const MAC = window.location.pathname.split("/").pop();
let mappings = [];
let macros = [];

const KEY_ICONS = {
  // Power & System
  "KEY_POWER": "⏻", "POWER": "⏻", "SYSTEM_POWER_DOWN": "⏻",
  "KEY_SLEEP": "💤", "SLEEP": "💤", "SYSTEM_SLEEP": "💤",
  "KEY_WAKEUP": "☀", "SYSTEM_WAKE_UP": "☀",
  "KEY_RESTART": "🔄",
  // Volume & Mute
  "KEY_MUTE": "🔇", "MUTE": "🔇",
  "KEY_VOLUMEUP": "🔊", "VOLUME_UP": "🔊",
  "KEY_VOLUMEDOWN": "🔉", "VOLUME_DOWN": "🔉",
  // Media Transport
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
  "KEY_FRAMEFORWARD": "⏭1", "FRAME_FORWARD": "⏭1",
  "KEY_FRAMEBACK": "⏮1", "FRAME_BACK": "⏮1",
  // Navigation & Android TV
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
  "PROFILE_SWITCH": "👤", "LOCK_SCREEN": "🔒",
  "LANGUAGE_SWITCH": "🌐", "SCREENSAVER": "🖼",
  "FULLSCREEN": "⛶", "KEY_FULL_SCREEN": "⛶",
  "GUIDE": "📺", "INPUT_SELECT": "⎆",
  // Standard Keys
  "KEY_ENTER": "⏎", "ENTER": "⏎",
  "KEY_ESC": "⎋", "ESCAPE": "⎋",
  "KEY_BACKSPACE": "⌫", "BACKSPACE": "⌫",
  "KEY_TAB": "⇥", "TAB": "⇥",
  "KEY_SPACE": "␣", "SPACEBAR": "␣",
  "KEY_DELETE": "⌦", "DELETE": "⌦",
  "KEY_UP": "⬆", "UP_ARROW": "⬆",
  "KEY_DOWN": "⬇", "DOWN_ARROW": "⬇",
  "KEY_LEFT": "⬅", "LEFT_ARROW": "⬅",
  "KEY_RIGHT": "➡", "RIGHT_ARROW": "➡",
  "KEY_PAGEUP": "⇞", "PAGE_UP": "⇞",
  "KEY_PAGEDOWN": "⇟", "PAGE_DOWN": "⇟",
  "KEY_HOME": "⤒",
  "KEY_END": "⤓", "END": "⤓",
  "KEY_INSERT": "⎀", "INSERT": "⎀",
  "KEY_CAPSLOCK": "⇪", "CAPS_LOCK": "⇪",
  // Modifiers
  "KEY_LEFTSHIFT": "⇧", "KEY_RIGHTSHIFT": "⇧",
  "LEFT_SHIFT": "⇧", "RIGHT_SHIFT": "⇧",
  "KEY_LEFTCTRL": "⌃", "KEY_RIGHTCTRL": "⌃",
  "LEFT_CONTROL": "⌃", "RIGHT_CONTROL": "⌃",
  "KEY_LEFTALT": "⌥", "KEY_RIGHTALT": "⌥",
  "LEFT_ALT": "⌥", "RIGHT_ALT": "⌥",
  "KEY_LEFTMETA": "❖", "KEY_RIGHTMETA": "❖",
  "LEFT_GUI": "❖", "RIGHT_GUI": "❖",
  // Channels
  "KEY_CHANNELUP": "📺⬆", "CHANNEL_UP": "📺⬆",
  "KEY_CHANNELDOWN": "📺⬇", "CHANNEL_DOWN": "📺⬇",
  "KEY_LAST": "📺↩", "LAST_CHANNEL": "📺↩",
  // Color Buttons
  "KEY_RED": "🔴", "RED": "🔴",
  "KEY_GREEN": "🟢", "GREEN": "🟢",
  "KEY_BLUE": "🔵", "BLUE": "🔵",
  "KEY_YELLOW": "🟡", "YELLOW": "🟡",
  // Info & Captions
  "KEY_INFO": "ℹ", "INFO": "ℹ",
  "KEY_SUBTITLE": "💬", "CAPTIONS": "💬",
  "KEY_ASPECTRATIO": "⊟", "ASPECT_RATIO": "⊟",
  "KEY_AUDIO": "🎵", "AUDIO_TRACK": "🎵",
  // Apps & Browser
  "KEY_WWW": "🌐", "BROWSER": "🌐",
  "KEY_MAIL": "✉", "MAIL": "✉",
  "KEY_CALC": "🔢", "CALCULATOR": "🔢",
  "KEY_CAMERA": "📷", "SNAPSHOT": "📷",
  "KEY_BRIGHTNESSUP": "🔆", "BRIGHTNESS_UP": "🔆",
  "KEY_BRIGHTNESSDOWN": "🔅", "BRIGHTNESS_DOWN": "🔅",
  "KEY_HELP": "❓", "HELP": "❓",
  "KEY_COFFEE": "☕", "KEY_BOOKMARKS": "🔖", "BOOKMARKS": "🔖",
  "KEY_FILE": "📁", "KEY_CALENDAR": "📅", "KEY_CHAT": "💬",
  "ZOOM_IN": "🔎+", "ZOOM_OUT": "🔎−",
  "KEY_ZOOMIN": "🔎+", "KEY_ZOOMOUT": "🔎−",
  "REFRESH": "🔄", "KEY_REFRESH": "🔄",
  "KEY_DICTATE": "📝", "DICTATE": "📝",
  "KEY_EMOJI_PICKER": "😀", "EMOJI_PICKER": "😀",
  "KEY_GAMES": "🎮", "GAMES": "🎮",
  "KEY_DVR": "📹", "DVR": "📹",
  "APPLICATION": "▤",
  // Mouse
  "BTN_LEFT": "🖱L", "BTN_RIGHT": "🖱R", "BTN_MIDDLE": "🖱M",
  "BUTTON_1": "🖱1", "BUTTON_2": "🖱2", "BUTTON_3": "🖱3",
  "MOUSE_MOVE": "🖱↔",
  // Misc
  "KEY_SYSRQ": "⎙", "PRINT_SCREEN": "⎙",
  "KEY_SCROLLLOCK": "⇳", "SCROLL_LOCK": "⇳",
  "KEY_TV": "📺", "TV": "📺", "KEY_DVD": "💿", "DVD": "💿"
};

