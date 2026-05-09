const ICONS = {
  keyboard: "⌨️",
  mouse: "🖱️",
  audio: "🎧",
  phone: "📱",
  gamepad: "🎮",
  device: "📡",
};

let refreshInterval = null;
const processing = new Set();
let pendingWifiSsid = "";

async function api(path, method = "GET", body = null) {
  const opts = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch("/api" + path, opts);
  return res.json();
}

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// --- Bluetooth ---

function deviceCard(dev, isPaired) {
  const icon = ICONS[dev.type] || ICONS.device;
  const connected = dev.connected;
  const trusted = dev.trusted;
  const busy = processing.has(dev.mac);

  let statusDot = "disconnected";
  let statusText = "Disconnected";
  if (busy) { statusDot = "processing"; statusText = "Processing..."; }
  else if (connected) { statusDot = "connected"; statusText = "Connected"; }
  else if (trusted) { statusDot = "trusted"; statusText = "Trusted"; }

  let actions = "";
  if (busy) {
    actions = `<span class="spinner"></span><span class="processing-text">Please wait...</span>`;
  } else if (isPaired) {
    if (connected) {
      actions = `
        <button class="btn btn-ghost btn-sm" onclick="disconnectDevice('${dev.mac}')">Disconnect</button>
        <button class="btn btn-danger btn-sm" onclick="confirmRemove('${dev.mac}', '${dev.name.replace(/'/g, "\\'")}')">Remove</button>`;
    } else {
      actions = `
        <button class="btn btn-success btn-sm" onclick="connectDevice('${dev.mac}')">Connect</button>
        ${!trusted ? `<button class="btn btn-ghost btn-sm" onclick="trustDevice('${dev.mac}')">Trust</button>` : ""}
        <button class="btn btn-danger btn-sm" onclick="confirmRemove('${dev.mac}', '${dev.name.replace(/'/g, "\\'")}')">Remove</button>`;
    }
  } else {
    actions = `<button class="btn btn-primary btn-sm" onclick="pairDevice('${dev.mac}')">Pair</button>`;
  }

  return `
    <div class="device-card ${connected ? "connected" : ""} ${busy ? "busy" : ""}" id="dev-${dev.mac.replace(/:/g, "")}">
      <div class="device-icon">${icon}</div>
      <div class="device-info">
        <div class="device-name">${dev.name}</div>
        <div class="device-meta">
          <span class="status-dot ${statusDot}"></span>
          <span class="status-label">${statusText}</span>
          <span class="device-mac">${dev.mac}</span>
        </div>
      </div>
      <div class="device-actions">${actions}</div>
    </div>`;
}

function setProcessing(mac, busy) {
  if (busy) processing.add(mac); else processing.delete(mac);
  const id = "dev-" + mac.replace(/:/g, "");
  const el = document.getElementById(id);
  if (el) {
    const isPaired = el.parentElement.id === "paired-devices";
    const name = el.querySelector(".device-name").textContent;
    el.outerHTML = deviceCard({ mac, name, type: "device", connected: false, trusted: false }, isPaired);
  }
}

function removeFromNearby(mac) {
  const id = "dev-" + mac.replace(/:/g, "");
  const el = document.getElementById(id);
  if (el && el.parentElement.id === "scan-results") {
    el.remove();
    const c = document.getElementById("scan-results");
    if (!c.querySelector(".device-card")) {
      c.innerHTML = '<div class="empty">No new devices found.</div>';
    }
  }
}

async function loadAdapter() {
  try {
    const info = await api("/adapter");
    const dot = document.querySelector(".adapter-dot");
    const text = document.querySelector(".adapter-text");
    dot.classList.toggle("on", info.powered);
    text.textContent = info.powered ? `${info.name} — ${info.address}` : "Adapter Off";
  } catch { document.querySelector(".adapter-text").textContent = "Unavailable"; }
}

async function loadDevices() {
  const c = document.getElementById("paired-devices");
  try {
    const data = await api("/devices");
    if (data.devices.length === 0) {
      c.innerHTML = '<div class="empty">No paired devices. Scan and pair a device to get started.</div>';
    } else {
      c.innerHTML = data.devices.map((d) => deviceCard(d, true)).join("");
    }
  } catch { c.innerHTML = '<div class="empty">Failed to load devices</div>'; }
}

async function startScan() {
  const btn = document.getElementById("scan-btn");
  const c = document.getElementById("scan-results");
  btn.disabled = true;
  document.getElementById("scan-text").textContent = "Scanning...";
  btn.classList.add("scanning");
  c.innerHTML = '<div class="empty"><span class="scan-dot"></span> Scanning... (~8 seconds)</div>';
  try {
    const data = await api("/scan", "POST");
    if (data.devices.length === 0) {
      c.innerHTML = '<div class="empty">No new devices found. Make sure your device is in pairing mode.</div>';
    } else {
      c.innerHTML = data.devices.map((d) => deviceCard(d, false)).join("");
    }
    toast(`Found ${data.devices.length} device(s)`, "success");
  } catch {
    c.innerHTML = '<div class="empty">Scan failed. Try again.</div>';
    toast("Scan failed", "error");
  } finally {
    btn.disabled = false;
    document.getElementById("scan-text").textContent = "Scan";
    btn.classList.remove("scanning");
  }
}

