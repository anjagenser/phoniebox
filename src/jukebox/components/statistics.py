"""
Usage statistics store

Keeps persistent counters for

* how often each RFID card has been swiped
* how often each song has been played

Next to the all-time counters, per-month buckets are kept so historic top lists
(per month and, aggregated from the months, per year) can be reported.

Only actual usage is counted: a swipe or a song counts once it has been in use
for at least ``misc.statistics_min_play_seconds`` (20 s by default). Cards that
are swiped away again and songs that are skipped early leave no trace.

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

DEFAULT_STATISTICS_FILE = '../../shared/settings/statistics.json'
DEFAULT_MIN_PLAY_SECONDS = 20


class StatisticsStore:
    """Thread-safe counter store shared across the reader, player and RPC threads."""

    def __init__(self):
        self._lock = threading.RLock()
        self._loaded = False
        self._path = None
        self._data = {'cards': {}, 'songs': {}, 'history': {}}
        self._pending_card = None
        self._pending_token = 0

    def _resolve_path(self):
        try:
            return cfg.getn('misc', 'statistics_file', default=DEFAULT_STATISTICS_FILE)
        except Exception:
            return DEFAULT_STATISTICS_FILE

    def min_play_seconds(self):
        """Minimum time a card or song must be in use before it is counted."""
        try:
            return float(cfg.getn('misc', 'statistics_min_play_seconds',
                                  default=DEFAULT_MIN_PLAY_SECONDS))
        except Exception:
            return float(DEFAULT_MIN_PLAY_SECONDS)

    def _ensure_loaded(self):
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            self._path = self._resolve_path()
            data = {'cards': {}, 'songs': {}, 'history': {}}
            try:
                if os.path.isfile(self._path):
                    with open(self._path) as stream:
                        stored = json.load(stream)
                    if isinstance(stored, dict):
                        data['cards'] = stored.get('cards', {}) or {}
                        data['songs'] = stored.get('songs', {}) or {}
                        data['history'] = stored.get('history', {}) or {}
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

    def _count_in_month(self, kind, key, timestamp):
        month = time.strftime('%Y-%m', time.localtime(timestamp))
        bucket = self._data['history'].setdefault(month, {})
        counters = bucket.setdefault(kind, {})
        counters[key] = int(counters.get(key, 0)) + 1

    def count_card_swipe(self, card_id):
        """Register a card swipe; it is counted once the card stayed in use long enough.

        A swipe that is replaced by another card before the minimum time has
        passed is dropped, so briefly presented cards do not show up.
        """
        if not card_id:
            return
        card_id = str(card_id)
        delay = self.min_play_seconds()
        with self._lock:
            self._cancel_pending_card()
            if delay <= 0:
                self._record_card_swipe(card_id)
                return
            self._pending_token += 1
            token = self._pending_token
            timer = threading.Timer(delay, self._confirm_card_swipe, args=(card_id, token))
            timer.daemon = True
            self._pending_card = timer
            timer.start()

    def _cancel_pending_card(self):
        if self._pending_card is not None:
            self._pending_card.cancel()
            self._pending_card = None

    def _confirm_card_swipe(self, card_id, token):
        with self._lock:
            if token != self._pending_token:
                return
            self._pending_card = None
            self._record_card_swipe(card_id)

    def _record_card_swipe(self, card_id):
        with self._lock:
            self._ensure_loaded()
            now = time.time()
            entry = self._data['cards'].get(card_id, {'count': 0})
            entry['count'] = int(entry.get('count', 0)) + 1
            entry['last_swiped'] = now
            self._data['cards'][card_id] = entry
            self._count_in_month('cards', card_id, now)
            self._save()

    def count_song_play(self, file, title=None, artist=None, album=None):
        """Increment the play counter for a song, keyed by its file/uri.

        The caller is expected to have watched the track for at least
        #StatisticsStore.min_play_seconds before calling this.
        """
        if not file:
            return
        with self._lock:
            self._ensure_loaded()
            now = time.time()
            entry = self._data['songs'].get(file, {'count': 0})
            entry['count'] = int(entry.get('count', 0)) + 1
            entry['last_played'] = now
            if title:
                entry['title'] = title
            if artist:
                entry['artist'] = artist
            if album:
                entry['album'] = album
            self._data['songs'][file] = entry
            self._count_in_month('songs', file, now)
            self._save()

    def _song_info(self, file, count):
        entry = self._data['songs'].get(file, {})
        return {
            'file': file,
            'count': int(count),
            'title': entry.get('title'),
            'artist': entry.get('artist'),
            'album': entry.get('album'),
        }

    def _top_of_bucket(self, counters, kind, limit):
        items = sorted(counters.get(kind, {}).items(), key=lambda i: (-int(i[1]), i[0]))
        if limit is not None and limit > 0:
            items = items[:limit]
        if kind == 'songs':
            return [self._song_info(file, count) for file, count in items]
        return [{'card_id': card_id, 'count': int(count)} for card_id, count in items]

    def _history(self, limit):
        months = {}
        years = {}
        for month, bucket in self._data['history'].items():
            if not isinstance(bucket, dict):
                continue
            months[month] = bucket
            year = years.setdefault(month[:4], {'cards': {}, 'songs': {}})
            for kind in ('cards', 'songs'):
                for key, count in (bucket.get(kind) or {}).items():
                    year[kind][key] = year[kind].get(key, 0) + int(count)

        def periods(buckets):
            return [
                {
                    'period': period,
                    'cards': self._top_of_bucket(bucket, 'cards', limit),
                    'songs': self._top_of_bucket(bucket, 'songs', limit),
                }
                for period, bucket in sorted(buckets.items(), reverse=True)
            ]

        return {'months': periods(months), 'years': periods(years)}

    def get_statistics(self, limit=None, history_limit=3):
        """Return sorted statistics.

        :param limit: Optionally limit each all-time list to the top ``limit`` entries.
        :param history_limit: Number of entries per historic period (month / year).
        :return: dict with ``cards`` and ``songs`` lists (most frequent first),
            ``total_swipes`` / ``total_plays`` totals and a ``history`` dict with
            ``months`` and ``years`` lists (most recent first).
        """
        with self._lock:
            self._ensure_loaded()
            history = self._history(history_limit)
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
            'history': history,
        }

    def reset(self):
        """Clear all statistics and persist the empty store."""
        with self._lock:
            self._ensure_loaded()
            self._cancel_pending_card()
            self._data = {'cards': {}, 'songs': {}, 'history': {}}
            self._save()


stats = StatisticsStore()
