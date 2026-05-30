import asyncio
import logging
import re

log = logging.getLogger("bt_manager")

MAC_RE = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
HID_UUID = "00001812-0000-1000-8000-00805f9b34fb"
MAX_CONNECTED = 7

PASSKEY_RE = re.compile(r"Confirm passkey (\d{6})")
DISPLAY_PASSKEY_RE = re.compile(r"Passkey: (\d{6})")
ENTER_PIN_RE = re.compile(r"Enter PIN code:")
DISPLAY_PIN_RE = re.compile(r"PIN code: (\w+)")
REQUEST_PASSKEY_RE = re.compile(r"Enter passkey")


def _strip_ansi(text):
    return ANSI_RE.sub("", text)


def _is_hid_supported(device_type):
    return device_type in ("keyboard", "mouse", "gamepad", "device")


class BluetoothManager:
    def __init__(self):
        self._pair_lock = asyncio.Lock()
        self._pair_proc = None
        self._pairing_state = {}
        self._scan_proc = None

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

    # --- Scan (live streaming) ---

    async def _stop_b2u(self):
        proc = await asyncio.create_subprocess_exec(
            "systemctl", "stop", "bluetooth_2_usb",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        await asyncio.sleep(1)

    async def _start_b2u(self):
        proc = await asyncio.create_subprocess_exec(
            "systemctl", "start", "bluetooth_2_usb",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()

    async def scan_start(self):
        await self.scan_stop()
        await self._stop_b2u()
        await self._run("power", "on", timeout=3)
        await self._run("pairable", "on", timeout=3)
        self._scan_proc = await asyncio.create_subprocess_exec(
            "bluetoothctl", "scan", "on",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        log.info("[SCAN] Started background scan (bt2usb stopped)")

    async def scan_stop(self):
        if self._scan_proc:
            try:
                self._scan_proc.kill()
                await self._scan_proc.communicate()
            except Exception:
                pass
            self._scan_proc = None
        await self._run("scan", "off", timeout=5)
        await self._start_b2u()
        log.info("[SCAN] Stopped (bt2usb restarted)")

    async def scan_results(self):
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

    async def scan(self, duration=8):
        await self.scan_start()
        await asyncio.sleep(duration)
        devices = await self.scan_results()
        await self.scan_stop()
        return devices

    # --- Pairing (line-by-line with passkey support) ---

    async def _read_lines(self, proc, timeout=30):
        """Read stdout lines until timeout, yielding each stripped line."""
        lines = []
        try:
            async def _reader():
                while True:
                    raw = await proc.stdout.readline()
                    if not raw:
                        break
                    line = _strip_ansi(raw.decode(errors="replace")).strip()
                    if line:
                        lines.append(line)
                        yield line
            async for line in asyncio.wait_for(_reader().__aiter__().__anext__(), timeout):
                pass
        except (asyncio.TimeoutError, StopAsyncIteration):
            pass
        return lines

    async def _send(self, proc, cmd, delay=0.3):
        log.info(f"[PAIR] >>> {cmd}")
        proc.stdin.write(f"{cmd}\n".encode())
        await proc.stdin.drain()
        await asyncio.sleep(delay)

    async def _read_until(self, proc, patterns, timeout=20):
        """Read lines until one matches a pattern or timeout. Returns (matched_pattern_key, match, all_output)."""
        output = []
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            try:
                raw = await asyncio.wait_for(proc.stdout.readline(), timeout=min(remaining, 2))
            except asyncio.TimeoutError:
                continue
            if not raw:
                break
            line = _strip_ansi(raw.decode(errors="replace")).strip()
            if not line:
                continue
            output.append(line)
            log.debug(f"[PAIR] <<< {line}")
            for key, pattern in patterns.items():
                m = pattern.search(line) if hasattr(pattern, 'search') else (line if pattern in line else None)
                if m:
                    return key, m, output
        return None, None, output

    async def pair_and_trust(self, mac):
        if self._pair_lock.locked():
            return {"success": False, "message": "Another pairing is in progress"}

        async with self._pair_lock:
            return await self._do_pair(mac)

    async def _do_pair(self, mac):
        log.info(f"[PAIR] ========== START pair flow for {mac} ==========")
        self._pairing_state = {"mac": mac, "status": "starting"}

        # Clean stale state
        await self._run("remove", mac, timeout=5)
        await asyncio.sleep(1)

        proc = await asyncio.create_subprocess_exec(
            "bluetoothctl",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self._pair_proc = proc

        try:
            # Setup agent with KeyboardDisplay capability (handles Apple passkey)
            await self._send(proc, "power on")
            await self._send(proc, "pairable on")
            await self._send(proc, "agent KeyboardDisplay")
            await self._send(proc, "default-agent")

            # Brief scan to ensure device is visible (5s for Apple BLE devices)
            await self._send(proc, "scan on")
            await asyncio.sleep(5)
            await self._send(proc, "scan off")
            await asyncio.sleep(0.5)

            # Start pairing
            await self._send(proc, f"pair {mac}")
            self._pairing_state["status"] = "pairing"

            # Read output looking for success, failure, or passkey prompt
            match_patterns = {
                "confirm": PASSKEY_RE,
                "display": DISPLAY_PASSKEY_RE,
                "pin": ENTER_PIN_RE,
                "display_pin": DISPLAY_PIN_RE,
                "request_passkey": REQUEST_PASSKEY_RE,
                "success": re.compile(r"Pairing successful|pairing successful"),
                "failed": re.compile(r"Failed to pair|not available|AuthenticationFailed|ConnectionAttemptFailed"),
                "connected": re.compile(r"Connected: yes"),
            }

            key, match, output = await self._read_until(proc, match_patterns, timeout=25)
            log.info(f"[PAIR] Match: key={key}, output_lines={len(output)}")

            if key == "confirm":
                passkey = match.group(1) if hasattr(match, 'group') else "000000"
                log.info(f"[PAIR] Passkey confirmation requested: {passkey}")
                self._pairing_state.update({
                    "status": "passkey_required",
                    "passkey": passkey,
                    "passkey_type": "confirm",
                })
                # Wait for user to confirm via API
                confirmed = await self._wait_for_confirmation(45)
                if confirmed:
                    await self._send(proc, "yes")
                else:
                    await self._send(proc, "no")
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "Passkey rejected by user"}

                # Wait for pairing result after confirmation
                key2, _, _ = await self._read_until(proc, {
                    "success": re.compile(r"Pairing successful"),
                    "failed": re.compile(r"Failed to pair|AuthenticationFailed"),
                }, timeout=15)
                if key2 != "success":
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "Pairing failed after passkey confirmation"}

            elif key == "display":
                passkey = match.group(1) if hasattr(match, 'group') else "000000"
                log.info(f"[PAIR] Display passkey for keyboard entry: {passkey}")
                self._pairing_state.update({
                    "status": "passkey_required",
                    "passkey": passkey,
                    "passkey_type": "display",
                })
                # For keyboards: user types the passkey on the physical device
                # Wait for pairing to complete
                key2, _, _ = await self._read_until(proc, {
                    "success": re.compile(r"Pairing successful"),
                    "failed": re.compile(r"Failed to pair|AuthenticationFailed"),
                }, timeout=45)
                if key2 != "success":
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "Pairing failed. Did you type the passkey on the keyboard?"}

            elif key == "pin":
                log.info("[PAIR] PIN code requested")
                self._pairing_state.update({
                    "status": "passkey_required",
                    "passkey": "0000",
                    "passkey_type": "pin",
                })
                await self._send(proc, "0000")
                key2, _, _ = await self._read_until(proc, {
                    "success": re.compile(r"Pairing successful"),
                    "failed": re.compile(r"Failed to pair"),
                }, timeout=15)
                if key2 != "success":
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "PIN pairing failed"}

            elif key == "display_pin":
                # Legacy Apple keyboards (A1314): bluetoothctl shows "PIN code: XXXXXX"
                # User must type this on the keyboard + Enter
                pin = match.group(1) if hasattr(match, 'group') else "000000"
                log.info(f"[PAIR] DisplayPinCode for legacy keyboard: {pin}")
                self._pairing_state.update({
                    "status": "passkey_required",
                    "passkey": pin,
                    "passkey_type": "display",
                })
                key2, _, _ = await self._read_until(proc, {
                    "success": re.compile(r"Pairing successful"),
                    "failed": re.compile(r"Failed to pair|AuthenticationFailed"),
                }, timeout=45)
                if key2 != "success":
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "Pairing failed. Did you type the PIN on the keyboard and press Enter?"}

            elif key == "request_passkey":
                # RequestPasskey: rare, some devices ask us to enter a passkey
                log.info("[PAIR] RequestPasskey — sending default 000000")
                self._pairing_state.update({
                    "status": "passkey_required",
                    "passkey": "000000",
                    "passkey_type": "confirm",
                })
                confirmed = await self._wait_for_confirmation(45)
                if confirmed:
                    await self._send(proc, "000000")
                else:
                    await self._send(proc, "")
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "Passkey entry cancelled"}
                key2, _, _ = await self._read_until(proc, {
                    "success": re.compile(r"Pairing successful"),
                    "failed": re.compile(r"Failed to pair|AuthenticationFailed"),
                }, timeout=15)
                if key2 != "success":
                    await self._cleanup_pair(proc, mac)
                    return {"success": False, "message": "Pairing failed after passkey entry"}

            elif key == "failed":
                error_text = "\n".join(output[-5:])
                await self._cleanup_pair(proc, mac)
                error_msg = "Pairing failed. Make sure the device is in pairing mode."
                for line in output:
                    if "Failed to pair" in line:
                        clean = re.sub(r"^.*?Failed", "Failed", line.strip())
                        if clean:
                            error_msg = clean
                        break
                return {"success": False, "message": error_msg}

            elif key is None:
                await self._cleanup_pair(proc, mac)
                return {"success": False, "message": "Pairing timed out. Make sure the device is in pairing mode."}

            # Trust and connect
            self._pairing_state["status"] = "connecting"
            await self._send(proc, f"trust {mac}")
            await asyncio.sleep(1)
            await self._send(proc, f"connect {mac}")

            # Wait for connection
            key3, _, _ = await self._read_until(proc, {
                "connected": re.compile(r"Connected: yes|Connection successful"),
                "failed": re.compile(r"Failed to connect"),
            }, timeout=10)

            # Cleanup bluetoothctl session
            try:
                proc.stdin.write(b"quit\n")
                await proc.stdin.drain()
                await asyncio.wait_for(proc.communicate(), timeout=5)
            except Exception:
                proc.kill()
                try:
                    await proc.communicate()
                except Exception:
                    pass

            self._pair_proc = None
            self._pairing_state = {"mac": mac, "status": "done"}

            # Verify
            info = await self.get_device_info(mac)
            paired = info.get("paired", False)
            bonded = info.get("bonded", False)

            if paired or bonded:
                log.info(f"[PAIR] ========== SUCCESS for {mac} ==========")
                return {"success": True, "message": "Paired, trusted, and connected"}

            await self._run("remove", mac, timeout=5)
            return {"success": False, "message": "Pairing could not be verified"}

        except Exception as e:
            log.error(f"[PAIR] Exception: {e}")
            await self._cleanup_pair(proc, mac)
            return {"success": False, "message": f"Pairing error: {e}"}

    async def _wait_for_confirmation(self, timeout=45):
        """Wait for user to call confirm_passkey()."""
        self._pairing_state["confirmed"] = None
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            if self._pairing_state.get("confirmed") is not None:
                return self._pairing_state["confirmed"]
            await asyncio.sleep(0.3)
        return False

    async def confirm_passkey(self, mac, confirmed):
        if self._pairing_state.get("mac") != mac:
            return {"success": False, "message": "No active pairing for this device"}
        self._pairing_state["confirmed"] = confirmed
        return {"success": True}

    def get_pairing_status(self, mac=None):
        if mac and self._pairing_state.get("mac") != mac:
            return {"status": "none"}
        return dict(self._pairing_state)

    async def _cleanup_pair(self, proc, mac):
        """Kill pairing process and remove half-paired device."""
        try:
            proc.stdin.write(b"quit\n")
            await proc.stdin.drain()
            await asyncio.wait_for(proc.communicate(), timeout=3)
        except Exception:
            try:
                proc.kill()
                await proc.communicate()
            except Exception:
                pass
        self._pair_proc = None
        self._pairing_state = {}
        await self._run("remove", mac, timeout=5)

    # --- Connect / Disconnect / Trust / Remove ---

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
        log.warning("[CONNECT] Failed after 2 attempts")
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