function keyIcon(name) {
  return KEY_ICONS[name] || "";
}

function keyLabel(name) {
  const icon = keyIcon(name);
  return icon ? icon + " " + name : name;
}
let pickerCallback = null;
let pickerMode = "source";
let pickerCategory = "All";
let monitorWs = null;
let monitorRunning = false;
let autoScroll = true;

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

// --- Load Device Info ---
async function loadDevice() {
  try {
    const data = await api("/mapping/" + MAC);
    document.getElementById("device-name").textContent = data.device_name || MAC;
    document.getElementById("device-mac").textContent = MAC.replace(/-/g, ":");
    mappings = data.mappings || [];
    macros = data.macros || [];
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
    list.innerHTML = '<div class="empty-mappings">No custom mappings. Using default mapping. Click "+ Add Mapping" or use Quick Actions.</div>';
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

  // Drag-and-drop handlers
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
      if (e.clientY < midY) {
        row.classList.add("drag-over");
      } else {
        row.classList.add("drag-over-below");
      }
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over", "drag-over-below");
    });
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

function deleteMapping(idx) {
  mappings.splice(idx, 1);
  renderMappings();
}

async function saveMappings() {
  const valid = mappings.filter(m => m.source.evdev_code !== null && m.target.hid_usage !== null);
  if (valid.length !== mappings.length) {
    toast("Some mappings are incomplete — save only valid ones?", "info");
  }
  try {
    const data = {
      device_name: document.getElementById("device-name").textContent,
      mac: MAC.replace(/-/g, ":"),
      mappings: valid,
      macros: macros
    };
    const r = await api("/mapping/" + MAC, "POST", data);
    if (r.success) {
      mappings = valid;
      renderMappings();
      toast("Mappings saved!", "success");
    } else {
      toast("Save failed: " + (r.message || ""), "error");
    }
  } catch { toast("Save failed", "error"); }
}

