# RPi-Jukebox-RFID Version 3
# Copyright (c) See file LICENSE in project root folder
import os
import sys

import pytest

sys.path.append(os.path.abspath('src/jukebox'))
from components.rfid.hardware.pn532_spi.protocol import (  # noqa: E402
    CFGITEM_MAX_RETRIES, TargetResponseError, max_retries_params,
    parse_inlist_response, uid_to_card_id)


def inlist_response(uid: bytes, targets: int = 1) -> bytes:
    """Build an InListPassiveTarget response: NbTg, Tg, SENS_RES, SEL_RES, len, UID."""
    return bytes([targets, 0x01, 0x00, 0x04, 0x08, len(uid)]) + uid


class TestParseInlistResponse:
    def test_reads_a_four_byte_uid(self):
        readout = parse_inlist_response(inlist_response(b'\xaa\x58\x00\x70'))
        assert readout.uid == b'\xaa\x58\x00\x70'
        assert readout.targets == 1

    def test_reads_a_seven_byte_uid(self):
        uid = b'\x04\x11\x22\x33\x44\x55\x66'
        assert parse_inlist_response(inlist_response(uid)).uid == uid

    def test_no_card_is_not_an_error(self):
        """NbTg = 0 is the ordinary empty poll, not a collision.

        adafruit_pn532.get_passive_target raises "More than one card detected!" here,
        which is what makes an empty poll able to kill the reader thread.
        """
        readout = parse_inlist_response(bytes([0x00]))
        assert readout.uid is None
        assert readout.targets == 0

    def test_no_response_is_not_an_error(self):
        assert parse_inlist_response(None) == (None, 0)

    def test_several_cards_report_no_uid(self):
        readout = parse_inlist_response(inlist_response(b'\xaa\xbb\xcc\xdd', targets=2))
        assert readout.uid is None
        assert readout.targets == 2

    @pytest.mark.parametrize('response, reason', [
        (b'', 'empty frame'),
        (bytes([0x01, 0x01, 0x00, 0x04]), 'header cut short'),
        (bytes([0x01, 0x01, 0x00, 0x04, 0x08, 0x04, 0xaa]), 'uid cut short'),
        (bytes([0x01, 0x01, 0x00, 0x04, 0x08, 0x63]) + b'\x00' * 9, 'implausible uid length'),
        (bytes([0x01, 0x01, 0x00, 0x04, 0x08, 0x00]), 'zero uid length'),
    ])
    def test_malformed_frames_raise(self, response, reason):
        with pytest.raises(TargetResponseError):
            parse_inlist_response(response)


class TestMaxRetriesParams:
    def test_builds_rfconfiguration_params(self):
        assert max_retries_params(2) == [CFGITEM_MAX_RETRIES, 0xFF, 0x01, 2]

    def test_accepts_the_range_ends(self):
        assert max_retries_params(0)[-1] == 0
        assert max_retries_params(0xFF)[-1] == 0xFF

    @pytest.mark.parametrize('retries', [-1, 256])
    def test_rejects_out_of_range(self, retries):
        with pytest.raises(ValueError):
            max_retries_params(retries)


class TestUidToCardId:
    def test_matches_the_stored_card_id_format(self):
        assert uid_to_card_id(b'\xaa\x58\x00\x70') == '2857894000'

    def test_leading_zero_bytes_collapse(self):
        """Documents existing behaviour: the cards database is keyed on these strings."""
        assert uid_to_card_id(b'\x00\x00\x00\x01') == '1'
