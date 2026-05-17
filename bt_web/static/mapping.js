const MAC = window.location.pathname.split("/").pop();
let mappings = [];
let macros = [];

const KEY_ICONS = {
  "KEY_POWER": "⏻", "POWER": "⏻", "SYSTEM_POWER_DOWN": "⏻",
  "KEY_SLEEP": "💤", "SLEEP": "💤", "SYSTEM_SLEEP": "💤",
  "KEY_WAKEUP": "☀", "SYSTEM_WAKE_UP": "☀",
  "KEY_RESTART": "🔄",
  "KEY_MUTE": "🔇", "MUTE": "🔇",
  "KEY_VOLUMEUP": "🔊", "VOLUME_UP": "🔊",
  "KEY_VOLUMEDOWN": "🔉", "VOLUME_DOWN": "🔉",
  "KEY_PLAYPAUSE": "⏯", "PLAY_PAUSE": "⏯",
  "KEY_PLAY": "▶️", "PLAY": "▶️",
  "KEY_PAUSE": "⏸", "PAUSE": "⏸",
  "KEY_STOPCD": "⏹", "STOP": "⏹",
  "KEY_NEXTSONG": "⏭", "NEXT_TRACK": "⏭",
  "KEY_PREVIOUSSONG": "⏮", "PREV_TRACK": "⏮",
  "KEY_FASTFORWARD": "⏩", "FAST_FORWARD": "⏩",
  "KEY_REWIND": "⏪", "REWIND": "⏪",
  "KEY_RECORD": "⏺", "RECORD": "⏺",
  "KEY_EJECTCD": "⏏", "EJECT": "⏏",
  "KEY_SHUFFLE": "🔀", "SHUFFLE": "🔀",
  "KEY_MEDIA_REPEAT": "🔁", "REPEAT": "🔁",
  "KEY_SLOW": "🐢", "SLOW": "🐢",
  "KEY_BACK": "◀", "BACK": "◀",
  "KEY_FORWARD": "▶", "FORWARD": "▶",
  "KEY_HOMEPAGE": "🏠", "HOME": "🏠",
  "KEY_MENU": "☰", "MENU": "☰",
  "KEY_SELECT": "✓", "DPAD_CENTER": "✓", "MENU_ESCAPE": "✕",
  "DPAD_UP": "⬆", "DPAD_DOWN": "⬇", "DPAD_LEFT": "⬅", "DPAD_RIGHT": "➡",
  "KEY_SEARCH": "🔍", "SEARCH": "🔍",
  "KEY_EXIT": "✕", "EXIT": "✕",
  "KEY_VOICECOMMAND": "🎤", "VOICE_COMMAND": "🎤",
  "KEY_ASSISTANT": "🎤", "ASSISTANT": "🎤",
  "KEY_APPSELECT": "⊞", "APP_SWITCH": "⊞",
  "RECENT_APPS": "⊞", "ALL_APPS": "⊞⊞",
  "SETTINGS": "⚙", "KEY_CONFIG": "⚙",
  "FULLSCREEN": "⛶", "KEY_FULL_SCREEN": "⛶",
  "KEY_ENTER": "⏎", "ENTER": "⏎",
  "KEY_SPACE": "⎵", "SPACEBAR": "⎵",
  "KEY_TAB": "⇥", "TAB": "⇥",
  "KEY_ESC": "⎋", "ESCAPE": "⎋",
  "KEY_BACKSPACE": "⌫", "BACKSPACE": "⌫", "DELETE_BACKSPACE": "⌫",
  "KEY_DELETE": "⌦", "DELETE_FORWARD": "⌦",
  "KEY_UP": "⬆", "UP_ARROW": "⬆",
  "KEY_DOWN": "⬇", "DOWN_ARROW": "⬇",
  "KEY_LEFT": "⬅", "LEFT_ARROW": "⬅",
  "KEY_RIGHT": "➡", "RIGHT_ARROW": "➡",
  "KEY_PAGEUP": "⇞", "PAGE_UP": "⇞",
  "KEY_PAGEDOWN": "⇟", "PAGE_DOWN": "⇟",
  "KEY_CAPSLOCK": "⇪", "CAPS_LOCK": "⇪",
  "KEY_LEFTSHIFT": "⇧", "KEY_RIGHTSHIFT": "⇧",
  "LEFT_SHIFT": "⇧", "RIGHT_SHIFT": "⇧",
  "KEY_LEFTCTRL": "⌃", "KEY_RIGHTCTRL": "⌃",
  "LEFT_CONTROL": "⌃", "RIGHT_CONTROL": "⌃",
  "KEY_LEFTALT": "⌥", "KEY_RIGHTALT": "⌥",
  "LEFT_ALT": "⌥", "RIGHT_ALT": "⌥",
  "KEY_LEFTMETA": "❖", "KEY_RIGHTMETA": "❖",
  "LEFT_GUI": "❖", "RIGHT_GUI": "❖",
  "KEY_CHANNELUP": "📺⬆", "CHANNEL_UP": "📺⬆",
  "KEY_CHANNELDOWN": "📺⬇", "CHANNEL_DOWN": "📺⬇",
  "KEY_RED": "🔴", "RED": "🔴",
  "KEY_GREEN": "🟢", "GREEN": "🟢", "GREEN_MENU_BUTTON": "🟢",
  "KEY_BLUE": "🔵", "BLUE": "🔵", "BLUE_MENU_BUTTON": "🔵",
  "KEY_YELLOW": "🟡", "YELLOW": "🟡",
  "KEY_INFO": "ℹ", "INFO": "ℹ",
  "KEY_SUBTITLE": "💬", "CAPTIONS": "💬",
  "KEY_WWW": "🌐", "BROWSER": "🌐",
  "KEY_BRIGHTNESSUP": "🔆", "BRIGHTNESS_UP": "🔆",
  "KEY_BRIGHTNESSDOWN": "🔅", "BRIGHTNESS_DOWN": "🔅",
  "KEY_TV": "📺", "TV": "📺",
  "BTN_LEFT": "🖱L", "BTN_RIGHT": "🖱R", "BTN_MIDDLE": "🖱M",
  "MOUSE_MOVE": "🖱↔",
  "KEY_SYSRQ": "⎙", "PRINT_SCREEN": "⎙",
  "KEY_SCROLLLOCK": "⇳", "SCROLL_LOCK": "⇳"
};

