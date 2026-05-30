#!/usr/bin/env python3
"""WebHID config daemon — reads /dev/hidg3, dispatches BT and WiFi commands."""

import asyncio
import fcntl
import logging
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bt_manager import BluetoothManager
from net_manager import NetworkManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%y-%m-%d %H:%M:%S",
)
log = logging.getLogger("webhid")

HIDG_PATH = "/dev/hidg3"
REPORT_SIZE = 64
REPORT_ID_CMD = 1
REPORT_ID_RSP = 2
VERSION = "1.0.0"

GADGET_HID_WRITE_GET_REPORT = (1 << 30) | (2 << 16) | (ord('g') << 8) | 0x42

CMD_GET_DEVICE_LIST = 0x01
CMD_GET_DEVICE_INFO = 0x02
CMD_SCAN_START = 0x03
CMD_SCAN_STOP = 0x04
CMD_SCAN_RESULTS = 0x05
CMD_PAIR_DEVICE = 0x06
CMD_PAIR_CONFIRM = 0x07
CMD_UNPAIR_DEVICE = 0x08
CMD_CONNECT = 0x09
CMD_DISCONNECT = 0x0A
CMD_GET_ADAPTER_INFO = 0x0B
CMD_GET_VERSION = 0x0D
CMD_WIFI_STATUS = 0x10
CMD_WIFI_ENABLE = 0x11
CMD_WIFI_DISABLE = 0x12
CMD_WIFI_HOTSPOT = 0x13
CMD_WIFI_SCAN = 0x14
CMD_WIFI_CONNECT = 0x15

STATUS_OK = 0x00
STATUS_ERROR = 0x01
STATUS_BUSY = 0x02
STATUS_NOT_FOUND = 0x03
STATUS_PASSKEY_DISPLAY = 0x04
STATUS_PASSKEY_CONFIRM = 0x05

DEVICE_TYPES = {
    "keyboard": 1, "mouse": 2, "gamepad": 3, "audio": 4, "combo": 5, "device": 0,
}
DEVICE_ICONS = {
    "keyboard": 1, "mouse": 2, "gamepad": 3, "audio": 4, "combo": 5,
}


def mac_to_bytes(mac):
    return bytes(int(h, 16) for h in mac.split(":"))


def bytes_to_mac(data, offset=0):
    return ":".join(f"{data[offset + i]:02X}" for i in range(6))


def pack_string(s, length):
    encoded = s.encode("utf-8")[:length - 1]
    return encoded + b"\x00" * (length - len(encoded))


def unpack_string(data, offset, length):
    chunk = data[offset:offset + length]
    end = chunk.find(b"\x00")
    if end != -1:
        chunk = chunk[:end]
    return chunk.decode("utf-8", errors="replace").strip()


def pack_device(dev):
    buf = bytearray(32)
    mac_bytes = mac_to_bytes(dev["mac"])
    buf[0:6] = mac_bytes
    buf[6] = 0
    flags = 0
    if dev.get("paired"):
        flags |= 1
    if dev.get("trusted"):
        flags |= 2
    if dev.get("connected"):
        flags |= 4
    if dev.get("supported", True):
        flags |= 8
    buf[7] = flags
    buf[8] = DEVICE_TYPES.get(dev.get("type", "device"), 0)
    name = dev.get("name", dev["mac"])[:23]
    encoded = name.encode("utf-8")[:23]
    buf[9:9 + len(encoded)] = encoded
    return bytes(buf)