async function pairDevice(mac) {
  setProcessing(mac, true);
  toast("Pairing... If prompted, confirm on the device.", "info");
  try {
    const r = await api(`/pair/${mac}`, "POST");
    if (r.success) { toast("Paired and connected!", "success"); removeFromNearby(mac); loadDevices(); }
    else toast("Pairing failed: " + (r.message || "Unknown error"), "error");
  } catch { toast("Pairing request failed", "error"); }
  finally { setProcessing(mac, false); }
}

async function connectDevice(mac) {
  setProcessing(mac, true);
  try {
    const r = await api(`/connect/${mac}`, "POST");
    toast(r.success ? "Connected" : "Connection failed", r.success ? "success" : "error");
  } catch { toast("Connection request failed", "error"); }
  finally { setProcessing(mac, false); loadDevices(); }
}

async function disconnectDevice(mac) {
  setProcessing(mac, true);
  try { await api(`/disconnect/${mac}`, "POST"); toast("Disconnected", "info"); }
  finally { setProcessing(mac, false); loadDevices(); }
}

async function trustDevice(mac) {
  await api(`/trust/${mac}`, "POST");
  toast("Device trusted — will auto-connect", "success");
  loadDevices();
}

function confirmRemove(mac, name) {
  document.getElementById("confirm-msg").textContent = `Remove "${name}"? This will unpair and forget the device.`;
  document.getElementById("confirm-yes").onclick = () => removeDevice(mac);
  document.getElementById("confirm-overlay").classList.remove("hidden");
}
function closeConfirm() { document.getElementById("confirm-overlay").classList.add("hidden"); }

async function removeDevice(mac) {
  closeConfirm();
  setProcessing(mac, true);
  try { await api(`/device/${mac}`, "DELETE"); toast("Device removed", "info"); }
  finally { setProcessing(mac, false); loadDevices(); }
}

// --- Network ---

async function loadNetStatus() {
  try {
    const s = await api("/network");
    document.getElementById("net-conn").textContent = s.connected ? "Connected" : "Disconnected";
    document.getElementById("net-conn").className = "net-val " + (s.connected ? "on" : "off");
    document.getElementById("net-ssid").textContent = s.connected ? s.ssid : "--";
    document.getElementById("net-ip").textContent = s.ip || "--";
    const apEl = document.getElementById("net-ap");
    if (s.hotspot_active) {
      apEl.textContent = "Active (10.42.0.1)";
      apEl.className = "net-val on";
    } else {
      apEl.textContent = "Off";
      apEl.className = "net-val off";
    }
  } catch {}
}

function signalBars(signal) {
  let level = "s1";
  if (signal > 75) level = "s4";
  else if (signal > 50) level = "s3";
  else if (signal > 25) level = "s2";
  return `<div class="wifi-bars ${level}">
    <span style="height:4px"></span><span style="height:7px"></span>
    <span style="height:10px"></span><span style="height:14px"></span>
  </div>`;
}

async function scanWifi() {
  const btn = document.getElementById("wifi-scan-btn");
  const c = document.getElementById("wifi-list");
  btn.disabled = true;
  c.innerHTML = '<div class="empty-sm">Scanning...</div>';
  try {
    const data = await api("/wifi/scan");
    if (data.networks.length === 0) {
      c.innerHTML = '<div class="empty-sm">No networks found</div>';
    } else {
      c.innerHTML = data.networks.map((n) => `
        <div class="wifi-item ${n.active ? "active" : ""}" onclick="promptWifi('${n.ssid.replace(/'/g, "\\'")}', '${n.security}', ${n.active})">
          ${signalBars(n.signal)}
          <span class="wifi-ssid">${n.ssid}</span>
          ${n.security ? '<span class="wifi-lock">🔒</span>' : ""}
        </div>`).join("");
    }
  } catch { c.innerHTML = '<div class="empty-sm">Scan failed</div>'; }
  finally { btn.disabled = false; }
}

function promptWifi(ssid, security, active) {
  if (active) return;
  pendingWifiSsid = ssid;
  document.getElementById("wifi-connect-title").textContent = `Connect to "${ssid}"`;
  const passInput = document.getElementById("wifi-pass");
  passInput.value = "";
  passInput.style.display = security ? "block" : "none";
  document.getElementById("wifi-overlay").classList.remove("hidden");
  if (security) passInput.focus();
}

function closeWifiDialog() { document.getElementById("wifi-overlay").classList.add("hidden"); }

async function submitWifiConnect() {
  const password = document.getElementById("wifi-pass").value;
  closeWifiDialog();
  toast(`Connecting to ${pendingWifiSsid}...`, "info");
  try {
    const r = await api("/wifi/connect", "POST", { ssid: pendingWifiSsid, password });
    if (r.success) {
      toast("WiFi connected!", "success");
      loadNetStatus();
      scanWifi();
    } else {
      toast("Connection failed: " + (r.message || ""), "error");
    }
  } catch { toast("Connection failed", "error"); }
}

// --- Init ---

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => { loadDevices(); loadNetStatus(); }, 10000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadAdapter();
  loadDevices();
  loadNetStatus();
  scanWifi();
  startAutoRefresh();
});