function keyIcon(name) { return KEY_ICONS[name] || ""; }
function keyLabel(name) {
  const icon = keyIcon(name);
  return icon ? icon + " " + name : name;
}

let pickerCallback = null;
let pickerMode = "source";
let pickerCategory = "All";
let monitorWs = null;
let monitorRunning = false;

async function api(path, method = "GET", body = null) {
  const opts = { method };
  if (body) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
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

// --- Tabs ---
function switchToTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add("active");
  document.getElementById("tab-" + tabName).classList.add("active");
  if (tabName === "monitor") startMonitor();
  else if (monitorRunning) stopMonitor();
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("disabled")) return;
    switchToTab(btn.dataset.tab);
  });
});

// --- Load ---
async function loadDevice() {
  try {
    const data = await api("/mapping/" + MAC);
    document.getElementById("device-name").textContent = data.device_name || MAC;
    document.getElementById("device-mac").textContent = MAC.replace(/-/g, ":");
    mappings = data.mappings || [];
    macros = data.macros || [];
    // Normalize old "targets" format back to single target
    mappings = mappings.map(m => {
      if (m.targets && !m.target) {
        return { source: m.source, target: m.targets[0] || { name: "(none)", hid_usage: null, type: "keyboard" } };
      }
      return m;
    });
    renderMappings();
    renderMacros();
  } catch {
    document.getElementById("device-name").textContent = MAC.replace(/-/g, ":");
    mappings = [];
    macros = [];
    renderMappings();
    renderMacros();
  }
}

// --- Mapping Rows ---
let dragIdx = null;

