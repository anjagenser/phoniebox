#!/usr/bin/env bash

_run_setup_rfid_reader() {
    local script="${INSTALLATION_PATH}"/installation/components/setup_rfid_reader.sh
    sudo chmod +x "$script"
    # This step is interactive. Its output goes through a pipe ('tee' into the log),
    # where Python buffers its prompts until the buffer is full - the user would see
    # questions long after they were asked. PYTHONUNBUFFERED keeps them in order.
    PYTHONUNBUFFERED=1 run_and_print_lc "$script"
}

setup_rfid_reader() {
    if [ "$ENABLE_RFID_READER" == true ] ; then
        run_with_log_frame _run_setup_rfid_reader "Install RFID Reader"
    fi
}
