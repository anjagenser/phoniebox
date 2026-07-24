# RPi-Jukebox-RFID Version 3
# Copyright (c) See file LICENSE in project root folder
"""Quiet hours: block playback during a configured time window.

During the quiet window the player is kept stopped so the box cannot be used.
In the minutes leading up to the window the volume is gently faded out, giving
a "wind down" towards the start of the quiet time. When the window ends the
volume that was captured before fading is restored.

Configuration is stored in ``jukebox.yaml`` under ``quiet_hours``::

    quiet_hours:
      enabled: false
      start: '21:00'       # quiet window begins (volume fully faded)
      end: '06:00'         # quiet window ends
      fade_minutes: 15     # length of the volume ramp before 'start'
"""
import datetime
import logging

import jukebox.cfghandler
import jukebox.plugs as plugin
import jukebox.publishing as publishing
from jukebox.multitimer import GenericEndlessTimerClass

logger = logging.getLogger('jb.timers.quiet')
cfg = jukebox.cfghandler.get_handler('jukebox')

MINUTES_PER_DAY = 24 * 60


def parse_hhmm(value):
    """Parse a ``'HH:MM'`` string into minutes since midnight.

    Returns ``None`` for invalid input.
    """
    try:
        hours_str, minutes_str = str(value).strip().split(':')
        hours = int(hours_str)
        minutes = int(minutes_str)
    except (ValueError, AttributeError):
        return None
    if not (0 <= hours < 24 and 0 <= minutes < 60):
        return None
    return hours * 60 + minutes


def in_quiet_window(now_min, start_min, end_min):
    """Return ``True`` if ``now_min`` lies within ``[start, end)``.

    The window may wrap around midnight (e.g. 21:00 -> 06:00).
    """
    if start_min is None or end_min is None or start_min == end_min:
        return False
    if start_min < end_min:
        return start_min <= now_min < end_min
    return now_min >= start_min or now_min < end_min


def fade_progress(now_min, start_min, fade_min):
    """Return the fade fraction in ``[0, 1)`` while inside the ramp before the
    quiet window, else ``None``.

    ``0.0`` at the beginning of the ramp, approaching ``1.0`` as the quiet start
    is reached. The remaining volume scale is therefore ``(1 - fraction)``.
    """
    if start_min is None or not fade_min or fade_min <= 0:
        return None
    fade_start = (start_min - fade_min) % MINUTES_PER_DAY
    elapsed = (now_min - fade_start) % MINUTES_PER_DAY
    if 0 <= elapsed < fade_min:
        return elapsed / fade_min
    return None


