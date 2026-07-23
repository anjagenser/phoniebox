# -*- coding: utf-8 -*-
"""
Package for interfacing with the MPD Music Player Daemon

Status information in three topics
1) Player Status: published only on change
  This is a subset of the MPD status (and not the full MPD status) ??
  - folder
  - song
  - volume (volume is published only via player status, and not separatly to avoid too many Threads)
  - ...
2) Elapsed time: published every 250 ms, unless constant
  - elapsed
3) Folder Config: published only on change
   This belongs to the folder being played
   Publish:
   - random, resume, single, loop
   On save store this information:
   Contains the information for resume functionality of each folder
   - random, resume, single, loop
   - if resume:
     - current song, elapsed
   - what is PLAYSTATUS for?
   When to save
   - on stop
   Angstsave:
   - on pause (only if box get turned off without proper shutdown - else stop gets implicitly called)
   - on status change of random, resume, single, loop (for resume omit current status if currently playing- this has now meaning)
   Load checks:
   - if resume, but no song, elapsed -> log error and start from the beginning

Status storing:
  - Folder config for each folder (see above)
  - Information to restart last folder playback, which is:
    - last_folder -> folder_on_close
    - song, elapsed
    - random, resume, single, loop
    - if resume is enabled, after start we need to set last_played_folder, such that card swipe is detected as second swipe?!
      on the other hand: if resume is enabled, this is also saved to folder.config -> and that is checked by play card

Internal status
  - last played folder: Needed to detect second swipe


Saving {'player_status': {'last_played_folder': 'TraumfaengerStarkeLieder', 'CURRENTSONGPOS': '0', 'CURRENTFILENAME': 'TraumfaengerStarkeLieder/01.mp3'},
'audio_folder_status':
{'TraumfaengerStarkeLieder': {'ELAPSED': '1.0', 'CURRENTFILENAME': 'TraumfaengerStarkeLieder/01.mp3', 'CURRENTSONGPOS': '0', 'PLAYSTATUS': 'stop', 'RESUME': 'OFF', 'SHUFFLE': 'OFF', 'LOOP': 'OFF', 'SINGLE': 'OFF'},
'Giraffenaffen': {'ELAPSED': '1.0', 'CURRENTFILENAME': 'TraumfaengerStarkeLieder/01.mp3', 'CURRENTSONGPOS': '0', 'PLAYSTATUS': 'play', 'RESUME': 'OFF', 'SHUFFLE': 'OFF', 'LOOP': 'OFF', 'SINGLE': 'OFF'}}}

References:
https://github.com/Mic92/python-mpd2
https://python-mpd2.readthedocs.io/en/latest/topics/commands.html
https://mpd.readthedocs.io/en/latest/protocol.html

sudo -u mpd speaker-test -t wav -c 2
"""  # noqa: E501
# Warum ist "Second Swipe" im Player und nicht im RFID Reader?
# Second swipe ist abhängig vom Player State - nicht vom RFID state.
# Beispiel: RFID triggered Folder1, Web App triggered Folder2, RFID Folder1:
# Dann muss das 2. Mal Folder1 auch als "first swipe" gewertet werden.
# Wenn der RFID das basierend auf IDs macht, kann der nicht  unterscheiden und glaubt es ist 2. Swipe.
# Beispiel 2: Jemand hat RFID Reader (oder 1x RFID und 1x Barcode Scanner oder so) angeschlossen. Liest zuerst Karte mit
# Reader 1 und dann mit Reader 2: Reader 2 weiß nicht, was bei Reader 1 passiert ist und denkt es ist 1. swipe.
# Beispiel 3: RFID trigered Folder1, Playlist läuft durch und hat schon gestoppt, dann wird die Karte wieder vorgehalten.
# Dann muss das als 1. Swipe gewertet werden
# Beispiel 4: RFID triggered "Folder1", dann wird Karte "Volume Up" aufgelegt, dann wieder Karte "Folder1": Auch das ist
# aus Sicht ders Playbacks 2nd Swipe
# 2nd Swipe ist keine im Reader festgelegte Funktion extra fur den Player.
#
# In der aktuellen Implementierung weiß der Player (der second "swipe" dekodiert) überhaupt nichts vom RFID.
# Im Prinzip gibt es zwei "Play" Funktionen: (1) play always from start und (2) play with toggle action.
# Die Web App ruft immer (1) auf und die RFID immer (2). Jetzt kann man sogar für einige Karten sagen
# immer (1) - also kein Second Swipe und für andere (2).
# Sollte der Reader das Swcond swipe dekodieren, muss aber der Reader den Status des Player kennen.
# Das ist allerdings ein Problem. In Version 2 ist das nicht aufgefallen,
# weil alles uber File I/Os lief - Thread safe ist das nicht!
#
# Beispiel: Second swipe bei anderen Funktionen, hier: WiFi on/off.
# Was die Karte Action tut ist ein Toggle. Der Toggle hängt vom Wifi State ab, den der RFID Kartenleser nicht kennt.
# Den kann der Leser auch nicht tracken. Der State kann ja auch über die Web App oder Kommandozeile geändert werden.
# Toggle (und 2nd Swipe generell) ist immer vom Status des Zielsystems abhängig und kann damit nur vom Zielsystem geändert
# werden. Bei Wifi also braucht man 3 Funktionen: on / off / toggle. Toggle ist dann first swipe / second swipe