function renderMappings() {
  const list = document.getElementById("mapping-list");
  if (mappings.length === 0) {
    list.innerHTML = '<div class="empty-mappings">No custom mappings. Click "+ Add Mapping" or use Quick Actions.</div>';
    return;
  }
  list.innerHTML = mappings.map((m, i) => `
    <div class="mapping-row" data-idx="${i}" draggable="true">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="row-num">${i + 1}</span>
      <button class="mapping-btn source" onclick="openPicker('source', ${i})">${keyLabel(m.source.name)}</button>
      <span class="mapping-arrow">&rarr;</span>
      <button class="mapping-btn target" onclick="openPicker('target', ${i})">${keyLabel(m.target.name)}</button>
      <button class="mapping-delete" onclick="deleteMapping(${i})" title="Remove">&times;</button>
    </div>
  `).join("");

  list.querySelectorAll(".mapping-row").forEach(row => {
    row.addEventListener("dragstart", (e) => {
      dragIdx = parseInt(row.dataset.idx);
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      list.querySelectorAll(".drag-over, .drag-over-below").forEach(r => r.classList.remove("drag-over", "drag-over-below"));
      dragIdx = null;
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      list.querySelectorAll(".drag-over, .drag-over-below").forEach(r => r.classList.remove("drag-over", "drag-over-below"));
      if (e.clientY < midY) row.classList.add("drag-over");
      else row.classList.add("drag-over-below");
    });
    row.addEventListener("dragleave", () => { row.classList.remove("drag-over", "drag-over-below"); });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over", "drag-over-below");
      const dropIdx = parseInt(row.dataset.idx);
      if (dragIdx === null || dragIdx === dropIdx) return;
      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      let targetIdx = e.clientY < midY ? dropIdx : dropIdx + 1;
      if (targetIdx > dragIdx) targetIdx--;
      const [moved] = mappings.splice(dragIdx, 1);
      mappings.splice(targetIdx, 0, moved);
      renderMappings();
    });
  });
}

function addMapping() {
  mappings.push({
    source: { name: "(click to set)", evdev_code: null },
    target: { name: "(click to set)", hid_usage: null, type: "keyboard" }
  });
  renderMappings();
  const list = document.getElementById("mapping-list");
  list.lastElementChild.scrollIntoView({ behavior: "smooth" });
}

function deleteMapping(idx) { mappings.splice(idx, 1); renderMappings(); }

async function saveMappings() {
  const valid = mappings.filter(m => m.source.evdev_code !== null && m.target.hid_usage !== null);
  if (valid.length !== mappings.length) toast("Some mappings are incomplete — saving only valid ones", "info");
  try {
    const data = {
      device_name: document.getElementById("device-name").textContent,
      mac: MAC.replace(/-/g, ":"),
      mappings: valid,
      macros: macros
    };
    const r = await api("/mapping/" + MAC, "POST", data);
    if (r.success) { mappings = valid; renderMappings(); toast("Saved! Relay restarting...", "success"); }
    else toast("Save failed: " + (r.message || ""), "error");
  } catch { toast("Save failed", "error"); }
}

async function resetMappings() {
  if (!confirm("Reset to default mappings? This will delete your custom config.")) return;
  try {
    const r = await api("/mapping/" + MAC, "DELETE");
    if (r.success) { mappings = []; macros = []; renderMappings(); renderMacros(); toast("Reset to defaults", "success"); }
  } catch { toast("Reset failed", "error"); }
}

// --- Usage Picker ---
function openPicker(mode, idx) {
  pickerMode = mode;
  pickerCategory = "All";
  document.getElementById("picker-title").textContent = mode === "source" ? "Select Source Key" : "Select Target Output";
  document.getElementById("picker-search").value = "";
  pickerCallback = (item) => {
    if (mode === "source") {
      mappings[idx].source = { name: item.name, evdev_code: item.code };
    } else {
      mappings[idx].target = { name: item.name, hid_usage: item.code, type: item.type || "keyboard" };
    }
    renderMappings();
  };
  renderPickerCategories();
  filterPicker();
  document.getElementById("picker-overlay").classList.add("open");
  document.getElementById("picker-search").focus();
}

function closePicker() {
  document.getElementById("picker-overlay").classList.remove("open");
  pickerCallback = null;
}

function renderPickerCategories() {
  const cats = pickerMode === "source" ? Object.keys(USAGES.source) : Object.keys(USAGES.target);
  const container = document.getElementById("picker-categories");
  container.innerHTML = ['All', ...cats].map(c =>
    `<button class="picker-cat ${c === pickerCategory ? 'active' : ''}" onclick="setPickerCat('${c}')">${c}</button>`
  ).join("");
}

