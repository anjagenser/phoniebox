#!/usr/bin/env python3
"""Compare PN532 polling strategies for a card placement that reads unreliably.

Run with the jukebox daemon stopped, it needs exclusive access to the SPI bus:

    systemctl --user stop jukebox-daemon
    cd /home/pi/RPi-Jukebox-RFID && .venv/bin/python tools/rfid_probe.py sweep
    systemctl --user start jukebox-daemon

The sweep waits for the card by itself, so there is nothing to time: put the card in the
failing position when asked and leave it there until the sweep finishes.

The number that decides whether playback survives is not the hit rate but the longest gap
between two successful reads, because the card removal watchdog pauses once that gap
exceeds card_removal_delay. Every strategy is scored on that.

Strategies:
    legacy    read_passive_target with the PN532 default of unlimited activation
              retries. A poll that finds nothing burns the full host timeout and leaves
              InListPassiveTarget running inside the PN532. This is today's driver.
    abort     legacy, but an ACK frame is sent after a timed-out poll to drop the
              command still in flight, so the next poll starts from a clean state.
    bounded   MxRtyPassiveActivation capped, and InListPassiveTarget issued directly so
              NbTg is parsed here. A poll that finds nothing returns straight away
              instead of running until the host gives up.
"""
import argparse
import sys
import time

import board
import busio
from digitalio import DigitalInOut
from adafruit_pn532.spi import PN532_SPI

_COMMAND_INLISTPASSIVETARGET = 0x4A
_COMMAND_RFCONFIGURATION = 0x32
_COMMAND_INRELEASE = 0x52
_CFGITEM_RF_FIELD = 0x01
_CFGITEM_MAX_RETRIES = 0x05
_MIFARE_ISO14443A = 0x00

# Frame that tells the PN532 to abandon the command it is currently running.
_ACK = b"\x00\x00\xff\x00\xff\x00"

# (label, strategy, poll_timeout, max_retries, loop_wait, repoll)
SWEEP = [
    ("today: legacy, 500ms poll, unlimited retries", "legacy", 0.5, None, 0.2, "cycle"),
    ("legacy + abort after timeout", "abort", 0.5, None, 0.2, "cycle"),
    ("bounded retries=2, 300ms poll", "bounded", 0.3, 2, 0.05, "cycle"),
    ("bounded retries=2, 300ms poll, no repoll", "bounded", 0.3, 2, 0.05, "none"),
    ("bounded retries=0, 300ms poll", "bounded", 0.3, 0, 0.05, "cycle"),
]


def parse_repoll(arg):
    if arg.startswith("cycle:"):
        return "cycle", float(arg.split(":", 1)[1]) / 1000.0
    return arg, 0.0


def set_max_retries(pn532, retries):
    """Bound InListPassiveTarget so a fruitless poll ends by itself.

    NXP UM0701-02 RFConfiguration item 0x05, fields MxRtyATR / MxRtyPSL /
    MxRtyPassiveActivation. The PN532 powers up with MxRtyPassiveActivation = 0xFF,
    meaning it hunts forever and only the host timeout ends the poll.
    """
    pn532.call_function(_COMMAND_RFCONFIGURATION,
                        params=[_CFGITEM_MAX_RETRIES, 0xFF, 0x01, retries & 0xFF],
                        timeout=0.5)


def abort_pending(pn532):
    """Drop a command the PN532 is still running after the host stopped waiting."""
    try:
        pn532._write_data(_ACK)
        return True
    except Exception:
        return False


def poll_legacy(pn532, timeout):
    """Today's path. RuntimeError also covers NbTg=0, which the library misreports."""
    try:
        uid = pn532.read_passive_target(timeout=timeout)
        return uid, ("hit" if uid else "timeout")
    except RuntimeError as e:
        return None, f"error: {e}"


