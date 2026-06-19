"""Tests for the fileserver pure helpers: multipart parsing and path safety.

No network or hardware required.  The fileserver package pulls in
``jukebox.cfghandler``, ``jukebox.publishing`` and ``components.player`` at
import time and registers plugin hooks, so those are stubbed out below.
"""
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock

# --- Stub heavy / hardware-bound package-init dependencies -----------------
import jukebox  # noqa: E402
jukebox.cfghandler = MagicMock()
jukebox.publishing = MagicMock()
sys.modules['jukebox.cfghandler'] = jukebox.cfghandler
sys.modules['jukebox.publishing'] = jukebox.publishing

# Make the @plugin.initialize / @plugin.atexit decorators no-ops so importing
# the module does not try to register real plugins
import jukebox.plugs as plugin  # noqa: E402


def _identity(fkt):
    return fkt


plugin.initialize = _identity
plugin.atexit = _identity

from components.fileserver import (  # noqa: E402
    is_within_directory,
    parse_multipart,
)


def _build_multipart(boundary, parts):
    """Build a multipart/form-data body. ``parts`` is a list of dicts with
    keys: name, optional filename, value (str or bytes)."""
    out = b''
    bnd = boundary.encode()
    for p in parts:
        out += b'--' + bnd + b'\r\n'
        disp = f'Content-Disposition: form-data; name="{p["name"]}"'
        if 'filename' in p:
            disp += f'; filename="{p["filename"]}"'
        out += disp.encode() + b'\r\n'
        if 'filename' in p:
            out += b'Content-Type: application/octet-stream\r\n'
        out += b'\r\n'
        value = p['value']
        out += value if isinstance(value, bytes) else value.encode()
        out += b'\r\n'
    out += b'--' + bnd + b'--\r\n'
    return out


class TestParseMultipart(unittest.TestCase):
    content_type = 'multipart/form-data; boundary=----JukeboxBoundary123'
    boundary = '----JukeboxBoundary123'

    def test_single_file(self):
        body = _build_multipart(self.boundary, [
            {'name': 'files', 'filename': 'song.mp3', 'value': b'\x00\x01\x02binary'},
        ])
        fields, files = parse_multipart(body, self.content_type)
        self.assertEqual(fields, {})
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0][0], 'song.mp3')
        self.assertEqual(files[0][1], b'\x00\x01\x02binary')

    def test_field_and_multiple_files(self):
        body = _build_multipart(self.boundary, [
            {'name': 'folder', 'value': 'MyAlbum'},
            {'name': 'files', 'filename': 'a.mp3', 'value': b'aaa'},
            {'name': 'files', 'filename': 'b.mp3', 'value': b'bbb'},
        ])
        fields, files = parse_multipart(body, self.content_type)
        self.assertEqual(fields['folder'], 'MyAlbum')
        self.assertEqual([f[0] for f in files], ['a.mp3', 'b.mp3'])
        self.assertEqual([f[1] for f in files], [b'aaa', b'bbb'])

    def test_binary_data_containing_crlf_and_dashes(self):
        payload = b'ID3\r\n--not-the-boundary--\r\n\x00\xff'
        body = _build_multipart(self.boundary, [
            {'name': 'files', 'filename': 'x.mp3', 'value': payload},
        ])
        _, files = parse_multipart(body, self.content_type)
        self.assertEqual(files[0][1], payload)

    def test_quoted_boundary(self):
        ct = 'multipart/form-data; boundary="----JukeboxBoundary123"'
        body = _build_multipart(self.boundary, [
            {'name': 'files', 'filename': 'a.mp3', 'value': b'aaa'},
        ])
        _, files = parse_multipart(body, ct)
        self.assertEqual(files[0][1], b'aaa')

    def test_missing_boundary_raises(self):
        with self.assertRaises(ValueError):
            parse_multipart(b'whatever', 'multipart/form-data')


class TestIsWithinDirectory(unittest.TestCase):
    def setUp(self):
        self.base = os.path.realpath(tempfile.mkdtemp())

    def test_direct_child(self):
        self.assertTrue(is_within_directory(self.base, os.path.join(self.base, 'album')))

    def test_nested_child(self):
        self.assertTrue(
            is_within_directory(self.base, os.path.join(self.base, 'a', 'b', 'c')))

    def test_base_itself(self):
        self.assertTrue(is_within_directory(self.base, self.base))

    def test_parent_traversal_rejected(self):
        self.assertFalse(
            is_within_directory(self.base, os.path.join(self.base, '..', 'evil')))

    def test_sibling_with_shared_prefix_rejected(self):
        # The classic startswith() bug: a sibling dir whose name extends the
        # base name must NOT be considered inside the base.
        sibling = self.base + '_evil'
        self.assertFalse(is_within_directory(self.base, sibling))

    def test_absolute_outside_path_rejected(self):
        self.assertFalse(is_within_directory(self.base, '/etc/passwd'))


if __name__ == '__main__':
    unittest.main()
