# New Features (future3/develop branch)

This page documents features added to the `future3/develop` branch that are not yet in a stable release.

## Table of Contents

- [Per-folder Playback Configuration](#per-folder-playback-configuration)
- [Spotify / Mopidy URI Card Action](#spotify--mopidy-uri-card-action)
- [Automatic Bluetooth Headset Routing](#automatic-bluetooth-headset-routing)
- [File Upload via Web UI](#file-upload-via-web-ui)
- [Runtime Log Level Toggle](#runtime-log-level-toggle)
- [Trixie (Debian 13) Compatibility](#trixie-debian-13-compatibility)
- [Installing This Development Version](#installing-this-development-version)

---

## Per-folder Playback Configuration

Each audio folder can now have its own playback settings: **Resume**, **Shuffle**, **Loop**, and **Single**.

### How it works

Settings are saved per-folder in `shared/settings/music_player_status.json` under the `folder_config` key. They take effect every time the folder is played (via RFID card swipe or the Web UI).

| Option | Behaviour |
|--------|-----------|
| **Resume** | Continue from the last song and position (saved on every status poll) |
| **Shuffle** | Randomise playback order (MPD `random` mode) |
| **Loop** | Repeat the playlist when it finishes (MPD `repeat` mode) |
| **Single** | Repeat the current song indefinitely (MPD `single` + `repeat` modes) |

### Web UI

When you register a card and choose **Play folder**, four toggles appear below the folder name. Changes take effect immediately and are persisted.

### RPC commands

```yaml
# Get config for a folder
player.ctrl.get_folder_config:
  args:
    folder: "MyAlbum"

# Set individual options (omit any key to leave it unchanged)
player.ctrl.set_folder_config:
  args:
    folder: "MyAlbum"
    resume: true
    shuffle: false
    loop: true
    single: false
```

Both are available as RPC aliases `get_folder_config` and `set_folder_config`.

---

## Spotify / Mopidy URI Card Action

Requires **Mopidy** with **Mopidy-Spotify**. See [Mopidy / Spotify setup](../builders/components/mopidy.md) for installation.

### Assign a Spotify URI to a card

1. In the Web UI, open **Card Registration**.
2. Choose the action **Play music**.
3. Click **Enter Spotify / Stream URI**.
4. Paste a Spotify URI (`spotify:album:4aawyAB9vmqN3uQ7FjRGTy`) or a Spotify web URL (`https://open.spotify.com/album/...`). URLs are converted automatically.

### RPC command

```yaml
player.ctrl.play_uri:
  args:
    uri: "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"
```

Alias: `play_uri`

---

## Automatic Bluetooth Headset Routing

When a Bluetooth A2DP headset or speaker connects:

1. The current output sink is remembered.
2. All active audio streams (MPD / Mopidy) are moved to the Bluetooth sink automatically.
3. When the device disconnects, streams are moved back to the previous output.

No MAC address pre-configuration is needed. Works with any Bluetooth A2DP device.

Enable or disable the feature in `shared/settings/jukebox.yaml`:

```yaml
pulse:
  toggle_on_connect: true   # set to false to disable automatic routing
```

---

## File Upload via Web UI

Audio files can be uploaded directly from the browser without needing SSH or Samba.

### How to use

1. Open the **Library** tab in the Web UI.
2. Click the upload FAB (floating action button) in the bottom-right corner.
3. Select one or more audio files.
4. Optionally enter a destination subfolder (created automatically if it doesn't exist).
5. Click **Upload**.

### Technical details

A lightweight HTTP server (`fileserver` component) listens on port **8080**. The server prevents path traversal: the destination is always resolved relative to the `audiofolders` directory and a sibling/parent escape is rejected.

Configuration in `shared/settings/jukebox.yaml`:

```yaml
fileserver:
  enable: true            # set false to disable the server entirely
  host: '0.0.0.0'         # bind address; use '127.0.0.1' to restrict to localhost
  port: 8080
  token: ''               # if set, uploads must send a matching X-Upload-Token header
  max_upload_size_mb: 500 # reject uploads whose body exceeds this size (prevents OOM)
```

> **Security note:** With the default `host: '0.0.0.0'` and an empty `token`, any
> device on the local network can upload files. Set a `token` (and send it as the
> `X-Upload-Token` header) or bind to `127.0.0.1` if the box is on an untrusted
> network. The Web UI upload button does **not** send a token yet, so enabling
> `token` currently restricts uploads to API/`curl` clients.

---

## Runtime Log Level Toggle

The log level can be changed at runtime without restarting the service.

### Via RPC CLI

```bash
# Get current level
./src/jukebox/run_rpc_tool.py host get_log_level

# Set to DEBUG for a session
./src/jukebox/run_rpc_tool.py host set_log_level level=DEBUG

# Restore to INFO
./src/jukebox/run_rpc_tool.py host set_log_level level=INFO
```

Valid levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.

---

## Trixie (Debian 13) Compatibility

The installer now detects Debian 13 ("Trixie") and handles the PulseAudio → PipeWire transition automatically:

- `pulseaudio` and `pulseaudio-module-bluetooth` are **not** installed on Trixie.
- `pipewire-pulse` + `wireplumber` are installed instead.
- PipeWire-Pulse provides the full PulseAudio socket API, so `pulsectl`, MPD, and Mopidy continue to work unchanged.

No manual steps required — the installer handles everything.

---

## Installing This Development Version

> **Note:** This is a development branch. Expect rough edges. Use on a dedicated device, not a production box.

### Prerequisites

- Raspberry Pi 3, 4, or 5 (Pi Zero 2 W also works for testing)
- Raspberry Pi OS **Bookworm** (Debian 12) or **Trixie** (Debian 13) Lite — 64-bit recommended
- Fresh SD card (clean install)

### 1. Flash and boot

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) to flash Raspberry Pi OS Lite. Enable SSH in the imager's advanced options.

### 2. Clone this branch

```bash
# On the Raspberry Pi (via SSH):
cd ~
git clone --branch future3/develop https://github.com/MiczFlor/RPi-Jukebox-RFID.git
cd RPi-Jukebox-RFID
```

If you are working from a fork:

```bash
git clone --branch future3/develop https://github.com/<your-fork>/RPi-Jukebox-RFID.git
```

### 3. Run the installer

```bash
cd installation
bash install.sh
```

The installer asks a few questions (hostname, WiFi, Spotify, etc.) and does everything else automatically. Typical runtime: 15–25 minutes.

### 4. Optional: Spotify / Mopidy support

When asked "Install Mopidy for Spotify support?" answer **yes** and provide your Spotify API credentials (Client ID and Client Secret from [developer.spotify.com](https://developer.spotify.com/dashboard)).

The installer:
- Installs Mopidy, Mopidy-Spotify, Mopidy-MPD, and the GStreamer Spotify plugin
- Configures Mopidy as a user service that replaces MPD
- Patches `jukebox-daemon.service` to depend on `mopidy.service` instead of `mpd.service`

### 5. Access the Web UI

After reboot, open `http://<hostname>.local` or `http://<IP-address>` in a browser.

### Running from source (development mode)

If you want to iterate quickly without re-running the full installer:

```bash
# Activate the Python virtual environment
source ~/.venv/jukebox/bin/activate

# Start the backend
cd src/jukebox
./run_jukebox.sh

# In a second terminal: start the Web UI dev server
cd src/webapp
npm start
```

The backend listens on ZMQ ports 5555 (RPC) and 5557/5558 (PubSub). The React dev server proxies API calls automatically.

### Checking service status

```bash
# Jukebox daemon
systemctl --user status jukebox-daemon

# MPD (standard install)
systemctl --user status mpd

# Mopidy (Spotify install)
systemctl --user status mopidy
```

### Logs

```bash
# Live log tail
journalctl --user -u jukebox-daemon -f

# Or the log file (path set in src/jukebox/logger.yaml)
tail -f /home/pi/.local/share/jukebox/jukebox.log
```

### RPC CLI tool

A command-line client for testing RPC calls:

```bash
# Tab-completion and history are supported
./src/jukebox/run_rpc_tool.py

# Examples:
./src/jukebox/run_rpc_tool.py player ctrl play_folder folder=MyAlbum
./src/jukebox/run_rpc_tool.py player ctrl get_folder_config folder=MyAlbum
./src/jukebox/run_rpc_tool.py player ctrl set_folder_config folder=MyAlbum resume=true shuffle=true
./src/jukebox/run_rpc_tool.py player ctrl play_uri uri=spotify:album:4aawyAB9vmqN3uQ7FjRGTy
./src/jukebox/run_rpc_tool.py host set_log_level level=DEBUG
```
