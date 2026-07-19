#!/usr/bin/env bash

AUTOHOTSPOT_INTERFACES_CONF_FILE="/etc/network/interfaces"
AUTOHOTSPOT_TARGET_PATH="/usr/bin/autohotspot"
AUTOHOTSPOT_SERVICE="autohotspot.service"
AUTOHOTSPOT_SERVICE_PATH="${SYSTEMD_PATH}/${AUTOHOTSPOT_SERVICE}"
AUTOHOTSPOT_TIMER="autohotspot.timer"
AUTOHOTSPOT_TIMER_PATH="${SYSTEMD_PATH}/${AUTOHOTSPOT_TIMER}"

_get_interface() {
    # interfaces may vary; detect the first real WiFi device.
    # Prefer NetworkManager's view (authoritative on NM systems); fall back to iw.
    # Exclude p2p-dev-* virtual interfaces and take only the first match, otherwise
    # a multi-line/empty result gets baked into the autohotspot script (wdev0='').
    WIFI_INTERFACE=""
    if command -v nmcli >/dev/null 2>&1; then
        WIFI_INTERFACE=$(nmcli -t -f DEVICE,TYPE device status 2>/dev/null \
            | awk -F: '$2=="wifi"{print $1; exit}')
    fi
    if [ -z "${WIFI_INTERFACE}" ]; then
        WIFI_INTERFACE=$(iw dev 2>/dev/null \
            | awk '$1=="Interface"{print $2}' | grep -v '^p2p-' | head -n1)
    fi

    # fix for CI runs on docker
    if [ "${CI_RUNNING}" == "true" ]; then
        if [ -z "${WIFI_INTERFACE}" ]; then
            WIFI_INTERFACE="CI TEST INTERFACE"
        fi
    fi

    # Fail loudly instead of baking an empty device into the autohotspot script.
    if [ -z "${WIFI_INTERFACE}" ]; then
        exit_on_error "ERROR: no WiFi interface detected for autohotspot (WiFi hardware present and enabled?)"
    fi
}


_get_last_ip_segment() {
    local ip="$1"
    echo $ip | cut -d'.' -f1-3
}


setup_autohotspot() {
    if [ "$ENABLE_AUTOHOTSPOT" == true ] ; then
        local installed=false
        if [[ $(is_dhcpcd_enabled) == true || "${CI_RUNNING}" == "true" ]]; then
            run_with_log_frame _run_setup_autohotspot_dhcpcd "Install AutoHotspot"
            installed=true
        fi

        if [[ $(is_NetworkManager_enabled) == true || "${CI_RUNNING}" == "true" ]]; then
            run_with_log_frame _run_setup_autohotspot_NetworkManager "Install AutoHotspot"
            installed=true
        fi

        if [[ "$installed" != true ]]; then
            exit_on_error "ERROR: No network service available"
        fi
    fi
}
