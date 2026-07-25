#!/usr/bin/env bash

_option_static_ip() {
  # ENABLE_STATIC_IP
  # Using the dynamically assigned IP address as it is the best guess to be free
  # Reference: https://unix.stackexchange.com/a/505385
  CURRENT_ROUTE=$(ip route get 8.8.8.8)
  CURRENT_GATEWAY=$(echo "${CURRENT_ROUTE}" | awk '{ print $3; exit }')
  CURRENT_INTERFACE=$(echo "${CURRENT_ROUTE}" | awk '{ print $5; exit }')
  CURRENT_IP_ADDRESS=$(echo "${CURRENT_ROUTE}" | awk '{ print $7; exit }')
  clear_c
  print_c "----------------------- STATIC IP -----------------------

Setting a static IP will save a lot of start up time.
The static adress will be '${CURRENT_IP_ADDRESS}'
from interface '${CURRENT_INTERFACE}'
with the gateway '${CURRENT_GATEWAY}'.

Set a static IP? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      ENABLE_STATIC_IP=false
      ;;
    *)
      ;;
  esac
  log "ENABLE_STATIC_IP=${ENABLE_STATIC_IP}"
}

_option_ipv6() {
  # DISABLE_IPv6
  clear_c
  print_c "------------------------- IP V6 -------------------------

IPv6 is only needed if you intend to use it.
Otherwise it can be disabled.

Do you want to disable IPv6? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      DISABLE_IPv6=false
      ;;
    *)
      ;;
  esac
  log "DISABLE_IPv6=${DISABLE_IPv6}"
}

_option_autohotspot() {
    # ENABLE_AUTOHOTSPOT
    clear_c
    print_c "---------------------- AUTOHOTSPOT ----------------------

When enabled, this service spins up a WiFi hotspot
when the Phoniebox is unable to connect to a known
WiFi. This way you can still access it.

Note:
Static IP configuration cannot be enabled with
WiFi hotspot and will be disabled, if selected before.

Do you want to enable an Autohotspot? [y/N]"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            ENABLE_AUTOHOTSPOT=true
            ;;
        *)
            ;;
    esac

    if [ "$ENABLE_AUTOHOTSPOT" = true ]; then
        #add hostname to default SSID to prevent collision
        local local_hostname=$(hostname)
        AUTOHOTSPOT_SSID="${AUTOHOTSPOT_SSID}_${local_hostname}"
        AUTOHOTSPOT_SSID="${AUTOHOTSPOT_SSID:0:32}"

        local response_autohotspot
        while [[ $response_autohotspot != "n" ]]
        do
            print_c "
--- Current configuration for Autohotpot
SSID              : $AUTOHOTSPOT_SSID
Password          : $AUTOHOTSPOT_PASSWORD
WiFi Country Code : $AUTOHOTSPOT_COUNTRYCODE
IP                : $AUTOHOTSPOT_IP
Do you want to change this values? [y/N]"
            read -r response_autohotspot
            case "$response_autohotspot" in
                [yY][eE][sS]|[yY])
                    local response_ssid=""
                    local response_ssid_length=0
                    while [[ $response_ssid_length -lt 1 || $response_ssid_length -gt 32 ]]
                    do
                        print_c "Please type the hotspot ssid (must be between 1 and 32 characters long):"
                        read -r response_ssid
                        response_ssid_length=$(get_string_length ${response_ssid})
                    done

                    local response_pw=""
                    local response_pw_length=0
                    while [[ $response_pw_length -lt 8 || $response_pw_length -gt 63 ]]
                    do
                        print_c "Please type the new password (must be between 8 and 63 characters long):"
                        read -r response_pw
                        response_pw_length=$(get_string_length ${response_pw})
                    done

                    local response_country_code=""
                    local response_country_code_length=0
                    while [[ $response_country_code_length -ne 2 ]]
                    do
                        print_c "Please type the WiFi country code (e.g. DE, GB, CZ or US):"
                        read -r response_country_code
                        response_country_code="${response_country_code^^}" # to Uppercase
                        response_country_code_length=$(get_string_length ${response_country_code})
                    done

                    AUTOHOTSPOT_SSID="${response_ssid}"
                    AUTOHOTSPOT_PASSWORD="${response_pw}"
                    AUTOHOTSPOT_COUNTRYCODE="${response_country_code}"
                    ;;
                *)
                    response_autohotspot=n
                    ;;
            esac
        done

        if [ "$ENABLE_STATIC_IP" = true ]; then
            ENABLE_STATIC_IP=false
            echo "ENABLE_STATIC_IP=${ENABLE_STATIC_IP}"
        fi
    fi

    echo "ENABLE_AUTOHOTSPOT=${ENABLE_AUTOHOTSPOT}"
    if [ "$ENABLE_AUTOHOTSPOT" = true ]; then
        echo "AUTOHOTSPOT_SSID=${AUTOHOTSPOT_SSID}"
        echo "AUTOHOTSPOT_PASSWORD=${AUTOHOTSPOT_PASSWORD}"
        echo "AUTOHOTSPOT_COUNTRYCODE=${AUTOHOTSPOT_COUNTRYCODE}"
        echo "AUTOHOTSPOT_IP=${AUTOHOTSPOT_IP}"
    fi
}

