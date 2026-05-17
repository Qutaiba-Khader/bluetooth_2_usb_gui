"""
Monkey-patch for bluetooth_2_usb relay service.
Loads custom key mappings from /opt/bluetooth_2_usb/mappings/ and overrides
the default evdev→HID translation for matched devices.

Install: copy to venv site-packages and import from sitecustomize.py
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger("mapping_hook")

MAPPINGS_DIR = Path("/opt/bluetooth_2_usb/mappings")

_custom_maps = {}


def load_custom_mappings():
    """Load all device mapping JSON files into memory."""
    global _custom_maps
    _custom_maps = {}
    if not MAPPINGS_DIR.exists():
        return
    for f in MAPPINGS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            mappings = data.get("mappings", [])
            if not mappings:
                continue
            override = {}
            consumer_codes = set()
            keyboard_codes = set()
            for m in mappings:
                src = m.get("source", {})
                tgt = m.get("target", {})
                evdev_code = src.get("evdev_code")
                hid_usage = tgt.get("hid_usage")
                tgt_type = tgt.get("type", "keyboard")
                if evdev_code is not None and hid_usage is not None:
                    override[evdev_code] = hid_usage
                    if tgt_type == "consumer" or tgt_type == "system":
                        consumer_codes.add(evdev_code)
                    else:
                        keyboard_codes.add(evdev_code)
            mac = f.stem
            _custom_maps[mac] = {
                "override": override,
                "consumer_codes": consumer_codes,
                "keyboard_codes": keyboard_codes,
            }
            logger.info("Loaded %d custom mappings for %s", len(override), mac)
        except Exception as e:
            logger.error("Failed to load mapping %s: %s", f, e)


def get_override_for_scancode(scancode):
    """Check all custom maps for a scancode override. Returns (hid_usage, is_consumer) or None."""
    for mac, data in _custom_maps.items():
        if scancode in data["override"]:
            is_consumer = scancode in data["consumer_codes"]
            return data["override"][scancode], is_consumer
    return None


def install_hook():
    """Monkey-patch the bluetooth_2_usb relay to use custom mappings."""
    try:
        from bluetooth_2_usb.evdev import mapping as m
        from bluetooth_2_usb.hid import dispatch as d

        original_evdev_to_usb_hid = m.evdev_to_usb_hid
        original_is_consumer_key = m.is_consumer_key

        def patched_evdev_to_usb_hid(event):
            scancode = event.scancode
            result = get_override_for_scancode(scancode)
            if result is not None:
                hid_usage_id, is_consumer = result
                key_name = m.find_key_name(event)
                hid_usage_name = f"CUSTOM_0x{hid_usage_id:02X}"
                try:
                    if is_consumer:
                        code_type = m._consumer_control_code_type()
                    else:
                        code_type = m._keycode_type()
                    for attribute in m._cached_dir(code_type):
                        if m._cached_getattr(code_type, attribute) == hid_usage_id:
                            hid_usage_name = attribute
                            break
                except Exception:
                    pass
                logger.info(
                    "Converted evdev scancode 0x%02X (%s) to HID UsageID 0x%02X (%s) [CUSTOM]",
                    scancode, key_name or "?", hid_usage_id, hid_usage_name,
                )
                return hid_usage_id, hid_usage_name
            return original_evdev_to_usb_hid(event)

        def patched_is_consumer_key(event):
            scancode = event.scancode
            result = get_override_for_scancode(scancode)
            if result is not None:
                _, is_consumer = result
                return is_consumer
            return original_is_consumer_key(event)

        m.evdev_to_usb_hid = patched_evdev_to_usb_hid
        m.is_consumer_key = patched_is_consumer_key
        d.evdev_to_usb_hid = patched_evdev_to_usb_hid
        d.is_consumer_key = patched_is_consumer_key

        load_custom_mappings()
        logger.info("Custom mapping hook installed (%d device configs)", len(_custom_maps))

    except Exception as e:
        logger.error("Failed to install mapping hook: %s", e)
        import traceback
        traceback.print_exc()