def poll_bounded(pn532, timeout):
    """Issue InListPassiveTarget directly so NbTg=0 is read as 'no card', not an error.

    adafruit_pn532.get_passive_target raises "More than one card detected!" whenever
    NbTg != 1, so NbTg=0 is indistinguishable from a real multi-card collision there.
    """
    try:
        resp = pn532.call_function(_COMMAND_INLISTPASSIVETARGET,
                                   params=[0x01, _MIFARE_ISO14443A],
                                   response_length=19, timeout=timeout)
    except RuntimeError as e:
        return None, f"error: {e}"
    if resp is None:
        return None, "timeout"
    if len(resp) < 6 or resp[0] == 0:
        return None, "no card"
    if resp[0] > 1:
        return None, f"collision nbtg={resp[0]}"
    uidlen = resp[5]
    if uidlen > 7 or len(resp) < 6 + uidlen:
        return None, "bad uid len"
    return bytes(resp[6:6 + uidlen]), "hit"


def repoll(pn532, mode, field_off_delay):
    if mode == "none":
        return "skipped"
    try:
        pn532.call_function(_COMMAND_INRELEASE, params=[0x00], response_length=1, timeout=0.5)
        if mode == "release":
            return "released"
        pn532.call_function(_COMMAND_RFCONFIGURATION,
                            params=[_CFGITEM_RF_FIELD, 0x00], timeout=0.5)
        if field_off_delay:
            time.sleep(field_off_delay)
        pn532.call_function(_COMMAND_RFCONFIGURATION,
                            params=[_CFGITEM_RF_FIELD, 0x01], timeout=0.5)
        return "cycled"
    except Exception as e:
        return f"FAILED {e.__class__.__name__}: {e}"


def reset_target(pn532):
    """Return an activated card to IDLE so the next poll can see it again.

    Every strategy has to start from the same state, otherwise a card left activated by
    the previous run reads as a total failure rather than as a property of the strategy.
    """
    try:
        pn532.call_function(_COMMAND_INRELEASE, params=[0x00], response_length=1, timeout=0.5)
        pn532.call_function(_COMMAND_RFCONFIGURATION,
                            params=[_CFGITEM_RF_FIELD, 0x00], timeout=0.5)
        time.sleep(0.05)
        pn532.call_function(_COMMAND_RFCONFIGURATION,
                            params=[_CFGITEM_RF_FIELD, 0x01], timeout=0.5)
        return True
    except Exception:
        return False


def configure(pn532, strategy, max_retries):
    set_max_retries(pn532, 0xFF if strategy != "bounded" else max_retries)


