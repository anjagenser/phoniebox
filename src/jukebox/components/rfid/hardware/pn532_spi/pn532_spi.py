import logging
import time

import board
import busio
from digitalio import DigitalInOut, Direction
from adafruit_pn532.spi import PN532_SPI

from components.rfid import ReaderBaseClass
import jukebox.cfghandler
import misc.inputminus as pyil
from misc.simplecolors import Colors

from .description import DESCRIPTION
from .protocol import (COMMAND_INLISTPASSIVETARGET, COMMAND_RFCONFIGURATION,
                       COMMAND_INRELEASE, CFGITEM_RF_FIELD, BRTY_ISO14443A_106,
                       TargetResponseError, max_retries_params,
                       parse_inlist_response, uid_to_card_id)

logger = logging.getLogger('jb.rfid.pn532spi')
cfg = jukebox.cfghandler.get_handler('rfid')

# Maps SPI CE number to the corresponding GPIO BCM pin number
_SPI_CE_GPIO = {0: 8, 1: 7}

# Safety net only: with the activation retries bounded the PN532 answers a fruitless
# poll by itself in a few tens of milliseconds, so this timeout should never be reached.
_POLL_TIMEOUT = 0.3

# How long read_card() may keep retrying before it reports "no card".
#
# This is the reader's share of card_removal_delay, so it has to stay well under it: the
# removal watchdog counts down while a poll is in progress, and every second spent here
# is a second in which a card that is still present looks removed. Cheap polls mean many
# attempts fit inside the budget, which is what makes a weakly coupled card survive.
_READ_BUDGET = 0.25

# PN532 activation retries per poll. Low enough that a poll ends promptly, above zero so
# a card that answers late in the anticollision still gets picked up.
_DEFAULT_MAX_RETRIES = 2

# Response is NbTg, Tg, SENS_RES (2), SEL_RES, NFCIDLength, NFCID (up to 7)
_INLIST_RESPONSE_LENGTH = 19


def query_customization() -> dict:
    prompt_color = Colors.lightgreen
    print("\nCustomization parameters for the PN532 (SPI):\n"
          "You will be fine with the default parameters if you use the default wiring.\n"
          "Hitting enter will always pick the default value.\n"
          "If unsure just hit 'enter' on all questions.\n"
          "Note: pin numbers refer to BCM (GPIOxx) numbering!\n")

    print("\nThe SPI CE pin: CE0 or CE1")
    spi_ce = pyil.input_int("SPI CEx (CE0=GPIO8, CE1=GPIO7)?", blank=0, min=0, max=1,
                            prompt_color=prompt_color, prompt_hint=True)

    print("\nThe IRQ GPIO pin for card detection.\n"
          "Using the IRQ pin reduces CPU load compared to pure polling.\n"
          "Enter 0 to disable (polling mode only).")
    pin_irq = pyil.input_int("IRQ GPIO pin (BCM, 0=disabled)?", blank=0, min=0, max=27,
                             prompt_color=prompt_color, prompt_hint=True)

    print("\nReset GPIO pin for hardware reset. Optional.\n"
          "Enter 0 to disable. If disabled, you must tie the RSTPDN pin of the PN532 HIGH.")
    pin_rst = pyil.input_int("Reset GPIO pin (BCM, 0=disabled)?", blank=0, min=0, max=27,
                             prompt_color=prompt_color, prompt_hint=True)

    return {'spi_bus': 0,
            'spi_ce': spi_ce,
            'pin_irq': pin_irq,
            'pin_rst': pin_rst,
            'log_all_cards': False}


