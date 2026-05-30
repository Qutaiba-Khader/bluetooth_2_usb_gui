const VID = 0x1d6b;

let port = null;
let reader = null;
let writer = null;
let readBuf = "";
let pendingResolve = null;
let onDisconnectCb = null;

export function isSupported() {
  return "serial" in navigator;
}

export function isConnected() {
  return port !== null && port.readable !== null;
}

export async function connect(onDisconnect) {
  onDisconnectCb = onDisconnect;
  port = await navigator.serial.requestPort({
    filters: [{ usbVendorId: VID }],
  });
  await port.open({ baudRate: 115200 });

  port.addEventListener("disconnect", () => {
    port = null;
    reader = null;
    writer = null;
    if (onDisconnectCb) onDisconnectCb();
  });

  startReader();
}

async function startReader() {
  while (port && port.readable) {
    reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        readBuf += new TextDecoder().decode(value);
        processBuffer();
      }
    } catch (e) {
      if (e.name !== "NetworkError") console.error("Read error:", e);
    } finally {
      try { reader.releaseLock(); } catch {}
      reader = null;
    }
  }
}

function processBuffer() {
  while (readBuf.includes("\n")) {
    const idx = readBuf.indexOf("\n");
    const line = readBuf.slice(0, idx).trim();
    readBuf = readBuf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve(msg);
      }
    } catch {}
  }
}

async function send(obj, timeout = 30000) {
  if (!port || !port.writable) throw new Error("Not connected");
  const data = JSON.stringify(obj) + "\n";
  const w = port.writable.getWriter();
  try {
    await w.write(new TextEncoder().encode(data));
  } finally {
    w.releaseLock();
  }
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    setTimeout(() => {
      if (pendingResolve === resolve) {
        pendingResolve = null;
        reject(new Error("Timeout"));
      }
    }, timeout);
  });
}

export async function getAdapterInfo() {
  return send({ cmd: "adapter" });
}

export async function getDeviceList() {
  const r = await send({ cmd: "devices" });
  return r.devices || [];
}

export async function scanStart() {
  return send({ cmd: "scan_start" });
}

export async function scanStop() {
  return send({ cmd: "scan_stop" });
}

export async function scanResults() {
  const r = await send({ cmd: "scan_results" });
  return r.devices || [];
}

export async function pairDevice(mac) {
  return send({ cmd: "pair", mac }, 60000);
}

export async function pairStatus(mac) {
  return send({ cmd: "pair_status", mac });
}

export async function confirmPair(mac, confirmed) {
  return send({ cmd: "pair_confirm", mac, confirmed });
}

export async function connectDevice(mac) {
  return send({ cmd: "connect", mac }, 20000);
}

export async function disconnectDevice(mac) {
  return send({ cmd: "disconnect", mac });
}

export async function trustDevice(mac) {
  return send({ cmd: "trust", mac });
}

export async function removeDevice(mac) {
  return send({ cmd: "remove", mac });
}

export async function getNetworkStatus() {
  return send({ cmd: "network" });
}

export async function scanWifi() {
  const r = await send({ cmd: "wifi_scan" }, 20000);
  return r.networks || [];
}

export async function connectWifi(ssid, password) {
  return send({ cmd: "wifi_connect", ssid, password }, 30000);
}

export async function startHotspot() {
  return send({ cmd: "hotspot_start" }, 15000);
}

export async function ping() {
  return send({ cmd: "ping" }, 3000);
}
