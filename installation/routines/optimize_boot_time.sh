#!/usr/bin/env bash

# Reference: https://panther.software/configuration-code/raspberry-pi-3-4-faster-boot-time-in-few-easy-steps/

OPTIMIZE_DHCP_CONF="/etc/dhcpcd.conf"
OPTIMIZE_BOOT_CMDLINE_OPTIONS="consoleblank=1 logo.nologo quiet loglevel=0 plymouth.enable=0 vt.global_cursor_default=0 plymouth.ignore-serial-consoles splash fastboot noatime nodiratime noram"
OPTIMIZE_BOOT_CMDLINE_OPTIONS_IPV6="ipv6.disable=1"
OPTIMIZE_DHCP_CONF_HEADER="## Jukebox DHCP Config"
OPTIMIZE_BOOT_CONF_HEADER="## Jukebox Boot Config"

# Disable a unit only if it is actually installed, so absent optional units
# (which differ across Raspberry Pi OS / Debian images) do not error the install.
_disable_service_if_present() {
  local unit="$1"
  if [[ "$(_get_service_enablement "${unit}")" != "not-found" ]] \
     && [[ -n "$(_get_service_enablement "${unit}")" ]]; then
    log "  Disable ${unit}"
    sudo systemctl disable --now "${unit}"
  else
    log "  INFO: optional unit ${unit} not installed, skipping"
  fi
}

_optimize_disable_irrelevant_services() {
  log "  Disable keyboard-setup.service"
  sudo systemctl disable keyboard-setup.service

  log "  Disable triggerhappy.service"
  sudo systemctl disable triggerhappy.service
  sudo systemctl disable triggerhappy.socket

  log "  Disable raspi-config.service"
  sudo systemctl disable raspi-config.service

  log "  Disable apt-daily.service & apt-daily-upgrade.service"
  sudo systemctl disable apt-daily.service
  sudo systemctl disable apt-daily-upgrade.service
  sudo systemctl disable apt-daily.timer
  sudo systemctl disable apt-daily-upgrade.timer

  # Do not block boot waiting for the network to be fully online. The Jukebox
  # and its player come up fine without it, and autohotspot decides for itself
  # whether a network exists. On a Pi this wait routinely cost ~6s of boot.
  _disable_service_if_present NetworkManager-wait-online.service
  _disable_service_if_present systemd-networkd-wait-online.service

  # cloud-init provisions cloud VM instances and has no purpose on an appliance.
  # It is pulled in by some Debian/RPi images and added ~3s to boot.
  if [[ ! -f /etc/cloud/cloud-init.disabled ]] && dpkg -s cloud-init >/dev/null 2>&1; then
    log "  Disable cloud-init"
    sudo touch /etc/cloud/cloud-init.disabled
  fi

  # nmbd is the Samba NetBIOS name service (legacy Windows name resolution).
  # The file share is served by smbd alone; nmbd just adds ~1.5s to boot.
  _disable_service_if_present nmbd.service

  # atd runs jobs scheduled with 'at'. The Jukebox schedules its timers in its own
  # process and never uses 'at'.
  _disable_service_if_present atd.service

  # Housekeeping jobs of a general purpose Debian machine. On an appliance they
  # only cost boot time, I/O and SD card writes:
  #   man-db        - rebuilds manual page indexes (Lite images have almost no man pages)
  #   dpkg-db-backup- daily copy of the package database
  #   e2scrub_all   - online ext4 metadata check, needs LVM snapshots (the Pi has no LVM)
  _disable_service_if_present man-db.timer
  _disable_service_if_present dpkg-db-backup.timer
  _disable_service_if_present e2scrub_all.timer
  _disable_service_if_present e2scrub_reap.service
}

# Start the user systemd instance (and therefore the --user Jukebox, Mopidy and
# audio services) at boot without waiting for an interactive login session.
_optimize_enable_user_linger() {
  log "  Enable systemd linger for ${CURRENT_USER}"
  sudo loginctl enable-linger "${CURRENT_USER}"
}

