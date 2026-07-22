"""Tests for the pure parsing helpers in components.hostif.linux.bluetooth.

The plugin system is mocked at import time so the module can be imported
without the full jukebox runtime; only the side-effect-free parsers are tested.
"""
import importlib.util
import os
import sys
import unittest
from unittest.mock import MagicMock

# bluetooth.py only depends on jukebox.plugs; mock it so we can import the file
# directly without running the heavy components.hostif.linux package __init__.
sys.modules['jukebox'] = MagicMock()
sys.modules['jukebox.plugs'] = MagicMock()

_MODULE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__),
                 '..', '..', 'src', 'jukebox',
                 'components', 'hostif', 'linux', 'bluetooth.py'))
_spec = importlib.util.spec_from_file_location('bt_under_test', _MODULE_PATH)
_bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bt)

parse_devices = _bt.parse_devices
parse_info = _bt.parse_info
is_audio_device = _bt.is_audio_device

DEVICES_OUTPUT = """\
Device AA:BB:CC:DD:EE:FF Sony WH-1000XM4
Device 11:22:33:44:55:66 Kitchen Speaker
Not a device line
"""

INFO_OUTPUT = """\
Device AA:BB:CC:DD:EE:FF (public)
\tName: Sony WH-1000XM4
\tAlias: Sony WH-1000XM4
\tClass: 0x00240404
\tIcon: audio-headset
\tPaired: yes
\tTrusted: yes
\tBlocked: no
\tConnected: yes
"""


class TestParseDevices(unittest.TestCase):
    def test_parses_mac_and_name(self):
        devices = parse_devices(DEVICES_OUTPUT)
        self.assertEqual(len(devices), 2)
        self.assertEqual(devices[0], ('AA:BB:CC:DD:EE:FF', 'Sony WH-1000XM4'))
        self.assertEqual(devices[1], ('11:22:33:44:55:66', 'Kitchen Speaker'))

    def test_empty(self):
        self.assertEqual(parse_devices(''), [])
        self.assertEqual(parse_devices(None), [])


class TestParseInfo(unittest.TestCase):
    def test_parses_properties(self):
        info = parse_info(INFO_OUTPUT)
        self.assertEqual(info['Name'], 'Sony WH-1000XM4')
        self.assertEqual(info['Paired'], 'yes')
        self.assertEqual(info['Connected'], 'yes')
        self.assertEqual(info['Trusted'], 'yes')
        self.assertEqual(info['Icon'], 'audio-headset')
        # The "Device <mac> (public)" header line must not become a property
        self.assertNotIn('Device', info)


class TestIsAudioDevice(unittest.TestCase):
    def test_audio_icon(self):
        self.assertTrue(is_audio_device({'Icon': 'audio-headset'}))
        self.assertTrue(is_audio_device({'Icon': 'audio-speakers'}))

    def test_audio_class_bit(self):
        # Major device class "Audio/Video" bit set
        self.assertTrue(is_audio_device({'Class': '0x00240404'}))

    def test_non_audio(self):
        self.assertFalse(is_audio_device({'Icon': 'input-mouse'}))
        self.assertFalse(is_audio_device({'Class': '0x00000100'}))  # Computer
        self.assertFalse(is_audio_device({}))

    def test_invalid_class(self):
        self.assertFalse(is_audio_device({'Class': 'not-hex'}))


if __name__ == '__main__':
    unittest.main()
