"""
Usage statistics store

Keeps persistent counters for

* how often each RFID card has been swiped
* how often each song has been played

The store is a plain helper (not a plugin package on its own): it is imported
and fed by the already-loaded ``rfid`` reader and ``player`` components, and read
out via RPC functions registered in the already-loaded ``misc`` package. This
avoids introducing a new named module (which would require a config migration on
existing boxes).

Data is persisted as a small JSON file. Writes happen immediately after each
counted event so the numbers survive an abrupt power-off (a common way a
Phoniebox is switched off).
"""

import json
import os
import threading
import time
import logging

import jukebox.cfghandler

logger = logging.getLogger('jb.stats')
cfg = jukebox.cfghandler.get_handler('jukebox')

#: Default location, mirrors where the player status file lives
DEFAULT_STATISTICS_FILE = '../../shared/settings/statistics.json'


class StatisticsStore:
    """Thread-safe counter store shared across the reader, player and RPC threads."""

    def __init__(self):
        self._lock = threading.RLock()
        self._loaded = False
        self._path = None
        self._data = {'cards': {}, 'songs': {}}

    # -- persistence ------------------------------------------------------
    def _resolve_path(self):
        try:
            return cfg.getn('misc', 'statistics_file', default=DEFAULT_STATISTICS_FILE)
        except Exception:
            return DEFAULT_STATISTICS_FILE

    def _ensure_loaded(self):
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            self._path = self._resolve_path()
            data = {'cards': {}, 'songs': {}}
            try:
                if os.path.isfile(self._path):
                    with open(self._path) as stream:
                        stored = json.load(stream)
                    if isinstance(stored, dict):
                        data['cards'] = stored.get('cards', {}) or {}
                        data['songs'] = stored.get('songs', {}) or {}
            except Exception as e:
                logger.error(f"Could not read statistics file '{self._path}': {e}")
            self._data = data
            self._loaded = True

    def _save(self):
        if not self._path:
            return
        try:
            with open(self._path, 'w') as stream:
                json.dump(self._data, stream, indent=2)
        except Exception as e:
            logger.error(f"Could not write statistics file '{self._path}': {e}")

    # -- counting ---------------------------------------------------------
    def count_card_swipe(self, card_id):
        """Increment the swipe counter for a card id."""
        if not card_id:
            return
        card_id = str(card_id)
        with self._lock:
            self._ensure_loaded()
            entry = self._data['cards'].get(card_id, {'count': 0})
            entry['count'] = int(entry.get('count', 0)) + 1
            entry['last_swiped'] = time.time()
            self._data['cards'][card_id] = entry
            self._save()

    def count_song_play(self, file, title=None, artist=None, album=None):
        """Increment the play counter for a song, keyed by its file/uri."""
        if not file:
            return
        with self._lock:
            self._ensure_loaded()
            entry = self._data['songs'].get(file, {'count': 0})
            entry['count'] = int(entry.get('count', 0)) + 1
            entry['last_played'] = time.time()
            # Keep the latest known metadata for a readable display
            if title:
                entry['title'] = title
            if artist:
                entry['artist'] = artist
            if album:
                entry['album'] = album
            self._data['songs'][file] = entry
            self._save()

    # -- read out ---------------------------------------------------------
    def get_statistics(self, limit=None):
        """Return sorted statistics.

        :param limit: Optionally limit each list to the top ``limit`` entries.
        :return: dict with ``cards`` and ``songs`` lists (most frequent first)
            and ``total_swipes`` / ``total_plays`` totals.
        """
        with self._lock:
            self._ensure_loaded()
            cards = [
                {
                    'card_id': card_id,
                    'count': int(entry.get('count', 0)),
                    'last_swiped': entry.get('last_swiped'),
                }
                for card_id, entry in self._data['cards'].items()
            ]
            songs = [
                {
                    'file': file,
                    'count': int(entry.get('count', 0)),
                    'title': entry.get('title'),
                    'artist': entry.get('artist'),
                    'album': entry.get('album'),
                    'last_played': entry.get('last_played'),
                }
                for file, entry in self._data['songs'].items()
            ]
            total_swipes = sum(c['count'] for c in cards)
            total_plays = sum(s['count'] for s in songs)

        cards.sort(key=lambda c: c['count'], reverse=True)
        songs.sort(key=lambda s: s['count'], reverse=True)
        if limit is not None and limit > 0:
            cards = cards[:limit]
            songs = songs[:limit]
        return {
            'cards': cards,
            'songs': songs,
            'total_swipes': total_swipes,
            'total_plays': total_plays,
        }

    def reset(self):
        """Clear all statistics and persist the empty store."""
        with self._lock:
            self._ensure_loaded()
            self._data = {'cards': {}, 'songs': {}}
            self._save()


#: Shared singleton used by the reader, player and misc RPC functions
stats = StatisticsStore()