import os
import re
import json
import subprocess
import urllib.parse
import urllib.request
import mpd
import threading
import logging
import time
import functools
from pathlib import Path
import components.player
import components.player.uri
from components.statistics import stats
import jukebox.cfghandler
import jukebox.utils as utils
import jukebox.plugs as plugs
import jukebox.multitimer as multitimer
import jukebox.publishing as publishing
import jukebox.playlistgenerator as playlistgenerator
import misc

from jukebox.NvManager import nv_manager
from .playcontentcallback import PlayContentCallbacks, PlayCardState
from .coverart_cache_manager import CoverartCacheManager

logger = logging.getLogger('jb.PlayerMPD')
cfg = jukebox.cfghandler.get_handler('jukebox')

# Cache of resolved URI -> {'name': str|None, 'image': str|None}, so the web app
# can render a readable card list without hitting Mopidy on every request.
_uri_details_cache = {}


class MpdLock:
    def __init__(self, client: mpd.MPDClient, host: str, port: int):
        self._lock = threading.RLock()
        self.client = client
        self.host = host
        self.port = port

    def _try_connect(self):
        try:
            self.client.connect(self.host, self.port)
        except mpd.base.ConnectionError:
            pass

    def __enter__(self):
        self._lock.acquire()
        self._try_connect()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self._lock.release()

    def acquire(self, blocking: bool = True, timeout: float = -1) -> bool:
        locked = self._lock.acquire(blocking, timeout)
        if locked:
            self._try_connect()
        return locked

    def release(self):
        self._lock.release()

    def locked(self):
        return self._lock.locked()


