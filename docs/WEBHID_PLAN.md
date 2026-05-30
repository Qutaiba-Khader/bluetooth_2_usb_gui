# bt2usb-webhid — WiFi-Free BLE Pairing via WebHID

**Goal**: Eliminate WiFi dependency for BT device management. Plug Pi Zero 2 W into a computer via USB, open a static web page in Chrome, pair/unpair/manage BLE devices through WebHID — same UX as the HID Remapper web config tool.

**Current state**: The Pi runs two services — `bluetooth_2_usb` (HID relay) and `bt-web` (FastAPI GUI on port 8080). Both require WiFi/IP to access. This plan adds a third communication channel: a config HID interface over the same USB cable that carries keyboard/mouse/consumer reports.

---

## Architecture

```
 ┌─────────────────────────────────────────────────┐
 │  Host PC (Chrome)                               │
 │                                                 │
 │  WebHID Web Tool (static HTML/JS)               │
 │    navigator.hid.requestDevice({               │
 │      filters: [{ vendorId: 0x1D6B,             │
 │                  productId: 0x0104,             │
 │                  usagePage: 0xFF00 }]           │
 │    })                                           │
 │    device.sendFeatureReport(CMD, data)           │
 │    device.receiveFeatureReport() ← response     │
 └──────────────────┬──────────────────────────────┘
                    │ USB (single cable)
 ┌──────────────────┴──────────────────────────────┐
 │  Pi Zero 2 W                                    │
 │                                                 │
 │  USB Composite Gadget (dwc2 + libcomposite)     │
 │  ├─ hid.usb0  Keyboard    → /dev/hidg0         │
 │  ├─ hid.usb1  Mouse       → /dev/hidg1         │
 │  ├─ hid.usb2  Consumer    → /dev/hidg2         │
 │  └─ hid.usb3  Config HID  → /dev/hidg3  ← NEW │
 │                                                 │
 │  Config Daemon (reads/writes /dev/hidg3)        │
 │    ↕ D-Bus                                      │
 │  BlueZ (bluetoothctl / org.bluez D-Bus API)     │
 └─────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Config HID Function (USB gadget layer)

Add a 4th HID function to the composite gadget with a vendor-specific usage page.

**File to modify**: `src/bluetooth_2_usb/gadgets/layout.py`

Add to `build_default_layout()`:
```python
GadgetHidDevice(
    protocol=0,
    subclass=0,
    report_length=64,        # 64-byte feature reports
    descriptor=CONFIG_HID_DESCRIPTOR,
)
```

**Report Descriptor** (new, in `src/bluetooth_2_usb/hid/descriptors.py`):
```
Usage Page (Vendor Defined 0xFF00)
Usage (0x01)
Collection (Application)
  Report ID (1)              // Command report
  Usage (0x20)
  Logical Minimum (0)
  Logical Maximum (255)
  Report Size (8)
  Report Count (63)          // 63 bytes payload (1 byte report ID + 63 data = 64 total)
  Feature (Data, Variable)

  Report ID (2)              // Response report
  Usage (0x21)
  Logical Minimum (0)
  Logical Maximum (255)
  Report Size (8)
  Report Count (63)
  Feature (Data, Variable)
