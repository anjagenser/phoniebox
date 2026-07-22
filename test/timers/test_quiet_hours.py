"""Tests for the pure time helpers in components.timers.quiet_hours.

These cover the time-window and fade math without needing the jukebox config
handler, plugin system or timer threads, which are mocked at import time.
"""
import sys
import unittest
from unittest.mock import MagicMock

# Stub heavy import-time dependencies before importing the module under test.
import jukebox  # noqa: E402
jukebox.cfghandler = MagicMock()
sys.modules['jukebox.cfghandler'] = jukebox.cfghandler
sys.modules['jukebox.plugs'] = MagicMock()
sys.modules['jukebox.publishing'] = MagicMock()
sys.modules['jukebox.multitimer'] = MagicMock()

from components.timers.quiet_hours import (  # noqa: E402
    parse_hhmm,
    in_quiet_window,
    fade_progress,
)


class TestParseHhmm(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(parse_hhmm('00:00'), 0)
        self.assertEqual(parse_hhmm('21:00'), 21 * 60)
        self.assertEqual(parse_hhmm('06:30'), 6 * 60 + 30)
        self.assertEqual(parse_hhmm('23:59'), 23 * 60 + 59)

    def test_invalid(self):
        self.assertIsNone(parse_hhmm('24:00'))
        self.assertIsNone(parse_hhmm('12:60'))
        self.assertIsNone(parse_hhmm('nope'))
        self.assertIsNone(parse_hhmm(''))
        self.assertIsNone(parse_hhmm('12'))
        self.assertIsNone(parse_hhmm(None))


class TestInQuietWindow(unittest.TestCase):
    def test_window_crossing_midnight(self):
        start, end = 21 * 60, 6 * 60  # 21:00 -> 06:00
        self.assertTrue(in_quiet_window(22 * 60, start, end))   # 22:00 inside
        self.assertTrue(in_quiet_window(2 * 60, start, end))    # 02:00 inside
        self.assertTrue(in_quiet_window(21 * 60, start, end))   # start inclusive
        self.assertFalse(in_quiet_window(6 * 60, start, end))   # end exclusive
        self.assertFalse(in_quiet_window(12 * 60, start, end))  # noon outside
        self.assertFalse(in_quiet_window(20 * 60 + 59, start, end))

    def test_same_day_window(self):
        start, end = 9 * 60, 17 * 60  # 09:00 -> 17:00
        self.assertTrue(in_quiet_window(12 * 60, start, end))
        self.assertFalse(in_quiet_window(8 * 60, start, end))
        self.assertFalse(in_quiet_window(17 * 60, start, end))  # end exclusive

    def test_degenerate(self):
        # Equal start/end or None -> never in window
        self.assertFalse(in_quiet_window(100, 300, 300))
        self.assertFalse(in_quiet_window(100, None, 300))
        self.assertFalse(in_quiet_window(100, 300, None))


class TestFadeProgress(unittest.TestCase):
    def test_ramp_before_start(self):
        start, fade = 21 * 60, 30  # fade 20:30 -> 21:00
        # Before ramp
        self.assertIsNone(fade_progress(20 * 60, start, fade))
        # Beginning of ramp -> 0.0
        self.assertAlmostEqual(fade_progress(20 * 60 + 30, start, fade), 0.0)
        # Halfway -> 0.5
        self.assertAlmostEqual(fade_progress(20 * 60 + 45, start, fade), 0.5)
        # At start -> no longer fading (quiet window takes over)
        self.assertIsNone(fade_progress(21 * 60, start, fade))

    def test_ramp_crossing_midnight(self):
        start, fade = 15, 30  # start 00:15, fade begins 23:45
        self.assertAlmostEqual(fade_progress(23 * 60 + 45, start, fade), 0.0)
        self.assertAlmostEqual(fade_progress(0, start, fade), 0.5)
        self.assertIsNone(fade_progress(15, start, fade))

    def test_disabled_fade(self):
        self.assertIsNone(fade_progress(100, 200, 0))
        self.assertIsNone(fade_progress(100, 200, None))


if __name__ == '__main__':
    unittest.main()
