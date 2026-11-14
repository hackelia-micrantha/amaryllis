#!/usr/bin/env python3
"""Installed Android example model-admission smoke (no model assets or mocks).

Requires one disposable Android emulator with amaryllis.example installed
and the React Native debug Metro server available via adb reverse tcp:8081.
"""

import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


PACKAGE = "amaryllis.example"
ACTIVITY = f"{PACKAGE}/.MainActivity"
BOUNDS = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")


def run(command: list[str], timeout: int = 30) -> str:
    result = subprocess.run(
        command, capture_output=True, text=True, timeout=timeout, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"{command[0]} failed (exit {result.returncode}): "
            f"{result.stderr.strip()[:400]}"
        )
    return result.stdout.strip()


def connected_emulator() -> str:
    output = run(["adb", "devices"])
    serials = [
        line.split()[0]
        for line in output.splitlines()[1:]
        if line.strip() and line.split()[-1] == "device"
    ]
    if len(serials) != 1 or not serials[0].startswith("emulator-"):
        raise AssertionError(f"expected exactly one disposable emulator; found {serials}")
    serial = serials[0]
    if run(["adb", "-s", serial, "shell", "getprop", "ro.kernel.qemu"]) != "1":
        raise AssertionError(f"{serial} did not identify as a QEMU emulator")
    return serial


def adb(serial: str, *args: str, timeout: int = 30) -> str:
    return run(["adb", "-s", serial, *args], timeout=timeout)


def snapshot(serial: str) -> bytes:
    adb(serial, "shell", "uiautomator", "dump", "/sdcard/window.xml", timeout=35)
    data = subprocess.run(
        ["adb", "-s", serial, "exec-out", "cat", "/sdcard/window.xml"],
        capture_output=True, timeout=20, check=True
    ).stdout
    ET.fromstring(data)  # Treat empty/malformed device output as a failure.
    return data


def nodes(root: ET.Element) -> list[ET.Element]:
    return list(root.iter("node"))


def visible_values(root: ET.Element) -> list[str]:
    return [
        value
        for node in nodes(root)
        for key in ("text", "content-desc")
        if (value := node.get(key))
    ]


def assert_welcome(root: ET.Element) -> None:
    values = visible_values(root)
    if "Model Imports" not in values:
        raise AssertionError("Model Imports title absent")
    if "Not imported" not in values:
        raise AssertionError("required model missing-state label absent")
    if "Personas" in values or "Ready to configure SDK." in values:
        raise AssertionError("model-gated application content unexpectedly visible")


def find_continue(root: ET.Element) -> tuple[ET.Element, bool]:
    parent = {child: node for node in root.iter() for child in node}
    matches = [
        node for node in nodes(root)
        if node.get("text") == "Continue" or node.get("content-desc") == "Continue"
    ]
    if len(matches) != 1:
        raise AssertionError(f"expected one visible Continue control, found {len(matches)}")
    target = matches[0]
    current = target
    enabled = True
    while current is not None and current.tag == "node":
        if current.get("enabled") == "false":
            enabled = False
            break
        if current.get("scrollable") == "true":
            break
        current = parent.get(current)
    return target, enabled