Collection End
```

This gives us:
- **Feature Report ID 1** (host → device): 63-byte command payload
- **Feature Report ID 2** (device → host): 63-byte response payload
- WebHID uses `sendFeatureReport()` / `receiveFeatureReport()` for bidirectional comms

**Also modify**: `src/bluetooth_2_usb/gadgets/config.py` — no changes needed if layout iteration already handles N devices (it does).

### 2. Config HID Protocol

Binary protocol over 64-byte feature reports. Byte 0 = report ID (handled by HID layer), Byte 1 = command/status, Bytes 2-63 = payload.

#### Commands (Host → Device, Report ID 1)

| Cmd | Name | Payload | Description |
|-----|------|---------|-------------|
| 0x01 | GET_DEVICE_LIST | — | List all paired BT devices |
| 0x02 | GET_DEVICE_INFO | 6B MAC | Get details for one device |
| 0x03 | SCAN_START | — | Start BLE scan |
| 0x04 | SCAN_STOP | — | Stop BLE scan |
| 0x05 | SCAN_RESULTS | 1B offset | Get discovered devices (paginated) |
| 0x06 | PAIR_DEVICE | 6B MAC + 1B addr_type | Initiate pairing |
| 0x07 | PAIR_CONFIRM | 6B MAC + 1B yes/no | Confirm passkey |
| 0x08 | UNPAIR_DEVICE | 6B MAC | Remove pairing |
| 0x09 | CONNECT | 6B MAC | Connect paired device |
| 0x0A | DISCONNECT | 6B MAC | Disconnect device |
| 0x0B | GET_ADAPTER_INFO | — | Get BT adapter state |
| 0x0C | CLEAR_BONDS | — | Remove all paired devices |
| 0x0D | GET_VERSION | — | Get firmware/daemon version |

#### Responses (Device → Host, Report ID 2)

| Byte | Field | Description |
|------|-------|-------------|
| 0 | status | 0x00=OK, 0x01=ERROR, 0x02=BUSY, 0x03=NOT_FOUND, 0x04=PASSKEY_DISPLAY, 0x05=PASSKEY_CONFIRM |
| 1 | cmd_echo | Echo of the command this responds to |
| 2 | seq | Sequence/page number (for multi-packet responses) |
| 3 | total | Total pages (for multi-packet responses) |
| 4-62 | data | Response payload |

#### Device List Entry (packed into response data, 32 bytes each = 1 device per response):

| Offset | Size | Field |
|--------|------|-------|
| 0 | 6 | MAC address |
| 6 | 1 | Address type (0=public, 1=random) |
| 7 | 1 | Flags: bit0=paired, bit1=trusted, bit2=connected, bit3=hid_supported |
| 8 | 1 | Device type (0=unknown, 1=keyboard, 2=mouse, 3=gamepad, 4=audio, 5=combo) |
| 9 | 23 | Device name (UTF-8, null-terminated, truncated) |

### 3. Config Daemon (Pi-side)

New Python module: `bt_web/webhid_daemon.py` (or `src/bluetooth_2_usb/webhid/`)

**Core loop**:
```python
async def run():
    fd = os.open('/dev/hidg3', os.O_RDWR)
    while True:
        # Read GET_REPORT request (feature report ID 1)
        data = os.read(fd, 64)
        cmd = data[1]
        response = await handle_command(cmd, data[2:])
        # Write SET_REPORT response (feature report ID 2)
        os.write(fd, response)
```

**BT operations**: Reuse existing `bt_manager.py` (BluetoothManager class) which already wraps `bluetoothctl` with async subprocess calls. The pairing flow with passkey handling is already implemented.

**Systemd service**: `bt2usb-webhid.service` — runs alongside the existing services, reads/writes `/dev/hidg3`.

**Alternatively**: integrate into the existing `bt-web.service` as a background asyncio task, sharing the BluetoothManager instance. This avoids race conditions between WiFi GUI and WebHID making concurrent `bluetoothctl` calls.

### 4. WebHID Web Tool (Host-side)

Static HTML/JS page — no server, no build step. Hosted on GitHub Pages or opened as local file.

**Location**: `webhid-tool/` in the repo root (or `docs/webhid-tool/` for GitHub Pages).

**Files**:
```
webhid-tool/
  index.html          -- Single-page UI
  webhid.js           -- WebHID communication layer
  style.css           -- Dark theme (matching hid-remapper-vx style)
```

**WebHID API flow**:
```javascript
// Connect
const [device] = await navigator.hid.requestDevice({
  filters: [{ vendorId: 0x1D6B, productId: 0x0104, usagePage: 0xFF00 }]
});
await device.open();

// Send command
const cmd = new Uint8Array(64);
cmd[0] = 0x01;  // Report ID 1
cmd[1] = 0x01;  // GET_DEVICE_LIST
await device.sendFeatureReport(1, cmd.slice(1));

