#!/usr/bin/env bash

_run_set_raspi_config() {
  # Source: https://raspberrypi.stackexchange.com/a/66939

  # Autologin
  log "  Enable Autologin for user"
  sudo raspi-config nonint do_boot_behaviour B2

  # Wait for network at boot
  # log "  Enable 'Wait for network at boot'"
  # sudo raspi-config nonint do_boot_wait 1

  # power management of wifi: switch off to avoid disconnecting
  log "  Disable Wifi power management to avoid disconnecting"
  sudo iwconfig wlan0 power off
  # 'iwconfig' only changes the running interface, and NetworkManager turns power
  # saving back on whenever it (re)connects. Persist it in the connection profile
  # as well (2 = disable), so the Phoniebox stays reachable after every reconnect.
  if command -v nmcli >/dev/null 2>&1; then
    # A per-profile setting is lost when the profile is regenerated (netplan) or
    # when a new WiFi is added later, so set the NetworkManager-wide default too.
    log "    Set NetworkManager default wifi.powersave=off"
    sudo mkdir -p /etc/NetworkManager/conf.d
    sudo tee /etc/NetworkManager/conf.d/10-wifi-powersave-off.conf >/dev/null <<-EOF
	[connection]
	wifi.powersave = 2
	EOF

    local wifi_device
    wifi_device=$(nmcli -t -f DEVICE,TYPE device status 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}')
    if [[ -n "$wifi_device" ]]; then
      local wifi_profile
      wifi_profile=$(nmcli -t -f DEVICE,CONNECTION device status 2>/dev/null \
          | awk -F: -v dev="$wifi_device" '$1==dev{print $2; exit}')
      if [[ -n "$wifi_profile" && "$wifi_profile" != "--" ]]; then
        log "    Persist powersave=off in WiFi profile '${wifi_profile}'"
        sudo nmcli connection modify "$wifi_profile" 802-11-wireless.powersave 2
      else
        log "    No WiFi connection profile found, skipping persistent setting"
      fi
    fi
  fi

  # On-board audio
  if [ "$DISABLE_ONBOARD_AUDIO" == true ]; then
    local configFile=$(get_boot_config_path)
    log "  Disable on-chip BCM audio"
    if grep -q -E "^dtparam=([^,]*,)*audio=(on|true|yes|1).*" "${configFile}" ; then
      local configFile_backup="${configFile}.backup.audio_on_$(date +%d.%m.%y_%H.%M.%S)"
      log "    Backup ${configFile} --> ${configFile_backup}"
      sudo cp "${configFile}" "${configFile_backup}"
      sudo sed -i "s/^\(dtparam=\([^,]*,\)*\)audio=\(on\|true\|yes\|1\)\(.*\)/\1audio=off\4/g" "${configFile}"
    else
      log "    On board audio seems to be off already. Not touching ${configFile}"
    fi
  fi
}

set_raspi_config() {
    run_with_log_frame _run_set_raspi_config "Set default raspi-config"
}
