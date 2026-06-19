"""Tests for components.player.uri.normalize_uri

These are pure-logic tests with no hardware or player backend required.
The parent ``components.player`` package pulls in ``jukebox.cfghandler`` at
import time, so it is mocked here to keep the test self-contained.
"""
import sys
import unittest
from unittest.mock import MagicMock

# Stub out heavy package-init dependencies before importing the module.
# components.player.__init__ does `cfg = jukebox.cfghandler.get_handler(...)`
# at import time, which would otherwise require ruamel.yaml and a config file.
import jukebox  # noqa: E402
jukebox.cfghandler = MagicMock()
sys.modules['jukebox.cfghandler'] = jukebox.cfghandler

from components.player.uri import normalize_uri  # noqa: E402


class TestNormalizeUri(unittest.TestCase):
    def test_spotify_uri_passthrough(self):
        uri = 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy'
        self.assertEqual(normalize_uri(uri), uri)

    def test_spotify_album_url_to_uri(self):
        self.assertEqual(
            normalize_uri('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy'),
            'spotify:album:4aawyAB9vmqN3uQ7FjRGTy')

    def test_spotify_playlist_url_to_uri(self):
        self.assertEqual(
            normalize_uri('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'),
            'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')

    def test_spotify_track_and_artist(self):
        self.assertEqual(
            normalize_uri('https://open.spotify.com/track/abc123'),
            'spotify:track:abc123')
        self.assertEqual(
            normalize_uri('https://open.spotify.com/artist/xyz789'),
            'spotify:artist:xyz789')

    def test_http_without_tls_is_accepted(self):
        self.assertEqual(
            normalize_uri('http://open.spotify.com/album/abc123'),
            'spotify:album:abc123')

    def test_local_folder_passthrough(self):
        uri = 'TraumfaengerStarkeLieder/'
        self.assertEqual(normalize_uri(uri), uri)

    def test_unrelated_url_passthrough(self):
        # Not a recognised Spotify content URL -> returned unchanged
        uri = 'https://example.com/album/abc'
        self.assertEqual(normalize_uri(uri), uri)

    def test_url_with_query_params(self):
        # Trailing query string (e.g. ?si=...) must not leak into the URI id
        self.assertEqual(
            normalize_uri('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy?si=abcd'),
            'spotify:album:4aawyAB9vmqN3uQ7FjRGTy')


if __name__ == '__main__':
    unittest.main()
