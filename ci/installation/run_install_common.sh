#!/usr/bin/env bash

# Install Phoniebox and test it
# Used e.g. for tests on Docker

# Objective:
# Test for a common installation path. Including autohotspot

SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(dirname "$SOURCE")"
LOCAL_INSTALL_SCRIPT_PATH="${INSTALL_SCRIPT_PATH:-${SCRIPT_DIR}/../../installation}"
LOCAL_INSTALL_SCRIPT_PATH="${LOCAL_INSTALL_SCRIPT_PATH%/}"

export ENABLE_WEBAPP_PROD_DOWNLOAD=true
# Run installation (in interactive mode)
# y - start setup
# n - deactivate ipv6
# n - use static ip
# y - setup autohotspot
# n -   change default configuration
# n - deactivate bluetooth
# 3 - audio output: Pi on-board (no sound card overlay)
# n - setup spotify (mopidy)
# - - mpd overwrite config (only with existing installation)
# n - setup rfid reader
# y - setup samba
# y - setup webapp
# - - build webapp (skipped due to forced webapp Download)
# n - setup kiosk mode
# y - components confirmed, start installation
# n - reboot

"${LOCAL_INSTALL_SCRIPT_PATH}/install-jukebox.sh" <<< 'y
n
n
y
n
n
3
n
n
y
y
n
y
n
'
