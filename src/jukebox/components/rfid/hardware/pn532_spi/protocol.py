# RPi-Jukebox-RFID Version 3
# Copyright (c) See file LICENSE in project root folder
"""PN532 frame handling that needs no hardware, so it can be tested on its own.

Kept apart from pn532_spi.py because that module imports board/busio and can only be
imported on a Pi with the Adafruit stack installed.
"""
from collections import namedtuple

# NXP UM0701-02
COMMAND_INLISTPASSIVETARGET = 0x4A
COMMAND_RFCONFIGURATION = 0x32
COMMAND_INRELEASE = 0x52
CFGITEM_RF_FIELD = 0x01
CFGITEM_MAX_RETRIES = 0x05
BRTY_ISO14443A_106 = 0x00

#: Longest UID a type A target can report.
MAX_UID_LENGTH = 7

#: uid is None unless exactly one target answered. targets is NbTg as reported.
TargetReadout = namedtuple('TargetReadout', ['uid', 'targets'])


class TargetResponseError(ValueError):
    """An InListPassiveTarget response that cannot be interpreted."""


def max_retries_params(retries: int) -> list:
    """Build RFConfiguration params that bound how long the PN532 hunts for a target.

    The chip powers up with MxRtyPassiveActivation = 0xFF, which means it retries
    forever: a poll that finds nothing then runs until the host stops waiting, instead
    of reporting NbTg = 0. Bounding it turns a fruitless poll from a full host timeout
    into a few tens of milliseconds.
    """
    if not 0 <= retries <= 0xFF:
        raise ValueError(f"retries out of range: {retries}")
    return [CFGITEM_MAX_RETRIES, 0xFF, 0x01, retries]


def parse_inlist_response(response) -> TargetReadout:
    """Pull the UID out of an InListPassiveTarget response.

    Response layout is NbTg, Tg, SENS_RES (2), SEL_RES, NFCIDLength, NFCID[...].

    Note this deliberately does not treat NbTg = 0 as an error. adafruit_pn532's
    get_passive_target raises "More than one card detected!" for every NbTg != 1, so
    the ordinary "no card present" case is indistinguishable there from a real
    collision, and it surfaces as an exception on a completely normal code path.
    """
    if response is None:
        return TargetReadout(None, 0)
    if len(response) < 1:
        raise TargetResponseError("empty InListPassiveTarget response")

    targets = response[0]
    if targets == 0:
        return TargetReadout(None, 0)
    if targets > 1:
        # The response is only sized for one target, so the rest cannot be trusted.
        return TargetReadout(None, targets)

    if len(response) < 6:
        raise TargetResponseError(
            f"InListPassiveTarget response too short for a target: {bytes(response)!r}")
    uid_length = response[5]
    if uid_length == 0 or uid_length > MAX_UID_LENGTH:
        raise TargetResponseError(f"implausible UID length {uid_length}")
    if len(response) < 6 + uid_length:
        raise TargetResponseError(
            f"UID truncated, want {uid_length} bytes: {bytes(response)!r}")
    return TargetReadout(bytes(response[6:6 + uid_length]), 1)


def uid_to_card_id(uid: bytes) -> str:
    """Render a UID the way the card database stores it.

    Leading zero bytes collapse because the UID is read as one integer. That loses
    information, but the cards database is keyed on these strings, so it has to stay.
    """
    return str(int(uid.hex(), base=16))