function setPickerCat(cat) { pickerCategory = cat; renderPickerCategories(); filterPicker(); }

let _cachedSourceList = null;
let _cachedTargetList = null;
function getSourceListCached() { if (!_cachedSourceList) _cachedSourceList = getSourceList(); return _cachedSourceList; }
function getTargetListCached() {
  _cachedTargetList = getTargetList();
  macros.forEach((m, i) => {
    if (m.steps && m.steps.length > 0) {
      const label = m.name || (m.trigger ? `Macro ${i+1}: ${m.trigger}` : `Macro ${i+1}`);
      _cachedTargetList.push({ name: label, code: i, category: "Macros", type: "macro" });
    }
  });
  return _cachedTargetList;
}

function filterPicker() {
  const search = document.getElementById("picker-search").value.toLowerCase();
  const items = pickerMode === "source" ? getSourceListCached() : getTargetListCached();
  const filtered = items.filter(item => {
    if (pickerCategory !== "All" && item.category !== pickerCategory) return false;
    if (search && !item.name.toLowerCase().includes(search) && !String(item.code).includes(search)) return false;
    return true;
  });
  const list = document.getElementById("picker-list");
  list.innerHTML = filtered.map(item =>
    `<div class="picker-item" onclick="pickItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">${keyLabel(item.name)} <span class="item-code">${item.code}</span></div>`
  ).join("") + `<div style="border-top:1px solid var(--border-color);margin-top:8px;padding-top:8px">
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Custom ${pickerMode === "source" ? "evdev scancode" : "HID usage"}:</div>
    <div style="display:flex;gap:6px;align-items:center">
      <input id="custom-code-name" placeholder="Name" style="flex:1;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:13px;font-family:monospace">
      <input id="custom-code-val" placeholder="${pickerMode === "source" ? "e.g. 115 or 0x73" : "e.g. 0x00070073"}" style="width:160px;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:13px;font-family:monospace">
      <button class="btn btn-primary btn-sm" onclick="pickCustomCode()">Add</button>
    </div>
  </div>`;
}

function parseCode(str) {
  str = str.trim();
  if (str.startsWith("0x") || str.startsWith("0X")) return parseInt(str, 16);
  return parseInt(str, 10);
}

function pickCustomCode() {
  const name = document.getElementById("custom-code-name").value.trim();
  const rawVal = document.getElementById("custom-code-val").value.trim();
  if (!rawVal) { toast("Enter a code value", "error"); return; }
  let code = parseCode(rawVal);
  let type = "keyboard";
  if (pickerMode === "target" && rawVal.startsWith("0x") && rawVal.length >= 10) {
    const full = parseInt(rawVal, 16);
    const page = (full >> 16) & 0xFFFF;
    code = full & 0xFFFF;
    if (page === 0x000C) type = "consumer";
    else if (page === 0x0001) type = "system";
  } else if (pickerMode === "target") {
    type = code > 200 ? "consumer" : "keyboard";
  }
  if (isNaN(code)) { toast("Invalid code format", "error"); return; }
  const finalName = name || `CUSTOM_0x${code.toString(16).toUpperCase()}`;
  pickItem({ name: finalName, code, category: "Custom", type });
}

function pickItem(item) { if (pickerCallback) pickerCallback(item); closePicker(); }

// --- Quick Actions ---
function quickMap(sourceName, targetName, targetType) {
  const sourceList = getSourceListCached();
  const targetList = getTargetListCached();
  const src = sourceList.find(s => s.name === sourceName);
  const tgt = targetList.find(t => t.name === targetName);
  if (!src || !tgt) { toast("Usage not found", "error"); return; }
  const idx = mappings.findIndex(m => m.source.evdev_code === src.code);
  if (idx >= 0) {
    mappings[idx].target = { name: tgt.name, hid_usage: tgt.code, type: targetType };
    toast(`Updated: ${src.name} → ${tgt.name}`, "info");
  } else {
    mappings.push({ source: { name: src.name, evdev_code: src.code }, target: { name: tgt.name, hid_usage: tgt.code, type: targetType } });
    toast(`Added: ${src.name} → ${tgt.name}`, "success");
  }
  renderMappings();
}

