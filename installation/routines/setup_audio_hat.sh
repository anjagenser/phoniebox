#!/usr/bin/env bash

# Ordered list of selectable I2S sound cards: "<dtoverlay>|<description>".
# Kept ordered (indexed array, not a hash) so the menu numbering is stable.
# Mirrors the boards supported by components/setup_hifiberry.sh.
AUDIO_HAT_CHOICES=(
    "hifiberry-dac|HiFiBerry DAC / MiniAmp / DAC Zero (PCM5102A)"
    "hifiberry-dacplus|HiFiBerry DAC+ Standard/Pro, Amp2"
    "hifiberry-dacplushd|HiFiBerry DAC2 HD"
    "hifiberry-dacplusadc|HiFiBerry DAC+ ADC"
    "hifiberry-dacplusadcpro|HiFiBerry DAC+ ADC Pro"
    "hifiberry-digi|HiFiBerry Digi+"
    "hifiberry-digi-pro|HiFiBerry Digi+ Pro"
    "hifiberry-amp|HiFiBerry Amp+ (not Amp2)"
    "hifiberry-amp3|HiFiBerry Amp3"
)

get_audio_hat_description() {
    local overlay="$1"
    local choice
    for choice in "${AUDIO_HAT_CHOICES[@]}"; do
        if [[ "${choice%%|*}" == "${overlay}" ]]; then
            echo "${choice#*|}"
            return
        fi
    done
    echo "${overlay}"
}

_audio_hat_enable_overlay() {
    print_lc "  Enable sound card overlay '${AUDIO_HAT}'"
    # setup_hifiberry.sh resolves its helper includes and options/onboard_sound.sh
    # relative to its own directory, so it must run from there.
    cd "${INSTALLATION_PATH}/installation/components" || exit_on_error
    # It exits 1 even on success (legacy behaviour), so the exit code is not checked.
    run_and_print_lc bash ./setup_hifiberry.sh enable "${AUDIO_HAT}"
    cd "${INSTALLATION_PATH}" || exit_on_error
}

_audio_hat_check() {
    print_verify_installation

    local configFile
    configFile=$(get_boot_config_path)
    verify_file_contains_string_once "dtoverlay=${AUDIO_HAT}" "${configFile}"
    # Anchored, so a commented out line in the image's config.txt is not mistaken
    # for an active on-chip audio setting
    verify_file_does_not_contain_string "^dtparam=audio=on" "${configFile}"
}

_run_setup_audio_hat() {
    _audio_hat_enable_overlay
    _audio_hat_check

    # The sound card only appears after a reboot, so its PulseAudio sink cannot be
    # resolved now. An empty 'pulse_sink_name' makes the Jukebox use the system
    # default sink, which is the correct one once the on-board audio is off.
    local tmp_fin_message="AUDIO:      Sound card '${AUDIO_HAT}' is enabled and becomes active after the reboot.
            Verify the output with
            $ pactl list sinks short
            If the Jukebox picks the wrong sink, set 'outputs.primary.pulse_sink_name'
            in shared/settings/jukebox.yaml to the sink name shown there."
    FIN_MESSAGE="${FIN_MESSAGE:+$FIN_MESSAGE\n}${tmp_fin_message}"
}

setup_audio_hat() {
    if [[ "$AUDIO_HAT" != "none" ]]; then
        run_with_log_frame _run_setup_audio_hat "Setup sound card '${AUDIO_HAT}'"
    fi
}
