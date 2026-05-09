import asyncio
import logging
import re

log = logging.getLogger("net_manager")

HOTSPOT_CON = "bt2usb-hotspot"


class NetworkManager:
    async def _run(self, *args, timeout=15):
        cmd = f"nmcli {' '.join(args)}"
        log.info(f"[NET] {cmd}")
        proc = await asyncio.create_subprocess_exec(
            "nmcli", *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return ""
        return stdout.decode(errors="replace").strip()

    async def get_status(self):
        log.info("[NET] Getting network status")
        active = await self._run("-t", "-f", "NAME,TYPE,DEVICE", "connection", "show", "--active")
        wifi_con = None
        hotspot_active = False
        for line in active.splitlines():
            parts = line.split(":")
            if len(parts) >= 2 and "wireless" in parts[1]:
                if parts[0] == HOTSPOT_CON:
                    hotspot_active = True
                else:
                    wifi_con = parts[0]

        ip = ""
        ssid = ""
        signal = ""
        if wifi_con or hotspot_active:
            dev_info = await self._run("-t", "-f", "IP4.ADDRESS,GENERAL.CONNECTION", "device", "show", "wlan0")
            for line in dev_info.splitlines():
                if "IP4.ADDRESS" in line:
                    ip = line.split(":", 1)[-1].strip()
                elif "GENERAL.CONNECTION" in line:
                    ssid = line.split(":", 1)[-1].strip()

        result = {
            "connected": wifi_con is not None,
            "ssid": wifi_con or "",
            "ip": ip,
            "hotspot_active": hotspot_active,
            "hotspot_ssid": "Bluetooth To USB",
            "hotspot_ip": "10.42.0.1" if hotspot_active else "",
        }
        log.info(f"[NET] Status: {result}")
        return result

    async def scan_wifi(self):
        log.info("[NET] Scanning WiFi networks")
        await self._run("device", "wifi", "rescan", timeout=10)
        await asyncio.sleep(2)
        output = await self._run("-t", "-f", "SSID,SIGNAL,SECURITY,IN-USE", "device", "wifi", "list")
        networks = []
        seen = set()
        for line in output.splitlines():
            parts = line.split(":")
            if len(parts) >= 3:
                ssid = parts[0].strip()
                if not ssid or ssid in seen or ssid == "Bluetooth To USB":
                    continue
                seen.add(ssid)
                networks.append({
                    "ssid": ssid,
                    "signal": int(parts[1]) if parts[1].isdigit() else 0,
                    "security": parts[2] if len(parts) > 2 else "",
                    "active": parts[3].strip() == "*" if len(parts) > 3 else False,
                })
        networks.sort(key=lambda x: x["signal"], reverse=True)
        log.info(f"[NET] Found {len(networks)} networks")
        return networks

    async def connect_wifi(self, ssid, password=""):
        log.info(f"[NET] Connecting to WiFi: {ssid}")
        if password:
            output = await self._run("device", "wifi", "connect", ssid, "password", password, timeout=30)
        else:
            output = await self._run("device", "wifi", "connect", ssid, timeout=30)
        ok = "successfully" in output.lower()
        log.info(f"[NET] Connect result: success={ok}")
        if ok:
            await self._stop_hotspot()
        return {"success": ok, "message": output}

    async def disconnect_wifi(self):
        log.info("[NET] Disconnecting WiFi")
        await self._run("device", "disconnect", "wlan0")
        return {"success": True}

    async def forget_wifi(self, ssid):
        log.info(f"[NET] Forgetting network: {ssid}")
        output = await self._run("connection", "delete", ssid)
        return {"success": True, "message": output}

    async def start_hotspot(self):
        log.info("[NET] Starting hotspot manually")
        output = await self._run("connection", "up", HOTSPOT_CON)
        return {"success": "successfully" in output.lower(), "message": output}

    async def _stop_hotspot(self):
        log.info("[NET] Stopping hotspot")
        await self._run("connection", "down", HOTSPOT_CON)

    async def get_saved_networks(self):
        log.info("[NET] Listing saved networks")
        output = await self._run("-t", "-f", "NAME,TYPE", "connection", "show")
        saved = []
        for line in output.splitlines():
            parts = line.split(":")
            if len(parts) >= 2 and "wireless" in parts[1] and parts[0] != HOTSPOT_CON:
                saved.append(parts[0])
        return saved
