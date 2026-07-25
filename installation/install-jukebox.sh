#!/usr/bin/env bash
# One-line install script for the Jukebox Version 3
#
# To install, simply execute
# cd; bash <(wget -qO- https://raw.githubusercontent.com/MiczFlor/RPi-Jukebox-RFID/future3/develop/installation/install-jukebox.sh)
#
# If you want to get a specific branch or a different repository (mainly for developers)
# you may specify them like this
# cd; GIT_USER='MiczFlor' GIT_BRANCH='future3/develop' bash <(wget -qO- https://raw.githubusercontent.com/MiczFlor/RPi-Jukebox-RFID/future3/develop/installation/install-jukebox.sh)
#
export LC_ALL=C

# Set Repo variables if not specified when calling the script
GIT_USER=${GIT_USER:-"MiczFlor"}
GIT_BRANCH=${GIT_BRANCH:-"future3/main"}

# Constants
GIT_REPO_NAME="RPi-Jukebox-RFID"
GIT_URL="https://github.com/${GIT_USER}/${GIT_REPO_NAME}"
echo GIT_BRANCH $GIT_BRANCH
echo GIT_URL $GIT_URL

CURRENT_USER="${SUDO_USER:-$(whoami)}"
CURRENT_USER_GROUP=$(id -gn "$CURRENT_USER")
HOME_PATH=$(getent passwd "$CURRENT_USER" | cut -d: -f6)

# Local source mode
# When this script is started from inside a complete source tree (instead of being
# piped from the web), that tree is installed as it is - nothing is downloaded from
# GitHub. This is the way to install a locally modified or not-yet-published version:
#   cd ~/RPi-Jukebox-RFID && bash installation/install-jukebox.sh
LOCAL_SOURCE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)"
if [[ -n "$LOCAL_SOURCE_PATH" ]] \
   && [[ -d "${LOCAL_SOURCE_PATH}/installation/routines" ]] \
   && [[ -d "${LOCAL_SOURCE_PATH}/src/jukebox" ]]; then
    LOCAL_SOURCE=true
else
    LOCAL_SOURCE=false
    LOCAL_SOURCE_PATH=""
fi

if [[ "$LOCAL_SOURCE" == true ]]; then
    INSTALLATION_PATH="${LOCAL_SOURCE_PATH}"
else
    INSTALLATION_PATH="${HOME_PATH}/${GIT_REPO_NAME}"
fi
INSTALL_ID=$(date +%s)
INSTALLATION_LOGFILE="${HOME_PATH}/INSTALL-${INSTALL_ID}.log"

# Manipulate file descriptor for logging
_setup_logging(){
    if [ "$CI_RUNNING" == "true" ]; then
        exec 3>&1 2>&1
    else
        exec 3>&1 1>>"${INSTALLATION_LOGFILE}" 2>&1 || { echo "ERROR: Cannot create log file."; exit 1; }
    fi
    echo "Log start: ${INSTALL_ID}"
}

# Function to log to both console and logfile
print_lc() {
  local message="$1"
  echo -e "$message" | tee /dev/fd/3
}

# Function to log to logfile only
log() {
  local message="$1"
  echo -e "$message"
}

# Function to run a command where the output will be logged to both console and logfile
run_and_print_lc() {
  "$@" | tee /dev/fd/3
}

# Function to log to console only
print_c() {
  local message="$1"
  echo -e "$message" 1>&3
}

# Function to clear console screen
clear_c() {
  clear 1>&3
}

# Generic emergency error handler that exits the script immediately
# Print additional custom message if passed as first argument
# Examples:
#   a command || exit_on_error
#   a command || exit_on_error "Execution of command failed"
exit_on_error () {
  print_lc "\n****************************************"
  print_lc "ERROR OCCURRED!
A non-recoverable error occurred.
Check install log for details:"
  print_lc "$INSTALLATION_LOGFILE"
  print_lc "****************************************"
  if [[ -n $1 ]]; then
    print_lc "$1"
    print_lc "****************************************"
  fi
  log "Abort!"
  exit 1
}