_option_bluetooth() {
  # DISABLE_BLUETOOTH
  clear_c
  print_c "----------------------- BLUETOOTH -----------------------

Turning off Bluetooth will save energy and
start up time, if you do not plan to use it.

Do you want to disable Bluetooth? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      DISABLE_BLUETOOTH=false
      ;;
    *)
      ;;
  esac
  log "DISABLE_BLUETOOTH=${DISABLE_BLUETOOTH}"
}

_option_mopidy() {
    # SETUP_MOPIDY / SPOTIFY
    clear_c
    print_c "------------------------- SPOTIFY -----------------------

Phoniebox can play Spotify content via Mopidy.
When enabled, Mopidy replaces MPD as the music backend.
Local audio files continue to work through Mopidy-Local.

Note: You need a Spotify Premium account and API credentials.
Get your client_id and client_secret at:
  https://developer.spotify.com/dashboard

Do you want to enable Spotify support? [y/N]"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            SETUP_MOPIDY=true
            SETUP_MPD=false

            if [[ -n "${SPOTIFY_CLIENT_ID}" && -n "${SPOTIFY_CLIENT_SECRET}" ]]; then
                print_c "Using the Spotify credentials that are already set."
            fi

            while [[ -z "${SPOTIFY_CLIENT_ID}" ]]; do
                print_c "Enter your Spotify client_id:"
                read -r SPOTIFY_CLIENT_ID
            done

            while [[ -z "${SPOTIFY_CLIENT_SECRET}" ]]; do
                print_c "Enter your Spotify client_secret:"
                read -r SPOTIFY_CLIENT_SECRET
            done
            ;;
        *)
            ;;
    esac

    log "SETUP_MOPIDY=${SETUP_MOPIDY}"
    if [ "$SETUP_MOPIDY" == true ]; then
        log "SPOTIFY_CLIENT_ID=<set>"
        log "SPOTIFY_CLIENT_SECRET=<set>"
    fi
}

_option_mpd() {
    clear_c
    if [[ "$SETUP_MPD" == true ]]; then
        if [[ -f "${MPD_CONF_PATH}" || -f "${SYSTEMD_USR_PATH}/mpd.service" ]]; then
            print_c "-------------------------- MPD --------------------------

It seems there is a MPD already installed.
Note: It is important that MPD runs as a user service!
Would you like to overwrite your configuration? [Y/n]"
            read -r response
            case "$response" in
                [nN][oO]|[nN])
                    ENABLE_MPD_OVERWRITE_INSTALL=false
                    ;;
                *)
                    ;;
            esac
        fi
    fi

    log "SETUP_MPD=${SETUP_MPD}"
    if [ "$SETUP_MPD" == true ]; then
        log "ENABLE_MPD_OVERWRITE_INSTALL=${ENABLE_MPD_OVERWRITE_INSTALL}"
    fi
}

