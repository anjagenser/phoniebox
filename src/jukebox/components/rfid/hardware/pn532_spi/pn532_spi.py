import logging

import board
import busio
from digitalio import DigitalInOut, Direction
from adafruit_pn532.spi import PN532_SPI

from components.rfid import ReaderBaseClass
import jukebox.cfghandler
import misc.inputminus as pyil
from misc.simplecolors import Colors

from .description import DESCRIPTION

logger = logging.getLogger('jb.rfid.pn532spi')
cfg = jukebox.cfghandler.get_handler('rfid')

# Maps SPI CE number to the corresponding GPIO BCM pin number
_SPI_CE_GPIO = {0: 8, 1: 7}

# A poll blocks for this long before it reports "no card". The retries after a miss are
# kept short so a genuine card removal is still noticed quickly.
_POLL_TIMEOUT = 0.5
_POLL_RETRIES = 2
_POLL_RETRY_TIMEOUT = 0.2

# PN532 commands used for the presence re-poll (NXP UM0701-02)
_COMMAND_RFCONFIGURATION = 0x32
_COMMAND_INRELEASE = 0x52
_CFGITEM_RF_FIELD = 0x01


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
            self._logger.info("No IRQ pin configured — using polling mode (0.5s interval)")

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
        self._keep_running = True

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

        # read_passive_target blocks for up to `timeout` seconds.
        # With IRQ pin configured the library waits for the IRQ signal first,
        # reducing CPU load. Without IRQ pin it polls the SPI bus directly.
        # Either way the 0.5s timeout allows _keep_running to be checked regularly.
        uid = self._read_uid()
        if uid is None:
            return ''

        if not self._keep_running:
            return ''

        try:
            card_id = str(int(uid.hex(), base=16))
        except ValueError:
            self._logger.debug(f"Error while reading card. Raw card ID = {uid!r}")
            return ''

        if self.log_all_cards:
            self._logger.debug(f"Card detected with ID = {card_id}")

        self._repoll_target()
        return card_id

    def _read_uid(self):
        """Poll for a card, retrying briefly before reporting nothing.

        A card that rests in a holder or slot does not answer every poll: the coupling is
        weaker than with a card placed flat on the antenna, and the card needs a moment to
        power up again after the RF field was cycled. Without the retries a single missed
        poll looks like a removed card to the place-and-remove watchdog.
        """
        uid = self.device.read_passive_target(timeout=_POLL_TIMEOUT)
        for _ in range(_POLL_RETRIES):
            if uid is not None or not self._keep_running:
                break
            uid = self.device.read_passive_target(timeout=_POLL_RETRY_TIMEOUT)
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
            self.device.call_function(_COMMAND_INRELEASE, params=[0x00],
                                      response_length=1, timeout=0.5)
            self.device.call_function(_COMMAND_RFCONFIGURATION,
                                      params=[_CFGITEM_RF_FIELD, 0x00], timeout=0.5)
            self.device.call_function(_COMMAND_RFCONFIGURATION,
                                      params=[_CFGITEM_RF_FIELD, 0x01], timeout=0.5)
        except Exception as e:
            self._logger.debug(f"Presence re-poll failed: {e.__class__.__name__}: {e}")
