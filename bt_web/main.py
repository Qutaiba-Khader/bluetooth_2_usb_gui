import asyncio
import json
import logging
import re
import time
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from bt_manager import BluetoothManager
from net_manager import NetworkManager

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)-5s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bt_web")

app = FastAPI()
bt = BluetoothManager()
net = NetworkManager()

static = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static)), name="static")

MAPPINGS_DIR = Path("/opt/bluetooth_2_usb/mappings")
MAPPINGS_DIR.mkdir(parents=True, exist_ok=True)

# Pre-compiled patterns for monitor log parsing
_RE_CONVERTED = re.compile(
    r"Converted evdev scancode 0x([0-9A-Fa-f]+) \((\w+)\) to HID UsageID 0x([0-9A-Fa-f]+) \((\w+)\)"
)
_RE_PRESS = re.compile(
    r"(Pressing|Releasing) (\w+) \(0x([0-9A-Fa-f]+)\) via"
)
_RE_UNSUPPORTED = re.compile(
    r"Unsupported key pressed: 0x([0-9A-Fa-f]+)"
)
_RE_MOUSE = re.compile(
    r"Sending mouse movement to gadget:.*x=(-?\d+) y=(-?\d+) wheel=(-?\d+)"
)


@app.get("/")
async def index():
    return FileResponse(str(static / "index.html"))


# --- Mapping Page ---

@app.get("/mapping/{mac}")
async def mapping_page(mac: str):
    return FileResponse(str(static / "mapping.html"))


# --- Mapping API ---

@app.get("/api/mapping/{mac}")
async def get_mapping(mac: str):
    mac_clean = mac.replace("-", ":").upper()
    mac_file = mac.replace(":", "-")
    path = MAPPINGS_DIR / f"{mac_file}.json"
    device_name = mac_clean
    try:
        devices = await bt.get_paired_devices()
        for d in devices:
            if d.get("mac", "").upper() == mac_clean:
                device_name = d.get("name", mac_clean)
                break
    except Exception:
        pass
    if path.exists():
        data = json.loads(path.read_text())
        data["device_name"] = device_name
        return data
    return {"device_name": device_name, "mac": mac_clean, "mappings": []}


@app.post("/api/mapping/{mac}")
async def save_mapping(mac: str, body: dict):
    mac_file = mac.replace(":", "-")
    path = MAPPINGS_DIR / f"{mac_file}.json"
    path.write_text(json.dumps(body, indent=2))
    log.info("Saved mapping for %s (%d rules)", mac, len(body.get("mappings", [])))
    # Auto-restart relay so mapping hook reloads the new config
    asyncio.create_task(_restart_relay())
    return {"success": True}


async def _restart_relay():
    await asyncio.sleep(0.5)
    try:
        proc = await asyncio.create_subprocess_exec(
            "sudo", "systemctl", "restart", "bluetooth_2_usb",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=10)
        log.info("Relay service restarted to apply new mappings")
    except Exception as e:
        log.error("Failed to restart relay after save: %s", e)


@app.delete("/api/mapping/{mac}")
async def delete_mapping(mac: str):
    mac_file = mac.replace(":", "-")
    path = MAPPINGS_DIR / f"{mac_file}.json"
    if path.exists():
        path.unlink()
        log.info("Deleted custom mapping for %s", mac)
    return {"success": True}


# --- Monitor WebSocket ---

