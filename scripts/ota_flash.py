#!/usr/bin/env python3
"""
MAChip ESP32 Over-The-Air (OTA) Flash Utility
Transmits compiled firmware binary to the ESP32 hardware node over LAN (ArduinoOTA protocol, Port 3232).
"""

import os
import sys
import argparse
import subprocess
import socket
import urllib.request
import json
import time

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BIN_PATH = os.path.join(PROJECT_ROOT, "firmware", "MaChip_Test", "build", "MaChip_Test.ino.bin")
DEFAULT_SKETCH_PATH = os.path.join(PROJECT_ROOT, "firmware", "MaChip_Test", "MaChip_Test.ino")
DEFAULT_BUILD_DIR = os.path.join(PROJECT_ROOT, "firmware", "MaChip_Test", "build")
ESPOTA_SCRIPT = os.path.join(PROJECT_ROOT, "scripts", "espota.py")

ARDUINO_CLI_PATHS = [
    os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Arduino IDE", "resources", "app", "lib", "backend", "resources", "arduino-cli.exe"),
    "arduino-cli"
]

def find_arduino_cli():
    for p in ARDUINO_CLI_PATHS:
        if os.path.isfile(p):
            return p
    return "arduino-cli"

def auto_detect_esp_ip(backend_url="http://127.0.0.1:5000/api/esp/status"):
    print("[OTA] Searching for active ESP32 on the network...")
    
    # 1. Query Node.js Backend for last tracked ESP32 IP
    try:
        req = urllib.request.Request(backend_url, headers={"User-Agent": "MAChip-OTA/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                ip = data.get("ip")
                if ip and ip not in ("127.0.0.1", "localhost", "::1"):
                    print(f"[OTA] Found active ESP32 IP via Backend status: {ip}")
                    return ip
    except Exception as e:
        pass

    # 2. Try resolving mDNS hostname (machip-esp32.local)
    try:
        resolved = socket.gethostbyname("machip-esp32.local")
        if resolved:
            print(f"[OTA] Resolved mDNS hostname machip-esp32.local -> {resolved}")
            return resolved
    except Exception:
        pass

    return None

def compile_firmware(sketch_path=DEFAULT_SKETCH_PATH, build_dir=DEFAULT_BUILD_DIR):
    cli = find_arduino_cli()
    print(f"[OTA-COMPILE] Compiling {os.path.basename(sketch_path)} with {os.path.basename(cli)}...")
    cmd = [
        cli,
        "compile",
        "-b", "esp32:esp32:esp32",
        "--build-path", build_dir,
        sketch_path
    ]
    
    start_time = time.time()
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if res.returncode != 0:
        print("[OTA-COMPILE] Compilation failed!")
        print(res.stdout)
        sys.exit(1)
        
    duration = time.time() - start_time
    print(f"[OTA-COMPILE] Compilation succeeded in {duration:.1f}s.")

def flash_ota(ip, bin_path, port=3232, timeout=15):
    if not os.path.isfile(bin_path):
        print(f"[OTA-ERROR] Binary file not found: {bin_path}")
        print("Run with --compile to build firmware first, or specify a valid --bin path.")
        sys.exit(1)

    bin_size_kb = os.path.getsize(bin_path) / 1024.0
    print(f"[OTA-FLASH] Target IP:       {ip}:{port}")
    print(f"[OTA-FLASH] Firmware Binary: {bin_path} ({bin_size_kb:.1f} KB)")
    print(f"[OTA-FLASH] Connecting to ESP32 over LAN...")

    cmd = [
        sys.executable,
        ESPOTA_SCRIPT,
        "-i", ip,
        "-p", str(port),
        "-f", bin_path,
        "-r",
        "-t", str(timeout)
    ]

    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in iter(process.stdout.readline, ''):
            sys.stdout.write(line)
            sys.stdout.flush()
        process.wait()

        if process.returncode == 0:
            print("\n[OTA-SUCCESS] Firmware flashing completed successfully! The ESP32 is rebooting.")
        else:
            print(f"\n[OTA-ERROR] Flashing exited with return code {process.returncode}")
            sys.exit(process.returncode)
    except KeyboardInterrupt:
        print("\n[OTA-ABORT] Flashing cancelled by user.")
        sys.exit(130)

def main():
    parser = argparse.ArgumentParser(description="MAChip ESP32 ArduinoOTA Flashing Tool")
    parser.add_argument("--ip", type=str, default=None, help="ESP32 IP Address or Hostname (e.g. 192.168.1.86)")
    parser.add_argument("--port", type=int, default=3232, help="ArduinoOTA port (default: 3232)")
    parser.add_argument("--bin", type=str, default=DEFAULT_BIN_PATH, help="Path to compiled .bin file")
    parser.add_argument("--compile", action="store_true", help="Compile firmware before flashing")
    parser.add_argument("--timeout", type=int, default=15, help="OTA handshake timeout in seconds (default: 15)")

    args = parser.parse_args()

    # Step 1: Optional Compilation
    if args.compile or not os.path.isfile(args.bin):
        compile_firmware(DEFAULT_SKETCH_PATH, DEFAULT_BUILD_DIR)

    # Step 2: Determine Target IP
    target_ip = args.ip
    if not target_ip:
        target_ip = auto_detect_esp_ip()

    if not target_ip:
        try:
            target_ip = input("[OTA] Enter ESP32 IP address (e.g. 192.168.1.86): ").strip()
        except EOFError:
            target_ip = None

    if not target_ip:
        print("[OTA-ERROR] Target IP address is required. Use --ip <IP>.")
        sys.exit(1)

    # Step 3: Flash Firmware via espota.py
    flash_ota(target_ip, args.bin, port=args.port, timeout=args.timeout)

if __name__ == "__main__":
    main()