class PlayerMPD:
    """Interface to MPD Music Player Daemon"""

    def __init__(self):
        self.nvm = nv_manager()
        self.mpd_host = cfg.getn('playermpd', 'host')
        self.music_player_status = self.nvm.load(cfg.getn('playermpd', 'status_file'))

        self.second_swipe_action_dict = {'toggle': self.toggle,
                                         'play': self.play,
                                         'skip': self.next,
                                         'rewind': self.rewind,
                                         'replay': self.replay,
                                         'replay_if_stopped': self.replay_if_stopped}
        self.second_swipe_action = None
        self.decode_2nd_swipe_option()

        self.end_of_playlist_next_action = utils.get_config_action(cfg,
                                                                   'playermpd',
                                                                   'end_of_playlist_next_action',
                                                                   'none',
                                                                   {'rewind': self.rewind,
                                                                    'stop': self.stop,
                                                                    'none': lambda: None},
                                                                   logger)
        self.stopped_prev_action = utils.get_config_action(cfg,
                                                           'playermpd',
                                                           'stopped_prev_action',
                                                           'prev',
                                                           {'rewind': self.rewind,
                                                            'prev': self._prev_in_stopped_state,
                                                            'none': lambda: None},
                                                           logger)
        self.stopped_next_action = utils.get_config_action(cfg,
                                                          'playermpd',
                                                          'stopped_next_action',
                                                          'next',
                                                          {'rewind': self.rewind,
                                                           'next': self._next_in_stopped_state,
                                                           'none': lambda: None},
                                                          logger)

        self.mpd_client = mpd.MPDClient()
        self.coverart_cache_manager = CoverartCacheManager()

        # The timeout refer to the low-level socket time-out
        # If these are too short and the response is not fast enough (due to the PI being busy),
        # the current MPC command times out. Leave these at blocking calls, since we do not react on a timed out socket
        # in any relevant matter anyway
        self.mpd_client.timeout = None               # network timeout in seconds (floats allowed), default: None
        self.mpd_client.idletimeout = None           # timeout for fetching the result of the idle command
        self.connect()
        logger.info(f"Connected to MPD Version: {self.mpd_client.mpd_version}")
        self.player_backend = self._detect_backend()

        self.current_folder_status = {}
        if not self.music_player_status:
            self.music_player_status['player_status'] = {}
            self.music_player_status['audio_folder_status'] = {}
            self.music_player_status.save_to_json()
            self.current_folder_status = {}
            self.music_player_status['player_status']['last_played_folder'] = ''
        else:
            last_played_folder = self.music_player_status['player_status'].get('last_played_folder')
            if last_played_folder:
                # current_folder_status is a dict, but last_played_folder a str
                self.current_folder_status = self.music_player_status['audio_folder_status'][last_played_folder]
                # Restore the playlist status in mpd
                # But what about playback position?
                self.mpd_client.clear()
                #  This could fail and cause load fail of entire package:
                # self.mpd_client.add(last_played_folder)
                logger.info(f"Last Played Folder: {last_played_folder}")

        # Clear last folder played, as we actually did not play any folder yet
        # Needed for second swipe detection
        # TODO: This will loose the last_played_folder information is the box is started and closed with playing anything...
        # Change this to last_played_folder and shutdown_state (for restoring)
        self.music_player_status['player_status']['last_played_folder'] = ''

        self.old_song = None
        self.mpd_status = {}
        self.mpd_status_poll_interval = 0.25
        self.mpd_lock = MpdLock(self.mpd_client, self.mpd_host, 6600)
        self.status_is_closing = False
        # self.status_thread = threading.Timer(self.mpd_status_poll_interval, self._mpd_status_poll).start()

        self.status_thread = multitimer.GenericEndlessTimerClass('mpd.timer_status',
                                                                 self.mpd_status_poll_interval, self._mpd_status_poll)
        self.status_thread.start()

    def exit(self):
        logger.debug("Exit routine of playermpd started")
        self.status_is_closing = True
        self.status_thread.cancel()
        self.mpd_client.disconnect()
        self.nvm.save_all()
        return self.status_thread.timer_thread

    def connect(self):
        # At boot the jukebox daemon may come up before the MPD/Mopidy frontend
        # is listening on 6600. Without retrying, a single ConnectionRefusedError
        # aborts the whole 'player' plugin load and 'ctrl' never gets registered,
        # leaving the library dead until a manual restart. Retry with backoff so
        # a slow-to-start backend is tolerated.
        connect_timeout = float(cfg.setndefault('playermpd', 'connect_timeout', value=30))
        deadline = time.monotonic() + connect_timeout
        attempt = 0
        while True:
            attempt += 1
            try:
                self.mpd_client.connect(self.mpd_host, 6600)
                if attempt > 1:
                    logger.info(f"Connected to MPD at {self.mpd_host}:6600 after {attempt} attempts")
                return
            except (ConnectionRefusedError, OSError, mpd.base.ConnectionError) as e:
                if time.monotonic() >= deadline:
                    logger.error(f"Giving up connecting to MPD at {self.mpd_host}:6600 "
                                 f"after {connect_timeout:.0f}s ({attempt} attempts)")
                    raise
                logger.warning(f"MPD not ready at {self.mpd_host}:6600 "
                               f"({type(e).__name__}); retrying...")
                time.sleep(1.0)

    def _detect_backend(self) -> str:
        """Return the active player backend: ``'mopidy'`` or ``'mpd'``.

        Mopidy's MPD frontend and real MPD accept different URIs for local
        files (see :meth:`_music_file_uri`), so we must know which one we talk
        to. The backend can be forced via the ``playermpd.backend`` config key;
        otherwise it is auto-detected. Mopidy's MPD frontend always advertises
        protocol version ``0.19.0``, which no current real MPD reports.
        """
        backend = str(cfg.setndefault('playermpd', 'backend', value='auto')).lower()
        if backend in ('mopidy', 'mpd'):
            logger.info(f"Player backend forced to '{backend}' via config")
            return backend
        try:
            version = str(self.mpd_client.mpd_version)
        except Exception:
            version = ''
        detected = 'mopidy' if version == '0.19.0' else 'mpd'
        logger.info(f"Detected player backend '{detected}' (MPD protocol version '{version}')")
        return detected

    def _music_file_uri(self, path: str) -> str:
        """Convert a music-library file path into a URI the backend understands.

        The playlist generator yields absolute filesystem paths. Real MPD wants
        a path relative to its music directory, while Mopidy-Local wants a
        URL-encoded ``local:track:`` URI. Passing a raw filesystem path to
        Mopidy drops the connection, so this conversion is required. Values that
        already carry a URI scheme (``spotify:``, ``http:``, ``local:`` ...) are
        returned unchanged.
        """
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.\-]*:', path):
            return path
        base = components.player.get_music_library_path()
        relpath = os.path.relpath(path, base) if (base and os.path.isabs(path)) else path
        if getattr(self, 'player_backend', 'mpd') == 'mopidy':
            return 'local:track:' + urllib.parse.quote(relpath)
        return relpath

    def decode_2nd_swipe_option(self):
        cfg_2nd_swipe_action = cfg.setndefault('playermpd', 'second_swipe_action', 'alias', value='none').lower()
        if cfg_2nd_swipe_action not in [*self.second_swipe_action_dict.keys(), 'none', 'custom']:
            logger.error(f"Config mpd.second_swipe_action must be one of "
                         f"{[*self.second_swipe_action_dict.keys(), 'none', 'custom']}. Ignore setting.")
        if cfg_2nd_swipe_action in self.second_swipe_action_dict.keys():
            self.second_swipe_action = self.second_swipe_action_dict[cfg_2nd_swipe_action]
        if cfg_2nd_swipe_action == 'custom':
            custom_action = utils.decode_rpc_call(cfg.getn('playermpd', 'second_swipe_action', default=None))
            self.second_swipe_action = functools.partial(plugs.call_ignore_errors,
                                                         custom_action['package'],
                                                         custom_action['plugin'],
                                                         custom_action['method'],
                                                         custom_action['args'],
                                                         custom_action['kwargs'])

    @plugs.tag
    def get_second_swipe_option(self) -> str:
        """Get the current second-swipe action alias.

        :return: One of ``'toggle'``, ``'play'``, ``'skip'``, ``'rewind'``,
            ``'replay'``, ``'replay_if_stopped'``, ``'none'``
        """
        return cfg.getn('playermpd', 'second_swipe_action', 'alias', default='none')

    @plugs.tag
    def set_second_swipe_option(self, alias: str) -> str:
        """Set the second-swipe action and persist it to config.

        The change takes effect immediately without restarting the service.

        :param alias: One of ``'toggle'``, ``'play'``, ``'skip'``, ``'rewind'``,
            ``'replay'``, ``'replay_if_stopped'``, ``'none'``
        :return: The alias that was set
        """
        valid = [*self.second_swipe_action_dict.keys(), 'none']
        alias = alias.lower().strip()
        if alias not in valid:
            raise ValueError(f"Invalid second swipe alias {alias!r}. Must be one of: {valid}")
        cfg.setn('playermpd', 'second_swipe_action', 'alias', value=alias)
        cfg.save(only_if_changed=True)
        if alias == 'none':
            self.second_swipe_action = None
        else:
            self.second_swipe_action = self.second_swipe_action_dict[alias]
        logger.info(f"Second swipe option set to '{alias}'")
        return alias

    def mpd_retry_with_mutex(self, mpd_cmd, *args):
        """
        This method adds thread saftey for acceses to mpd via a mutex lock,
        it shall be used for each access to mpd to ensure thread safety
        In case of a communication error the connection will be reestablished and the pending command will be repeated 2 times

        I think this should be refactored to a decorator
        """
        with self.mpd_lock:
            try:
                value = mpd_cmd(*args)
            except Exception as e:
                logger.error(f"{e.__class__.__qualname__}: {e}")
                value = None
        return value

    def _mpd_status_poll(self):
        """
        this method polls the status from mpd and stores the important inforamtion in the music_player_status,
        it will repeat itself in the intervall specified by self.mpd_status_poll_interval
        """
        self.mpd_status.update(self.mpd_retry_with_mutex(self.mpd_client.status))
        self.mpd_status.update(self.mpd_retry_with_mutex(self.mpd_client.currentsong))

        if self.mpd_status.get('elapsed') is not None:
            self.current_folder_status["ELAPSED"] = self.mpd_status['elapsed']
            self.music_player_status['player_status']["CURRENTSONGPOS"] = self.mpd_status['song']
            self.music_player_status['player_status']["CURRENTFILENAME"] = self.mpd_status['file']

        if self.mpd_status.get('file') is not None:
            self.current_folder_status["CURRENTFILENAME"] = self.mpd_status['file']
            self.current_folder_status["CURRENTSONGPOS"] = self.mpd_status['song']
            self.current_folder_status["ELAPSED"] = self.mpd_status.get('elapsed', '0.0')
            self.current_folder_status["PLAYSTATUS"] = self.mpd_status['state']

        self._count_song_statistic()

        # Delete the volume key to avoid confusion
        # Volume is published via the 'volume' component!
        try:
            del self.mpd_status['volume']
        except KeyError:
            pass
        publishing.get_publisher().send('playerstatus', self.mpd_status)

    def _count_song_statistic(self):
        """Count a song play once, when the currently playing track changes.

        Called on every status poll; it records at most one play per song change
        while the player is actually playing.
        """
        if self.mpd_status.get('state') != 'play':
            return
        file = self.mpd_status.get('file')
        if not file or file == getattr(self, '_stats_last_counted_file', None):
            return
        self._stats_last_counted_file = file
        try:
            stats.count_song_play(
                file=file,
                title=self.mpd_status.get('title'),
                artist=self.mpd_status.get('artist'),
                album=self.mpd_status.get('album'),
            )
        except Exception as e:
            logger.error(f"Could not record song play statistic: {e}")

    # MPD can play absolute paths but can find songs in its database only by relative path
    # This function aims to prepare the song_url accordingly
    def harmonize_mpd_url(self, song_url):
        _music_library_path_absolute = os.path.expanduser(components.player.get_music_library_path())
        song_url = song_url.replace(f'{_music_library_path_absolute}/', '')

        return song_url

    @plugs.tag
    def get_player_type_and_version(self):
        with self.mpd_lock:
            value = self.mpd_client.mpd_version()
        return value

    def _mopidy_local_scan(self):
        """Rescan the local library on a Mopidy backend.

        Mopidy ignores the MPD ``update`` command for local files; the library
        is refreshed by running ``mopidy local scan`` as a separate process. The
        running Mopidy picks up the changes without a restart. The command is
        configurable via ``playermpd.library.mopidy_scan_command``.
        """
        cmd = cfg.setndefault('playermpd', 'library', 'mopidy_scan_command',
                              value=['mopidy', 'local', 'scan'])
        if isinstance(cmd, str):
            cmd = cmd.split()
        logger.info(f"Running Mopidy local scan: {' '.join(cmd)}")
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=600)
            if result.returncode != 0:
                logger.error(f"Mopidy local scan failed (rc={result.returncode}): "
                             f"{result.stderr.decode(errors='replace')[-500:]}")
        except (OSError, subprocess.TimeoutExpired) as e:
            logger.error(f"Mopidy local scan error: {e.__class__.__name__}: {e}")

    @plugs.tag
    def update(self):
        if getattr(self, 'player_backend', 'mpd') == 'mopidy':
            self._mopidy_local_scan()
            return 0
        with self.mpd_lock:
            state = self.mpd_client.update()
        return state

    @plugs.tag
    def update_wait(self):
        # On Mopidy the scan is already synchronous, so there is nothing to wait for
        if getattr(self, 'player_backend', 'mpd') == 'mopidy':
            self._mopidy_local_scan()
            return 0
        state = self.update()
        self._db_wait_for_update(state)
        return state

    @plugs.tag
    def play(self):
        with self.mpd_lock:
            self.mpd_client.play()

    @plugs.tag
    def stop(self):
        with self.mpd_lock:
            self.mpd_client.stop()

    @plugs.tag
    def pause(self, state: int = 1):
        """Enforce pause to state (1: pause, 0: resume)

        This is what you want as card removal action: pause the playback, so it can be resumed when card is placed
        on the reader again. What happens on re-placement depends on configured second swipe option
        """
        with self.mpd_lock:
            self.mpd_client.pause(state)

    @plugs.tag
    def prev(self):
        logger.debug("Prev")
        if self.mpd_status['state'] == 'stop':
            logger.debug('Player is stopped, calling stopped_prev_action')
            return self.stopped_prev_action()
        try:
            with self.mpd_lock:
                self.mpd_client.previous()
        except mpd.base.CommandError:
            # This shouldn't happen in reality, but we still catch
            # this error to avoid crashing the player thread:
            logger.warning('Failed to go to previous song, ignoring')

    def _prev_in_stopped_state(self):
        with self.mpd_lock:
            self.mpd_client.play(max(0, int(self.mpd_status['pos']) - 1))

    @plugs.tag
    def next(self):
        """Play next track in current playlist"""
        logger.debug("Next")
        if self.mpd_status['state'] == 'stop':
            logger.debug('Player is stopped, calling stopped_next_action')
            return self.stopped_next_action()
        playlist_len = int(self.mpd_status.get('playlistlength', -1))
        current_pos = int(self.mpd_status.get('pos', 0))
        if current_pos == playlist_len - 1:
            logger.debug(f'next() called during last song ({current_pos}) of '
                         f'playlist (len={playlist_len}), running end_of_playlist_next_action.')
            return self.end_of_playlist_next_action()
        try:
            with self.mpd_lock:
                self.mpd_client.next()
        except mpd.base.CommandError:
            # This shouldn't happen in reality, but we still catch
            # this error to avoid crashing the player thread:
            logger.warning('Failed to go to next song, ignoring')

    def _next_in_stopped_state(self):
        pos = int(self.mpd_status['pos']) + 1
        if pos > int(self.mpd_status['playlistlength']) - 1:
            return self.end_of_playlist_next_action()
        with self.mpd_lock:
            self.mpd_client.play(pos)

    @plugs.tag
    def seek(self, new_time):
        with self.mpd_lock:
            self.mpd_client.seekcur(new_time)

    @plugs.tag
    def rewind(self):
        """
        Re-start current playlist from first track

        Note: Will not re-read folder config, but leave settings untouched"""
        logger.debug("Rewind")
        with self.mpd_lock:
            self.mpd_client.play(0)

    @plugs.tag
    def replay(self):
        """
        Re-start playing the last-played folder

        Will reset settings to folder config"""
        logger.debug("Replay")
        with self.mpd_lock:
            self.play_folder(self.music_player_status['player_status']['last_played_folder'])

    @plugs.tag
    def toggle(self):
        """Toggle pause state, i.e. do a pause / resume depending on current state"""
        with self.mpd_lock:
            self.mpd_client.pause()

    @plugs.tag
    def replay_if_stopped(self):
        """
        Re-start playing the last-played folder unless playlist is still playing

        > [!NOTE]
        > To me this seems much like the behaviour of play,
        > but we keep it as it is specifically implemented in box 2.X"""
        with self.mpd_lock:
            if self.mpd_status['state'] == 'stop':
                self.play_folder(self.music_player_status['player_status']['last_played_folder'])

    # Shuffle
    def _shuffle(self, random):
        # As long as we don't work with waiting lists (aka playlist), this implementation is ok!
        self.mpd_retry_with_mutex(self.mpd_client.random, 1 if random else 0)

    @plugs.tag
    def shuffle(self, option='toggle'):
        if option == 'toggle':
            if self.mpd_status['random'] == '0':
                self._shuffle(1)
            else:
                self._shuffle(0)
        elif option == 'enable':
            self._shuffle(1)
        elif option == 'disable':
            self._shuffle(0)
        else:
            logger.error(f"'{option}' does not exist for 'shuffle'")

    # Repeat
    def _repeatmode(self, mode):
        if mode == 'repeat':
            repeat = 1
            single = 0
        elif mode == 'single':
            repeat = 1
            single = 1
        else:
            repeat = 0
            single = 0

        with self.mpd_lock:
            self.mpd_client.repeat(repeat)
            self.mpd_client.single(single)

    @plugs.tag
    def repeat(self, option='toggle'):
        if option == 'toggle':
            if self.mpd_status['repeat'] == '0':
                self._repeatmode('repeat')
            elif self.mpd_status['repeat'] == '1' and self.mpd_status['single'] == '0':
                self._repeatmode('single')
            else:
                self._repeatmode(None)
        elif option == 'toggle_repeat':
            if self.mpd_status['repeat'] == '0':
                self._repeatmode('repeat')
            else:
                self._repeatmode(None)
        elif option == 'toggle_repeat_single':
            if self.mpd_status['single'] == '0':
                self._repeatmode('single')
            else:
                self._repeatmode(None)
        elif option == 'enable_repeat':
            self._repeatmode('repeat')
        elif option == 'enable_repeat_single':
            self._repeatmode('single')
        elif option == 'disable':
            self._repeatmode(None)
        else:
            logger.error(f"'{option}' does not exist for 'repeat'")

    @plugs.tag
    def get_current_song(self, param):
        return self.mpd_status

    @plugs.tag
    def map_filename_to_playlist_pos(self, filename):
        # self.mpd_client.playlistfind()
        raise NotImplementedError

    @plugs.tag
    def remove(self):
        raise NotImplementedError

    @plugs.tag
    def move(self):
        # song_id = param.get("song_id")
        # step = param.get("step")
        # MPDClient.playlistmove(name, from, to)
        # MPDClient.swapid(song1, song2)
        raise NotImplementedError

    @plugs.tag
    def play_single(self, song_url):
        with self.mpd_lock:
            self.mpd_client.clear()
            self.mpd_client.addid(self._music_file_uri(song_url))
            self.mpd_client.play()

    @plugs.tag
    def play_uri(self, uri: str) -> None:
        """Play a Mopidy URI directly (Spotify album, playlist, track, or artist).

        Accepts both Mopidy-style URIs (``spotify:album:xxx``) and
        ``https://open.spotify.com/...`` URLs, which are converted automatically.

        Requires Mopidy with Mopidy-Spotify as the music backend.
        Example card config::

            action:
              alias: play_uri
              args:
                uri: "spotify:album:4aawyAB9vmqN3uQ7FjRGTy"
        """
        uri = components.player.uri.normalize_uri(uri)
        logger.info(f"play_uri: '{uri}'")
        # Second-swipe handling (mirrors play_card): re-placing the same card that is
        # already loaded runs the configured second_swipe_action (e.g. 'play' to resume
        # from pause) instead of clearing and restarting from the beginning. With
        # place-not-swipe this gives: place -> play, remove -> pause, place -> resume.
        with self.mpd_lock:
            is_second_swipe = self.music_player_status['player_status']['last_played_folder'] == uri
        if self.second_swipe_action is not None and is_second_swipe:
            logger.debug('play_uri: calling second swipe action')
            self.second_swipe_action()
            return
        with self.mpd_lock:
            self.mpd_client.clear()
            self.mpd_client.add(uri)
            self.music_player_status['player_status']['last_played_folder'] = uri
            self.current_folder_status = self.music_player_status['audio_folder_status'].get(uri)
            if self.current_folder_status is None:
                self.current_folder_status = self.music_player_status['audio_folder_status'][uri] = {}
            self.mpd_client.play()

    def _mopidy_rpc(self, method: str, params: dict):
        """Call Mopidy's HTTP JSON-RPC API and return the ``result`` field.

        Uses the same host as the MPD connection and Mopidy's default HTTP port
        (6680, configurable via ``playermpd.mopidy_http_port``). Raises on a
        transport error or a JSON-RPC error response.
        """
        host = self.mpd_host or 'localhost'
        port = cfg.setndefault('playermpd', 'mopidy_http_port', value=6680)
        url = f'http://{host}:{port}/mopidy/rpc'
        payload = json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params
        }).encode('utf-8')
        request = urllib.request.Request(
            url, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=3) as response:
            data = json.loads(response.read().decode('utf-8'))
        if data.get('error') is not None:
            raise RuntimeError(data['error'])
        return data.get('result')

    def _resolve_uri_image(self, uri: str):
        """Return the largest available cover image URL for a URI, or ``None``."""
        try:
            result = self._mopidy_rpc('core.library.get_images', {'uris': [uri]})
            images = (result or {}).get(uri) or []
            if not images:
                return None
            # Prefer the largest image (fall back to the first if sizes missing)
            best = max(images, key=lambda i: (i.get('width') or 0) * (i.get('height') or 0))
            return best.get('uri')
        except Exception as e:
            logger.debug(f"_resolve_uri_image('{uri}') failed: {e.__class__.__name__}: {e}")
            return None

    def _resolve_uri_details(self, uri: str):
        """Resolve a URI to ``{'name': ..., 'image': ...}`` via Mopidy (cached)."""
        empty = {'name': None, 'image': None}
        if not uri:
            return dict(empty)
        uri = components.player.uri.normalize_uri(uri)
        if getattr(self, 'player_backend', 'mpd') != 'mopidy':
            return dict(empty)
        if uri in _uri_details_cache:
            return dict(_uri_details_cache[uri])

        name = None
        try:
            if ':playlist:' in uri:
                playlist = self._mopidy_rpc('core.playlists.lookup', {'uri': uri})
                if playlist:
                    name = playlist.get('name')
            else:
                result = self._mopidy_rpc('core.library.lookup', {'uris': [uri]})
                tracks = (result or {}).get(uri) or []
                if tracks:
                    track = tracks[0]
                    if ':album:' in uri:
                        name = (track.get('album') or {}).get('name')
                    elif ':artist:' in uri:
                        artists = track.get('artists') or []
                        name = artists[0].get('name') if artists else None
                    else:
                        name = track.get('name')
        except Exception as e:
            logger.debug(f"_resolve_uri_details('{uri}') failed: {e.__class__.__name__}: {e}")
            return dict(empty)

        details = {'name': name, 'image': self._resolve_uri_image(uri)}
        _uri_details_cache[uri] = details
        return dict(details)

    @plugs.tag
    def get_uri_name(self, uri: str):
        """Resolve a playback URI to a human-readable name.

        For Spotify URIs (and other Mopidy-backed URIs) this returns the name of
        the playlist, album, artist or track, so the web app can show a readable
        label on the cards tab instead of the raw URI. Returns ``None`` when the
        name cannot be resolved (real MPD backend, Mopidy unreachable, or an
        unknown/invalid URI).
        """
        return self._resolve_uri_details(uri).get('name')

    @plugs.tag
    def get_uri_details(self, uri: str):
        """Resolve a playback URI to ``{'name': ..., 'image': ...}``.

        ``image`` is a cover-art URL (e.g. a Spotify image) or ``None``. Used by
        the web app to show a readable label and cover on the cards tab.
        """
        return self._resolve_uri_details(uri)

    @plugs.tag
    def resume(self):
        with self.mpd_lock:
            songpos = self.current_folder_status["CURRENTSONGPOS"]
            elapsed = self.current_folder_status["ELAPSED"]
            self.mpd_client.seek(songpos, elapsed)
            self.mpd_client.play()

    @plugs.tag
    def play_card(self, folder: str, recursive: bool = False):
        """
        Main entry point for trigger music playing from RFID reader. Decodes second swipe options before playing folder content

        Checks for second (or multiple) trigger of the same folder and calls first swipe / second swipe action
        accordingly.

        :param folder: Folder path relative to music library path
        :param recursive: Add folder recursively
        """
        # Developers notes:
        #
        #     * 2nd swipe trigger may also happen, if playlist has already stopped playing
        #       --> Generally, treat as first swipe
        #     * 2nd swipe of same Card ID may also happen if a different song has been played in between from WebUI
        #       --> Treat as first swipe
        #     * With place-not-swipe: Card is placed on reader until playlist expieres. Music stop. Card is removed and
        #       placed again on the reader: Should be like first swipe
        #     * TODO: last_played_folder is restored after box start, so first swipe of last played card may look like
        #       second swipe
        #
        logger.debug(f"last_played_folder = {self.music_player_status['player_status']['last_played_folder']}")
        with self.mpd_lock:
            is_second_swipe = self.music_player_status['player_status']['last_played_folder'] == folder
        if self.second_swipe_action is not None and is_second_swipe:
            logger.debug('Calling second swipe action')

            # run callbacks before second_swipe_action is invoked
            play_card_callbacks.run_callbacks(folder, PlayCardState.secondSwipe)

            self.second_swipe_action()
        else:
            logger.debug('Calling first swipe action')

            # run callbacks before play_folder is invoked
            play_card_callbacks.run_callbacks(folder, PlayCardState.firstSwipe)

            self.play_folder(folder, recursive)

    @plugs.tag
    def get_single_coverart(self, song_url):
        mp3_file_path = Path(components.player.get_music_library_path(), song_url).expanduser()
        cache_filename = self.coverart_cache_manager.get_cache_filename(mp3_file_path)

        return cache_filename

    @plugs.tag
    def get_album_coverart(self, albumartist: str, album: str):
        song_list = self.list_songs_by_artist_and_album(albumartist, album)

        return self.get_single_coverart(song_list[0]['file'])

    @plugs.tag
    def flush_coverart_cache(self):
        """
        Deletes the Cover Art Cache
        """

        return self.coverart_cache_manager.flush_cache()

    @plugs.tag
    def get_folder_content(self, folder: str):
        """
        Get the folder content as content list with meta-information. Depth is always 1.

        Call repeatedly to descend in hierarchy

        :param folder: Folder path relative to music library path
        """
        plc = playlistgenerator.PlaylistCollector(components.player.get_music_library_path())
        plc.get_directory_content(folder)
        return plc.playlist

    @plugs.tag
    def get_folder_config(self, folder: str) -> dict:
        """Get playback configuration for a folder.

        Returns per-folder settings controlling how the folder is played back.
        All keys default to ``False`` if no config has been saved yet.

        :param folder: Folder path relative to music library path
        :return: Dict with boolean keys ``resume``, ``shuffle``, ``loop``, ``single``
        """
        cfg_store = self.music_player_status.setdefault('folder_config', {})
        defaults = {'resume': False, 'shuffle': False, 'loop': False, 'single': False}
        return {**defaults, **cfg_store.get(folder, {})}

    @plugs.tag
    def set_folder_config(self, folder: str, resume: bool = None,
                          shuffle: bool = None, loop: bool = None,
                          single: bool = None) -> dict:
        """Set playback configuration for a folder.

        Only the keys that are explicitly passed (not ``None``) are updated.
        Settings take effect the next time the folder is played.

        :param folder: Folder path relative to music library path
        :param resume: Resume playback from last position
        :param shuffle: Randomise playback order
        :param loop: Repeat playlist when finished
        :param single: Repeat single song
        :return: Updated config dict (same shape as :meth:`get_folder_config`)
        """
        cfg_store = self.music_player_status.setdefault('folder_config', {})
        folder_cfg = cfg_store.setdefault(folder, {})
        if resume is not None:
            folder_cfg['resume'] = bool(resume)
        if shuffle is not None:
            folder_cfg['shuffle'] = bool(shuffle)
        if loop is not None:
            folder_cfg['loop'] = bool(loop)
        if single is not None:
            folder_cfg['single'] = bool(single)
        self.music_player_status.save_to_json()
        defaults = {'resume': False, 'shuffle': False, 'loop': False, 'single': False}
        return {**defaults, **folder_cfg}

    @plugs.tag
    def play_folder(self, folder: str, recursive: bool = False) -> None:
        """
        Playback a music folder.

        Folder content is added to the playlist as described by :mod:`jukebox.playlistgenerator`.
        The playlist is cleared first. Per-folder config (shuffle, loop, single, resume) is applied
        automatically.

        :param folder: Folder path relative to music library path
        :param recursive: Add folder recursively
        """
        with self.mpd_lock:
            logger.info(f"Play folder: '{folder}'")

            folder_cfg = self.get_folder_config(folder)

            self.mpd_client.clear()
            self.mpd_client.random(1 if folder_cfg.get('shuffle') else 0)
            self.mpd_client.repeat(1 if folder_cfg.get('loop') or folder_cfg.get('single') else 0)
            self.mpd_client.single(1 if folder_cfg.get('single') else 0)

            plc = playlistgenerator.PlaylistCollector(components.player.get_music_library_path())
            plc.parse(folder, recursive)
            uri = '--unset--'
            try:
                for uri in plc:
                    self.mpd_client.addid(self._music_file_uri(uri))
            except mpd.base.CommandError as e:
                logger.error(f"{e.__class__.__qualname__}: {e} at uri {uri}")
            except Exception as e:
                logger.error(f"{e.__class__.__qualname__}: {e} at uri {uri}")

            self.music_player_status['player_status']['last_played_folder'] = folder

            self.current_folder_status = self.music_player_status['audio_folder_status'].get(folder)
            if self.current_folder_status is None:
                self.current_folder_status = self.music_player_status['audio_folder_status'][folder] = {}

            resume_songpos = None
            resume_elapsed = None
            if folder_cfg.get('resume'):
                try:
                    songpos = self.current_folder_status.get('CURRENTSONGPOS')
                    elapsed = self.current_folder_status.get('ELAPSED')
                    if songpos is not None and elapsed is not None:
                        resume_songpos = int(songpos)
                        resume_elapsed = float(elapsed)
                        if resume_elapsed <= 0:
                            resume_songpos = None
                            resume_elapsed = None
                except (ValueError, TypeError):
                    pass

            if resume_songpos is not None:
                logger.info(f"Resuming from song {resume_songpos} at {resume_elapsed:.1f}s")
                self.mpd_client.play(resume_songpos)
                try:
                    self.mpd_client.seekcur(resume_elapsed)
                except Exception as e:
                    logger.warning(f"Could not seek to resume position: {e}")
            else:
                self.mpd_client.play()

    @plugs.tag
    def play_album(self, albumartist: str, album: str):
        """
        Playback a album found in MPD database.

        All album songs are added to the playlist
        The playlist is cleared first.

        :param albumartist: Artist of the Album provided by MPD database
        :param album: Album name provided by MPD database
        """
        with self.mpd_lock:
            logger.info(f"Play album: '{album}' by '{albumartist}")
            self.mpd_client.clear()
            self.mpd_retry_with_mutex(self.mpd_client.findadd, 'albumartist', albumartist, 'album', album)
            self.mpd_client.play()

    @plugs.tag
    def queue_load(self, folder):
        # There was something playing before -> stop and save state
        # Clear the queue
        # Check / Create the playlist
        #  - not needed if same folder is played again? Buf what if files have been added a mpc update has been run?
        #  - and this a re-trigger to start the new playlist
        # If we must update the playlists everytime anyway why write them to file and not just keep them in the queue?
        # Load the playlist
        # Get folder config and apply settings
        pass

    @plugs.tag
    def playerstatus(self):
        return self.mpd_status

    @plugs.tag
    def playlistinfo(self):
        with self.mpd_lock:
            value = self.mpd_client.playlistinfo()
        return value

    # Attention: MPD.listal will consume a lot of memory with large libs.. should be refactored at some point
    @plugs.tag
    def list_all_dirs(self):
        with self.mpd_lock:
            result = self.mpd_client.listall()
            # list = [entry for entry in list if 'directory' in entry]
        return result

    @plugs.tag
    def list_albums(self):
        with self.mpd_lock:
            album_list = self.mpd_retry_with_mutex(self.mpd_client.list, 'album', 'group', 'albumartist')

        return album_list

    @plugs.tag
    def list_songs_by_artist_and_album(self, albumartist, album):
        with self.mpd_lock:
            song_list = self.mpd_retry_with_mutex(self.mpd_client.find, 'albumartist', albumartist, 'album', album)

        return song_list

    @plugs.tag
    def get_song_by_url(self, song_url):
        song_url = self.harmonize_mpd_url(song_url)

        with self.mpd_lock:
            song = self.mpd_retry_with_mutex(self.mpd_client.find, 'file', song_url)

        return song

    def get_volume(self):
        """
        Get the current volume

        For volume control do not use directly, but use through the plugin 'volume',
        as the user may have configured a volume control manager other than MPD"""
        with self.mpd_lock:
            volume = self.mpd_client.status().get('volume')
        return int(volume)

    def set_volume(self, volume):
        """
        Set the volume

        For volume control do not use directly, but use through the plugin 'volume',
        as the user may have configured a volume control manager other than MPD"""
        with self.mpd_lock:
            self.mpd_client.setvol(volume)
        return self.get_volume()

    def _db_wait_for_update(self, update_id: int):
        logger.debug("Waiting for update to finish")
        while self._db_is_updating(update_id):
            # a little throttling
            time.sleep(0.1)

    def _db_is_updating(self, update_id: int):
        with self.mpd_lock:
            _status = self.mpd_client.status()
            _cur_update_id = _status.get('updating_db')
            if _cur_update_id is not None and int(_cur_update_id) <= int(update_id):
                return True
            else:
                return False