_option_rfid_reader() {
  # ENABLE_RFID_READER
  clear_c
  print_c "---------------------- RFID READER ----------------------

Phoniebox can be controlled with rfid cards/tags, if you
have a rfid reader connected.
Choose yes to setup a reader. You get prompted for
the type selection and configuration later on.

Do you want to setup a rfid reader? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      ENABLE_RFID_READER=false
      ;;
    *)
      ;;
  esac
  log "ENABLE_RFID_READER=${ENABLE_RFID_READER}"
}

_option_samba() {
  # ENABLE_SAMBA
  clear_c
  print_c "------------------------- SAMBA -------------------------

Samba is required to conveniently copy files
to your Phoniebox via a network share.
If you don't need it, feel free to skip the installation.
If you are unsure, stick to YES!

Do you want to install Samba? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      ENABLE_SAMBA=false
      ;;
    *)
      ;;
  esac
  log "ENABLE_SAMBA=${ENABLE_SAMBA}"
}

_option_webapp() {
  # ENABLE_WEBAPP
  clear_c
  print_c "------------------------ WEB APP ------------------------

This is only required if you want to use
a graphical interface to manage your Phoniebox!

Would you like to install the Web App? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      ENABLE_WEBAPP=false
      ENABLE_KIOSK_MODE=false
      ;;
    *)
      ;;
  esac
  log "ENABLE_WEBAPP=${ENABLE_WEBAPP}"
}

_option_kiosk_mode() {
    # ENABLE_KIOSK_MODE
    clear_c
    print_c "----------------------- KIOSK MODE ----------------------"
    if [[ $(get_architecture) == "armv6" ]]; then

        print_c "
Due to limited resources the kiosk mode is not supported
on Raspberry Pi 1 or Zero 1 ('ARMv6' models).
Kiosk mode will not be installed.

Press enter to continue."
        read
        ENABLE_KIOSK_MODE=false
    else

        print_c "
If you have a screen attached to your RPi,
this will launch the Web App right after boot.
It will only install the necessary xserver dependencies
and not the entire RPi desktop environment.

Would you like to enable the Kiosk Mode? [y/N]"
        read -r response
        case "$response" in
            [yY][eE][sS]|[yY])
            ENABLE_KIOSK_MODE=true
            ;;
            *)
            ;;
        esac
    fi

    log "ENABLE_KIOSK_MODE=${ENABLE_KIOSK_MODE}"
}

_options_update_raspi_os() {
  # UPDATE_RASPI_OS
  clear_c
  print_c "----------------------- UPDATE OS -----------------------

This shall be done eventually,
but increases the installation time a lot.

Would you like to update the operating system? [Y/n]"
  read -r response
  case "$response" in
    [nN][oO]|[nN])
      UPDATE_RASPI_OS=false
      ;;
    *)
      ;;
  esac
  log "UPDATE_RASPI_OS=${UPDATE_RASPI_OS}"
}

_option_audio_output() {
  # AUDIO_HAT / DISABLE_ONBOARD_AUDIO
  # Which speaker hardware is built into this box. Selecting an I2S sound card
  # also enables its overlay during the installation (see setup_audio_hat.sh).
  clear_c
  print_c "--------------------- AUDIO OUTPUT ----------------------

Which audio output is built into your Phoniebox?

For an external sound card the Pi's on-chip audio is
switched off, which makes the sound configuration easier.
(This touches your boot configuration file. A backup copy
will be written, see the install log for details.)

  1) Sound card HAT (HiFiBerry and compatible I2S boards)
  2) USB sound card / USB speaker
  3) Raspberry Pi on-board output (3.5mm jack or HDMI)
  4) Bluetooth speaker only

Enter your choice [1-4]:"
  local response_audio
  read -r response_audio
  case "$response_audio" in
    1)
      _option_audio_hat_board
      DISABLE_ONBOARD_AUDIO=true
      ;;
    2)
      AUDIO_HAT="none"
      DISABLE_ONBOARD_AUDIO=true
      ;;
    3|4|*)
      # On-board output, Bluetooth only, and the default for an empty or invalid
      # answer: leave the Pi's audio as it comes
      AUDIO_HAT="none"
      DISABLE_ONBOARD_AUDIO=false
      ;;
  esac

  log "AUDIO_HAT=${AUDIO_HAT}"
  log "DISABLE_ONBOARD_AUDIO=${DISABLE_ONBOARD_AUDIO}"
}

