#!/bin/bash
# Add CDC ACM serial function to existing USB gadget for WebSerial communication
set -e

GADGET=$(find /sys/kernel/config/usb_gadget -maxdepth 1 -mindepth 1 -type d | head -1)
if [ -z "$GADGET" ]; then
    echo "No USB gadget found"
    exit 1
fi

if [ -d "$GADGET/functions/acm.0" ]; then
    echo "ACM function already exists"
    exit 0
fi

UDC=$(cat "$GADGET/UDC" 2>/dev/null)
if [ -z "$UDC" ]; then
    echo "Gadget not bound to UDC"
    exit 1
fi

echo "Adding ACM function to $GADGET"

modprobe usb_f_acm 2>/dev/null || true

CONF=$(find "$GADGET/configs" -maxdepth 1 -mindepth 1 -type d | head -1)

# Remember existing function links before unbind
EXISTING_FUNCS=""
for link in "$CONF"/*; do
    [ -L "$link" ] && EXISTING_FUNCS="$EXISTING_FUNCS $(basename "$link")"
done

# Unbind
echo "" > "$GADGET/UDC"

# Create ACM function and link to config
mkdir -p "$GADGET/functions/acm.0"
ln -sf "$GADGET/functions/acm.0" "$CONF/acm.0"

# Re-link any existing functions that got removed
for func in $EXISTING_FUNCS; do
    [ -d "$GADGET/functions/$func" ] && ln -sf "$GADGET/functions/$func" "$CONF/$func" 2>/dev/null
done

# Set composite device class for Windows compatibility
echo 0xEF > "$GADGET/bDeviceClass"
echo 0x02 > "$GADGET/bDeviceSubClass"
echo 0x01 > "$GADGET/bDeviceProtocol"

# Rebind
echo "$UDC" > "$GADGET/UDC"

echo "ACM function added — /dev/ttyGS0 should be available"
ls -la /dev/ttyGS0 2>/dev/null || echo "WARNING: /dev/ttyGS0 not found"
