const VID = 0x1d6b;
const PID = 0x0104;
const USAGE_PAGE = 0xff00;
const REPORT_ID_CMD = 1;
const REPORT_ID_RSP = 2;
const REPORT_SIZE = 63;

const CMD = {
  GET_DEVICE_LIST: 0x01,
  GET_DEVICE_INFO: 0x02,
  SCAN_START: 0x03,
  SCAN_STOP: 0x04,
  SCAN_RESULTS: 0x05,
  PAIR_DEVICE: 0x06,
  PAIR_CONFIRM: 0x07,
  UNPAIR_DEVICE: 0x08,
  CONNECT: 0x09,
  DISCONNECT: 0x0a,
  GET_ADAPTER_INFO: 0x0b,
  GET_VERSION: 0x0d,
  WIFI_STATUS: 0x10,
  WIFI_ENABLE: 0x11,
  WIFI_DISABLE: 0x12,
  WIFI_HOTSPOT: 0x13,
  WIFI_SCAN: 0x14,
  WIFI_CONNECT: 0x15,
};

const STATUS = {
  OK: 0x00,
  ERROR: 0x01,
  BUSY: 0x02,
  NOT_FOUND: 0x03,
  PASSKEY_DISPLAY: 0x04,
  PASSKEY_CONFIRM: 0x05,
};

const DEV_TYPE = { 0: "device", 1: "keyboard", 2: "mouse", 3: "gamepad", 4: "audio", 5: "combo" };
const DEV_ICON = { keyboard: "⌨️", mouse: "🖱️", gamepad: "🎮", audio: "🎧", combo: "🔀", device: "📡" };

let hidDevice = null;
let _onDisconnect = null;

function isSupported() { return "hid" in navigator; }

async function connect(onDisconnect) {
  _onDisconnect = onDisconnect || null;
  const filters = [{ vendorId: VID, productId: PID, usagePage: USAGE_PAGE }];
  const [device] = await navigator.hid.requestDevice({ filters });
  if (!device) throw new Error("No device selected");
  await device.open();
  hidDevice = device;
  hidDevice.addEventListener("disconnect", () => {
    hidDevice = null;
    if (typeof _onDisconnect === "function") _onDisconnect();
  });
  return device;
}

function disconnect() {
  if (hidDevice) {
    hidDevice.close();
    hidDevice = null;
  }
}

function isConnected() { return hidDevice !== null && hidDevice.opened; }

async function sendCommand(cmd, payload = []) {
  if (!isConnected()) throw new Error("Not connected");
  const data = new Uint8Array(REPORT_SIZE);
  data[0] = cmd;
  for (let i = 0; i < payload.length && i < REPORT_SIZE - 1; i++) {
    data[i + 1] = payload[i];
  }
  await hidDevice.sendFeatureReport(REPORT_ID_CMD, data);
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
    try {
      const report = await hidDevice.receiveFeatureReport(REPORT_ID_RSP);
      const view = report.data;
      if (view.byteLength < 4) continue;
      const status = view.getUint8(0);
      const cmdEcho = view.getUint8(1);
      if (cmdEcho === 0 && status === 0) continue;
      return {
        status,
        cmdEcho,
        seq: view.getUint8(2),
        total: view.getUint8(3),
        data: new Uint8Array(view.buffer, view.byteOffset + 4, view.byteLength - 4),
      };
    } catch { continue; }
  }
  throw new Error("Response timeout");
}

function parseMac(bytes, offset) {
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push(bytes[offset + i].toString(16).padStart(2, "0").toUpperCase());
  return parts.join(":");
}

function macToBytes(mac) {
  return mac.split(":").map((h) => parseInt(h, 16));
}

function parseString(data, offset, length) {
  let s = "";
  for (let i = 0; i < length; i++) {
    if (data[offset + i] === 0) break;
    s += String.fromCharCode(data[offset + i]);
  }
  return s;
}

function parseDeviceEntry(data, offset) {
  const mac = parseMac(data, offset);
  const flags = data[offset + 7];
  const typeCode = data[offset + 8];
  const name = parseString(data, offset + 9, 23);
  return {
    mac,
    addrType: data[offset + 6],
    paired: !!(flags & 1),
    trusted: !!(flags & 2),
    connected: !!(flags & 4),
    hidSupported: !!(flags & 8),
    type: DEV_TYPE[typeCode] || "device",
    icon: DEV_ICON[DEV_TYPE[typeCode]] || DEV_ICON.device,
    name: name || mac,
  };
}

async function getVersion() {
  const r = await sendCommand(CMD.GET_VERSION);
  if (r.status !== STATUS.OK) return null;
  return parseString(r.data, 0, r.data.length);
}

