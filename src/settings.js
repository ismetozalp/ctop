// Persistent settings store (localStorage) with change notifications.
// Browser-only module; not imported by the node --test pure suite.
const KEY = "ctop.settings";
const DEFAULTS = {
  interval: 2000,      // ms between samples
  paused: false,
  theme: "Default",    // "Default" or a btop theme name
  tempScale: "C",      // "C" | "F"
  netBits: false,      // false = bytes/s, true = bits/s
  showLoops: false,    // show loopN devices (snap images etc.) in the mem box disk I/O list
  notify: false,       // browser notifications on threshold breach
  fileBrowser: "files", // "files" (Cockpit Files) or "explorer"
  updateRepo: "ismetozalp/ctop", // GitHub owner/repo checked for self-update
  updateCheckOnStart: true,      // auto-check for a newer release at startup
  thresholds: { cpu: 90, mem: 90, temp: 90 },
  boxes: { gpu: true, mem: true, net: true, bat: true, proc: true, containers: true, sensors: true, history: false },
};

function load() {
  try {
    const saved = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "{}");
    return {
      ...DEFAULTS, ...saved,
      thresholds: { ...DEFAULTS.thresholds, ...(saved.thresholds || {}) },
      boxes: { ...DEFAULTS.boxes, ...(saved.boxes || {}) },
    };
  } catch { return JSON.parse(JSON.stringify(DEFAULTS)); }
}

const state = load();
const listeners = new Set();

function save() { try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
function emit(key) { listeners.forEach((fn) => fn(key, state)); }

export const settings = {
  get(k) { return state[k]; },
  all() { return state; },
  set(k, v) { state[k] = v; save(); emit(k); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
