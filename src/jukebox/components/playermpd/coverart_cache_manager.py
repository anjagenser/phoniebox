from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC
from pathlib import Path
import hashlib
import logging
import urllib.request
from queue import Queue
from threading import Thread
import jukebox.cfghandler

COVER_PREFIX = 'cover'
NO_COVER_ART_EXTENSION = 'no-art'
NO_CACHE = ''
CACHE_PENDING = 'CACHE_PENDING'

logger = logging.getLogger('jb.CoverartCacheManager')
cfg = jukebox.cfghandler.get_handler('jukebox')


class CoverartCacheManager:
    def __init__(self):
        coverart_cache_path = cfg.setndefault('webapp', 'coverart_cache_path', value='../../src/webapp/build/cover-cache')
        self.cache_folder_path = Path(coverart_cache_path).expanduser()
        self.write_queue = Queue()
        self.worker_thread = Thread(target=self.process_write_requests)
        self.worker_thread.daemon = True
        self.worker_thread.start()

    def generate_cache_key(self, base_filename: str) -> str:
        return f"{COVER_PREFIX}-{hashlib.sha256(base_filename.encode()).hexdigest()}"

    def _find_cached(self, cache_key: str):
        """Return the cached filename for a key, NO_CACHE for a no-art marker, or
        None if not cached. Uses direct ``exists()`` probes (O(1)) instead of
        scanning the whole cache directory on every lookup — the previous
        ``iterdir()`` made browsing folders with many items flood and time out
        the single-threaded RPC server. Falls back to a glob only on a miss, to
        still catch the rare non-jpg/png extension."""
        if not self.cache_folder_path.exists():
            return None
        if (self.cache_folder_path / f"{cache_key}.{NO_COVER_ART_EXTENSION}").exists():
            return NO_CACHE
        for ext in ('jpg', 'jpeg', 'png'):
            candidate = self.cache_folder_path / f"{cache_key}.{ext}"
            if candidate.exists():
                return candidate.name
        return None

    def get_cache_filename(self, mp3_file_path: str) -> str:
        base_filename = Path(mp3_file_path).stem
        cache_key = self.generate_cache_key(base_filename)

        hit = self._find_cached(cache_key)
        if hit is not None:
            return hit

        self.save_to_cache(mp3_file_path)
        return CACHE_PENDING

    def save_to_cache(self, mp3_file_path: str):
        self.write_queue.put(mp3_file_path)

    def lookup_remote(self, cache_id: str) -> str:
        """Return the cached filename for a previously-downloaded remote image.

        ``cache_id`` is any stable string (e.g. a Spotify URI). Returns the
        filename if already cached, ``NO_CACHE`` ('') if a no-art marker exists,
        or ``None`` if it has not been downloaded yet.
        """
        cache_key = self.generate_cache_key(cache_id)
        return self._find_cached(cache_key)

    def cache_remote(self, cache_id: str, url: str) -> str:
        """Ensure a remote image URL is cached locally; return its filename.

        Returns the filename if already cached, otherwise queues a background
        download (so the caller/RPC thread is never blocked on the network) and
        returns ``CACHE_PENDING``.
        """
        existing = self.lookup_remote(cache_id)
        if existing is not None:
            return existing
        self.write_queue.put(('remote', cache_id, url))
        return CACHE_PENDING

    def _save_remote_to_cache(self, cache_id: str, url: str):
        cache_key = self.generate_cache_key(cache_id)
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'phoniebox'})
            with urllib.request.urlopen(request, timeout=10) as response:
                data = response.read()
                content_type = response.headers.get('Content-Type', 'image/jpeg')
        except Exception as e:
            # Leave it uncached so it is retried on a later request (do not write
            # a no-art marker for a transient network/Spotify failure).
            logger.error(f"Error downloading cover art from {url}: {e}")
            return

        file_extension = ('jpg' if 'jpeg' in content_type or 'jpg' in content_type
                          else (content_type.split('/')[-1].split(';')[0] or 'jpg'))
        cache_filename = f"{cache_key}.{file_extension}"
        self.cache_folder_path.mkdir(parents=True, exist_ok=True)
        with (self.cache_folder_path / cache_filename).open('wb') as file:
            file.write(data)
            logger.debug(f"Cached remote cover: {cache_filename}")

    def _save_to_cache(self, mp3_file_path: str):
        base_filename = Path(mp3_file_path).stem
        cache_key = self.generate_cache_key(base_filename)

        file_extension, data = self._extract_album_art(mp3_file_path)
        if file_extension == NO_COVER_ART_EXTENSION:  # Check if cover has been added as separate file in folder
            file_extension, data = self._get_from_filesystem(mp3_file_path)

        cache_filename = f"{cache_key}.{file_extension}"
        full_path = self.cache_folder_path / cache_filename

        with full_path.open('wb') as file:
            file.write(data)
            logger.debug(f"Created file: {cache_filename}")

        return cache_filename

    def _extract_album_art(self, mp3_file_path: str) -> tuple:
        try:
            audio_file = MP3(mp3_file_path, ID3=ID3)
        except Exception as e:
            logger.error(f"Error reading MP3 file {mp3_file_path}: {e}")
            return (NO_COVER_ART_EXTENSION, b'')

        # An MP3 without any ID3 tags has ``tags is None``; fall through to the
        # filesystem cover.* lookup instead of raising.
        if not audio_file.tags:
            return (NO_COVER_ART_EXTENSION, b'')

        for tag in audio_file.tags.values():
            if isinstance(tag, APIC):
                if tag.mime and tag.data:
                    # Only ever produce jpg/png so the O(1) cache lookup (which
                    # probes those extensions) always finds the file again.
                    file_extension = 'png' if tag.mime == 'image/png' else 'jpg'
                    return (file_extension, tag.data)

        return (NO_COVER_ART_EXTENSION, b'')

    def _get_from_filesystem(self, mp3_file_path: str) -> tuple:
        path = Path(mp3_file_path)
        directory = path.parent
        cover_files = list(directory.glob('Cover.*')) + list(directory.glob('cover.*'))

        for file in cover_files:
            if file.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                with file.open('rb') as img_file:
                    data = img_file.read()
                    file_extension = file.suffix[1:]
                    return (file_extension, data)

        return (NO_COVER_ART_EXTENSION, b'')

    def process_write_requests(self):
        while True:
            item = self.write_queue.get()
            try:
                if isinstance(item, tuple) and item and item[0] == 'remote':
                    _, cache_id, url = item
                    self._save_remote_to_cache(cache_id, url)
                else:
                    self._save_to_cache(item)
            except Exception as e:
                logger.error(f"Error processing write request: {e}")
            self.write_queue.task_done()

    def flush_cache(self):
        for path in self.cache_folder_path.iterdir():
            if path.is_file():
                path.unlink()
                logger.debug(f"Deleted cached file: {path.name}")
        logger.info("Cache flushed successfully.")