async function getAdapterInfo() {
  const r = await sendCommand(CMD.GET_ADAPTER_INFO);
  if (r.status !== STATUS.OK) return null;
  return {
    powered: !!(r.data[0] & 1),
    address: parseMac(r.data, 1),
    connectedCount: r.data[7],
    maxConnected: r.data[8],
    name: parseString(r.data, 9, 50),
  };
}

async function getDeviceList() {
  const devices = [];
  let page = 0;
  while (true) {
    const r = await sendCommand(CMD.GET_DEVICE_LIST, [page]);
    if (r.status !== STATUS.OK || r.total === 0) break;
    if (r.data.length >= 32) devices.push(parseDeviceEntry(r.data, 0));
    if (r.seq >= r.total - 1) break;
    page++;
  }
  return devices;
}

async function startScan() { return sendCommand(CMD.SCAN_START); }
async function stopScan() { return sendCommand(CMD.SCAN_STOP); }

async function getScanResults() {
  const devices = [];
  let page = 0;
  while (true) {
    const r = await sendCommand(CMD.SCAN_RESULTS, [page]);
    if (r.status !== STATUS.OK || r.total === 0) break;
    if (r.data.length >= 32) devices.push(parseDeviceEntry(r.data, 0));
    if (r.seq >= r.total - 1) break;
    page++;
  }
  return devices;
}

async function pairDevice(mac, addrType = 0) {
  const r = await sendCommand(CMD.PAIR_DEVICE, [...macToBytes(mac), addrType]);
  if (r.status === STATUS.BUSY) {
    return waitForResponse(45000);
  }
  return r;
}

async function confirmPair(mac, accept) {
  return sendCommand(CMD.PAIR_CONFIRM, [...macToBytes(mac), accept ? 1 : 0]);
}

async function unpairDevice(mac) {
  return sendCommand(CMD.UNPAIR_DEVICE, macToBytes(mac));
}

async function connectDevice(mac) {
  return sendCommand(CMD.CONNECT, macToBytes(mac));
}

async function disconnectDevice(mac) {
  return sendCommand(CMD.DISCONNECT, macToBytes(mac));
}

async function getWifiStatus() {
  const r = await sendCommand(CMD.WIFI_STATUS);
  if (r.status !== STATUS.OK) return null;
  return {
    radioOn: !!r.data[0],
    connected: !!r.data[1],
    ssid: parseString(r.data, 2, 30),
    ip: parseString(r.data, 32, 20),
  };
}

async function enableWifi(ssid = "", password = "") {
  const payload = new Uint8Array(63);
  const ssidBytes = new TextEncoder().encode(ssid.slice(0, 30));
  const passBytes = new TextEncoder().encode(password.slice(0, 31));
  payload.set(ssidBytes, 0);
  payload.set(passBytes, 31);
  return sendCommand(CMD.WIFI_ENABLE, Array.from(payload));
}

async function disableWifi() {
  return sendCommand(CMD.WIFI_DISABLE);
}

async function scanWifiNetworks() {
  const networks = [];
  let page = 0;
  const first = await sendCommand(CMD.WIFI_SCAN, [0]);
  if (first.status !== STATUS.OK || first.total === 0) return networks;
  networks.push({
    ssid: parseString(first.data, 0, 31),
    signal: first.data[31],
    secured: !!first.data[32],
  });
  for (page = 1; page < first.total; page++) {
    const r = await sendCommand(CMD.WIFI_SCAN, [page]);
    if (r.status !== STATUS.OK) break;
    networks.push({
      ssid: parseString(r.data, 0, 31),
      signal: r.data[31],
      secured: !!r.data[32],
    });
  }
  return networks;
}

async function connectWifi(ssid, password = "") {
  const payload = new Uint8Array(63);
  const ssidBytes = new TextEncoder().encode(ssid.slice(0, 30));
  const passBytes = new TextEncoder().encode(password.slice(0, 31));
  payload.set(ssidBytes, 0);
  payload.set(passBytes, 31);
  return sendCommand(CMD.WIFI_CONNECT, Array.from(payload));
}

async function startHotspot(ssid = "", password = "") {
  const payload = new Uint8Array(63);
  const ssidBytes = new TextEncoder().encode(ssid.slice(0, 30));
  const passBytes = new TextEncoder().encode(password.slice(0, 31));
  payload.set(ssidBytes, 0);
  payload.set(passBytes, 31);
  return sendCommand(CMD.WIFI_HOTSPOT, Array.from(payload));
}

export {
  isSupported, connect, disconnect, isConnected,
  getVersion, getAdapterInfo, getDeviceList,
  startScan, stopScan, getScanResults,
  pairDevice, confirmPair, unpairDevice,
  connectDevice, disconnectDevice,
  getWifiStatus, enableWifi, disableWifi, startHotspot, scanWifiNetworks, connectWifi,
  CMD, STATUS, DEV_ICON,
};