// --- Macros ---
function renderMacros() {
  const list = document.getElementById("macro-list");
  if (!list) return;
  if (macros.length === 0) {
    list.innerHTML = '<div class="empty-mappings">No macros defined. Click "+ Add Macro" to create one.<br><br><span style="color:var(--text-muted);font-size:12px">To use: create a macro here, then in Mappings tab assign a key to it (appears in target picker under "Macros").</span></div>';
    return;
  }
  list.innerHTML = macros.map((m, i) => `
    <div class="mapping-row" style="flex-direction:column;align-items:stretch;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="row-num">${i + 1}</span>
        <input class="macro-name-input" value="${m.name || ''}" placeholder="Macro ${i+1}" oninput="macros[${i}].name=this.value;_cachedTargetList=null">
        <span style="color:var(--text-muted);font-size:13px">${m.steps.length} step(s)</span>
        <button class="mapping-delete" onclick="deleteMacro(${i})" title="Remove" style="margin-left:auto">&times;</button>
      </div>
      <div style="padding-left:36px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
        ${m.steps.map((s, si) => `<span class="macro-step-chip">
          <button class="macro-step-btn" onclick="openMacroPicker(${i},${si})">${keyLabel(s.key || '(set)')}</button>
          <input type="number" class="macro-delay-input" value="${s.delay || 50}" min="10" max="2000" onchange="macros[${i}].steps[${si}].delay=parseInt(this.value)" title="Delay (ms)">
          <span class="macro-step-remove" onclick="removeMacroStep(${i},${si})">&times;</span>
        </span>`).join('<span class="macro-step-arrow">→</span>')}
        <button class="macro-add-step" onclick="addMacroStep(${i})">+ step</button>
      </div>
    </div>
  `).join("");
}

function addMacro() {
  macros.push({ name: "", steps: [] });
  _cachedTargetList = null;
  renderMacros();
}

function deleteMacro(idx) {
  macros.splice(idx, 1);
  _cachedTargetList = null;
  renderMacros();
}

function openMacroPicker(macroIdx, stepIdx) {
  pickerMode = "target";
  pickerCategory = "All";
  document.getElementById("picker-title").textContent = "Select Macro Step Key";
  document.getElementById("picker-search").value = "";
  pickerCallback = (item) => {
    macros[macroIdx].steps[stepIdx].key = item.name;
    macros[macroIdx].steps[stepIdx].hid_usage = item.code;
    macros[macroIdx].steps[stepIdx].type = item.type || "keyboard";
    renderMacros();
  };
  renderPickerCategories();
  filterPicker();
  document.getElementById("picker-overlay").classList.add("open");
  document.getElementById("picker-search").focus();
}

function addMacroStep(macroIdx) {
  macros[macroIdx].steps.push({ key: "(set)", hid_usage: null, type: "keyboard", delay: 50 });
  _cachedTargetList = null;
  renderMacros();
  const stepIdx = macros[macroIdx].steps.length - 1;
  openMacroPicker(macroIdx, stepIdx);
}

function removeMacroStep(macroIdx, stepIdx) {
  macros[macroIdx].steps.splice(stepIdx, 1);
  _cachedTargetList = null;
  renderMacros();
}

// --- Monitor ---
let monitorRows = {};
let lastActiveRow = null;

function findMappedTarget(evdevName, evdevCode) {
  for (const m of mappings) {
    if (m.source.name === evdevName || m.source.evdev_code === evdevCode) return m.target.name;
  }
  return null;
}

