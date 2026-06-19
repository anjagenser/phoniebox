import os
import re
import logging
import jukebox.cfghandler
from typing import Optional


logger = logging.getLogger('jb.player')
cfg = jukebox.cfghandler.get_handler('jukebox')


def _get_music_library_path(conf_file):
    """Parse the music directory from the mpd.conf file"""
    pattern = re.compile(r'^\s*music_directory\s*"(.*)"', re.I)
    directory = None
    with open(conf_file, 'r') as f:
        for line in f:
            res = pattern.match(line)
            if res:
                directory = res.group(1)
                break
        else:
            logger.error(f"Could not find music library path in {conf_file}")
    logger.debug(f"MPD music lib path = {directory}; from {conf_file}")
    return directory


class MusicLibPath:
    """Extract the music directory from config or, as fallback, from mpd.conf"""
    def __init__(self):
        self._music_library_path = None
        # Prefer the direct config entry written during installation — works with both MPD and Mopidy
        direct_path = cfg.getn('playermpd', 'library', 'path', default=None)
        if direct_path:
            self._music_library_path = os.path.expanduser(str(direct_path))
            logger.debug(f"Music lib path = {self._music_library_path}; from jukebox config")
            return
        # Fall back to parsing mpd.conf for setups predating the library.path config key
        mpd_conf_file = cfg.setndefault('playermpd', 'mpd_conf', value='~/.config/mpd/mpd.conf')
        try:
            self._music_library_path = _get_music_library_path(os.path.expanduser(mpd_conf_file))
        except Exception as e:
            logger.error(f"Could not determine music library directory from '{mpd_conf_file}'")
            logger.error(f"Reason: {e.__class__.__name__}: {e}")

    @property
    def music_library_path(self):
        return self._music_library_path


# ---------------------------------------------------------------------------


_MUSIC_LIBRARY_PATH: Optional[MusicLibPath] = None


def get_music_library_path():
    """Get the music library path"""
    global _MUSIC_LIBRARY_PATH
    if _MUSIC_LIBRARY_PATH is None:
        _MUSIC_LIBRARY_PATH = MusicLibPath()
    return _MUSIC_LIBRARY_PATH.music_library_path