# ---------------------------------------------------------------------------
# Plugin Initializer / Finalizer
# ---------------------------------------------------------------------------

player_ctrl: PlayerMPD
#: Callback handler instance for play_card events.
#: - is executed when play_card function is called
#: States:
#: - See :class:`PlayCardState`
#: See :class:`PlayContentCallbacks`
play_card_callbacks: PlayContentCallbacks[PlayCardState]


@plugs.initialize
def initialize():
    global player_ctrl
    player_ctrl = PlayerMPD()
    plugs.register(player_ctrl, name='ctrl')

    global play_card_callbacks
    play_card_callbacks = PlayContentCallbacks[PlayCardState]('play_card_callbacks', logger, context=player_ctrl.mpd_lock)

    # Update mpc library
    library_update = cfg.setndefault('playermpd', 'library', 'update_on_startup', value=True)
    if library_update:
        player_ctrl.update()

    # Check user rights on music library — run in background; can be slow on large libraries
    library_check_user_rights = cfg.setndefault('playermpd', 'library', 'check_user_rights', value=True)
    if library_check_user_rights is True:
        music_library_path = components.player.get_music_library_path()
        if music_library_path is not None:
            logger.info(f"Change user rights for {music_library_path} (background thread)")
            threading.Thread(
                target=misc.recursive_chmod,
                args=[music_library_path],
                kwargs={'mode_files': 0o666, 'mode_dirs': 0o777},
                daemon=True,
                name='chmod.audiofolders',
            ).start()


@plugs.atexit
def atexit(**ignored_kwargs):
    global player_ctrl
    return player_ctrl.exit()
