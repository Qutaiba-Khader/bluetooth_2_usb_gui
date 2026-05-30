#!/usr/bin/env python3
"""Serial daemon for WebSerial communication over /dev/ttyGS0.
JSON-line protocol: one JSON object per line, newline-terminated."""

import asyncio
import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from bt_manager import BluetoothManager
from net_manager import NetworkManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("serial_daemon")

SERIAL_DEV = "/dev/ttyGS0"


class SerialDaemon:
    def __init__(self):
        self.bt = BluetoothManager()
        self.net = NetworkManager()
        self.reader = None
        self.writer = None

    async def open(self):
        log.info(f"Opening {SERIAL_DEV}")
        r, w = await asyncio.open_connection(host=None, port=None)
        # asyncio doesn't support serial natively, use raw fd
        self.fd = os.open(SERIAL_DEV, os.O_RDWR | os.O_NOCTTY)
        log.info("Serial daemon running")

    async def respond(self, obj):
        line = json.dumps(obj, separators=(",", ":")) + "\n"
        data = line.encode("utf-8")
        loop = asyncio.get_event_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(None, os.write, self.fd, data),
                timeout=3.0,
            )
        except asyncio.TimeoutError:
            log.warning("Write timed out")
        except Exception as e:
            log.error(f"Write error: {e}")

    async def handle(self, msg):
        cmd = msg.get("cmd", "")
        log.info(f"Command: {cmd}")

        try:
            if cmd == "adapter":
                info = await self.bt.get_adapter()
                connected = await self.bt._get_connected_macs()
                info["connected_count"] = len(connected)
                await self.respond({"ok": True, "data": info})

            elif cmd == "devices":
                devices = await self.bt.get_paired_devices()
                await self.respond({"ok": True, "devices": devices})

            elif cmd == "scan_start":
                await self.bt.scan_start()
                await self.respond({"ok": True})

            elif cmd == "scan_stop":
                await self.bt.scan_stop()
                await self.respond({"ok": True})

            elif cmd == "scan_results":
                devices = await self.bt.scan_results()
                await self.respond({"ok": True, "devices": devices})

            elif cmd == "pair":
                result = await self.bt.pair_and_trust(msg.get("mac", ""))
                await self.respond(result)

            elif cmd == "pair_confirm":
                result = await self.bt.confirm_passkey(msg.get("mac", ""), msg.get("confirmed", False))
                await self.respond(result)

            elif cmd == "pair_status":
                result = self.bt.get_pairing_status(msg.get("mac"))
                await self.respond(result)

            elif cmd == "connect":
                result = await self.bt.connect(msg.get("mac", ""))
                await self.respond(result)

            elif cmd == "disconnect":
                result = await self.bt.disconnect(msg.get("mac", ""))
                await self.respond(result)

            elif cmd == "trust":
                result = await self.bt.trust(msg.get("mac", ""))
                await self.respond(result)

            elif cmd == "remove":
                result = await self.bt.remove(msg.get("mac", ""))
                await self.respond(result)

            elif cmd == "network":
                status = await self.net.get_status()
                await self.respond({"ok": True, "data": status})

            elif cmd == "wifi_scan":
                networks = await self.net.scan_wifi()
                await self.respond({"ok": True, "networks": networks})

            elif cmd == "wifi_connect":
                result = await self.net.connect_wifi(msg.get("ssid", ""), msg.get("password", ""))
                await self.respond(result)

            elif cmd == "hotspot_start":
                result = await self.net.start_hotspot()
                await self.respond(result)

            elif cmd == "ping":
                await self.respond({"ok": True, "pong": True})

            else:
                await self.respond({"ok": False, "error": f"Unknown command: {cmd}"})

        except Exception as e:
            log.error(f"Handler error: {e}")
            await self.respond({"ok": False, "error": str(e)})

    async def read_loop(self):
        loop = asyncio.get_event_loop()
        buf = b""
        while True:
            try:
                chunk = await loop.run_in_executor(None, os.read, self.fd, 4096)
                if not chunk:
                    await asyncio.sleep(0.1)
                    continue
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        msg = json.loads(line)
                        await self.handle(msg)
                    except json.JSONDecodeError:
                        log.warning(f"Invalid JSON: {line[:100]}")
                        await self.respond({"ok": False, "error": "Invalid JSON"})
            except OSError as e:
                log.error(f"Read error: {e}")
                await asyncio.sleep(1)


async def main():
    daemon = SerialDaemon()
    daemon.fd = os.open(SERIAL_DEV, os.O_RDWR | os.O_NOCTTY)
    log.info(f"Serial daemon running on {SERIAL_DEV}")
    await daemon.read_loop()


if __name__ == "__main__":
    asyncio.run(main())