function startMonitor() {
  if (monitorWs) return;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  monitorWs = new WebSocket(`${proto}//${location.host}/ws/monitor/${MAC}`);
  monitorWs.onopen = () => {
    monitorRunning = true;
    const s = document.getElementById("monitor-status");
    s.textContent = "Connected"; s.className = "monitor-status connected";
    monitorWs.send(JSON.stringify({ action: "start" }));
  };
  monitorWs.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (lastActiveRow) { lastActiveRow.classList.remove("monitor-active"); lastActiveRow = null; }
    if (data.mouse_move) {
      let row = document.getElementById("mon-mouse");
      if (!row) { row = document.createElement("tr"); row.id = "mon-mouse"; document.getElementById("monitor-body").appendChild(row); }
      row.innerHTML = `<td></td><td style="color:var(--text-muted)">REL</td><td>${keyLabel("MOUSE_MOVE")}</td><td>REL_XY</td><td style="color:var(--text-muted)">—</td><td style="color:#f0c040">${data.value}</td><td></td><td></td>`;
      row.classList.add("monitor-active"); lastActiveRow = row; return;
    }
    const key = data.unsupported ? "unsup_" + data.code : data.code;
    const mappedTo = findMappedTarget(data.name, data.code);
    if (!monitorRows[key]) {
      monitorRows[key] = { name: data.name, hidName: data.hid_name || "", last: data.value, min: data.value, max: data.value, unsupported: !!data.unsupported, mappedTo };
    } else {
      const r = monitorRows[key]; r.last = data.value; r.name = data.name; r.hidName = data.hid_name || ""; r.mappedTo = mappedTo;
      if (data.value < r.min) r.min = data.value;
      if (data.value > r.max) r.max = data.value;
    }
    let row = document.getElementById("mon-" + key);
    if (!row) { row = document.createElement("tr"); row.id = "mon-" + key; document.getElementById("monitor-body").appendChild(row); }
    const r = monitorRows[key];
    const valClass = r.last === 1 ? "val-press" : r.last === 0 ? "val-release" : "val-repeat";
    const unsupStyle = r.unsupported ? ' style="color:var(--danger)"' : '';
    const mappedStyle = r.mappedTo ? 'color:var(--success)' : 'color:var(--text-muted)';
    row.innerHTML = `<td><button class="btn btn-ghost btn-sm" onclick="monitorToMapping(${data.code},'${r.name}')" title="Add mapping">+</button></td><td${unsupStyle}>${data.code}</td><td${unsupStyle}>${keyLabel(r.name)}</td><td>${r.hidName ? keyLabel(r.hidName) : (r.unsupported ? '<span style="color:var(--danger)">unmapped</span>' : '')}</td><td style="${mappedStyle}">${r.mappedTo || '—'}</td><td class="${valClass}">${r.last}</td><td>${r.min}</td><td>${r.max}</td>`;
    row.classList.add("monitor-active"); lastActiveRow = row;
  };
  monitorWs.onclose = () => { monitorRunning = false; monitorWs = null; const s = document.getElementById("monitor-status"); s.textContent = "Disconnected"; s.className = "monitor-status disconnected"; };
  monitorWs.onerror = () => { toast("Monitor connection failed", "error"); stopMonitor(); };
}

function stopMonitor() {
  if (monitorWs) { try { monitorWs.send(JSON.stringify({ action: "stop" })); } catch {} monitorWs.close(); monitorWs = null; }
  monitorRunning = false;
  const s = document.getElementById("monitor-status"); s.textContent = "Disconnected"; s.className = "monitor-status disconnected";
}

function clearMonitor() { document.getElementById("monitor-body").innerHTML = ""; monitorRows = {}; }

function monitorToMapping(code, name) {
  if (mappings.some(m => m.source.evdev_code === code)) { toast(`${name} already mapped`, "info"); switchToTab("mappings"); return; }
  mappings.push({ source: { name, evdev_code: code }, target: { name: "(click to set)", hid_usage: null, type: "keyboard" } });
  renderMappings(); switchToTab("mappings");
  toast(`Added ${name} — set the target`, "success");
}

// --- Import/Export ---
function exportMappings() {
  const data = { device_name: document.getElementById("device-name").textContent, mac: MAC.replace(/-/g, ":"), mappings, macros, exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `mapping-${MAC}.json`; a.click();
  toast("Config exported", "success");
}

function importMappings(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.mappings) { mappings = data.mappings; macros = data.macros || []; renderMappings(); renderMacros(); toast(`Imported ${mappings.length} mappings`, "success"); }
      else toast("Invalid file", "error");
    } catch { toast("Failed to parse", "error"); }
  };
  reader.readAsText(file); event.target.value = "";
}

async function restartService() {
  if (!confirm("Restart the relay service?")) return;
  try { const r = await api("/service/restart", "POST"); toast(r.success ? "Restarting..." : "Failed", r.success ? "success" : "error"); }
  catch { toast("Failed", "error"); }
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePicker(); });
document.addEventListener("DOMContentLoaded", loadDevice);
