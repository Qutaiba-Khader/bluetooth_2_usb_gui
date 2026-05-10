import asyncio
import logging
import re

log = logging.getLogger("bt_manager")

MAC_RE = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
HID_UUID = "00001812-0000-1000-8000-00805f9b34fb"
MAX_CONNECTED = 7


def _strip_ansi(text):
    return ANSI_RE.sub("", text)


def _is_hid_supported(device_type):
    return device_type in ("keyboard", "mouse", "gamepad", "device")


class BluetoothManager:
    async def _run(self, *args, timeout=30):
        cmd = f"bluetoothctl {' '.join(args)}"
        log.info(f"[CMD] {cmd}")
        proc = await asyncio.create_subprocess_exec(
            "bluetoothctl", *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            log.warning(f"[CMD] Timed out after {timeout}s: {cmd}")
            proc.kill()
            await proc.communicate()
            return ""
        out = _strip_ansi(stdout.decode(errors="replace").strip())
        if out:
            log.debug(f"[CMD] Output: {out[:500]}")
        return out

    async def _interactive(self, commands):
        log.info(f"[SESSION] Starting interactive bluetoothctl ({len(commands)} steps)")
        proc = await asyncio.create_subprocess_exec(
            "bluetoothctl",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async def send(cmd, delay=0.5):
            log.info(f"[SESSION] >>> {cmd}  (wait {delay}s)")
            proc.stdin.write(f"{cmd}\n".encode())
            await proc.stdin.drain()
            await asyncio.sleep(delay)

        try:
            for cmd, delay in commands:
                await send(cmd, delay)
            proc.stdin.write(b"quit\n")
            await proc.stdin.drain()
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        except asyncio.TimeoutError:
            log.warning("[SESSION] Timed out, killing process")
            proc.kill()
            stdout, _ = await proc.communicate()
        except Exception as e:
            log.error(f"[SESSION] Error: {e}")
            proc.kill()
            await proc.communicate()
            raise

        output = _strip_ansi(stdout.decode(errors="replace"))
        log.info(f"[SESSION] Output ({len(output)} chars):\n{output[:3000]}")
        return output

    def _parse_device_list(self, output):
        devices = []
        seen = set()
        for line in output.splitlines():
            m = re.match(r".*Device\s+([0-9A-Fa-f:]{17})\s+(.*)", line)
            if m and m.group(1) not in seen:
                seen.add(m.group(1))
                name = m.group(2).strip()
                if not name:
                    name = "Unknown Device"
                devices.append({"mac": m.group(1), "name": name})
        return devices

    def _parse_info(self, output):
        info = {}
        for line in output.splitlines():
            line = line.strip()
            m = re.match(r"([\w][\w\s]*?):\s+(.*)", line)
            if m:
                key = m.group(1).strip().lower().replace(" ", "_")
                val = m.group(2).strip()
                if val == "yes":
                    val = True
                elif val == "no":
                    val = False
                info[key] = val
        return info

    def _device_type(self, icon, uuids=None):
        icon = str(icon).lower()
        if "keyboard" in icon:
            return "keyboard"
        if "mouse" in icon:
            return "mouse"
        if any(x in icon for x in ("audio", "headset", "headphone")):
            return "audio"
        if "phone" in icon:
            return "phone"
        if any(x in icon for x in ("gaming", "gamepad")):
            return "gamepad"
        if "input" in icon:
            return "keyboard"
        return "device"

    def _resolve_name(self, name, mac, alias=""):
        if alias and not MAC_RE.match(alias.replace("-", ":")):
            return alias
        if name and not MAC_RE.match(name.replace("-", ":")):
            return name
        return mac

    async def get_adapter(self):
        output = await self._run("show")
        info = self._parse_info(output)
        return {
            "name": info.get("name", "Unknown"),
            "address": info.get("controller", ""),
            "powered": info.get("powered", False),
            "max_connected": MAX_CONNECTED,
        }

    async def get_device_info(self, mac):
        output = await self._run("info", mac)
        return self._parse_info(output)

    async def get_paired_devices(self):
        output = await self._run("devices", "Paired")
        devices = self._parse_device_list(output)
        connected = await self._get_connected_macs()

        result = []
        for d in devices:
            info = await self.get_device_info(d["mac"])
            d["name"] = self._resolve_name(
                str(info.get("name", "")), d["mac"], str(info.get("alias", ""))
            )
            d["connected"] = d["mac"] in connected
            d["trusted"] = info.get("trusted", False)
            dtype = self._device_type(info.get("icon", ""))
            d["type"] = dtype
            d["supported"] = _is_hid_supported(dtype)
            result.append(d)
        return result

    async def _get_connected_macs(self):
        output = await self._run("devices", "Connected")
        return {d["mac"] for d in self._parse_device_list(output)}

    async def get_relay_count(self):
        try:
            proc = await asyncio.create_subprocess_exec(
                "bluetooth_2_usb", "--list", "--output", "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        except Exception:
            return 0
        return stdout.decode().count('"relay"')

    async def scan(self, duration=8):
        await self._run("--timeout", str(duration), "scan", "on", timeout=duration + 5)
        await asyncio.sleep(1)
        output = await self._run("devices")
        all_devices = self._parse_device_list(output)
        paired_output = await self._run("devices", "Paired")
        paired_macs = {d["mac"] for d in self._parse_device_list(paired_output)}

        nearby = []
        for d in all_devices:
            if d["mac"] not in paired_macs:
                info = await self.get_device_info(d["mac"])
                d["name"] = self._resolve_name(
                    str(info.get("name", "")), d["mac"], str(info.get("alias", ""))
                )
                dtype = self._device_type(info.get("icon", ""))
                d["type"] = dtype
                d["supported"] = _is_hid_supported(dtype)
                nearby.append(d)
        return nearby

    async def pair_and_trust(self, mac):
        log.info(f"[PAIR] ========== START pair flow for {mac} ==========")

        log.info("[PAIR] Step 1: Removing stale state")
        await self._run("remove", mac, timeout=5)
        await asyncio.sleep(2)

        log.info("[PAIR] Step 2: Interactive session (agent + pairable + scan + pair)")
        output = await self._interactive([
            ("power on",              0.5),
            ("pairable on",           0.5),
            ("agent NoInputNoOutput", 0.5),
            ("default-agent",         0.5),
            ("scan on",               5),
            (f"pair {mac}",           15),
            ("scan off",              1),
            (f"trust {mac}",          1),
            (f"connect {mac}",        5),
        ])

        log.info("[PAIR] Step 3: Verifying result")
        info = await self.get_device_info(mac)
        paired = info.get("paired", False)
        bonded = info.get("bonded", False)
        log.info(f"[PAIR] paired={paired} bonded={bonded}")

        if paired or bonded:
            log.info(f"[PAIR] ========== SUCCESS for {mac} ==========")
            return {"success": True, "message": "Paired, trusted, and connected"}

        error_msg = "Pairing failed. Make sure the device is in pairing mode and try again."
        for line in output.splitlines():
            if "Failed to pair" in line:
                clean = re.sub(r"^.*?Failed", "Failed", _strip_ansi(line).strip())
                if clean:
                    error_msg = clean
                break

        log.error(f"[PAIR] ========== FAILED for {mac}: {error_msg} ==========")
        return {"success": False, "message": error_msg}

    async def connect(self, mac):
        log.info(f"[CONNECT] Connecting to {mac}")
        for attempt in range(2):
            output = await self._run("connect", mac, timeout=15)
            ok = any(x in output.lower() for x in ("successful", "connected"))
            if ok:
                log.info(f"[CONNECT] success on attempt {attempt + 1}")
                return {"success": True, "message": "Connected"}
            if attempt == 0:
                log.info("[CONNECT] First attempt failed, retrying in 2s")
                await asyncio.sleep(2)
        log.warning(f"[CONNECT] Failed after 2 attempts")
        return {"success": False, "message": output}

    async def disconnect(self, mac):
        log.info(f"[DISCONNECT] {mac}")
        await self._run("disconnect", mac)
        return {"success": True}

    async def trust(self, mac):
        log.info(f"[TRUST] {mac}")
        await self._run("trust", mac)
        return {"success": True}

    async def remove(self, mac):
        log.info(f"[REMOVE] {mac}")
        await self._run("disconnect", mac)
        output = await self._run("remove", mac)
        return {"success": True, "message": output}