_check_existing_installation() {
    if [[ "$LOCAL_SOURCE" == true ]]; then
        # The source tree itself is expected to exist here. A virtual environment
        # inside it means the installation has already been run on this tree.
        if [[ -e "${INSTALLATION_PATH}/.venv" ]]; then
            print_lc "
############## EXISTING INSTALLATION FOUND ##############
'${INSTALLATION_PATH}/.venv' exists, so this source tree
has already been installed. Rerunning the installer over
an existing installation is not supported (overwrites
settings, etc). Please backup your 'shared' folder and
manually changed files and run the installation on a
fresh image."
            exit 1
        fi
        return
    fi

    if [[ -e "${INSTALLATION_PATH}" ]]; then
        print_lc "
############## EXISTING INSTALLATION FOUND ##############
Rerunning the installer over an existing installation is
currently not supported (overwrites settings, etc).
Please backup your 'shared' folder and manually changed
files and run the installation on a fresh image."
        exit 1
    fi
}

_download_jukebox_source() {
  log "#########################################################"
  print_c "Downloading Phoniebox software from Github ..."
  print_lc "Download Source: ${GIT_URL}/${GIT_BRANCH}"

  cd "${HOME_PATH}" || exit_on_error "ERROR: Changing to home dir failed."
  wget -qO- "${GIT_URL}/tarball/${GIT_BRANCH}" | tar xz
  # Use case insensitive search/sed because user names in Git Hub are case insensitive
  local git_repo_download=$(find . -maxdepth 1 -type d -iname "${GIT_USER}-${GIT_REPO_NAME}-*")
  log "GIT REPO DOWNLOAD = $git_repo_download"
  GIT_HASH=$(echo "$git_repo_download" | sed -rn "s/.*${GIT_USER}-${GIT_REPO_NAME}-([0-9a-fA-F]+)/\1/ip")
  # Save the git hash for this particular download for later git repo initialization
  log "GIT HASH = $GIT_HASH"
  if [[ -z "${git_repo_download}" ]]; then
    exit_on_error "ERROR: Couldn't find git download."
  fi
  if [[ -z "${GIT_HASH}" ]]; then
    exit_on_error "ERROR: Couldn't determine git hash from download."
  fi
  mv "$git_repo_download" "$GIT_REPO_NAME" || exit_on_error "ERROR: Can't overwrite existing installation."
  log "\nDONE: Downloading Phoniebox software from Github"
  log "#########################################################"
}

_prepare_local_source() {
  log "#########################################################"
  print_lc "Installing the local source tree at ${INSTALLATION_PATH}"
  print_lc "(no download from GitHub)"

  if [[ "${INSTALLATION_PATH}" != "${HOME_PATH}/${GIT_REPO_NAME}" ]]; then
    print_lc "NOTE: the source is not at the documented location
      ${HOME_PATH}/${GIT_REPO_NAME}
      Paths in the documentation refer to that location."
  fi

  # A tree transferred as a tar/zip/copy can have lost the executable bit that
  # git records (100755 -> 100644). Several install steps call scripts with a
  # leading './' (Web App build, sound card overlay, RFID reader), which then
  # fail with 'Permission denied'.
  find "${INSTALLATION_PATH}" -type f -name '*.sh' -exec chmod +x {} + 2>/dev/null

  log "DONE: preparing local source"
  log "#########################################################"
}

_load_sources() {
    # Load / Source dependencies
    for i in "${INSTALLATION_PATH}"/installation/includes/*; do
        source "$i" || exit_on_error
    done

    for j in "${INSTALLATION_PATH}"/installation/routines/*; do
        source "$j" || exit_on_error
    done
}

### SETUP LOGGING
_setup_logging

### CHECK PREREQUISITE
_check_existing_installation

### RUN INSTALLATION
log "Current User: $CURRENT_USER"
log "User home dir: $HOME_PATH"

if [[ "$LOCAL_SOURCE" == true ]]; then
    _prepare_local_source
else
    _download_jukebox_source
fi
cd "${INSTALLATION_PATH}" || exit_on_error "ERROR: Changing to install dir failed."
_load_sources

welcome
run_with_timer install
finish
