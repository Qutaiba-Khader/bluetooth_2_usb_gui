import logging
from pathlib import Path

from fastapi import FastAPI
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


@app.get("/")
async def index():
    return FileResponse(str(static / "index.html"))


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


@app.post("/api/scan/start")
async def scan_start():
    await bt.scan_start()
    return {"success": True}


@app.get("/api/scan/results")
async def scan_results():
    return {"devices": await bt.scan_results()}


@app.post("/api/scan/stop")
async def scan_stop():
    await bt.scan_stop()
    return {"success": True}


@app.post("/api/pair/{mac:path}")
async def pair(mac: str):
    return await bt.pair_and_trust(mac)


@app.get("/api/pair/{mac:path}/status")
async def pair_status(mac: str):
    return bt.get_pairing_status(mac)


@app.post("/api/pair/{mac:path}/confirm")
async def pair_confirm(mac: str, body: dict):
    confirmed = body.get("confirmed", False)
    return await bt.confirm_passkey(mac, confirmed)


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
