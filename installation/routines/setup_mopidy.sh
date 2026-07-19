#!/usr/bin/env bash

AUDIOFOLDERS_PATH="${SHARED_PATH}/audiofolders"
PLAYLISTS_PATH="${SHARED_PATH}/playlists"

MOPIDY_SYSTEMD_USR_SERVICE="${SYSTEMD_USR_PATH}/mopidy.service"

_mopidy_install_os_dependencies() {
    log "  Add Mopidy APT repository"

    local os_codename
    os_codename=$( . /etc/os-release; printf '%s\n' "$VERSION_CODENAME"; )

    # Mopidy may not have published a repo for the latest Debian release yet; fall back to bookworm
    local mopidy_list_url="https://apt.mopidy.com/${os_codename}.list"
    if ! wget -q --spider "${mopidy_list_url}" 2>/dev/null; then
        log "  No Mopidy repo for ${os_codename}, falling back to bookworm"
        mopidy_list_url="https://apt.mopidy.com/bookworm.list"
    fi

    # Add Mopidy GPG key and repository
    sudo mkdir -p /etc/apt/keyrings
    sudo wget -q -O /etc/apt/keyrings/mopidy-archive-keyring.gpg https://apt.mopidy.com/mopidy.gpg
    sudo wget -q -O /etc/apt/sources.list.d/mopidy.list "${mopidy_list_url}"

    # Pin Mopidy to major version 3 to avoid accidental upgrades
    echo -e "Package: mopidy\nPin: version 3.*\nPin-Priority: 1001" | sudo tee /etc/apt/preferences.d/mopidy > /dev/null

    sudo apt-get -y update

    log "  Install Mopidy OS dependencies"
    local apt_packages=$(get_args_from_file "${INSTALLATION_PATH}/packages-mopidy.txt")
    sudo apt-get -y install \
        $apt_packages \
        --no-install-recommends \
        --allow-downgrades \
        --allow-remove-essential \
        --allow-change-held-packages
}

_mopidy_install_gst_plugin_spotify() {
    log "  Install gst-plugin-spotify"
    local arch
    arch=$(dpkg --print-architecture)
    local gst_plugin_name="gst-plugin-spotify_0.15.0.alpha.1-4_${arch}.deb"
    local gst_plugin_url="https://github.com/kingosticks/gst-plugins-rs-build/releases/download/gst-plugin-spotify_0.15.0-alpha.1-4/${gst_plugin_name}"

    wget -q "${gst_plugin_url}" -O "/tmp/${gst_plugin_name}" || exit_on_error "Failed to download gst-plugin-spotify"
    sudo apt-get -y install "/tmp/${gst_plugin_name}" \
        --allow-downgrades \
        --allow-remove-essential \
        --allow-change-held-packages
    rm -f "/tmp/${gst_plugin_name}"
}

_mopidy_install_python_requirements() {
    log "  Install Mopidy Python requirements"
    # Mopidy plugins are installed globally (outside the jukebox venv)
    # as they are used by the Mopidy daemon, not the jukebox Python process.
    #
    # Mopidy-Spotify 5.x needs Mopidy >= 4.0, which only exists on PyPI (Trixie apt
    # ships 3.4.2). We must NOT use '--upgrade': pip would try to replace Debian-managed
    # dependencies (e.g. typing-extensions) and abort with 'uninstall-no-record-file'.
    #
    # Step 1: install Mopidy 4.x and a new-enough typing-extensions WITHOUT touching
    #         Debian packages ('--ignore-installed --no-deps' => no uninstall attempts,
    #         no cascade into apt-provided deps like pygobject).
    sudo pip3 install --break-system-packages --ignore-installed --no-deps \
        'mopidy>=4.0.0' 'typing-extensions>=4.14.1'
    # Step 2: install the extensions. Debian-satisfied deps are reused; genuinely new
    #         deps (pydantic, httpx, ...) are pulled fresh. No --upgrade.
    sudo pip3 install --break-system-packages \
        -r "${INSTALLATION_PATH}/requirements-mopidy.txt"
}

