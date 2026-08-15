#!/usr/bin/env bash

NETWORK_WATCHDOG_RESOURCES_PATH="${INSTALLATION_PATH}/resources/network-watchdog"
NETCHECK_TARGET_PATH="/usr/local/bin/phoniebox-netcheck"
NETCHECK_SERVICE="phoniebox-netcheck.service"
NETCHECK_SERVICE_PATH="${SYSTEMD_PATH}/${NETCHECK_SERVICE}"
NETCHECK_TIMER="phoniebox-netcheck.timer"
NETCHECK_TIMER_PATH="${SYSTEMD_PATH}/${NETCHECK_TIMER}"
NETCHECK_JOURNALD_CONF="/etc/systemd/journald.conf.d/99-jukebox-persistent.conf"

_install_packages_network_watchdog() {
    sudo apt-get -y install iw
}

# Raspberry Pi OS ships /usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf,
# which throws all logs away on reboot. Drop-ins are merged by file name, so ours
# needs a prefix above 40 to win, otherwise every failure is unexplainable.
_install_persistent_journal() {
    log "  Keep the journal across reboots"
    sudo mkdir -p /etc/systemd/journald.conf.d
    sudo rm -f /etc/systemd/journald.conf.d/00-jukebox-persistent.conf
    sudo tee "${NETCHECK_JOURNALD_CONF}" >/dev/null <<-EOF
	[Journal]
	Storage=persistent
	SystemMaxUse=64M
	SystemMaxFileSize=8M
	EOF
    # No running systemd in the CI container, so the reload has to wait for a boot
    if [ "${CI_RUNNING}" != "true" ]; then
        sudo systemctl restart systemd-journald
        sudo journalctl --flush >/dev/null 2>&1
    fi
}

_install_network_watchdog() {
    log "  Install network watchdog"
    sudo cp "${NETWORK_WATCHDOG_RESOURCES_PATH}"/phoniebox-netcheck "${NETCHECK_TARGET_PATH}"
    sudo chmod +x "${NETCHECK_TARGET_PATH}"

    sudo cp "${NETWORK_WATCHDOG_RESOURCES_PATH}"/phoniebox-netcheck.service "${NETCHECK_SERVICE_PATH}"
    sudo sed -i "s|%%NETCHECK_SCRIPT%%|${NETCHECK_TARGET_PATH}|g" "${NETCHECK_SERVICE_PATH}"

    sudo cp "${NETWORK_WATCHDOG_RESOURCES_PATH}"/phoniebox-netcheck.timer "${NETCHECK_TIMER_PATH}"
    sudo sed -i "s|%%NETCHECK_SERVICE%%|${NETCHECK_SERVICE}|g" "${NETCHECK_TIMER_PATH}"

    if [ "${CI_RUNNING}" != "true" ]; then
        sudo systemctl daemon-reload
    fi
    sudo systemctl enable "${NETCHECK_TIMER}"
}

_uninstall_network_watchdog() {
    if systemctl list-unit-files "${NETCHECK_TIMER}" >/dev/null 2>&1 ; then
        sudo systemctl stop "${NETCHECK_TIMER}" >/dev/null 2>&1
        sudo systemctl disable "${NETCHECK_TIMER}" >/dev/null 2>&1
    fi
    sudo rm -f "${NETCHECK_TIMER_PATH}" "${NETCHECK_SERVICE_PATH}"
}

_network_watchdog_check() {
    print_verify_installation

    verify_apt_packages iw

    verify_files_exists "${NETCHECK_TARGET_PATH}"
    verify_files_exists "${NETCHECK_SERVICE_PATH}"
    verify_file_contains_string "ExecStart=${NETCHECK_TARGET_PATH}" "${NETCHECK_SERVICE_PATH}"
    verify_files_exists "${NETCHECK_TIMER_PATH}"
    verify_file_contains_string "Unit=${NETCHECK_SERVICE}" "${NETCHECK_TIMER_PATH}"
    verify_service_enablement "${NETCHECK_TIMER}" enabled

    verify_files_exists "${NETCHECK_JOURNALD_CONF}"
}

_run_setup_network_watchdog() {
    _install_packages_network_watchdog
    _install_persistent_journal
    _uninstall_network_watchdog
    _install_network_watchdog
    _network_watchdog_check
}

setup_network_watchdog() {
    run_with_log_frame _run_setup_network_watchdog "Install network watchdog"
}
