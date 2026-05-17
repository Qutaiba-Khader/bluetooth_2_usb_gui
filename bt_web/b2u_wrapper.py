#!/opt/bluetooth_2_usb/venv/bin/python
"""Wrapper for bluetooth_2_usb service that loads custom key mappings."""

import sys
print("[b2u_wrapper] Starting with custom mapping hook", flush=True)
sys.path.insert(0, "/opt/bluetooth_2_usb/bt_web")

try:
    from mapping_hook import install_hook
    success = install_hook()
    print("[b2u_wrapper] Hook installed successfully", flush=True)
except Exception as e:
    print(f"[b2u_wrapper] Hook import/call failed: {e}", flush=True)
    import traceback
    traceback.print_exc()

from bluetooth_2_usb.service_entrypoint import main
raise SystemExit(main())