_mopidy_configure() {
    print_lc "  Configure Mopidy as user service"

    # Disable the system-wide Mopidy service (we run it as a user service instead)
    sudo systemctl stop mopidy.service 2>/dev/null || true
    sudo systemctl disable mopidy.service 2>/dev/null || true

    # Disable MPD (Mopidy replaces it)
    systemctl --user stop mpd.socket 2>/dev/null || true
    systemctl --user stop mpd.service 2>/dev/null || true
    systemctl --user disable mpd.socket 2>/dev/null || true
    systemctl --user disable mpd.service 2>/dev/null || true

    # Create Mopidy user config directory
    mkdir -p "$(dirname "$MOPIDY_CONF_PATH")"

    # Install Mopidy config from template
    cp -f "${INSTALLATION_PATH}/resources/default-settings/mopidy.default.conf" "${MOPIDY_CONF_PATH}"

    # Substitute placeholders
    sed -i "s|%%JUKEBOX_AUDIOFOLDERS_PATH%%|${AUDIOFOLDERS_PATH}|g" "${MOPIDY_CONF_PATH}"
    sed -i "s|%%JUKEBOX_PLAYLISTS_PATH%%|${PLAYLISTS_PATH}|g" "${MOPIDY_CONF_PATH}"
    sed -i "s|%%SPOTIFY_CLIENT_ID%%|${SPOTIFY_CLIENT_ID}|g" "${MOPIDY_CONF_PATH}"
    sed -i "s|%%SPOTIFY_CLIENT_SECRET%%|${SPOTIFY_CLIENT_SECRET}|g" "${MOPIDY_CONF_PATH}"

    chmod 600 "${MOPIDY_CONF_PATH}"

    # Register Mopidy as a user systemd service
    sudo cp -f "${INSTALLATION_PATH}/resources/default-services/mopidy.service" "${MOPIDY_SYSTEMD_USR_SERVICE}"
    sudo sed -i "s|%%MOPIDY_CONF_PATH%%|${MOPIDY_CONF_PATH}|g" "${MOPIDY_SYSTEMD_USR_SERVICE}"
    # Mopidy 4.x is installed via pip (usually /usr/local/bin/mopidy), not the apt
    # location (/usr/bin/mopidy = the 3.x kept only for its gstreamer system deps).
    # Point the service at whichever 'mopidy' resolves first on PATH.
    local mopidy_bin
    mopidy_bin=$(command -v mopidy || echo /usr/local/bin/mopidy)
    sudo sed -i "s|%%MOPIDY_BIN%%|${mopidy_bin}|g" "${MOPIDY_SYSTEMD_USR_SERVICE}"
    sudo chmod 644 "${MOPIDY_SYSTEMD_USR_SERVICE}"

    # Replace the mpd.service dependency in jukebox-daemon.service with mopidy.service
    local jukebox_service="${SYSTEMD_USR_PATH}/jukebox-daemon.service"
    if [[ -f "$jukebox_service" ]]; then
        sudo sed -i 's/Wants=mpd\.service/Wants=mopidy.service/' "$jukebox_service"
    fi

    systemctl --user daemon-reload
    systemctl --user enable mopidy.service
}

_mopidy_check() {
    print_verify_installation

    verify_apt_packages mopidy

    # Verify Mopidy extensions are installed.
    # They are installed globally via 'sudo pip3' (requirements-mopidy.txt) and are
    # easily missed if pip3 is absent or a version pin is incompatible with the OS
    # Python version. Without them Mopidy silently starts without the MPD frontend
    # (port 6600) and the jukebox 'player' plugin fails to connect.
    log "  Verify Mopidy extensions"
    local mopidy_deps_output
    mopidy_deps_output=$(mopidy deps 2>/dev/null)
    local ext
    for ext in Mopidy-MPD Mopidy-Local Mopidy-Spotify; do
        if ! echo "${mopidy_deps_output}" | grep -qi "${ext}"; then
            exit_on_error "ERROR: Mopidy extension '${ext}' is not installed.
Ensure 'python3-pip' is installed (see packages-mopidy.txt) and that
'sudo pip3 install -r requirements-mopidy.txt' succeeded for this OS's Python version."
        fi
    done
    log "  CHECK"

    verify_files_exists "${MOPIDY_CONF_PATH}"
    verify_file_contains_string "${AUDIOFOLDERS_PATH}" "${MOPIDY_CONF_PATH}"
    verify_file_contains_string "${PLAYLISTS_PATH}" "${MOPIDY_CONF_PATH}"

    verify_service_enablement mopidy.service disabled
    verify_service_enablement mopidy.service enabled --user
}

_run_setup_mopidy() {
    _mopidy_install_os_dependencies
    _mopidy_install_gst_plugin_spotify
    _mopidy_install_python_requirements
    _mopidy_configure
    _mopidy_check
}

setup_mopidy() {
    if [[ "$SETUP_MOPIDY" == true ]]; then
        run_with_log_frame _run_setup_mopidy "Install Mopidy (Spotify support)"
    fi
}
