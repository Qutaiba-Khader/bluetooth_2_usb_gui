<!-- omit in toc -->
# Bluetooth-to-USB HID Bridge for Raspberry Pi — with Web GUI

![Bluetooth-to-USB HID bridge overview for Raspberry Pi](assets/overview.png)

A fork of [quaxalber/bluetooth_2_usb](https://github.com/quaxalber/bluetooth_2_usb) that adds a **web-based management GUI**, **fallback WiFi AP**, and **boot optimizations**.

Use Bluetooth keyboards and mice in BIOS and boot menus, installers, kiosks,
tablets, KVM setups, retro systems, consoles, and other hosts where Bluetooth
is unavailable or inconvenient.

Bluetooth-2-USB turns a Raspberry Pi into a USB HID bridge for Bluetooth
keyboards and mice. To the target host, the Pi appears as a standard wired USB
keyboard and mouse — no Bluetooth support, pairing flow, or special drivers
required on the target system.

## What this fork adds

| Feature | Description |
| --- | --- |
| **Web GUI** | Manage Bluetooth devices from a browser — scan, pair, connect, disconnect, remove. Accessible at `http://<pi-ip>:8080` |
| **Network management** | View WiFi status, scan and connect to networks, all from the web UI |
| **Fallback WiFi AP** | When no known WiFi is available, the Pi creates a hotspot (`Bluetooth To USB` / password `1111111111`) so you can always reach the web UI |
| **Multi-device support** | Pair and relay multiple Bluetooth HID devices simultaneously |
| **Auto-connect** | Paired devices are automatically trusted — they reconnect when in range |
| **BLE pairing agent** | Proper `NoInputNoOutput` agent registration for BLE device pairing |
| **Boot optimizations** | Disables unnecessary services (cloud-init, wait-online, etc.) — reduces boot time by ~10 seconds |
| **Processing indicators** | Visual feedback during pair/connect operations with spinner states |

## Quick start

### 1. Install the base bluetooth_2_usb

```bash
sudo apt update && sudo apt install -y git
sudo git clone https://github.com/Qutaiba-Khader/bluetooth_2_usb_gui.git /opt/bluetooth_2_usb
cd /opt/bluetooth_2_usb && sudo env PYTHONPATH=src python3 -m bluetooth_2_usb install
```

### 2. Reboot

```bash
sudo reboot
```

### 3. Install the Web GUI

```bash
cd /opt/bluetooth_2_usb && sudo bash bt_web/setup.sh
```

### 4. Reboot again (for boot optimizations)

```bash
sudo reboot
```

### 5. Open the Web GUI

Open `http://<pi-ip>:8080` in your browser. If you don't know the Pi's IP, connect to the fallback WiFi:

| Setting | Value |
| --- | --- |
| SSID | `Bluetooth To USB` |
| Password | `1111111111` |
| Web UI | `http://10.42.0.1:8080` |

### 6. Connect the Pi to the target host

- Pi 4B / 5: use the USB-C power port
- Pi Zero W / Zero 2 W: use the USB data port

## Web GUI features

### Bluetooth management

- **Scan** for nearby Bluetooth devices
- **Pair** devices with one click (BLE + Classic)
- **Connect / Disconnect** paired devices
- **Remove** devices with confirmation dialog
- **Trust** devices for auto-reconnect
- **Processing states** with visual spinner feedback
- Devices are removed from the nearby list after pairing

### Network management

- View current WiFi connection (SSID, IP address)
- View fallback AP status
- Scan for available WiFi networks
- Connect to a WiFi network with password
- Signal strength bars for each network

### Fallback WiFi AP

When the Pi cannot connect to any known WiFi network, it automatically creates a WiFi hotspot:

- **SSID:** `Bluetooth To USB`
- **Password:** `1111111111`
- **IP:** `10.42.0.1`
- The AP shuts down automatically when WiFi reconnects
- The AP activates automatically when WiFi disconnects

## Architecture

```
bt_web/
├── main.py              # FastAPI application
├── bt_manager.py        # Bluetooth operations via bluetoothctl
├── net_manager.py       # Network operations via nmcli
├── setup.sh             # Installation script
├── bt-web.service       # systemd service for the web UI
├── bt2usb-ap-fallback.service  # Boot-time AP fallback check
├── 99-bt2usb-ap         # NetworkManager dispatcher for AP fallback
└── static/
    ├── index.html        # Two-column responsive layout
    ├── style.css         # Dark theme UI
    └── app.js            # Frontend logic
```

## Boot optimizations

The setup script disables unnecessary services to reduce boot time on a dedicated Pi:

| Disabled service | Time saved | Reason |
| --- | --- | --- |
| `cloud-init` (5 units) | ~5s | Cloud VM provisioning, not needed on Pi |
| `NetworkManager-wait-online` | ~3.5s | Nothing needs to block on network |
| `e2scrub_reap` | ~1.5s | Filesystem scrub can be run manually |
| `udisks2` | ~0.5s | Disk management not needed headless |
| `keyboard-setup` / `console-setup` | ~0.6s | Headless Pi, no local console |

The `bt-web` service starts with `Type=idle` and `Nice=10` so it does not compete with `bluetooth_2_usb` at boot.

## Requirements

- Raspberry Pi Zero W, Zero 2 W, 4B, or 5
- Raspberry Pi OS Bookworm or newer
- Internet access during installation
- Bluetooth keyboard, mouse, or both
- USB cable that supports data

> [!NOTE]
> Pi 3 models include Bluetooth, but they do not expose a suitable
> device-mode port for this project.
> On Pi 4B and Pi 5, the OTG-capable port is the USB-C power port.
> On Pi Zero boards, the OTG-capable port is the USB data port, not the
> power-only port.

## Managed paths

| Path | Purpose |
| --- | --- |
| `/opt/bluetooth_2_usb` | Managed installation root |
| `/opt/bluetooth_2_usb/bt_web` | Web GUI application |
| `/opt/bluetooth_2_usb/venv` | bluetooth_2_usb virtual environment |
| `/opt/bluetooth_2_usb/bt_web/venv` | Web GUI virtual environment |
| `/etc/default/bluetooth_2_usb` | Runtime settings |
| `/etc/systemd/system/bt-web.service` | Web GUI service unit |
| `/etc/systemd/system/bt2usb-ap-fallback.service` | Boot AP fallback unit |
| `/etc/NetworkManager/dispatcher.d/99-bt2usb-ap` | AP fallback dispatcher |

## Updating

```bash
cd /opt/bluetooth_2_usb
sudo git pull
sudo env PYTHONPATH=src python3 -m bluetooth_2_usb install
sudo bash bt_web/setup.sh
sudo reboot
```

## Uninstalling the Web GUI

```bash
sudo systemctl disable --now bt-web.service bt2usb-ap-fallback.service
sudo rm /etc/systemd/system/bt-web.service /etc/systemd/system/bt2usb-ap-fallback.service
sudo rm /etc/NetworkManager/dispatcher.d/99-bt2usb-ap
sudo nmcli connection delete bt2usb-hotspot
sudo rm -rf /opt/bluetooth_2_usb/bt_web
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for base bluetooth_2_usb issues.

For the Web GUI:

```bash
# Check service status
sudo systemctl status bt-web.service

# View logs
sudo journalctl -u bt-web.service -f

# Check AP status
nmcli connection show --active | grep bt2usb

# Restart the web UI
sudo systemctl restart bt-web.service
```

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- [quaxalber/bluetooth_2_usb](https://github.com/quaxalber/bluetooth_2_usb) — the original project this fork is based on
- [Mike Redrobe](https://github.com/mikerr/pihidproxy) for the original Pi HID proxy idea
- [Adafruit](https://www.adafruit.com/) for CircuitPython HID and Blinka
- Everyone who tests the project on real hardware

---

<div align="center">

Forked and extended by [Qutaiba Khader](https://github.com/Qutaiba-Khader)

</div>
