"""
Monkey-patch for bluetooth_2_usb relay service.
Loads custom key mappings and macros from /opt/bluetooth_2_usb/mappings/.

Supports multiple targets per source key and macro sequences.
"""

import asyncio
import json
import logging
from pathlib import Path

logger = logging.getLogger("mapping_hook")

MAPPINGS_DIR = Path("/opt/bluetooth_2_usb/mappings")

# scancode → list of (hid_usage, is_consumer)
_override_map = {}
# scancode → list of (hid_usage, is_consumer, delay_sec)
_macro_map = {}
# macro_index → list of (hid_usage, is_consumer, delay_sec)
_macro_defs = {}


def load_custom_mappings():
    """Load all device mapping JSON files. Supports macros and multi-map."""
    global _override_map, _macro_map, _macro_defs
    _override_map = {}
    _macro_map = {}
    _macro_defs = {}
    if not MAPPINGS_DIR.exists():
        return
    count = 0
    macro_count = 0
    for f in MAPPINGS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())

            # Load macro definitions
            for i, macro in enumerate(data.get("macros", [])):
                steps = macro.get("steps", [])
                step_list = []
                for s in steps:
                    hid = s.get("hid_usage")
                    stype = s.get("type", "keyboard")
                    delay = s.get("delay", 50) / 1000.0
                    if hid is not None:
                        step_list.append((hid, stype in ("consumer", "system"), delay))
                if step_list:
                    _macro_defs[i] = step_list

            # Load mappings
            for m in data.get("mappings", []):
                src = m.get("source", {})
                evdev_code = src.get("evdev_code")
                if evdev_code is None:
                    continue

                # Handle targets array format
                targets = m.get("targets")
                if targets:
                    steps = []
                    for t in targets:
                        hid = t.get("hid_usage")
                        stype = t.get("type", "keyboard")
                        delay = t.get("delay", 50) / 1000.0
                        if hid is not None:
                            steps.append((hid, stype in ("consumer", "system"), delay))
                    if len(steps) == 1:
                        if evdev_code not in _override_map:
                            _override_map[evdev_code] = []
                        _override_map[evdev_code].append(steps[0][:2])
                        count += 1
                    elif len(steps) > 1:
                        _macro_map[evdev_code] = steps
                        macro_count += 1
                    continue

                # Single target format
                tgt = m.get("target", {})
                hid_usage = tgt.get("hid_usage")
                tgt_type = tgt.get("type", "keyboard")
                if hid_usage is None:
                    continue
                if tgt_type == "macro":
                    macro_idx = hid_usage
                    if macro_idx in _macro_defs:
                        _macro_map[evdev_code] = _macro_defs[macro_idx]
                        macro_count += 1
                    continue
                is_consumer = tgt_type in ("consumer", "system")
                if evdev_code not in _override_map:
                    _override_map[evdev_code] = []
                _override_map[evdev_code].append((hid_usage, is_consumer))
                count += 1

            logger.info("Loaded mappings from %s", f.stem)
        except Exception as e:
            logger.error("Failed to load mapping %s: %s", f, e)
    logger.info("Total: %d mappings, %d macros", count, macro_count)


def install_hook():
    """Monkey-patch the bluetooth_2_usb relay to use custom mappings.

    Supports multiple targets per source key by patching _dispatch_key_event.
    """
    try:
        from bluetooth_2_usb.evdev import mapping as m
        from bluetooth_2_usb.hid import dispatch as d

        original_evdev_to_usb_hid = m.evdev_to_usb_hid
        original_is_consumer_key = m.is_consumer_key

        _hid_name_cache = {}

        def _resolve_hid_name(hid_usage_id, is_consumer):
            if hid_usage_id in _hid_name_cache:
                return _hid_name_cache[hid_usage_id]
            name = f"CUSTOM_0x{hid_usage_id:02X}"
            try:
                code_type = m._consumer_control_code_type() if is_consumer else m._keycode_type()
                for attribute in m._cached_dir(code_type):
                    if m._cached_getattr(code_type, attribute) == hid_usage_id:
                        name = attribute
                        break
            except Exception:
                pass
            _hid_name_cache[hid_usage_id] = name
            return name

        def patched_evdev_to_usb_hid(event):
            targets = _override_map.get(event.scancode)
            if targets:
                # Return the FIRST target; additional targets handled by dispatch patch
                hid_usage_id, is_consumer = targets[0]
                hid_usage_name = _resolve_hid_name(hid_usage_id, is_consumer)
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug(
                        "Converted evdev scancode 0x%02X to HID 0x%02X (%s) [CUSTOM]",
                        event.scancode, hid_usage_id, hid_usage_name,
                    )
                return hid_usage_id, hid_usage_name
            return original_evdev_to_usb_hid(event)

        def patched_is_consumer_key(event):
            targets = _override_map.get(event.scancode)
            if targets:
                return targets[0][1]
            return original_is_consumer_key(event)

        m.evdev_to_usb_hid = patched_evdev_to_usb_hid
        m.is_consumer_key = patched_is_consumer_key
        d.evdev_to_usb_hid = patched_evdev_to_usb_hid
        d.is_consumer_key = patched_is_consumer_key

        # Patch _dispatch_key_event for multi-map and macros
        from bluetooth_2_usb.hid.dispatch import HidDispatcher
        from bluetooth_2_usb.evdev.types import KeyEvent

        original_dispatch = HidDispatcher._dispatch_key_event

        async def _send_key(self, hid_usage_id, is_consumer, press):
            gadget = self._hid_gadgets.consumer if is_consumer else self._hid_gadgets.keyboard
            if press:
                await gadget.press(hid_usage_id)
            else:
                if is_consumer:
                    await gadget.release()
                else:
                    await gadget.release(hid_usage_id)

        async def patched_dispatch_key_event(self, event: KeyEvent):
            macro_steps = _macro_map.get(event.scancode)
            if macro_steps:
                if event.keystate == KeyEvent.key_down:
                    for hid_usage_id, is_consumer, delay in macro_steps:
                        await _send_key(self, hid_usage_id, is_consumer, True)
                        await asyncio.sleep(delay)
                        await _send_key(self, hid_usage_id, is_consumer, False)
                        await asyncio.sleep(delay)
                return

            # Normal dispatch (first target)
            await original_dispatch(self, event)

            # Multi-map: additional targets beyond the first
            targets = _override_map.get(event.scancode)
            if targets and len(targets) > 1:
                for hid_usage_id, is_consumer in targets[1:]:
                    try:
                        await _send_key(self, hid_usage_id, is_consumer,
                                        event.keystate == KeyEvent.key_down)
                    except Exception as e:
                        logger.error("Multi-map dispatch error: %s", e)

        HidDispatcher._dispatch_key_event = patched_dispatch_key_event

        load_custom_mappings()
        logger.info("Custom mapping hook installed (%d scancodes, multi-map enabled)", len(_override_map))

    except Exception as e:
        logger.error("Failed to install mapping hook: %s", e)
        import traceback
        traceback.print_exc()
