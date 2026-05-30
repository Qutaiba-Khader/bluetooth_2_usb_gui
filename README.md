<!-- omit in toc -->
# Bluetooth-to-USB HID Bridge for Raspberry Pi

```
     +-----------------+         +-----------------+         +-----------------+
     |  Gamepad        |         |                 |         |                 |
     |  Keyboard       |---BT--->|  Raspberry Pi   |---USB-->|  Target Host    |
     |  Mouse          |         |  (HID Bridge)   |         |  (PC / Console) |
     +-----------------+         +-----------------+         +-----------------+
       Bluetooth Input             Converts BT->USB           Sees standard USB
       (wireless)                  keyboard & mouse            keyboard & mouse
```

A fork of [quaxalber/bluetooth_2_usb](https://github.com/quaxalber/bluetooth_2_usb) that adds a **web-based management GUI**, **USB config tool (WebSerial)**, **fallback WiFi AP**, **Apple device pairing**, and **boot optimizations**.

Bluetooth-2-USB turns a Raspberry Pi into a USB HID bridge. To the target host, the Pi appears as a standard wired USB keyboard and mouse. Use Bluetooth keyboards, mice, and gamepads in BIOS/boot menus, installers, kiosks, consoles, and other hosts where Bluetooth is unavailable.

## What this fork adds

| Feature | Description |
| --- | --- |
| **Web GUI** | Manage BT devices from a browser at `http://<pi-ip>:8080` |
| **USB Config Tool** | Manage BT devices over USB via [WebSerial](https://qutaiba-khader.github.io/bluetooth_2_usb_gui/) in Chrome -- no WiFi needed |
| **Network management** | WiFi status, network scanning, connect, hotspot controls |
| **Fallback WiFi AP** | Auto-creates hotspot when no known WiFi is available |
| **Multi-device support** | Up to 7 simultaneous Bluetooth HID devices |
| **Apple device support** | Full pairing for Magic Keyboard, Mouse, and Trackpad (passkey, PIN, SSP) |
| **Auto-connect** | Paired devices are trusted and auto-reconnect |
| **Boot optimizations** | Disables unnecessary services, ~26s boot time |

## Prerequisites

- **Raspberry Pi** Zero W, Zero 2 W, 4B, or 5
- **OS**: Raspberry Pi OS Bookworm or newer
- **USB cable** that supports data (not charge-only)
- One or more **Bluetooth HID devices** (keyboard, mouse, or gamepad)

> **Note:** Pi 3 models do not expose a device-mode USB port. On Pi 4B/5, use the USB-C power port. On Pi Zero, use the USB data port (not the power-only port).

## Quick start

### 1. Install

```bash
sudo apt update && sudo apt install -y git
sudo git clone https://github.com/Qutaiba-Khader/bluetooth_2_usb_gui.git /opt/bluetooth_2_usb
cd /opt/bluetooth_2_usb && sudo env PYTHONPATH=src python3 -m bluetooth_2_usb install
sudo reboot
```

### 2. Install the Web GUI and USB tool

```bash
cd /opt/bluetooth_2_usb && sudo bash bt_web/setup.sh
sudo reboot
```

### 3. Use it

**Option A -- WiFi GUI:** Open `http://<pi-ip>:8080` in any browser.

**Option B -- USB Tool:** Open the [USB Config Tool](https://qutaiba-khader.github.io/bluetooth_2_usb_gui/) in Chrome, click Connect, select the Pi's serial port.

If you don't know the Pi's IP, connect to the fallback WiFi:

| Setting | Value |
| --- | --- |
| SSID | `Bluetooth To USB` |
| Password | `1111111111` |
| Web UI | `http://10.42.0.1:8080` |

## USB Config Tool (WebSerial)

Manage Bluetooth devices directly over USB -- no WiFi or network connection needed. The Pi exposes a CDC ACM serial port alongside the HID gadgets. Chrome's WebSerial API provides reliable bidirectional communication.

**[Open USB Config Tool](https://qutaiba-khader.github.io/bluetooth_2_usb_gui/)**

Requirements:
- Chrome 89+ or Edge 89+ (WebSerial API)
- Pi connected via USB data cable

```
 Host PC (Chrome)                    Pi Zero 2 W
 +-----------------+    USB cable    +-----------------+
 |  WebSerial Tool |<===============>|  Serial Daemon  |
 |  (GitHub Pages) |                 |  (/dev/ttyGS0)  |
 +-----------------+                 +-----------------+
   serial.requestPort()               JSON-line protocol
   read/write streams                  bt_manager + net_manager
```

Features available over USB (no WiFi):
- Scan for nearby Bluetooth devices
- Pair, connect, disconnect, remove devices
- Passkey confirmation for Apple devices
- View WiFi status, scan networks, connect
- Start/stop WiFi hotspot

## Supported devices

| Type | Supported | Notes |
| --- | --- | --- |
| Keyboard | Yes | Full key relay, including Apple Magic Keyboard |
| Mouse | Yes | Movement, buttons, scroll, including Apple Magic Mouse |
| Gamepad | Yes | Buttons relayed as HID events |
| Apple Trackpad | Yes | Paired via SSP confirmation |
| Audio (earbuds) | No | Cannot relay as USB HID -- filtered from scan results |
| Phone | No | Cannot relay as USB HID -- filtered from scan results |

## Architecture

```
USB Composite Gadget (dwc2 + libcomposite)
+-- hid.usb0  Keyboard       -> /dev/hidg0
+-- hid.usb1  Mouse          -> /dev/hidg1
+-- hid.usb2  Consumer       -> /dev/hidg2
+-- hid.usb3  Config HID     -> /dev/hidg3
+-- acm.0     Serial (CDC)   -> /dev/ttyGS0  (WebSerial)
```

```
bt_web/
+-- main.py              # FastAPI app (WiFi GUI)
+-- bt_manager.py        # Bluetooth ops via interactive bluetoothctl
+-- net_manager.py       # Network ops via nmcli
+-- serial_daemon.py     # WebSerial daemon on /dev/ttyGS0
+-- add-acm.sh           # Adds CDC ACM function to USB gadget
+-- setup.sh             # Installation script
+-- bt-web.service       # Web GUI systemd service
+-- bt2usb-serial.service  # Serial daemon systemd service
+-- bt2usb-ap-fallback.service  # Hotspot fallback timer
+-- static/
    +-- index.html        # WiFi GUI (two-column layout)
    +-- style.css         # Dark theme
    +-- app.js            # Frontend logic

webhid-tool/             # USB Config Tool (GitHub Pages)
+-- index.html           # WebSerial UI
+-- serial.js            # WebSerial communication layer
+-- style.css            # Dark theme (shared base)
```

## Managed paths

| Path | Purpose |
| --- | --- |
| `/opt/bluetooth_2_usb` | Installation root |
| `/opt/bluetooth_2_usb/bt_web` | Web GUI + serial daemon |
| `/etc/default/bluetooth_2_usb` | Runtime settings (B2U_AUTO, B2U_GRAB, etc.) |
| `/etc/systemd/system/bt-web.service` | Web GUI service |
| `/etc/systemd/system/bt2usb-serial.service` | Serial daemon service |
| `/etc/systemd/system/bluetooth_2_usb.service` | Main HID bridge service |

## Updating

```bash
cd /opt/bluetooth_2_usb
sudo git pull
sudo env PYTHONPATH=src python3 -m bluetooth_2_usb install
sudo bash bt_web/setup.sh
sudo reboot
```

## Troubleshooting

```bash
# Service status
sudo systemctl status bluetooth_2_usb bt-web bt2usb-serial

# Logs
sudo journalctl -u bt-web -f
sudo journalctl -u bt2usb-serial -f

# Check USB gadget devices
ls /dev/hidg* /dev/ttyGS*

# Check Bluetooth adapter
bluetoothctl show | grep Powered

# Restart everything
sudo systemctl restart bluetooth_2_usb bt-web bt2usb-serial
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for base bluetooth_2_usb issues.

## License

[MIT License](LICENSE)

## Acknowledgments

- [quaxalber/bluetooth_2_usb](https://github.com/quaxalber/bluetooth_2_usb) -- the original project
- [Mike Redrobe](https://github.com/mikerr/pihidproxy) for the Pi HID proxy idea
- [Adafruit](https://www.adafruit.com/) for CircuitPython HID and Blinka

---

<div align="center">
Forked and extended by <a href="https://github.com/Qutaiba-Khader">Qutaiba Khader</a>
</div>