// Read response
const response = await device.receiveFeatureReport(2);
```

**UI sections**:
- **Connect button** — WebHID device picker
- **Adapter info** — BT adapter name, address, power state
- **Paired devices** — list with connect/disconnect/remove buttons, connection status dots
- **Scan & Pair** — start scan, show discovered devices, pair button, passkey dialog
- **Status bar** — USB connection state, daemon version

### 5. Feature Report I/O on Linux configfs gadget

The `/dev/hidgN` character device supports:
- `read()` — receives SET_REPORT from host (host sends feature report)
- `write()` — queues GET_REPORT response for host (host reads feature report)

For feature reports specifically:
- Host calls `sendFeatureReport(reportId, data)` → kernel delivers to `/dev/hidg3` via `write` on the host side → Pi reads from `/dev/hidg3`
- Host calls `receiveFeatureReport(reportId)` → kernel sends GET_REPORT to device → Pi must have a pending response written to `/dev/hidg3`

**Important**: The configfs HID gadget (`f_hid`) uses `HIDG_SET_REPORT` / `HIDG_GET_REPORT` ioctls, or raw read/write. Feature reports require the `hid_gadget_hid` kernel driver to handle GET_REPORT/SET_REPORT control transfers. This is supported in mainline Linux since ~5.10.

**Kernel requirement**: `CONFIG_USB_CONFIGFS_F_HID=y` (already enabled on Raspberry Pi OS).

---

## Implementation Phases

### Phase 1: Config HID Gadget Function
1. Add report descriptor to `hid/descriptors.py`
2. Add 4th HID device to `gadgets/layout.py`
3. Verify `/dev/hidg3` appears after gadget rebuild
4. Test raw read/write with a simple echo script

### Phase 2: Protocol + Daemon
1. Implement command parser and response builder
2. Wire up BluetoothManager for device list / adapter info (read-only commands first)
3. Add scan start/stop/results
4. Add pair/unpair/connect/disconnect with passkey flow
5. Add systemd service (or integrate into bt-web)

### Phase 3: WebHID Web Tool
1. Basic connect/disconnect UI
2. Device list display
3. Scan and pair flow with passkey dialog
4. Dark theme matching hid-remapper-vx
5. Host on GitHub Pages

### Phase 4: Integration & Polish
1. Handle concurrent access (WiFi GUI + WebHID)
2. Error recovery (USB disconnect/reconnect)
3. Connection state polling / event-driven updates
4. QR code for GitHub Pages URL on the existing QR page

---

## Files to Create / Modify

### New files
| File | Purpose |
|------|---------|
| `bt_web/webhid_daemon.py` | Config HID daemon — reads /dev/hidg3, dispatches BT commands |
| `bt_web/hid_protocol.py` | Protocol constants, pack/unpack helpers |
| `bt_web/bt2usb-webhid.service` | Systemd unit (if standalone) |
| `webhid-tool/index.html` | WebHID web tool UI |
| `webhid-tool/webhid.js` | WebHID communication layer |
| `webhid-tool/style.css` | Dark theme |

### Modified files
| File | Change |
|------|--------|
| `src/bluetooth_2_usb/hid/descriptors.py` | Add `CONFIG_HID_DESCRIPTOR` bytes |
| `src/bluetooth_2_usb/gadgets/layout.py` | Add 4th `GadgetHidDevice` to layout |
| `bt_web/setup.sh` | Deploy webhid daemon + service |
| `bt_web/main.py` | Optionally integrate daemon as background task |

---

## Key References

### WebHID API
- Spec: https://wicg.github.io/webhid/
- Chrome status: enabled by default since Chrome 89
- `navigator.hid.requestDevice()` — device picker with VID/PID/usagePage filters
- `HIDDevice.sendFeatureReport(reportId, data)` — host → device
- `HIDDevice.receiveFeatureReport(reportId)` — device → host (GET_REPORT)
- `HIDDevice.addEventListener('inputreport', handler)` — for interrupt IN reports (not needed for config)

### Linux USB Gadget HID
- configfs path: `/sys/kernel/config/usb_gadget/<name>/functions/hid.usb<N>/`
- Attributes: `protocol`, `subclass`, `report_length`, `report_desc` (binary write)
- Device node: `/dev/hidg<N>` — `read()` for SET_REPORT, `write()` for GET_REPORT response
- Kernel config: `CONFIG_USB_CONFIGFS_F_HID` (enabled on RPi OS)
- Feature report handling added in Linux 5.10+ via `f_hid` driver

### HID Remapper Config Protocol (reference implementation)
- Repo: `jfedor2/hid-remapper`, file `config-tool-web/code.js`
- Uses feature reports with Report ID 100 (commands) and 101 (responses)
- 64-byte reports, byte 0 = command, binary packed payloads
- WebHID connection: filters by `usagePage: 0xFFC0` (vendor page)
- Polling loop: sends command → reads response → processes

### BlueZ D-Bus API (alternative to bluetoothctl CLI)
- Service: `org.bluez`, path: `/org/bluez/hci0`
- Interfaces: `org.bluez.Adapter1` (scan/power), `org.bluez.Device1` (pair/connect/trust)
- Agent: `org.bluez.Agent1` (passkey/PIN handling)
- Python lib: `dbus-fast` (async) or `pydbus`
- Advantage over bluetoothctl: no subprocess parsing, proper async events, passkey callbacks
- The existing `bt_manager.py` uses `bluetoothctl` subprocesses — works but fragile for parsing

### Existing bt2usb Gadget Setup
- VID: `0x1D6B` (Linux Foundation), PID: `0x0104`
- Gadget root: `/sys/kernel/config/usb_gadget/bluetooth_2_usb/`
- Current functions: `hid.usb0` (keyboard), `hid.usb1` (mouse), `hid.usb2` (consumer)
- Identity: `/var/lib/bluetooth_2_usb/usb_identity.json` (persisted serial number)
- UDC: single controller from `/sys/class/udc/`

### User's Fork
- Repo: `github.com/Qutaiba-Khader/bluetooth_2_usb_gui`
- Web GUI: FastAPI in `bt_web/`, served on port 8080
- BT pairing already implemented: multi-agent passkey flow in `bt_manager.py`
- AP fallback: "Bluetooth To USB" SSID for headless setup
- Gamepad mapping: hardcoded in `src/bluetooth_2_usb/evdev/mapping.py`
- Key mapping feature was attempted and reverted (input lag) — NOT revisiting

---

## Tools Needed

| Tool | Purpose | Install |
|------|---------|---------|
| Python 3.11+ | Daemon development | Already on Pi |
| Chrome 89+ | WebHID testing | Already on host PC |
| `chrome://device-log` | USB/HID debug on host | Built into Chrome |
| `cat /dev/hidg3` | Raw HID traffic on Pi | Built-in |
| `echo -ne '\x01\x0B' > /dev/hidg3` | Send test responses | Built-in |
| `lsusb -v` | Verify composite device descriptors | `apt install usbutils` |
| `usbhid-dump` | Dump HID report descriptors from host | `apt install usbutils` |
| `wireshark` + USBPcap | USB traffic capture on Windows | Optional |
| `bluetoothctl` | BT management on Pi | Already installed |
| `dbus-monitor --system` | Monitor BlueZ D-Bus events | Built-in |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Feature reports not supported by f_hid on RPi OS kernel | Test early in Phase 1; fallback to interrupt IN/OUT reports if needed |
| WebHID can't filter by usagePage on composite device | Filter by interface number or collection; may need to iterate `device.collections` |
| Concurrent bluetoothctl access (WiFi GUI + WebHID) | Use mutex/lock in BluetoothManager; or integrate into single service |
| Passkey flow over HID is timing-sensitive | Use polling with timeout; daemon holds state until host confirms |
| /dev/hidg3 permissions | Add udev rule or run daemon as root (same as relay) |
| 63-byte payload too small for device names | Truncate names; use pagination for device lists |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Vendor usage page 0xFF00 | Standard vendor-defined page; WebHID allows it without platform permission |
| Feature reports (not interrupt) | Bidirectional request/response pattern; no polling overhead; WebHID supports both send and receive |
| 64-byte reports | Matches HID Remapper convention; fits one device entry per report |
| Standalone static web tool | No server needed; works offline; hostable on GitHub Pages; same pattern as HID Remapper |
| Reuse bt_manager.py | Pairing flow already handles passkey/PIN/Apple scenarios; no need to rewrite |
| Keep WiFi GUI working alongside | WebHID is an addition, not a replacement; WiFi GUI still useful for network config |