async function resetMappings() {
  if (!confirm("Reset to default mappings? This will delete your custom config for this device.")) return;
  try {
    const r = await api("/mapping/" + MAC, "DELETE");
    if (r.success) {
      mappings = [];
      renderMappings();
      toast("Reset to defaults", "success");
    }
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

function setPickerCat(cat) {
  pickerCategory = cat;
  renderPickerCategories();
  filterPicker();
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
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${pickerMode === "source" ? "Decimal (115) or hex (0x73) evdev code" : "HID: decimal (115), hex (0x73), or full page+usage (0x00070073)"}</div>
  </div>`;
}

function parseCode(str) {
  str = str.trim();
  if (str.startsWith("0x") || str.startsWith("0X")) {
    return parseInt(str, 16);
  }
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
    else type = "keyboard";
  } else if (pickerMode === "target") {
    type = code > 200 ? "consumer" : "keyboard";
  }

  if (isNaN(code)) { toast("Invalid code format", "error"); return; }
  const finalName = name || `CUSTOM_0x${code.toString(16).toUpperCase()}`;
  pickItem({ name: finalName, code, category: "Custom", type });
}

function pickItem(item) {
  if (pickerCallback) pickerCallback(item);
  closePicker();
}

// --- Quick Actions ---
function quickMap(sourceName, targetName, targetType) {
  const sourceList = getSourceListCached();
  const targetList = getTargetListCached();
  const src = sourceList.find(s => s.name === sourceName);
  const tgt = targetList.find(t => t.name === targetName);
  if (!src || !tgt) { toast("Usage not found", "error"); return; }

  const exists = mappings.some(m => m.source.evdev_code === src.code);
  if (exists) {
    const idx = mappings.findIndex(m => m.source.evdev_code === src.code);
    mappings[idx].target = { name: tgt.name, hid_usage: tgt.code, type: targetType };
    toast(`Updated: ${src.name} → ${tgt.name}`, "info");
  } else {
    mappings.push({
      source: { name: src.name, evdev_code: src.code },
      target: { name: tgt.name, hid_usage: tgt.code, type: targetType }
    });
    toast(`Added: ${src.name} → ${tgt.name}`, "success");
  }
  renderMappings();
}

// --- Macros ---
function renderMacros() {
  const list = document.getElementById("macro-list");
  if (!list) return;
  if (macros.length === 0) {
    list.innerHTML = '<div class="empty-mappings">No macros defined. Click "+ Add Macro" to create one.</div>';
    return;
  }
  list.innerHTML = macros.map((m, i) => `
    <div class="mapping-row" style="flex-direction:column;align-items:stretch;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="row-num">${i + 1}</span>
        <button class="mapping-btn source" onclick="openMacroPicker('trigger', ${i})" style="flex:0 0 auto;max-width:200px">${m.trigger ? keyLabel(m.trigger) : '(set trigger key)'}</button>
        <span class="mapping-arrow">&rarr;</span>
        <span style="color:var(--text-muted);font-size:13px">${m.steps.length} step(s)</span>
        <button class="mapping-delete" onclick="deleteMacro(${i})" title="Remove" style="margin-left:auto">&times;</button>
      </div>
      <div style="padding-left:36px;display:flex;flex-wrap:wrap;gap:4px">
        ${m.steps.map((s, si) => `<span style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;padding:3px 8px;font-size:12px;font-family:monospace;color:var(--text-primary);display:inline-flex;align-items:center;gap:4px">
          ${keyLabel(s.key)}${s.delay ? ' <span style="color:var(--text-muted)">+' + s.delay + 'ms</span>' : ''}
          <span style="cursor:pointer;color:var(--danger);margin-left:2px" onclick="removeMacroStep(${i},${si})">&times;</span>
        </span>`).join("")}
        <button style="background:none;border:1px dashed var(--border-color);border-radius:4px;padding:3px 8px;font-size:12px;color:var(--text-muted);cursor:pointer" onclick="addMacroStep(${i})">+ step</button>
      </div>
    </div>
  `).join("");
}

function addMacro() {
  macros.push({ trigger: null, trigger_code: null, steps: [] });
  renderMacros();
}

function deleteMacro(idx) {
  macros.splice(idx, 1);
  renderMacros();
}

function openMacroPicker(type, macroIdx, stepIdx) {
  if (type === "trigger") {
    pickerMode = "source";
    pickerCallback = (item) => {
      macros[macroIdx].trigger = item.name;
      macros[macroIdx].trigger_code = item.code;
      renderMacros();
    };
  } else {
    pickerMode = "target";
    pickerCallback = (item) => {
      macros[macroIdx].steps[stepIdx].key = item.name;
      macros[macroIdx].steps[stepIdx].hid_usage = item.code;
      macros[macroIdx].steps[stepIdx].type = item.type || "keyboard";
      renderMacros();
    };
  }
  pickerCategory = "All";
  document.getElementById("picker-title").textContent = type === "trigger" ? "Select Trigger Key" : "Select Macro Step Key";
  document.getElementById("picker-search").value = "";
  renderPickerCategories();
  filterPicker();
  document.getElementById("picker-overlay").classList.add("open");
  document.getElementById("picker-search").focus();
}

function addMacroStep(macroIdx) {
  const step = { key: "(set key)", hid_usage: null, type: "keyboard", delay: 50 };
  macros[macroIdx].steps.push(step);
  renderMacros();
  const stepIdx = macros[macroIdx].steps.length - 1;
  openMacroPicker("step", macroIdx, stepIdx);
}

function removeMacroStep(macroIdx, stepIdx) {
  macros[macroIdx].steps.splice(stepIdx, 1);
  renderMacros();
}

// --- Monitor (matches hid-remapper original behavior) ---
function findMappedTarget(evdevName, evdevCode) {
  for (const m of mappings) {
    if (m.source.name === evdevName || m.source.evdev_code === evdevCode) {
      return m.target.name;
    }
  }
  return null;
}

let monitorRows = {};
let lastActiveRow = null;

// Cached usage lists (rebuilt only when needed)
let _cachedSourceList = null;
let _cachedTargetList = null;

function getSourceListCached() {
  if (!_cachedSourceList) _cachedSourceList = getSourceList();
  return _cachedSourceList;
}
function getTargetListCached() {
  _cachedTargetList = getTargetList();
  // Add defined macros as targets
  macros.forEach((m, i) => {
    if (m.steps && m.steps.length > 0) {
      const label = m.trigger ? `Macro ${i+1}: ${m.trigger}` : `Macro ${i+1}`;
      _cachedTargetList.push({ name: label, code: i, category: "Macros", type: "macro" });
    }
  });
  return _cachedTargetList;
}

function startMonitor() {
  if (monitorWs) return;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/ws/monitor/${MAC}`;
  monitorWs = new WebSocket(url);

  monitorWs.onopen = () => {
    monitorRunning = true;
    const status = document.getElementById("monitor-status");
    status.textContent = "Connected";
    status.className = "monitor-status connected";
    monitorWs.send(JSON.stringify({ action: "start" }));
  };

  monitorWs.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (lastActiveRow) { lastActiveRow.classList.remove("monitor-active"); lastActiveRow = null; }

    if (data.mouse_move) {
      let row = document.getElementById("mon-mouse");
      if (!row) {
        row = document.createElement("tr");
        row.id = "mon-mouse";
        document.getElementById("monitor-body").appendChild(row);
      }
      row.innerHTML = `<td></td><td style="color:var(--text-muted)">REL</td><td>${keyLabel("MOUSE_MOVE")}</td><td>REL_XY</td><td style="color:var(--text-muted)">—</td><td style="color:#f0c040">${data.value}</td><td></td><td></td>`;
      row.classList.add("monitor-active");
      lastActiveRow = row;
      return;
    }

    const key = data.unsupported ? "unsup_" + data.code : data.code;
    const hidName = data.hid_name || "";
    const mappedTo = findMappedTarget(data.name, data.code);

    if (!monitorRows[key]) {
      monitorRows[key] = { name: data.name, hidName: hidName, last: data.value, min: data.value, max: data.value, unsupported: !!data.unsupported, mappedTo: mappedTo };
    } else {
      monitorRows[key].last = data.value;
      monitorRows[key].name = data.name;
      monitorRows[key].hidName = hidName;
      monitorRows[key].mappedTo = mappedTo;
      if (data.value < monitorRows[key].min) monitorRows[key].min = data.value;
      if (data.value > monitorRows[key].max) monitorRows[key].max = data.value;
    }

    let row = document.getElementById("mon-" + key);
    if (!row) {
      row = document.createElement("tr");
      row.id = "mon-" + key;
      document.getElementById("monitor-body").appendChild(row);
    }

    const r = monitorRows[key];
    const valClass = r.last === 1 ? "val-press" : r.last === 0 ? "val-release" : "val-repeat";
    const unsupStyle = r.unsupported ? ' style="color:var(--danger)"' : '';
    const mappedStyle = r.mappedTo ? 'color:var(--success)' : 'color:var(--text-muted)';
    const mappedLabel = r.mappedTo ? keyLabel(r.mappedTo) : '—';
    row.innerHTML = `<td><button class="btn btn-ghost btn-sm" onclick="monitorToMapping(${data.code}, '${r.name}')" title="Add mapping for this key">+</button></td><td${unsupStyle}>${data.code}</td><td${unsupStyle}>${keyLabel(r.name)}</td><td>${r.hidName ? keyLabel(r.hidName) : (r.unsupported ? '<span style="color:var(--danger)">unmapped</span>' : '')}</td><td style="${mappedStyle}">${mappedLabel}</td><td class="${valClass}">${r.last}</td><td>${r.min}</td><td>${r.max}</td>`;
    row.classList.add("monitor-active");
    lastActiveRow = row;
  };

  monitorWs.onclose = () => {
    monitorRunning = false;
    monitorWs = null;
    const status = document.getElementById("monitor-status");
    status.textContent = "Disconnected";
    status.className = "monitor-status disconnected";
  };

  monitorWs.onerror = () => {
    toast("Monitor connection failed", "error");
    stopMonitor();
  };
}

function stopMonitor() {
  if (monitorWs) {
    try { monitorWs.send(JSON.stringify({ action: "stop" })); } catch {}
    monitorWs.close();
    monitorWs = null;
  }
  monitorRunning = false;
  const status = document.getElementById("monitor-status");
  status.textContent = "Disconnected";
  status.className = "monitor-status disconnected";
}

function clearMonitor() {
  document.getElementById("monitor-body").innerHTML = "";
  monitorRows = {};
}

function monitorToMapping(code, name) {
  const exists = mappings.some(m => m.source.evdev_code === code);
  if (exists) {
    toast(`${name} is already mapped`, "info");
    switchToTab("mappings");
    return;
  }
  mappings.push({
    source: { name: name, evdev_code: code },
    target: { name: "(click to set)", hid_usage: null, type: "keyboard" }
  });
  renderMappings();
  switchToTab("mappings");
  toast(`Added ${name} — click the target to set it`, "success");
  setTimeout(() => {
    const rows = document.querySelectorAll(".mapping-row");
    const last = rows[rows.length - 1];
    if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}


// --- Import / Export ---
function exportMappings() {
  const data = {
    device_name: document.getElementById("device-name").textContent,
    mac: MAC.replace(/-/g, ":"),
    mappings: mappings,
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mapping-${MAC}.json`;
  a.click();
  toast("Config exported", "success");
}

function importMappings(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.mappings && Array.isArray(data.mappings)) {
        mappings = data.mappings;
        renderMappings();
        toast(`Imported ${mappings.length} mappings (not saved yet)`, "success");
      } else {
        toast("Invalid mapping file", "error");
      }
    } catch { toast("Failed to parse file", "error"); }
  };
  reader.readAsText(file);
  event.target.value = "";
}

async function restartService() {
  if (!confirm("Restart the Bluetooth-to-USB relay service?")) return;
  try {
    const r = await api("/service/restart", "POST");
    toast(r.success ? "Service restarting..." : "Restart failed", r.success ? "success" : "error");
  } catch { toast("Restart request failed", "error"); }
}

// --- Keyboard shortcut ---
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePicker();
  }
});

// --- Init ---
document.addEventListener("DOMContentLoaded", loadDevice);