_option_audio_hat_board() {
  local board_count=${#AUDIO_HAT_CHOICES[@]}
  local selection=""

  while [[ -z "$selection" ]]; do
    print_c "
--- Which sound card is it?"
    local index=1
    local choice
    for choice in "${AUDIO_HAT_CHOICES[@]}"; do
      print_c "  ${index}) ${choice#*|}"
      ((index++))
    done
    print_c "
If you are unsure, check the label on the board.
The HiFiBerry MiniAmp is option 1.

Enter your choice [1-${board_count}]:"
    local response_board
    read -r response_board
    if [[ "$response_board" =~ ^[0-9]+$ ]] \
       && [[ "$response_board" -ge 1 ]] && [[ "$response_board" -le "$board_count" ]]; then
      selection="${AUDIO_HAT_CHOICES[$((response_board - 1))]}"
    else
      print_c "Please enter a number between 1 and ${board_count}."
    fi
  done

  AUDIO_HAT="${selection%%|*}"
}

_option_webapp_devel_build() {
  # A local source tree has no matching pre-built bundle on GitHub (the release
  # assets are keyed by version and commit hash), so it must be built here.
  if [[ "${LOCAL_SOURCE}" == true ]]; then
    ENABLE_WEBAPP_PROD_DOWNLOAD=false
    log "ENABLE_WEBAPP_PROD_DOWNLOAD=${ENABLE_WEBAPP_PROD_DOWNLOAD} (local source install)"
    return
  fi

  # Let's detect if we are on the official release branch
  if [[ "$GIT_BRANCH" != "${GIT_BRANCH_RELEASE}" && "$GIT_BRANCH" != "${GIT_BRANCH_DEVELOP}" ]] || [[ "$GIT_USER" != "$GIT_UPSTREAM_USER" ]] || [[ "$CI_RUNNING" == "true" ]] ; then
    # Unless ENABLE_WEBAPP_PROD_DOWNLOAD is forced to true by user override, do not download a potentially stale build
    if [[ "$ENABLE_WEBAPP_PROD_DOWNLOAD" == "release-only" ]]; then
      ENABLE_WEBAPP_PROD_DOWNLOAD=false
    fi
    if [[ "$ENABLE_WEBAPP_PROD_DOWNLOAD" != true && "$ENABLE_WEBAPP_PROD_DOWNLOAD" != "release-only" ]]; then
      clear_c
      print_c "--------------------- WEB APP BUILD ---------------------

You are installing from a non-release branch
and/or an unofficial repository.
Therefore a pre-build Web App is not available
and it needs to be built locally.
This requires Node to be installed.

If you decline, the lastest pre-build version
from the official repository will be installed.
This can lead to incompatibilities.

Do you want to build the Web App? [Y/n]"
      read -r response
      case "$response" in
        [nN][oO]|[nN])
            ENABLE_WEBAPP_PROD_DOWNLOAD=true
            ;;
        *)
            ;;
      esac
    fi
  fi

  log "ENABLE_WEBAPP_PROD_DOWNLOAD=${ENABLE_WEBAPP_PROD_DOWNLOAD}"
}

_option_audio_output_summary() {
  if [[ "$AUDIO_HAT" != "none" ]]; then
    echo "$(get_audio_hat_description "${AUDIO_HAT}") [${AUDIO_HAT}]"
  elif [[ "$DISABLE_ONBOARD_AUDIO" == true ]]; then
    echo "USB sound card (on-board audio off)"
  else
    echo "Raspberry Pi on-board output / Bluetooth"
  fi
}

_option_backend_summary() {
  if [[ "$SETUP_MOPIDY" == true ]]; then
    echo "Mopidy, with Spotify support"
  elif [[ "$SETUP_MPD" == true ]]; then
    echo "MPD, local files only"
  else
    echo "none"
  fi
}

_option_yes_no_summary() {
  if [[ "$1" == true ]]; then echo "yes"; else echo "no"; fi
}