class QuietHours:
    """Monitor thread that enforces the quiet-hours window and volume fade."""

    def __init__(self, name, poll_interval=20.0):
        self.name = name
        self.poll_interval = poll_interval
        self._timer = None
        self._baseline_volume = None
        self._was_quiet = False
        self._was_fading = False
        self._last_published = None
        with cfg:
            cfg.setndefault('quiet_hours', 'enabled', value=False)
            cfg.setndefault('quiet_hours', 'start', value='21:00')
            cfg.setndefault('quiet_hours', 'end', value='06:00')
            cfg.setndefault('quiet_hours', 'fade_minutes', value=15)

    def start(self):
        self._timer = GenericEndlessTimerClass(
            f"{self.name}_monitor", self.poll_interval, self._tick)
        self._timer.start()
        self._publish_state()

    def cancel(self):
        if self._timer and self._timer.is_alive():
            self._timer.cancel()

    @property
    def timer_thread(self):
        return self._timer.timer_thread if self._timer else None

    def _read_config(self):
        return {
            'enabled': bool(cfg.getn('quiet_hours', 'enabled', default=False)),
            'start': cfg.getn('quiet_hours', 'start', default='21:00'),
            'end': cfg.getn('quiet_hours', 'end', default='06:00'),
            'fade_minutes': int(cfg.getn('quiet_hours', 'fade_minutes', default=15) or 0),
        }

    @staticmethod
    def _now_minutes():
        now = datetime.datetime.now()
        return now.hour * 60 + now.minute

    def _tick(self):
        try:
            self._evaluate(self._now_minutes())
            self._publish_state()
        except Exception as e:
            logger.error(f"Quiet-hours tick failed: {e.__class__.__name__}: {e}")

    def _publish_state(self):
        """Publish the current state to the web app when it changes."""
        try:
            state = self.get_state()
        except Exception as e:
            logger.error(f"Quiet-hours state build failed: {e.__class__.__name__}: {e}")
            return
        if state != self._last_published:
            self._last_published = state
            publishing.get_publisher().send('quiet_hours.state', state)

    def _evaluate(self, now_min):
        conf = self._read_config()
        if not conf['enabled']:
            self._restore()
            return

        start_min = parse_hhmm(conf['start'])
        end_min = parse_hhmm(conf['end'])
        fade_min = conf['fade_minutes']
        if start_min is None or end_min is None:
            logger.warning("Quiet hours: invalid start/end time; skipping")
            return

        if in_quiet_window(now_min, start_min, end_min):
            self._enforce_quiet()
            return

        fade = fade_progress(now_min, start_min, fade_min)
        if fade is not None:
            self._apply_fade(fade)
        else:
            self._restore()

    def _enforce_quiet(self):
        if not self._was_quiet:
            logger.info("Entering quiet hours: stopping playback")
        self._was_quiet = True
        self._was_fading = False
        plugin.call_ignore_errors('player', 'ctrl', 'stop')

    def _apply_fade(self, fraction):
        if not self._was_fading:
            try:
                self._baseline_volume = plugin.call('volume', 'ctrl', 'get_volume')
            except Exception:
                self._baseline_volume = None
            logger.info(f"Quiet hours: starting volume fade from {self._baseline_volume}")
            self._was_fading = True
        baseline = self._baseline_volume if self._baseline_volume is not None else 100
        target = max(0, int(round(baseline * (1.0 - fraction))))
        plugin.call_ignore_errors('volume', 'ctrl', 'set_volume', args=[target])

    def _restore(self):
        if self._was_quiet or self._was_fading:
            if self._baseline_volume is not None:
                logger.info(f"Quiet hours ended: restoring volume to {self._baseline_volume}")
                plugin.call_ignore_errors('volume', 'ctrl', 'set_volume',
                                          args=[self._baseline_volume])
            self._baseline_volume = None
        self._was_quiet = False
        self._was_fading = False

    @plugin.tag
    def get_config(self):
        """Return the quiet-hours configuration."""
        return self._read_config()

    @plugin.tag
    def set_config(self, enabled=None, start=None, end=None, fade_minutes=None):
        """Update and persist the quiet-hours configuration.

        :param enabled: Enable/disable quiet hours
        :param start: Quiet window start time as ``'HH:MM'``
        :param end: Quiet window end time as ``'HH:MM'``
        :param fade_minutes: Length of the volume fade ramp before ``start``
        """
        with cfg:
            if enabled is not None:
                cfg.setn('quiet_hours', 'enabled', value=bool(enabled))
            if start is not None:
                if parse_hhmm(start) is None:
                    raise ValueError(f"Invalid start time: {start}")
                cfg.setn('quiet_hours', 'start', value=str(start))
            if end is not None:
                if parse_hhmm(end) is None:
                    raise ValueError(f"Invalid end time: {end}")
                cfg.setn('quiet_hours', 'end', value=str(end))
            if fade_minutes is not None:
                cfg.setn('quiet_hours', 'fade_minutes', value=max(0, int(fade_minutes)))
        cfg.save(only_if_changed=True)
        # Apply immediately so toggling during the window takes effect at once.
        try:
            self._evaluate(self._now_minutes())
            self._publish_state()
        except Exception as e:
            logger.error(f"Quiet-hours immediate apply failed: {e.__class__.__name__}: {e}")
        return self._read_config()

    @plugin.tag
    def get_state(self):
        """Return the current quiet-hours state (``active`` / ``fading``)."""
        conf = self._read_config()
        now_min = self._now_minutes()
        start_min = parse_hhmm(conf['start'])
        end_min = parse_hhmm(conf['end'])
        active = (conf['enabled'] and start_min is not None and end_min is not None
                  and in_quiet_window(now_min, start_min, end_min))
        fading = (conf['enabled'] and start_min is not None
                  and fade_progress(now_min, start_min, conf['fade_minutes']) is not None)
        return {'enabled': conf['enabled'], 'active': active, 'fading': fading}
