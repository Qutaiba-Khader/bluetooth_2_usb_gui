import asyncio
import logging
import re

log = logging.getLogger("bt_manager")


def _strip_ansi(text):
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


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
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            log.warning(f"[CMD] Timed out after {timeout}s: {cmd}")
            proc.kill()
            await proc.communicate()
            return ""
        out = _strip_ansi(stdout.decode(errors="replace").strip())
        if out:
            log.debug(f"[CMD] Output: {out[:500]}")
        return out

    async def _interactive(self, commands, timeout=45):
        log.info(f"[SESSION] Starting interactive bluetoothctl ({len(commands)} steps)")
        proc = await asyncio.create_subprocess_exec(
            "bluetoothctl",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        output_chunks = []

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
                if not name or name == m.group(1):
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

    def _device_type(self, icon):
        icon = str(icon).lower()
        if "keyboard" in icon:
            return "keyboard"
        if "mouse" in icon:
            return "mouse"
        if any(x in icon for x in ("audio", "headset", "headphone")):
            return "audio"
        if "phone" in icon:
            return "phone"
        if any(x in icon for x in ("input", "gaming", "gamepad")):
            return "gamepad"
        return "device"

    async def get_adapter(self):
        log.info("[ADAPTER] Getting adapter info")
        output = await self._run("show")
        info = self._parse_info(output)
        result = {
            "name": info.get("name", "Unknown"),
            "address": info.get("controller", ""),
            "powered": info.get("powered", False),
            "discoverable": info.get("discoverable", False),
        }
        log.info(f"[ADAPTER] {result}")
        return result

    async def get_device_info(self, mac):
        output = await self._run("info", mac)
        return self._parse_info(output)

    async def get_paired_devices(self):
        log.info("[DEVICES] Loading paired devices")
        output = await self._run("devices", "Paired")
        devices = self._parse_device_list(output)
        connected = await self._get_connected_macs()
        log.info(f"[DEVICES] {len(devices)} paired, {len(connected)} connected")

        result = []
        for d in devices:
            info = await self.get_device_info(d["mac"])
            d["connected"] = d["mac"] in connected
            d["trusted"] = info.get("trusted", False)
            d["icon"] = str(info.get("icon", ""))
            d["type"] = self._device_type(info.get("icon", ""))
            log.info(f"[DEVICES]   {d['name']} ({d['mac']}) connected={d['connected']} trusted={d['trusted']}")
            result.append(d)
        return result

    async def _get_connected_macs(self):
        output = await self._run("devices", "Connected")
        return {d["mac"] for d in self._parse_device_list(output)}

    async def scan(self, duration=8):
        log.info(f"[SCAN] Starting {duration}s scan")
        await self._run("--timeout", str(duration), "scan", "on", timeout=duration + 5)
        output = await self._run("devices")
        all_devices = self._parse_device_list(output)
        paired_output = await self._run("devices", "Paired")
        paired_macs = {d["mac"] for d in self._parse_device_list(paired_output)}

        nearby = []
        for d in all_devices:
            if d["mac"] not in paired_macs:
                info = await self.get_device_info(d["mac"])
                d["type"] = self._device_type(info.get("icon", ""))
                nearby.append(d)

        log.info(f"[SCAN] Found {len(nearby)} nearby unpaired devices")
        for d in nearby:
            log.info(f"[SCAN]   {d['name']} ({d['mac']}) type={d['type']}")
        return nearby

    async def pair_and_trust(self, mac):
        log.info(f"[PAIR] ========== START pair flow for {mac} ==========")

        # Step 1: Clean slate — remove any stale state
        log.info(f"[PAIR] Step 1/4: Removing stale state")
        await self._run("remove", mac, timeout=5)
        await asyncio.sleep(2)

        # Step 2: Single interactive session that does everything in order:
        #   - power on, pairable on (bluetooth_2_usb disables this!)
        #   - register NoInputNoOutput agent for BLE Just Works pairing
        #   - scan to rediscover the device
        #   - pair, trust, connect
        log.info(f"[PAIR] Step 2/4: Interactive session (agent + pairable + scan + pair)")
        output = await self._interactive([
            ("power on",              0.5),
            ("pairable on",           0.5),
            ("agent NoInputNoOutput", 0.5),
            ("default-agent",         0.5),
            ("scan on",               5),       # wait 5s for BLE device to advertise
            (f"pair {mac}",           15),       # BLE pairing can take time
            ("scan off",              1),
            (f"trust {mac}",          1),
            (f"connect {mac}",        5),
        ])

        # Step 3: Verify
        log.info(f"[PAIR] Step 3/4: Verifying result")
        info = await self.get_device_info(mac)
        paired = info.get("paired", False)
        bonded = info.get("bonded", False)
        connected = info.get("connected", False)
        trusted = info.get("trusted", False)
        log.info(f"[PAIR] State: paired={paired} bonded={bonded} connected={connected} trusted={trusted}")

        # Step 4: Result
        if paired or bonded:
            log.info(f"[PAIR] ========== SUCCESS for {mac} ==========")
            return {"success": True, "message": "Paired, trusted, and connected"}

        # Try to extract a useful error message
        error_msg = "Pairing failed. Make sure the device is in pairing mode and try again."
        for line in output.splitlines():
            if "Failed to pair" in line:
                clean = _strip_ansi(line).strip()
                # Remove bluetoothctl prompt noise
                clean = re.sub(r"^.*?Failed", "Failed", clean)
                if clean:
                    error_msg = clean
                break

        log.error(f"[PAIR] ========== FAILED for {mac}: {error_msg} ==========")
        return {"success": False, "message": error_msg}

    async def connect(self, mac):
        log.info(f"[CONNECT] Connecting to {mac}")
        output = await self._run("connect", mac, timeout=15)
        ok = any(x in output.lower() for x in ("successful", "connected"))
        log.info(f"[CONNECT] success={ok}")
        return {"success": ok, "message": output}

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
        log.info(f"[REMOVE] Done: {output[:200]}")
        return {"success": True, "message": output}