class ConfigDaemon:
    def __init__(self):
        self.bt = BluetoothManager()
        self.net = NetworkManager()
        self.fd = None
        self.scan_cache = []
        self.wifi_scan_cache = []
        self.write_lock = asyncio.Lock()

    def make_response(self, status, cmd, seq=0, total=1, data=b""):
        buf = bytearray(63)
        buf[0] = status
        buf[1] = cmd
        buf[2] = seq
        buf[3] = total
        if data:
            n = min(len(data), 59)
            buf[4:4 + n] = data[:n]
        return bytes(buf)

    def error_response(self, cmd, msg=""):
        data = msg.encode("utf-8")[:59] if msg else b""
        return self.make_response(STATUS_ERROR, cmd, data=data)

    async def send(self, response):
        report = bytes([REPORT_ID_RSP]) + response
        report = report[:REPORT_SIZE].ljust(REPORT_SIZE, b"\x00")
        buf = struct.pack('<H', len(report)) + report
        loop = asyncio.get_event_loop()
        async with self.write_lock:
            try:
                await loop.run_in_executor(None, fcntl.ioctl, self.fd, GADGET_HID_WRITE_GET_REPORT, buf)
            except Exception as e:
                log.error(f"Write error (ioctl): {e}, falling back to write()")
                try:
                    await loop.run_in_executor(None, os.write, self.fd, report)
                except Exception as e2:
                    log.error(f"Write fallback error: {e2}")

    async def handle(self, cmd, payload):
        try:
            handlers = {
                CMD_GET_VERSION: self.cmd_version,
                CMD_GET_ADAPTER_INFO: self.cmd_adapter_info,
                CMD_GET_DEVICE_LIST: self.cmd_device_list,
                CMD_SCAN_START: self.cmd_scan_start,
                CMD_SCAN_STOP: self.cmd_scan_stop,
                CMD_SCAN_RESULTS: self.cmd_scan_results,
                CMD_PAIR_DEVICE: self.cmd_pair,
                CMD_PAIR_CONFIRM: self.cmd_pair_confirm,
                CMD_UNPAIR_DEVICE: self.cmd_unpair,
                CMD_CONNECT: self.cmd_connect,
                CMD_DISCONNECT: self.cmd_disconnect,
                CMD_WIFI_STATUS: self.cmd_wifi_status,
                CMD_WIFI_ENABLE: self.cmd_wifi_enable,
                CMD_WIFI_DISABLE: self.cmd_wifi_disable,
                CMD_WIFI_HOTSPOT: self.cmd_wifi_hotspot,
                CMD_WIFI_SCAN: self.cmd_wifi_scan,
                CMD_WIFI_CONNECT: self.cmd_wifi_connect,
            }
            handler = handlers.get(cmd)
            if handler:
                await handler(cmd, payload)
            else:
                await self.send(self.error_response(cmd, "Unknown command"))
        except Exception as e:
            log.error(f"Command {cmd:#x} failed: {e}")
            await self.send(self.error_response(cmd, str(e)[:59]))

    # --- BT commands ---

    async def cmd_version(self, cmd, payload):
        await self.send(self.make_response(STATUS_OK, cmd, data=VERSION.encode()))

    async def cmd_adapter_info(self, cmd, payload):
        info = await self.bt.get_adapter()
        connected = await self.bt._get_connected_macs()
        data = bytearray(59)
        flags = 0
        if info.get("powered"):
            flags |= 1
        data[0] = flags
        mac_str = info.get("address", "00:00:00:00:00:00")
        try:
            data[1:7] = mac_to_bytes(mac_str)
        except Exception:
            pass
        data[7] = len(connected)
        data[8] = info.get("max_connected", 4)
        name = info.get("name", "hci0")
        encoded = name.encode("utf-8")[:50]
        data[9:9 + len(encoded)] = encoded
        await self.send(self.make_response(STATUS_OK, cmd, data=bytes(data)))

    async def cmd_device_list(self, cmd, payload):
        page = payload[0] if payload else 0
        devices = await self.bt.get_paired_devices()
        if not devices:
            await self.send(self.make_response(STATUS_OK, cmd, seq=0, total=0))
            return
        if page >= len(devices):
            await self.send(self.make_response(STATUS_NOT_FOUND, cmd))
            return
        dev = devices[page]
        dev["paired"] = True
        await self.send(self.make_response(
            STATUS_OK, cmd, seq=page, total=len(devices),
            data=pack_device(dev),
        ))

    async def cmd_scan_start(self, cmd, payload):
        await self.bt.scan_start()
        await self.send(self.make_response(STATUS_OK, cmd))

    async def cmd_scan_stop(self, cmd, payload):
        await self.bt.scan_stop()
        self.scan_cache = await self.bt.scan_results()
        await self.send(self.make_response(STATUS_OK, cmd))

    async def cmd_scan_results(self, cmd, payload):
        page = payload[0] if payload else 0
        if not self.scan_cache:
            self.scan_cache = await self.bt.scan_results()
        if not self.scan_cache:
            await self.send(self.make_response(STATUS_OK, cmd, seq=0, total=0))
            return
        if page >= len(self.scan_cache):
            await self.send(self.make_response(STATUS_NOT_FOUND, cmd))
            return
        dev = self.scan_cache[page]
        await self.send(self.make_response(
            STATUS_OK, cmd, seq=page, total=len(self.scan_cache),
            data=pack_device(dev),
        ))

    async def cmd_pair(self, cmd, payload):
        if len(payload) < 6:
            await self.send(self.error_response(cmd, "MAC required"))
            return
        mac = bytes_to_mac(payload, 0)
        log.info(f"Pairing {mac}")
        await self.send(self.make_response(STATUS_BUSY, cmd))
        result = await self.bt.pair_and_trust(mac)
        if result.get("success"):
            await self.send(self.make_response(STATUS_OK, cmd))
        else:
            state = self.bt.get_pairing_status(mac)
            if state.get("status") == "passkey_required":
                passkey = state.get("passkey", "000000")
                ptype = state.get("passkey_type", "confirm")
                status = STATUS_PASSKEY_DISPLAY if ptype == "display" else STATUS_PASSKEY_CONFIRM
                await self.send(self.make_response(
                    status, cmd, data=passkey.encode()[:59],
                ))
            else:
                msg = result.get("message", "Failed")
                await self.send(self.error_response(cmd, msg[:59]))

    async def cmd_pair_confirm(self, cmd, payload):
        if len(payload) < 7:
            await self.send(self.error_response(cmd, "MAC+accept required"))
            return
        mac = bytes_to_mac(payload, 0)
        accept = payload[6] != 0
        result = await self.bt.confirm_passkey(mac, accept)
        status = STATUS_OK if result.get("success") else STATUS_ERROR
        await self.send(self.make_response(status, cmd))

    async def cmd_unpair(self, cmd, payload):
        if len(payload) < 6:
            await self.send(self.error_response(cmd, "MAC required"))
            return
        mac = bytes_to_mac(payload, 0)
        await self.bt.remove(mac)
        await self.send(self.make_response(STATUS_OK, cmd))

    async def cmd_connect(self, cmd, payload):
        if len(payload) < 6:
            await self.send(self.error_response(cmd, "MAC required"))
            return
        mac = bytes_to_mac(payload, 0)
        result = await self.bt.connect(mac)
        status = STATUS_OK if result.get("success") else STATUS_ERROR
        await self.send(self.make_response(status, cmd))

    async def cmd_disconnect(self, cmd, payload):
        if len(payload) < 6:
            await self.send(self.error_response(cmd, "MAC required"))
            return
        mac = bytes_to_mac(payload, 0)
        await self.bt.disconnect(mac)
        await self.send(self.make_response(STATUS_OK, cmd))

    # --- WiFi commands ---

    async def cmd_wifi_status(self, cmd, payload):
        radio = await self.net._run("radio", "wifi")
        wifi_on = "enabled" in radio.lower()
        data = bytearray(59)
        data[0] = 1 if wifi_on else 0
        if wifi_on:
            status = await self.net.get_status()
            data[1] = 1 if status.get("connected") else 0
            ssid = status.get("ssid", "")
            ip = status.get("ip", "")
            ssid_bytes = ssid.encode("utf-8")[:30]
            data[2:2 + len(ssid_bytes)] = ssid_bytes
            ip_bytes = ip.encode("utf-8")[:20]
            data[32:32 + len(ip_bytes)] = ip_bytes
        await self.send(self.make_response(STATUS_OK, cmd, data=bytes(data)))

    async def cmd_wifi_enable(self, cmd, payload):
        ssid = unpack_string(payload, 0, 31) if payload else ""
        password = unpack_string(payload, 31, 32) if len(payload) > 31 else ""
        log.info(f"WiFi enable: ssid={ssid!r}")
        await self.net._run("radio", "wifi", "on")
        await asyncio.sleep(2)
        if ssid:
            result = await self.net.connect_wifi(ssid, password)
            if result.get("success"):
                await self.send(self.make_response(STATUS_OK, cmd))
            else:
                await self.send(self.error_response(cmd, result.get("message", "Failed")[:59]))
        else:
            await asyncio.sleep(3)
            await self.send(self.make_response(STATUS_OK, cmd))

    async def cmd_wifi_disable(self, cmd, payload):
        log.info("WiFi disable")
        await self.net._run("radio", "wifi", "off")
        await self.send(self.make_response(STATUS_OK, cmd))

    async def cmd_wifi_hotspot(self, cmd, payload):
        ssid = unpack_string(payload, 0, 31) if payload else ""
        password = unpack_string(payload, 31, 32) if len(payload) > 31 else ""
        ssid = ssid or "Bluetooth To USB"
        password = password or "1111111111"
        log.info(f"WiFi hotspot start: ssid={ssid!r}")
        await self.net._run("radio", "wifi", "on")
        await asyncio.sleep(1)
        await self.net._run("connection", "modify", "bt2usb-hotspot",
                            "802-11-wireless.ssid", ssid,
                            "wifi-sec.psk", password)
        result = await self.net.start_hotspot()
        if result.get("success"):
            await self.send(self.make_response(STATUS_OK, cmd))
        else:
            await self.send(self.error_response(cmd, result.get("message", "Failed")[:59]))

    async def cmd_wifi_scan(self, cmd, payload):
        page = payload[0] if payload else 0
        if page == 0:
            log.info("WiFi scan")
            self.wifi_scan_cache = await self.net.scan_wifi()
        if not self.wifi_scan_cache:
            await self.send(self.make_response(STATUS_OK, cmd, seq=0, total=0))
            return
        if page >= len(self.wifi_scan_cache):
            await self.send(self.make_response(STATUS_NOT_FOUND, cmd))
            return
        n = self.wifi_scan_cache[page]
        data = bytearray(59)
        ssid_bytes = n["ssid"].encode("utf-8")[:30]
        data[0:len(ssid_bytes)] = ssid_bytes
        data[31] = min(n.get("signal", 0), 255)
        data[32] = 1 if n.get("security") else 0
        await self.send(self.make_response(
            STATUS_OK, cmd, seq=page, total=len(self.wifi_scan_cache), data=bytes(data),
        ))

    async def cmd_wifi_connect(self, cmd, payload):
        ssid = unpack_string(payload, 0, 31) if payload else ""
        password = unpack_string(payload, 31, 32) if len(payload) > 31 else ""
        if not ssid:
            await self.send(self.error_response(cmd, "SSID required"))
            return
        log.info(f"WiFi connect: ssid={ssid!r}")
        result = await self.net.connect_wifi(ssid, password)
        if result.get("success"):
            await self.send(self.make_response(STATUS_OK, cmd))
        else:
            await self.send(self.error_response(cmd, result.get("message", "Failed")[:59]))

    # --- Main loop ---

    async def run(self):
        log.info(f"Opening {HIDG_PATH}")
        while True:
            try:
                self.fd = os.open(HIDG_PATH, os.O_RDWR)
                break
            except FileNotFoundError:
                log.warning(f"{HIDG_PATH} not found, retrying in 5s")
                await asyncio.sleep(5)

        log.info("WebHID config daemon running")
        loop = asyncio.get_event_loop()
        while True:
            try:
                data = await loop.run_in_executor(None, os.read, self.fd, REPORT_SIZE)
                if len(data) < 2:
                    continue
                report_id = data[0]
                if report_id != REPORT_ID_CMD:
                    continue
                cmd = data[1]
                payload = bytes(data[2:]) if len(data) > 2 else b""
                log.info(f"Command: {cmd:#04x} payload={len(payload)}B")
                asyncio.create_task(self.handle(cmd, payload))
            except OSError as e:
                log.error(f"Read error: {e}, reopening in 2s")
                try:
                    os.close(self.fd)
                except Exception:
                    pass
                await asyncio.sleep(2)
                try:
                    self.fd = os.open(HIDG_PATH, os.O_RDWR)
                except Exception:
                    pass
            except Exception as e:
                log.error(f"Unexpected error: {e}")
                await asyncio.sleep(0.1)


def main():
    daemon = ConfigDaemon()
    asyncio.run(daemon.run())


if __name__ == "__main__":
    main()
