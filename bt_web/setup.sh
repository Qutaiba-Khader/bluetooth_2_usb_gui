#!/bin/bash
set -e

DIR=/opt/bluetooth_2_usb/bt_web
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[+] Creating bt_web directory..."
mkdir -p "$DIR/static"

echo "[+] Copying application files..."
cp "$SCRIPT_DIR/main.py" "$DIR/"
cp "$SCRIPT_DIR/bt_manager.py" "$DIR/"
cp "$SCRIPT_DIR/net_manager.py" "$DIR/"
cp "$SCRIPT_DIR/webhid_daemon.py" "$DIR/"
cp "$SCRIPT_DIR/static/index.html" "$DIR/static/"
cp "$SCRIPT_DIR/static/style.css" "$DIR/static/"
cp "$SCRIPT_DIR/static/app.js" "$DIR/static/"

echo "[+] Creating virtual environment..."
python3 -m venv "$DIR/venv"

echo "[+] Installing dependencies..."
"$DIR/venv/bin/pip" install --quiet fastapi uvicorn[standard]

echo "[+] Installing services..."
cp "$SCRIPT_DIR/bt-web.service" /etc/systemd/system/
cp "$SCRIPT_DIR/bt2usb-webhid.service" /etc/systemd/system/
cp "$SCRIPT_DIR/bt2usb-wifi-off.service" /etc/systemd/system/

echo "[+] Setting up fallback WiFi AP..."
nmcli connection show bt2usb-hotspot >/dev/null 2>&1 || \
  nmcli connection add type wifi ifname wlan0 con-name "bt2usb-hotspot" \
    autoconnect no ssid "Bluetooth To USB" \
    wifi-sec.key-mgmt wpa-psk wifi-sec.psk "1111111111" \
    ipv4.method shared 802-11-wireless.mode ap 802-11-wireless.band bg

cp "$SCRIPT_DIR/99-bt2usb-ap" /etc/NetworkManager/dispatcher.d/
chmod +x /etc/NetworkManager/dispatcher.d/99-bt2usb-ap

cp "$SCRIPT_DIR/bt2usb-ap-fallback.service" /etc/systemd/system/

echo "[+] Installing gamepad mapping..."
VENV_MAPPING="/opt/bluetooth_2_usb/venv/lib/python3.*/site-packages/bluetooth_2_usb/evdev/mapping.py"
SRC_MAPPING="/opt/bluetooth_2_usb/src/bluetooth_2_usb/evdev/mapping.py"
for target in $VENV_MAPPING; do
  if [ -f "$target" ] && [ -f "$SRC_MAPPING" ]; then
    cp "$SRC_MAPPING" "$target"
    rm -f "$(dirname "$target")/__pycache__/mapping."*.pyc
    echo "    Updated $(dirname "$target")"
  fi
done

echo "[+] Disabling WiFi power save (BT coexistence)..."
mkdir -p /etc/NetworkManager/conf.d
cat > /etc/NetworkManager/conf.d/wifi-powersave.conf <<WEOF
[connection]
wifi.powersave = 2
WEOF

echo "[+] Optimizing boot time..."
systemctl disable --now cloud-init-main.service cloud-init-local.service \
  cloud-init-network.service cloud-config.service cloud-final.service \
  cloud-init-hotplugd.socket 2>/dev/null || true
touch /etc/cloud/cloud-init.disabled 2>/dev/null || true
systemctl disable --now NetworkManager-wait-online.service e2scrub_reap.service \
  udisks2.service man-db.timer dpkg-db-backup.timer \
  keyboard-setup.service console-setup.service 2>/dev/null || true

echo "[+] Installing gadget descriptor updates..."
VENV_DESC="/opt/bluetooth_2_usb/venv/lib/python3.*/site-packages/bluetooth_2_usb/hid/descriptors.py"
VENV_LAYOUT="/opt/bluetooth_2_usb/venv/lib/python3.*/site-packages/bluetooth_2_usb/gadgets/layout.py"
VENV_CONST="/opt/bluetooth_2_usb/venv/lib/python3.*/site-packages/bluetooth_2_usb/hid/constants.py"
for src_dest in \
  "src/bluetooth_2_usb/hid/descriptors.py:$VENV_DESC" \
  "src/bluetooth_2_usb/gadgets/layout.py:$VENV_LAYOUT" \
  "src/bluetooth_2_usb/hid/constants.py:$VENV_CONST"; do
  src="/opt/bluetooth_2_usb/$(echo "$src_dest" | cut -d: -f1)"
  dest_glob="$(echo "$src_dest" | cut -d: -f2)"
  for target in $dest_glob; do
    if [ -f "$target" ] && [ -f "$src" ]; then
      cp "$src" "$target"
      rm -f "$(dirname "$target")/__pycache__/"*.pyc
      echo "    Updated $target"
    fi
  done
done

echo "[+] Enabling services..."
systemctl daemon-reload
systemctl enable bt-web.service bt2usb-ap-fallback.service bt2usb-webhid.service bt2usb-wifi-off.service
systemctl restart bt-web.service
systemctl restart bt2usb-webhid.service 2>/dev/null || true

echo ""
echo "[+] Done!"
echo "[+] WebHID tool: https://qutaiba-khader.github.io/bluetooth_2_usb_gui/"
echo "[+] WiFi is disabled by default. Use WebHID tool to enable when needed."
echo "[+] Reboot to apply all changes."