_add_options_to_cmdline() {
    local options="$1"

    local cmdlineFile=$(get_boot_cmdline_path)
    if [ ! -s "${cmdlineFile}" ];then
        sudo tee "${cmdlineFile}" <<-EOF
${options}
EOF
    else
        for option in $options
        do
            if ! grep -qiw "$option" "${cmdlineFile}" ; then
                sudo sed -i "s/$/ $option/" "${cmdlineFile}"
            fi
        done
    fi
}

# TODO: If false, actually make sure bluetooth is enabled
_optimize_handle_bluetooth() {
  if [ "$DISABLE_BLUETOOTH" = true ] ; then
    print_lc "  Disable bluetooth"
    sudo systemctl disable hciuart.service
    sudo systemctl disable bluetooth.service
  fi
}

# TODO: Allow options to enable/disable wifi, Dynamic/Static IP etc.
_optimize_static_ip() {
    # Static IP Address and DHCP optimizations
    if [[ $(is_dhcpcd_enabled) == true ]]; then
        if [ "$ENABLE_STATIC_IP" = true ] ; then
            print_lc "  Set static IP address"
            if grep -q "${OPTIMIZE_DHCP_CONF_HEADER}" "$OPTIMIZE_DHCP_CONF"; then
                log "    Skipping. Already set up!"
            else
                # DHCP has not been configured
                log "    ${CURRENT_INTERFACE} is the default network interface"
                log "    ${CURRENT_GATEWAY} is the Router Gateway address"
                log "    Using ${CURRENT_IP_ADDRESS} as the static IP for now"

                sudo tee -a $OPTIMIZE_DHCP_CONF <<-EOF

${OPTIMIZE_DHCP_CONF_HEADER}
interface ${CURRENT_INTERFACE}
static ip_address=${CURRENT_IP_ADDRESS}/24
static routers=${CURRENT_GATEWAY}
static domain_name_servers=${CURRENT_GATEWAY}
noarp

EOF

            fi
        fi
    fi
}

# TODO: Allow both Enable and Disable
# Disable ipv6 thoroughly on the system with kernel parameter
_optimize_ipv6_arp() {
    if [ "$DISABLE_IPv6" = true ] ; then
        print_lc "  Disabling IPV6"
        _add_options_to_cmdline "${OPTIMIZE_BOOT_CMDLINE_OPTIONS_IPV6}"
    fi
}

# TODO: Allow both Enable and Disable
_optimize_handle_boot_screen() {
  local configFile=$(get_boot_config_path)
  if [ "$DISABLE_BOOT_SCREEN" = true ] ; then
    log "  Disable RPi rainbow screen"
    if grep -q "${OPTIMIZE_BOOT_CONF_HEADER}" "$configFile"; then
      log "    Skipping. Already set up!"
    else
      sudo tee -a $configFile <<-EOF

${OPTIMIZE_BOOT_CONF_HEADER}
disable_splash=1

EOF
    fi
  fi
}

# TODO: Allow both Enable and Disable
_optimize_handle_boot_logs() {
  if [ "$DISABLE_BOOT_LOGS_PRINT" = true ] ; then
    log "  Disable boot logs"

    _add_options_to_cmdline "${OPTIMIZE_BOOT_CMDLINE_OPTIONS}"
  fi
}

get_nm_active_profile()
{
	local active_profile=$(nmcli -g DEVICE,CONNECTION device status | grep "^${CURRENT_INTERFACE}" | cut -d':' -f2)
	echo "$active_profile"
}

_optimize_static_ip_NetworkManager() {
    if [[ $(is_NetworkManager_enabled) == true ]]; then
        if [ "$ENABLE_STATIC_IP" = true ] ; then
            print_lc "  Set static IP address"
            log "    ${CURRENT_INTERFACE} is the default network interface"
            log "    ${CURRENT_GATEWAY} is the Router Gateway address"
            log "    Using ${CURRENT_IP_ADDRESS} as the static IP for now"
            local active_profile=$(get_nm_active_profile)
            sudo nmcli connection modify "$active_profile" ipv4.method manual ipv4.address "${CURRENT_IP_ADDRESS}/24" ipv4.gateway "$CURRENT_GATEWAY" ipv4.dns "$CURRENT_GATEWAY"
        #else
            # for future deactivation
            #sudo nmcli connection modify "$active_profile" ipv4.method auto ipv4.address "" ipv4.gateway "" ipv4.dns ""
        fi
    fi
}


