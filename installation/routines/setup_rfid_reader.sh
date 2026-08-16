#!/usr/bin/env bash

_run_setup_rfid_reader() {
    local script="${INSTALLATION_PATH}"/installation/components/setup_rfid_reader.sh
    sudo chmod +x "$script"
    # This step is interactive. Its output goes through a pipe ('tee' into the log),
    # where Python buffers its prompts until the buffer is full - the user would see
    # questions long after they were asked. PYTHONUNBUFFERED keeps them in order.
    # stderr is routed into the same pipe, so a crashing tool shows its traceback on
    # the console instead of hiding it in the log file.
    local ret
    PYTHONUNBUFFERED=1 "$script" 2>&1 | tee /dev/fd/3
    ret=${PIPESTATUS[0]}

    # A failed registration leaves an empty 'readers: {}' behind. That looks like a
    # finished installation, but no card is ever read - so say it out loud instead of
    # aborting the install, which would force a re-image of the whole box.
    local config="${INSTALLATION_PATH}/shared/settings/rfid.yaml"
    local readers
    readers=$("${INSTALLATION_PATH}/.venv/bin/python" -c "
import sys
from ruamel.yaml import YAML
cfg = YAML(typ='safe').load(open(sys.argv[1])) or {}
print(len((cfg.get('rfid') or {}).get('readers') or {}))
" "${config}" 2>/dev/null) || readers=0

    if [[ $ret -ne 0 ]] || [[ "${readers:-0}" -eq 0 ]]; then
        print_lc "
############## RFID READER NOT CONFIGURED ##############
The reader registration did not complete (exit code ${ret}),
no reader is stored in shared/settings/rfid.yaml. The Jukebox
will run, but it will not read any cards.
########################################################"
        local tmp_fin_message="RFID:       No reader was registered, cards will not be read!
            Re-run the registration (and check its output) with
            $ ${INSTALLATION_PATH}/installation/components/setup_rfid_reader.sh"
        FIN_MESSAGE="${FIN_MESSAGE:+$FIN_MESSAGE\n}${tmp_fin_message}"
    fi
}

setup_rfid_reader() {
    if [ "$ENABLE_RFID_READER" == true ] ; then
        run_with_log_frame _run_setup_rfid_reader "Install RFID Reader"
    fi
}
