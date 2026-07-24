# RPi-Jukebox-RFID Version 3
# Copyright (c) See file LICENSE in project root folder
"""Bluetooth headset management via ``bluetoothctl``.

Lets the web app scan for, pair, connect, disconnect and remove Bluetooth
audio devices (e.g. a headset). Once a headset connects, the audio output is
switched to it automatically by the PulseAudio monitor in
``components.volume`` (no configuration needed here).

These functions are registered under the ``host`` plugin package (see
``components.hostif.linux``). They shell out to ``bluetoothctl`` and therefore
require the BlueZ stack to be installed and the jukebox user to have access to
it (typically membership in the ``bluetooth`` group).
"""
import logging
import re
import shutil
import subprocess

import jukebox.plugs as plugin

logger = logging.getLogger('jb.host.bt')

_DEVICE_LINE = re.compile(r'^Device\s+([0-9A-Fa-f:]{17})\s+(.*)$')
_INFO_LINE = re.compile(r'^\s*([A-Za-z]+):\s+(.*)$')

_AUDIO_ICONS = {'audio-card', 'audio-headset', 'audio-headphones', 'audio-speakers'}


def parse_devices(output):
    """Parse ``bluetoothctl devices`` output into a list of ``(mac, name)``."""
    devices = []
    for line in (output or '').splitlines():
        match = _DEVICE_LINE.match(line.strip())
        if match:
            devices.append((match.group(1).upper(), match.group(2).strip()))
    return devices


def parse_info(output):
    """Parse ``bluetoothctl info <mac>`` output into a dict of properties."""
    info = {}
    for line in (output or '').splitlines():
        if line.strip().startswith('Device '):
            continue
        match = _INFO_LINE.match(line)
        if match:
            info[match.group(1)] = match.group(2).strip()
    return info


def is_audio_device(info):
    """Return ``True`` if the parsed device info looks like an audio device."""
    icon = (info.get('Icon') or '').lower()
    if icon in _AUDIO_ICONS:
        return True
    # Fall back to the major device class bit for "Audio/Video" (0x000400)
    device_class = info.get('Class') or ''
    try:
        return bool(int(device_class, 16) & 0x000400)
    except ValueError:
        return False


def _bluetoothctl_available():
    return shutil.which('bluetoothctl') is not None


def _run(args, timeout=15):
    """Run ``bluetoothctl <args>`` non-interactively, returning stdout."""
    ret = subprocess.run(['bluetoothctl', *args],
                         capture_output=True, text=True, check=False,
                         timeout=timeout, stdin=subprocess.DEVNULL)
    return ret.stdout or ''


def _session(commands, timeout=30):
    """Run several commands in a single ``bluetoothctl`` session via stdin.

    A single session keeps the pairing agent alive across ``pair``/``trust``/
    ``connect``, which one-shot invocations do not.
    """
    script = '\n'.join(commands) + '\nquit\n'
    ret = subprocess.run(['bluetoothctl'], input=script,
                         capture_output=True, text=True, check=False,
                         timeout=timeout)
    return ret.stdout or ''


def _device_info(mac):
    info = parse_info(_run(['info', mac]))
    return {
        'mac': mac.upper(),
        'name': info.get('Name', mac),
        'paired': info.get('Paired', 'no') == 'yes',
        'connected': info.get('Connected', 'no') == 'yes',
        'trusted': info.get('Trusted', 'no') == 'yes',
        'audio': is_audio_device(info),
    }


@plugin.register(package='host')
def bluetooth_available():
    """Return whether Bluetooth control (``bluetoothctl``) is available."""
    return _bluetoothctl_available()


@plugin.register(package='host')
def bluetooth_devices(audio_only=True):
    """List known Bluetooth devices with their pairing/connection status.

    :param audio_only: When ``True`` (default) only audio devices are returned.
    """
    if not _bluetoothctl_available():
        return {'available': False, 'devices': []}
    try:
        devices = [_device_info(mac) for mac, _name in parse_devices(_run(['devices']))]
    except subprocess.TimeoutExpired:
        logger.error("bluetooth_devices: bluetoothctl timed out")
        return {'available': True, 'devices': [], 'error': 'timeout'}
    if audio_only:
        devices = [d for d in devices if d['audio']]
    return {'available': True, 'devices': devices}


@plugin.register(package='host')
def bluetooth_scan(timeout=12, audio_only=True):
    """Scan for nearby Bluetooth devices, then return the known device list.

    :param timeout: Discovery duration in seconds.
    """
    if not _bluetoothctl_available():
        return {'available': False, 'devices': []}
    try:
        timeout = max(3, min(int(timeout), 30))
        _run(['power', 'on'], timeout=10)
        _run(['--timeout', str(timeout), 'scan', 'on'], timeout=timeout + 8)
    except subprocess.TimeoutExpired:
        logger.warning("bluetooth_scan: scan timed out (continuing)")
    except Exception as e:
        logger.error(f"bluetooth_scan failed: {e.__class__.__name__}: {e}")
    return bluetooth_devices(audio_only=audio_only)


@plugin.register(package='host')
def bluetooth_pair(mac):
    """Pair, trust and connect a Bluetooth device.

    :param mac: Device MAC address (``AA:BB:CC:DD:EE:FF``).
    """
    if not _bluetoothctl_available():
        raise RuntimeError("bluetoothctl not available")
    logger.info(f"Pairing Bluetooth device {mac}")
    output = _session([
        'power on',
        'agent on',
        'default-agent',
        f'pair {mac}',
        f'trust {mac}',
        f'connect {mac}',
    ], timeout=45)
    logger.debug(f"bluetooth_pair output: {output}")
    return _device_info(mac)


@plugin.register(package='host')
def bluetooth_connect(mac):
    """Connect an already-paired Bluetooth device."""
    if not _bluetoothctl_available():
        raise RuntimeError("bluetoothctl not available")
    logger.info(f"Connecting Bluetooth device {mac}")
    _run(['connect', mac], timeout=20)
    return _device_info(mac)


@plugin.register(package='host')
def bluetooth_disconnect(mac):
    """Disconnect a connected Bluetooth device."""
    if not _bluetoothctl_available():
        raise RuntimeError("bluetoothctl not available")
    logger.info(f"Disconnecting Bluetooth device {mac}")
    _run(['disconnect', mac], timeout=20)
    return _device_info(mac)


@plugin.register(package='host')
def bluetooth_remove(mac):
    """Remove (unpair) a Bluetooth device."""
    if not _bluetoothctl_available():
        raise RuntimeError("bluetoothctl not available")
    logger.info(f"Removing Bluetooth device {mac}")
    _run(['remove', mac], timeout=20)
    return {'mac': mac.upper(), 'removed': True}