# Show every choice in one place and let the user confirm the box being built.
# Returns 0 to start the installation, 1 to ask all questions again.
_option_confirm_components() {
  local webapp_summary="no"
  if [[ "$ENABLE_WEBAPP" == true ]]; then
    if [[ "$ENABLE_WEBAPP_PROD_DOWNLOAD" == true || "$ENABLE_WEBAPP_PROD_DOWNLOAD" == "release-only" ]]; then
      webapp_summary="yes, pre-built version"
    else
      webapp_summary="yes, built on this device"
    fi
  fi

  local rfid_summary="no"
  if [[ "$ENABLE_RFID_READER" == true ]]; then
    rfid_summary="yes, reader type is selected during the installation"
  fi

  local autohotspot_summary="no"
  if [[ "$ENABLE_AUTOHOTSPOT" == true ]]; then
    autohotspot_summary="yes, SSID '${AUTOHOTSPOT_SSID}' (${AUTOHOTSPOT_COUNTRYCODE}), ${AUTOHOTSPOT_IP}"
  fi

  local static_ip_summary="no, address from DHCP"
  if [[ "$ENABLE_STATIC_IP" == true ]]; then
    static_ip_summary="yes, ${CURRENT_IP_ADDRESS} on ${CURRENT_INTERFACE}"
  fi

  clear_c
  print_c "================ YOUR PHONIEBOX COMPONENTS ==============

HARDWARE
  Audio output      : $(_option_audio_output_summary)
  RFID reader       : ${rfid_summary}
  Bluetooth         : $(_option_yes_no_summary $([[ "$DISABLE_BLUETOOTH" == true ]] && echo false || echo true))

SOFTWARE
  Music backend     : $(_option_backend_summary)
  Web App           : ${webapp_summary}
  Kiosk mode        : $(_option_yes_no_summary "$ENABLE_KIOSK_MODE")
  Samba file share  : $(_option_yes_no_summary "$ENABLE_SAMBA")

NETWORK
  Autohotspot       : ${autohotspot_summary}
  Static IP         : ${static_ip_summary}
  IPv6              : $(_option_yes_no_summary $([[ "$DISABLE_IPv6" == true ]] && echo false || echo true))

=========================================================

Please check the list against the hardware you built in.
A wrong sound card or reader means no sound and no cards.

Is this correct and should the installation start? [Y/n]
(n = answer all questions again, q = quit)"

  local response_confirm
  read -r response_confirm
  case "$response_confirm" in
    [qQ]|[qQ][uU][iI][tT])
      print_lc "Installation aborted on user request."
      exit 0
      ;;
    [nN][oO]|[nN])
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

# Start each pass from the shipped defaults. Every question keeps the current
# value when the user just presses Enter, so without a reset the second pass
# could not undo an answer given in the first one.
_option_reset_to_defaults() {
  local spotify_client_id="${SPOTIFY_CLIENT_ID}"
  local spotify_client_secret="${SPOTIFY_CLIENT_SECRET}"

  source "${INSTALLATION_PATH}/installation/includes/01_default_config.sh" || exit_on_error

  # Keep credentials that have already been typed in, so they need not be retyped
  SPOTIFY_CLIENT_ID="${spotify_client_id}"
  SPOTIFY_CLIENT_SECRET="${spotify_client_secret}"
}

_run_customize_options() {
  local confirmed=false
  local first_pass=true

  while [[ "$confirmed" == false ]]; do
    if [[ "$first_pass" == false ]]; then
      _option_reset_to_defaults
    fi
    first_pass=false

    _option_ipv6
    _option_static_ip
    _option_autohotspot
    _option_bluetooth
    _option_audio_output
    _option_mopidy
    _option_mpd
    _option_rfid_reader
    _option_samba
    _option_webapp
    if [[ $ENABLE_WEBAPP == true ]] ; then
      _option_webapp_devel_build
      _option_kiosk_mode
    fi
    # Bullseye is currently under active development and should be updated in any case.
    # Hence, removing the step below as it becomse mandatory
    # _options_update_raspi_os

    if _option_confirm_components; then
      confirmed=true
    fi
  done
}

customize_options() {
    run_with_log_frame _run_customize_options "Customize Options"
}