def assert_continue(root: ET.Element, expected_enabled: bool) -> tuple[int, int]:
    values = visible_values(root)
    if "Personas" in values or "Ready to configure SDK." in values:
        raise AssertionError("model-gated application content unexpectedly visible")
    target, enabled = find_continue(root)
    if enabled != expected_enabled:
        raise AssertionError(
            f"Continue enabled mismatch: expected {str(expected_enabled).lower()}, "
            f"observed {str(enabled).lower()}"
        )
    match = BOUNDS.fullmatch(target.get("bounds", ""))
    if not match:
        raise AssertionError("Continue accessibility bounds unavailable")
    x1, y1, x2, y2 = map(int, match.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def await_welcome(serial: str, timeout_seconds: int = 150, diagnostic_dir: Path | None = None) -> bytes:
    deadline = time.monotonic() + timeout_seconds
    last_error = "no UI hierarchy received"
    while time.monotonic() < deadline:
        try:
            data = snapshot(serial)
            if diagnostic_dir is not None:
                (diagnostic_dir / 'last-window.xml').write_bytes(data)
            assert_welcome(ET.fromstring(data))
            return data
        except (RuntimeError, AssertionError, ET.ParseError, subprocess.CalledProcessError) as exc:
            last_error = str(exc)
        time.sleep(3)
    if diagnostic_dir is not None:
        try:
            (diagnostic_dir / 'activity.txt').write_text(adb(serial, 'shell', 'dumpsys', 'activity', 'activities'))
            (diagnostic_dir / 'logcat.txt').write_text(adb(serial, 'logcat', '-d', '-t', '400', timeout=20))
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            (diagnostic_dir / 'diagnostic-error.txt').write_text(str(exc))
    raise AssertionError(f"Model Imports not ready after {timeout_seconds}s: {last_error}")


def scroll_to_continue(serial: str) -> bytes:
    dimensions = adb(serial, "shell", "wm", "size")
    match = re.search(r"(\d+)x(\d+)", dimensions)
    if not match:
        raise AssertionError(f"unrecognized emulator size: {dimensions}")
    width, height = map(int, match.groups())
    last = ""
    for _ in range(9):
        data = snapshot(serial)
        try:
            find_continue(ET.fromstring(data))
            return data
        except AssertionError as exc:
            last = str(exc)
        adb(
            serial, "shell", "input", "swipe",
            str(width // 2), str(height * 80 // 100),
            str(width // 2), str(height * 20 // 100), "350",
        )
        time.sleep(1)
    raise AssertionError(f"Continue not reachable by scrolling: {last}")


def launch(serial: str) -> None:
    adb(serial, "shell", "am", "force-stop", PACKAGE)
    adb(serial, "shell", "am", "start", "-W", "-n", ACTIVITY, timeout=40)


def smoke(evidence: Path) -> None:
    evidence.mkdir(parents=True, exist_ok=True)
    serial = connected_emulator()
    metadata = [
        f"serial={serial}",
        f"android_release={adb(serial, 'shell', 'getprop', 'ro.build.version.release')}",
        f"android_sdk={adb(serial, 'shell', 'getprop', 'ro.build.version.sdk')}",
        f"device_model={adb(serial, 'shell', 'getprop', 'ro.product.model')}",
    ]
    with open(os.environ["MODEL_IMPORT_DEBUG_APK"], "rb") as apk:
        metadata.append(f"apk_sha256={hashlib.file_digest(apk, 'sha256').hexdigest()}")
    (evidence / "device.txt").write_text("\n".join(metadata) + "\n")
    print("\n".join(metadata), flush=True)

    adb(serial, "install", "-r", os.environ["MODEL_IMPORT_DEBUG_APK"], timeout=120)
    # A fresh, disposable emulator is required; clear imported app state before the first launch.
    if adb(serial, "shell", "pm", "clear", PACKAGE) != "Success":
        raise AssertionError("app-data clear did not succeed")
    adb(serial, "reverse", "tcp:8081", "tcp:8081")
    launch(serial)

    (evidence / "launch.xml").write_bytes(await_welcome(serial, diagnostic_dir=evidence))
    print("PASS: installed debug app renders Model Imports / Not imported")
    initial = scroll_to_continue(serial)
    (evidence / "before-tap.xml").write_bytes(initial)
    x, y = assert_continue(ET.fromstring(initial), expected_enabled=False)
    print("PASS: Continue is disabled without required model assets")

    adb(serial, "shell", "input", "tap", str(x), str(y))
    time.sleep(2)
    after_tap = snapshot(serial)
    (evidence / "after-tap.xml").write_bytes(after_tap)
    assert_continue(ET.fromstring(after_tap), expected_enabled=False)
    print("PASS: tapping disabled Continue does not enter gated demo")

    launch(serial)
    (evidence / "relaunch.xml").write_bytes(await_welcome(serial))
    after_restart = scroll_to_continue(serial)
    (evidence / "after-restart.xml").write_bytes(after_restart)
    assert_continue(ET.fromstring(after_restart), expected_enabled=False)
    print("PASS: model-import requirement persists after stop/relaunch")

    # Independent process exit status must reject an intentionally false oracle
    # against the *actual* post-restart on-device accessibility hierarchy.
    oracle = subprocess.run(
        [
            sys.executable, str(Path(__file__).resolve()), "assert-snapshot",
            str(evidence / "after-restart.xml"), "--expected-enabled", "true",
        ],
        text=True, capture_output=True, check=False, timeout=15,
    )
    (evidence / "false-assertion.txt").write_text(
        f"exit_status={oracle.returncode}\n{oracle.stderr}"
    )
    if oracle.returncode != 1 or "Continue enabled mismatch" not in oracle.stderr:
        raise AssertionError(
            "deliberately incorrect assertion did not fail in the assertion subprocess"
        )
    print("PASS: deliberate false assertion rejected (exit 1, diagnostic retained)")
    (evidence / "result.txt").write_text(
        "installed_debug_app=PASS\n"
        "initial_model_import_gate=PASS\n"
        "continue_disabled=PASS\n"
        "disabled_tap_denied=PASS\n"
        "relaunch_gate=PASS\n"
        "false_assertion_rejected=PASS\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    smoke_parser = subparsers.add_parser("run")
    smoke_parser.add_argument("evidence_dir", type=Path)
    oracle_parser = subparsers.add_parser("assert-snapshot")
    oracle_parser.add_argument("xml_path", type=Path)
    oracle_parser.add_argument(
        "--expected-enabled", choices=("true", "false"), required=True
    )
    args = parser.parse_args()
    try:
        if args.command == "run":
            smoke(args.evidence_dir)
        else:
            root = ET.fromstring(args.xml_path.read_bytes())
            assert_continue(root, expected_enabled=(args.expected_enabled == "true"))
    except (AssertionError, RuntimeError, ET.ParseError, OSError, subprocess.CalledProcessError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