_optimize_check() {
    print_verify_installation

    local cmdlineFile=$(get_boot_cmdline_path)
    local configFile=$(get_boot_config_path)


    verify_optional_service_enablement keyboard-setup.service disabled
    verify_optional_service_enablement triggerhappy.service disabled
    verify_optional_service_enablement triggerhappy.socket disabled
    verify_optional_service_enablement raspi-config.service disabled
    verify_optional_service_enablement apt-daily.service disabled
    verify_optional_service_enablement apt-daily-upgrade.service disabled
    verify_optional_service_enablement apt-daily.timer disabled
    verify_optional_service_enablement apt-daily-upgrade.timer disabled
    verify_optional_service_enablement NetworkManager-wait-online.service disabled
    verify_optional_service_enablement systemd-networkd-wait-online.service disabled
    verify_optional_service_enablement nmbd.service disabled
    verify_optional_service_enablement atd.service disabled
    verify_optional_service_enablement man-db.timer disabled
    verify_optional_service_enablement dpkg-db-backup.timer disabled
    verify_optional_service_enablement e2scrub_all.timer disabled
    verify_optional_service_enablement e2scrub_reap.service disabled

    if [ "$DISABLE_BLUETOOTH" = true ] ; then
        verify_optional_service_enablement hciuart.service disabled
        verify_optional_service_enablement bluetooth.service disabled
    fi

    if [ "$ENABLE_STATIC_IP" = true ] ; then
        if [[ $(is_dhcpcd_enabled) == true ]]; then
            verify_file_contains_string_once "${OPTIMIZE_DHCP_CONF_HEADER}" "${OPTIMIZE_DHCP_CONF}"
            verify_file_contains_string "${CURRENT_INTERFACE}" "${OPTIMIZE_DHCP_CONF}"
            verify_file_contains_string "${CURRENT_IP_ADDRESS}" "${OPTIMIZE_DHCP_CONF}"
            verify_file_contains_string "${CURRENT_GATEWAY}" "${OPTIMIZE_DHCP_CONF}"
        fi

        if [[ $(is_NetworkManager_enabled) == true ]]; then
            local active_profile=$(get_nm_active_profile)
            local active_profile_path="/etc/NetworkManager/system-connections/${active_profile}.nmconnection"
            verify_files_exists "${active_profile_path}"
            verify_file_contains_string "${CURRENT_IP_ADDRESS}" "${active_profile_path}"
            verify_file_contains_string "${CURRENT_GATEWAY}" "${active_profile_path}"
        fi
    fi
    if [ "$DISABLE_IPv6" = true ] ; then
        verify_file_contains_string_once "${OPTIMIZE_BOOT_CMDLINE_OPTIONS_IPV6}" "${cmdlineFile}"
    fi
    if [ "$DISABLE_BOOT_SCREEN" = true ] ; then
        verify_file_contains_string_once "${OPTIMIZE_BOOT_CONF_HEADER}" "${configFile}"
    fi

    if [ "$DISABLE_BOOT_LOGS_PRINT" = true ] ; then
        for option in $OPTIMIZE_BOOT_CMDLINE_OPTIONS
        do
            verify_file_contains_string_once $option "${cmdlineFile}"
        done
    fi
}

_run_optimize_boot_time() {
    _optimize_disable_irrelevant_services
    _optimize_enable_user_linger
    _optimize_handle_boot_screen
    _optimize_handle_boot_logs
    _optimize_handle_bluetooth
    _optimize_static_ip
    _optimize_static_ip_NetworkManager
    _optimize_ipv6_arp
    _optimize_check
}

optimize_boot_time() {
    run_with_log_frame _run_optimize_boot_time "Optimize boot time"
}
