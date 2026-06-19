# PN532 SPI Reader

PN532-based RFID/NFC reader connected via SPI, using the
[Adafruit CircuitPython PN532](https://github.com/adafruit/Adafruit_CircuitPython_PN532) library.

**place-capable**: yes

## Installation

Run the [RFID reader configuration tool](../coreapps.md#RFID-Reader) for guided installation.

The setup script enables the SPI interface via `raspi-config`. A reboot is required afterwards.

## Options

### spi_bus _(0)_

Always 0 on Raspberry Pi. SPI bus 1 is not supported.

### spi_ce _(default=0)_

The SPI Chip Select (CEx) pin. Determines which hardware CE line is used as the PN532 chip select.

- `0` = GPIO8 (SPI0 CE0) — Pin 24
- `1` = GPIO7 (SPI0 CE1) — Pin 26

### pin_irq _(default=0 = disabled)_

Optional IRQ GPIO pin (BCM numbering). When configured, the PN532 asserts this pin low when a card is
detected, reducing SPI polling overhead.

Set to `0` to disable. In that case the reader polls via SPI every 0.5 seconds.

### pin_rst _(default=0 = disabled)_

Optional reset GPIO pin (BCM numbering) for hardware reset of the PN532.

If not used, you **must** tie the `RSTPDN` pin of the PN532 board **HIGH** (or leave it floating if the
board has a pull-up resistor).

### log_all_cards _(default=false)_

When `true`, every card read-out is logged, even if the card remains on the reader. Useful for debugging.

## Card UID format

Card UIDs are returned as a decimal integer string — identical to the existing `pn532_i2c_py532` reader,
so existing card databases are compatible when switching from I2C to SPI.

## Board Connections

### Default wiring (spi_bus=0, spi_ce=0, no IRQ, no RST)

| PN532 Pin | Function             | RPi GPIO              | RPi Pin |
|-----------|----------------------|-----------------------|---------|
| VCC / 5V  | Power (recommended)  | 5V                    | 2 or 4  |
| GND       | Ground               | GND                   | 6       |
| SCK       | SPI Clock            | GPIO11 (SPI0 SCLK)    | 23      |
| MOSI      | Master Out Slave In  | GPIO10 (SPI0 MOSI)    | 19      |
| MISO      | Master In Slave Out  | GPIO9  (SPI0 MISO)    | 21      |
| NSS / CS  | Chip Select (CE0)    | GPIO8  (SPI0 CE0)     | 24      |

> **Note:** Do **not** connect both 3.3V and 5V at the same time.
> Using 5V is recommended as it does not draw power from the Pi's own 3.3V regulator.

### Optional wiring with IRQ and RST (recommended)

| PN532 Pin | Function    | RPi GPIO (example) | RPi Pin |
|-----------|-------------|--------------------|---------|
| IRQ       | Interrupt   | GPIO24             | 18      |
| RSTPDN    | Reset       | GPIO25             | 22      |

## Jumper settings (Adafruit PN532 breakout)

The PN532 breakout board uses two solder jumpers to select the communication interface:

| Jumper | SPI setting |
|--------|-------------|
| SEL0   | OFF         |
| SEL1   | OFF         |

## Hardware

This reader module is compatible with the
[Adafruit PN532 NFC/RFID controller breakout board](https://www.adafruit.com/product/364)
and most PN532-based breakout boards available from other vendors.

The PN532 supports 13.56 MHz cards/tags including:

- NXP Mifare Classic 1K / 4K
- NXP Mifare Ultralight
- NXP Mifare NTAG2xx
- ISO14443-A/B

## Differences from the I2C variant

| Feature          | `pn532_i2c_py532`       | `pn532_spi` (this module)      |
|------------------|-------------------------|--------------------------------|
| Interface        | I2C                     | SPI                            |
| Library          | py532lib                | adafruit-circuitpython-pn532   |
| IRQ support      | No                      | Yes (optional)                 |
| Reset support    | No                      | Yes (optional)                 |
| UID format       | Decimal integer string  | Decimal integer string ✓       |
| Card DB compat.  | ✓                       | ✓ (same UID format)            |