@app.websocket("/ws/monitor/{mac}")
async def monitor_ws(websocket: WebSocket, mac: str):
    await websocket.accept()
    mac_clean = mac.replace("-", ":").upper()
    log.info("Monitor WebSocket connected for %s", mac_clean)
    monitoring = False
    proc = None

    try:
        while True:
            msg = await websocket.receive_text()
            data = json.loads(msg)

            if data.get("action") == "start" and not monitoring:
                monitoring = True
                proc = await asyncio.create_subprocess_exec(
                    "journalctl", "-f", "-u", "bluetooth_2_usb",
                    "--no-pager", "-o", "short-precise",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                async def stream():
                    pending_conversion = {}
                    last_mouse_send = 0.0
                    try:
                        while proc and proc.stdout:
                            line = await proc.stdout.readline()
                            if not line:
                                break
                            text = line.decode(errors="replace")
                            parts = text.split(None, 1)
                            ts = parts[0] if parts else ""

                            mc = _RE_CONVERTED.search(text)
                            if mc:
                                hid_name = mc.group(4)
                                pending_conversion[hid_name] = {
                                    "evdev_code": int(mc.group(1), 16),
                                    "evdev_name": mc.group(2),
                                    "hid_code": int(mc.group(3), 16),
                                    "hid_name": hid_name,
                                }
                                # Bound dict to prevent unbounded growth
                                if len(pending_conversion) > 64:
                                    oldest = next(iter(pending_conversion))
                                    del pending_conversion[oldest]
                                continue

                            mp = _RE_PRESS.search(text)
                            if mp:
                                action = mp.group(1)
                                key_name = mp.group(2)
                                hid_code = int(mp.group(3), 16)
                                value = 1 if action == "Pressing" else 0
                                conv = pending_conversion.pop(key_name, None)
                                evdev_code = conv["evdev_code"] if conv else hid_code
                                evdev_name = conv["evdev_name"] if conv else key_name
                                await websocket.send_json({
                                    "code": evdev_code,
                                    "name": evdev_name,
                                    "value": value,
                                    "hid_code": hid_code,
                                    "hid_name": key_name,
                                    "timestamp": ts
                                })
                                continue

                            mu = _RE_UNSUPPORTED.search(text)
                            if mu:
                                evdev_code = int(mu.group(1), 16)
                                await websocket.send_json({
                                    "code": evdev_code,
                                    "name": f"UNSUPPORTED_0x{mu.group(1).upper()}",
                                    "value": 1,
                                    "hid_code": None,
                                    "hid_name": None,
                                    "unsupported": True,
                                    "timestamp": ts
                                })
                                continue

                            mm = _RE_MOUSE.search(text)
                            if mm:
                                now = time.monotonic()
                                if now - last_mouse_send < 0.2:
                                    continue
                                last_mouse_send = now
                                mx, my, mw = int(mm.group(1)), int(mm.group(2)), int(mm.group(3))
                                await websocket.send_json({
                                    "code": "mouse",
                                    "name": "MOUSE_MOVE",
                                    "value": f"x={mx} y={my}",
                                    "hid_code": None,
                                    "hid_name": "REL_XY",
                                    "mouse_move": True,
                                    "timestamp": ts
                                })
                    except (WebSocketDisconnect, ConnectionError):
                        pass

                asyncio.create_task(stream())

            elif data.get("action") == "stop":
                monitoring = False
                if proc:
                    proc.kill()
                    proc = None

    except (WebSocketDisconnect, ConnectionError):
        pass
    finally:
        if proc:
            proc.kill()
        log.info("Monitor WebSocket closed for %s", mac_clean)


async def find_evdev_for_mac(mac: str) -> list[str]:
    try:
        result = await asyncio.create_subprocess_exec(
            "/opt/bluetooth_2_usb/venv/bin/python3", "-c", """
import evdev, json
devices = []
for path in evdev.list_devices():
    dev = evdev.InputDevice(path)
    devices.append({"path": path, "name": dev.name, "phys": dev.phys, "uniq": dev.uniq})
print(json.dumps(devices))
""",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await result.communicate()
        devices = json.loads(stdout.decode())
        mac_lower = mac.lower()
        matched = [d["path"] for d in devices if d.get("uniq", "").lower() == mac_lower]
        if matched:
            return matched
        hid_devices = [d["path"] for d in devices if d.get("uniq")]
        return hid_devices
    except Exception as e:
        log.error("Failed to find evdev device: %s", e)
    return []


# --- Service Control ---

@app.post("/api/service/restart")
async def restart_service():
    try:
        proc = await asyncio.create_subprocess_exec(
            "sudo", "systemctl", "restart", "bluetooth_2_usb",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
        return {"success": proc.returncode == 0, "message": stderr.decode().strip() or "OK"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# --- Bluetooth ---

@app.get("/api/adapter")
async def adapter():
    info = await bt.get_adapter()
    connected = await bt._get_connected_macs()
    info["connected_count"] = len(connected)
    return info


@app.get("/api/devices")
async def devices():
    return {"devices": await bt.get_paired_devices()}


@app.post("/api/scan")
async def scan():
    return {"devices": await bt.scan()}


@app.post("/api/pair/{mac:path}")
async def pair(mac: str):
    return await bt.pair_and_trust(mac)


@app.post("/api/connect/{mac:path}")
async def connect(mac: str):
    return await bt.connect(mac)


@app.post("/api/disconnect/{mac:path}")
async def disconnect(mac: str):
    return await bt.disconnect(mac)


@app.post("/api/trust/{mac:path}")
async def trust(mac: str):
    return await bt.trust(mac)


@app.delete("/api/device/{mac:path}")
async def remove(mac: str):
    return await bt.remove(mac)


# --- Network ---

@app.get("/api/network")
async def network_status():
    return await net.get_status()


@app.get("/api/wifi/scan")
async def wifi_scan():
    return {"networks": await net.scan_wifi()}


@app.post("/api/wifi/connect")
async def wifi_connect(body: dict):
    return await net.connect_wifi(body["ssid"], body.get("password", ""))


@app.post("/api/wifi/disconnect")
async def wifi_disconnect():
    return await net.disconnect_wifi()


@app.delete("/api/wifi/{ssid}")
async def wifi_forget(ssid: str):
    return await net.forget_wifi(ssid)


@app.get("/api/wifi/saved")
async def wifi_saved():
    return {"networks": await net.get_saved_networks()}


@app.post("/api/hotspot/start")
async def hotspot_start():
    return await net.start_hotspot()