class ReaderClass(ReaderBaseClass):
    def __init__(self, reader_cfg_key):
        self._logger = logging.getLogger(f'jb.rfid.pn532spi({reader_cfg_key})')
        super().__init__(reader_cfg_key=reader_cfg_key, description=DESCRIPTION, logger=self._logger)

        with cfg:
            config = cfg.setndefault('rfid', 'readers', reader_cfg_key, 'config', value={})
            if len(config) == 0:
                self._logger.critical("Params dict is empty! Missing mandatory parameters.")
                raise KeyError("Params dict is empty! Missing mandatory parameters.")

            spi_ce = config.setdefault('spi_ce', 0)
            pin_irq = config.setdefault('pin_irq', 0)
            pin_rst = config.setdefault('pin_rst', 0)
            self.log_all_cards = config.setdefault('log_all_cards', False)
            self._max_retries = config.setdefault('max_retries', _DEFAULT_MAX_RETRIES)
            # spi_bus is stored in config for documentation but always 0 on RPi with Blinka
            config.setdefault('spi_bus', 0)

        # Map CE number to GPIO BCM pin
        cs_gpio = _SPI_CE_GPIO.get(spi_ce, 8)
        self._logger.info(f"SPI CE{spi_ce} -> CS on GPIO{cs_gpio}")

        self._cs_pin = DigitalInOut(getattr(board, f'D{cs_gpio}'))

        self._irq_pin = None
        if pin_irq:
            self._irq_pin = DigitalInOut(getattr(board, f'D{pin_irq}'))
            self._irq_pin.direction = Direction.INPUT
            self._logger.info(f"Using IRQ pin GPIO{pin_irq}")
        else:
            self._logger.info(f"No IRQ pin configured — polling for up to {_READ_BUDGET}s per read")

        self._rst_pin = None
        if pin_rst:
            self._rst_pin = DigitalInOut(getattr(board, f'D{pin_rst}'))
            self._logger.info(f"Using reset pin GPIO{pin_rst}")

        self._spi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)
        self.device = PN532_SPI(self._spi, self._cs_pin,
                                irq=self._irq_pin, reset=self._rst_pin,
                                debug=False)

        ic, ver, rev, support = self.device.firmware_version
        self._logger.info(f"PN532 found. Firmware version: {ver}.{rev}")

        self.device.SAM_configuration()
        self._apply_max_retries()
        self._keep_running = True

    def _apply_max_retries(self):
        """Stop the PN532 from hunting indefinitely on a poll that finds nothing.

        Without this a fruitless poll costs the full host timeout (measured: ~515ms),
        which leaves room for barely two poll attempts per second and makes a single
        missed read eat most of card_removal_delay.
        """
        try:
            self.device.call_function(COMMAND_RFCONFIGURATION,
                                      params=max_retries_params(self._max_retries),
                                      timeout=0.5)
            self._logger.info(f"PN532 activation retries bounded to {self._max_retries}")
        except Exception as e:
            self._logger.warning(f"Could not set activation retries, polls will be slow: "
                                 f"{e.__class__.__name__}: {e}")

    def cleanup(self):
        del self.device
        if self._irq_pin is not None:
            self._irq_pin.deinit()
        if self._rst_pin is not None:
            self._rst_pin.deinit()
        self._cs_pin.deinit()
        self._spi.deinit()

    def stop(self):
        self._keep_running = False

    def read_card(self) -> str:
        if not self._keep_running:
            return ''

        uid = self._read_uid()
        if uid is None:
            return ''

        if not self._keep_running:
            return ''

        try:
            card_id = uid_to_card_id(uid)
        except ValueError:
            self._logger.debug(f"Error while reading card. Raw card ID = {uid!r}")
            return ''

        if self.log_all_cards:
            self._logger.debug(f"Card detected with ID = {card_id}")

        self._repoll_target()
        return card_id

    def _poll_target(self):
        """Ask the PN532 once whether a card is in the field.

        InListPassiveTarget is issued directly rather than through
        adafruit_pn532.read_passive_target, because that helper raises
        "More than one card detected!" for NbTg = 0, i.e. every time no card is present.
        Nothing up the call chain catches it, so an ordinary empty poll would take the
        whole reader thread down with it.
        """
        try:
            response = self.device.call_function(COMMAND_INLISTPASSIVETARGET,
                                                 params=[0x01, BRTY_ISO14443A_106],
                                                 response_length=_INLIST_RESPONSE_LENGTH,
                                                 timeout=_POLL_TIMEOUT)
        except Exception as e:
            self._logger.debug(f"Poll failed: {e.__class__.__name__}: {e}")
            return None

        try:
            readout = parse_inlist_response(response)
        except TargetResponseError as e:
            self._logger.debug(f"Unreadable poll response: {e}")
            return None

        if readout.targets > 1:
            self._logger.debug(f"{readout.targets} cards in the field, ignoring")
        return readout.uid

    def _read_uid(self):
        """Poll for a card until the read budget runs out.

        A card that rests in a holder or slot does not answer every poll: the coupling is
        weaker than with a card placed flat on the antenna, and it needs a moment to power
        up again after the RF field was cycled. Retrying rides over those gaps, but the
        budget has to stay small: the card removal watchdog is counting down the whole
        time, so a slow retry loop causes the very dropout it is meant to hide.
        """
        uid = self._poll_target()
        deadline = time.monotonic() + _READ_BUDGET
        while uid is None and self._keep_running and time.monotonic() < deadline:
            uid = self._poll_target()
        return uid

    def _repoll_target(self):
        """Release the activated target and cycle the RF field.

        The PN532 activates a target only once. A card left lying on the reader is not
        reported by any further ``InListPassiveTarget``, which the place-and-remove
        watchdog cannot distinguish from a removal. Releasing the target and dropping the
        field returns the card to IDLE, so the next poll detects it as if freshly placed.

        Best effort: on failure detection degrades to the previous single-shot behaviour
        rather than taking down the reader thread.
        """
        try:
            self.device.call_function(COMMAND_INRELEASE, params=[0x00],
                                      response_length=1, timeout=0.5)
            self.device.call_function(COMMAND_RFCONFIGURATION,
                                      params=[CFGITEM_RF_FIELD, 0x00], timeout=0.5)
            self.device.call_function(COMMAND_RFCONFIGURATION,
                                      params=[CFGITEM_RF_FIELD, 0x01], timeout=0.5)
        except Exception as e:
            self._logger.debug(f"Presence re-poll failed: {e.__class__.__name__}: {e}")