def run(pn532, strategy, poll_timeout, max_retries, loop_wait, repoll_arg, duration, trace):
    mode, field_off_delay = parse_repoll(repoll_arg)
    configure(pn532, strategy, max_retries)
    reset_target(pn532)
    poll = poll_bounded if strategy == "bounded" else poll_legacy

    polls = hits = errors = 0
    poll_ms_total = 0.0
    gaps = []
    last_hit = first_hit = None
    streak = 0
    uids = set()

    t0 = time.monotonic()
    t_end = t0 + duration
    while time.monotonic() < t_end:
        t_poll = time.monotonic()
        uid, status = poll(pn532, poll_timeout)
        poll_ms = (time.monotonic() - t_poll) * 1000
        polls += 1
        poll_ms_total += poll_ms

        if uid is None:
            streak += 1
            if status.startswith("error"):
                errors += 1
            if strategy == "abort" and status == "timeout":
                abort_pending(pn532)
            if trace:
                print(f"{time.monotonic() - t0:7.2f}  {poll_ms:5.0f}m      -  "
                      f"{status} (#{streak} in a row)")
        else:
            hits += 1
            streak = 0
            uids.add(uid.hex())
            now = time.monotonic()
            if last_hit is not None:
                gaps.append(now - last_hit)
            else:
                first_hit = now
            last_hit = now
            t_repoll = time.monotonic()
            rstatus = repoll(pn532, mode, field_off_delay)
            repoll_ms = (time.monotonic() - t_repoll) * 1000
            if trace:
                print(f"{time.monotonic() - t0:7.2f}  {poll_ms:5.0f}m  {repoll_ms:5.0f}m  "
                      f"uid={uid.hex()} -> id={int(uid.hex(), base=16)}  [{rstatus}]")
        time.sleep(loop_wait)

    # The trailing miss streak is a gap too: it is what the watchdog would have been timing.
    if last_hit is not None:
        gaps.append(time.monotonic() - last_hit)

    elapsed = time.monotonic() - t0
    g = sorted(gaps)
    return {
        "polls": polls, "hits": hits, "errors": errors,
        "hit_rate": hits / polls if polls else 0.0,
        "polls_per_s": polls / elapsed if elapsed else 0.0,
        "avg_poll_ms": poll_ms_total / polls if polls else 0.0,
        "max_gap": g[-1] if g else float("nan"),
        "p90_gap": g[int(len(g) * 0.9)] if g else float("nan"),
        "median_gap": g[len(g) // 2] if g else float("nan"),
        "held_s": (last_hit - first_hit) if (first_hit and last_hit) else 0.0,
        "uids": uids,
    }


def print_summary(label, s, removal_delay):
    verdict = "survives" if s["max_gap"] < removal_delay else "would PAUSE"
    errors = f"   errors {s['errors']}" if s["errors"] else ""
    print(f"    polls {s['polls']:4d} @ {s['polls_per_s']:5.1f}/s   hits {s['hits']:4d} "
          f"({s['hit_rate'] * 100:4.1f}%)   avg poll {s['avg_poll_ms']:5.0f}ms{errors}")
    print(f"    gap between reads: median {s['median_gap']:5.2f}s  p90 {s['p90_gap']:5.2f}s  "
          f"max {s['max_gap']:5.2f}s")
    print(f"    vs card_removal_delay {removal_delay:.1f}s -> {verdict}")
    if len(s["uids"]) > 1:
        print(f"    WARNING: more than one uid seen: {sorted(s['uids'])}")


def recover_release(pn532):
    pn532.call_function(_COMMAND_INRELEASE, params=[0x00], response_length=1, timeout=0.5)


def recover_field(pn532, off_s):
    pn532.call_function(_COMMAND_RFCONFIGURATION,
                        params=[_CFGITEM_RF_FIELD, 0x00], timeout=0.5)
    time.sleep(off_s)
    pn532.call_function(_COMMAND_RFCONFIGURATION,
                        params=[_CFGITEM_RF_FIELD, 0x01], timeout=0.5)


def recover_sam(pn532):
    pn532.SAM_configuration()


# (consecutive misses that trigger it, label, action)
RECOVERY_LADDER = [
    (4, "InRelease", lambda p: recover_release(p)),
    (8, "field cycle 50ms", lambda p: recover_field(p, 0.05)),
    (12, "field cycle 300ms", lambda p: recover_field(p, 0.3)),
    (16, "field cycle 1s", lambda p: recover_field(p, 1.0)),
    (20, "SAM_configuration", lambda p: recover_sam(p)),
    (24, "SAM + field cycle 1s", lambda p: (recover_sam(p), recover_field(p, 1.0))),
]


def diag(pn532, duration, poll_timeout, max_retries):
    """Find out what it takes to make an activated card visible again.

    Escalates through increasingly heavy recovery actions during a miss streak and
    records which one preceded the next successful read. If nothing ever recovers it,
    the card is not answering at all and the cause is not the PN532 state machine.
    """
    set_max_retries(pn532, max_retries)
    print(f"{'t':>7}  {'poll':>6}  event")
    sys.stdout.flush()

    t0 = time.monotonic()
    t_end = t0 + duration
    streak = 0
    last_recovery = "none"
    fired = set()
    hits = 0
    credit = {}

    while time.monotonic() < t_end:
        t_poll = time.monotonic()
        uid, status = poll_bounded(pn532, poll_timeout)
        poll_ms = (time.monotonic() - t_poll) * 1000
        now = time.monotonic() - t0

        if uid is not None:
            hits += 1
            credit[last_recovery] = credit.get(last_recovery, 0) + 1
            print(f"{now:7.2f}  {poll_ms:5.0f}m  HIT uid={uid.hex()}  "
                  f"(after {streak} misses, last recovery: {last_recovery})")
            sys.stdout.flush()
            streak = 0
            fired = set()
            last_recovery = "none"
            # Hand the card back to IDLE the way the driver does today.
            try:
                recover_release(pn532)
                recover_field(pn532, 0.0)
            except Exception:
                pass
        else:
            streak += 1
            # Restart the ladder so every escalation keeps getting tried for the whole run.
            if streak > RECOVERY_LADDER[-1][0] + 4:
                streak = 0
                fired = set()
                last_recovery = "none"
            for threshold, label, action in RECOVERY_LADDER:
                if streak == threshold and threshold not in fired:
                    fired.add(threshold)
                    try:
                        action(pn532)
                        last_recovery = label
                        print(f"{now:7.2f}       -  recovery: {label} (after {streak} misses)")
                    except Exception as e:
                        print(f"{now:7.2f}       -  recovery {label} FAILED: "
                              f"{e.__class__.__name__}: {e}")
                    sys.stdout.flush()
        time.sleep(0.05)

    print(f"\n  hits: {hits}")
    if credit:
        print("  what preceded each hit:")
        for label, n in sorted(credit.items(), key=lambda kv: -kv[1]):
            print(f"    {n:4d} x  {label}")
    else:
        print("  the card never answered: not a PN532 state-machine problem")


def profile(pn532, duration, poll_timeout, max_retries):
    """Report the read rate per second while the card is moved through the field.

    Detection failing at rest but working in transit points at the coupling volume rather
    than at anything in software, so what matters is where in space the card answers.
    """
    set_max_retries(pn532, max_retries)
    reset_target(pn532)
    print(f"{'t':>7}  {'polls':>6}  {'hits':>5}  rate")
    sys.stdout.flush()

    t0 = time.monotonic()
    t_end = t0 + duration
    bucket_start = t0
    polls = hits = 0
    while time.monotonic() < t_end:
        uid, status = poll_bounded(pn532, poll_timeout)
        polls += 1
        if uid is not None:
            hits += 1
            try:
                recover_release(pn532)
                recover_field(pn532, 0.0)
            except Exception:
                pass
        now = time.monotonic()
        if now - bucket_start >= 1.0:
            rate = hits / polls if polls else 0.0
            bar = "#" * int(rate * 40)
            print(f"{now - t0:7.1f}  {polls:6d}  {hits:5d}  {rate * 100:5.1f}%  {bar}")
            sys.stdout.flush()
            bucket_start = now
            polls = hits = 0
        time.sleep(0.02)


def make_beep(path="/tmp/rfid_probe_beep.wav", freq=880.0, ms=90):
    """Write a short tone to play on every read, so the sweet spot can be found by ear."""
    import math
    import struct
    import wave

    rate = 22050
    frames = int(rate * ms / 1000)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        data = bytearray()
        for i in range(frames):
            # Fade the tail out, a hard cut clicks and is harder to localise by ear.
            envelope = min(1.0, (frames - i) / (rate * 0.02))
            sample = int(18000 * envelope * math.sin(2 * math.pi * freq * i / rate))
            data += struct.pack("<h", sample)
        w.writeframes(bytes(data))
    return path


def hunt(pn532, duration, poll_timeout, max_retries, player):
    """Beep on every successful read while the card or the reader is moved.

    Finding the working position by eye needs someone watching the terminal, which is
    exactly what is impossible with the box open and both hands busy.
    """
    import subprocess

    beep_path = make_beep()
    set_max_retries(pn532, max_retries)
    reset_target(pn532)
    print(f"Beeping on every read for {duration:.0f}s using {player}.")
    print("Move the card, or the reader, until it beeps steadily.\n")
    print(f"{'t':>7}  {'polls':>6}  {'hits':>5}  rate")
    sys.stdout.flush()

    t0 = time.monotonic()
    t_end = t0 + duration
    bucket_start = t0
    polls = hits = 0
    last_beep = 0.0
    devnull = subprocess.DEVNULL
    while time.monotonic() < t_end:
        uid, status = poll_bounded(pn532, poll_timeout)
        polls += 1
        now = time.monotonic()
        if uid is not None:
            hits += 1
            if now - last_beep > 0.18:
                last_beep = now
                try:
                    subprocess.Popen([player, beep_path], stdout=devnull, stderr=devnull)
                except Exception as e:
                    print(f"  could not play beep: {e.__class__.__name__}: {e}")
            try:
                recover_release(pn532)
                recover_field(pn532, 0.0)
            except Exception:
                pass
        if now - bucket_start >= 1.0:
            rate = hits / polls if polls else 0.0
            print(f"{now - t0:7.1f}  {polls:6d}  {hits:5d}  {rate * 100:5.1f}%  "
                  f"{'#' * int(rate * 40)}")
            sys.stdout.flush()
            bucket_start = now
            polls = hits = 0
        time.sleep(0.02)


def wait_for_card(pn532, limit=180.0):
    """Block until the card shows up, so the sweep needs no coordination."""
    set_max_retries(pn532, 0xFF)
    print(f"\nPut the card in the FAILING position now (waiting up to {limit:.0f}s)...")
    sys.stdout.flush()
    t_end = time.monotonic() + limit
    while time.monotonic() < t_end:
        uid, _ = poll_legacy(pn532, 0.5)
        if uid is not None:
            # Detecting the card activates it; hand it back to IDLE for the first run.
            reset_target(pn532)
            print(f"  card {uid.hex()} seen. Leave it exactly where it is.\n")
            sys.stdout.flush()
            return True
    print("  no card seen, giving up.")
    return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", nargs="?", default="sweep", choices=["sweep", "trace", "diag", "profile", "hunt"])
    p.add_argument("--strategy", default="legacy", choices=["legacy", "abort", "bounded"])
    p.add_argument("--poll-timeout", type=float, default=0.5)
    p.add_argument("--max-retries", type=int, default=2)
    p.add_argument("--loop-wait", type=float, default=0.2)
    p.add_argument("--repoll", default="cycle")
    p.add_argument("--duration", type=float, default=15.0)
    p.add_argument("--removal-delay", type=float, default=1.0)
    p.add_argument("--no-wait", action="store_true", help="skip waiting for the card")
    p.add_argument("--player", default="paplay", help="command used to play the beep")
    args = p.parse_args()

    cs_pin = DigitalInOut(board.D8)
    spi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)
    pn532 = PN532_SPI(spi, cs_pin, irq=None, reset=None, debug=False)
    ic, ver, rev, support = pn532.firmware_version
    print(f"PN532 firmware {ver}.{rev}")
    sys.stdout.flush()
    pn532.SAM_configuration()

    try:
        if args.command == "hunt":
            hunt(pn532, args.duration, args.poll_timeout, args.max_retries, args.player)
        elif args.command == "profile":
            profile(pn532, args.duration, args.poll_timeout, args.max_retries)
        elif args.command == "diag":
            if not args.no_wait and not wait_for_card(pn532):
                return 1
            diag(pn532, args.duration, args.poll_timeout, args.max_retries)
        elif args.command == "trace":
            if not args.no_wait and not wait_for_card(pn532):
                return 1
            print(f"strategy={args.strategy} poll={args.poll_timeout}s "
                  f"retries={args.max_retries} loop={args.loop_wait}s repoll={args.repoll}\n")
            print(f"{'t':>7}  {'poll':>6}  {'repoll':>6}  result")
            s = run(pn532, args.strategy, args.poll_timeout, args.max_retries,
                    args.loop_wait, args.repoll, args.duration, trace=True)
            print()
            print_summary("result", s, args.removal_delay)
        else:
            if not args.no_wait and not wait_for_card(pn532):
                return 1
            total = len(SWEEP) * args.duration
            print(f"Sweep: {len(SWEEP)} strategies x {args.duration:.0f}s "
                  f"(~{total:.0f}s). Do not move the card.")
            sys.stdout.flush()
            results = []
            for label, strategy, poll_timeout, retries, loop_wait, repoll_arg in SWEEP:
                print(f"\n>> {label}")
                sys.stdout.flush()
                s = run(pn532, strategy, poll_timeout, retries, loop_wait,
                        repoll_arg, args.duration, trace=False)
                print_summary(label, s, args.removal_delay)
                sys.stdout.flush()
                results.append((label, s))
            print("\n=== ranked by longest gap (lower is better) ===")
            for label, s in sorted(results, key=lambda r: r[1]["max_gap"]):
                print(f"  max {s['max_gap']:5.2f}s  median {s['median_gap']:5.2f}s  "
                      f"{s['polls_per_s']:5.1f} polls/s  {label}")
            print("\nCard can be removed now.")
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        try:
            set_max_retries(pn532, 0xFF)
        except Exception:
            pass
        cs_pin.deinit()
        spi.deinit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
