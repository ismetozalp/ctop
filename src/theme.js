import { buildGradient } from "./gradient.js";

// btop "Default" theme — base colors + gradient stop triples (start, mid, end).
const DEFAULT_COLORS = {
  main_bg: "#000000", main_fg: "#cccccc", title: "#eeeeee", hi_fg: "#b54040",
  selected_bg: "#6a2f2f", meter_bg: "#404040", div_line: "#303030", graph_text: "#606060",
  cpu_box: "#556d59", mem_box: "#6c6c4b", net_box: "#5c588d", proc_box: "#805252",
  proc_misc: "#0de756", inactive_fg: "#404040",
};
const DEFAULT_STOPS = {
  cpu:       ["#77ca9b", "#cbc06c", "#dc4c4c"],
  temp:      ["#4897d4", "#5474e8", "#ff40b6"],
  used:      ["#592b26", "#d9626d", "#ff4769"],
  cached:    ["#163350", "#74e6fc", "#26c5ff"],
  available: ["#4e3f0e", "#ffd77a", "#ffb814"],
  free:      ["#384f21", "#b5e685", "#dcff85"],
  download:  ["#291f75", "#4f43a3", "#b0a9de"],
  upload:    ["#620665", "#7d4180", "#dcafde"],
  process:   ["#80d0a3", "#dcd179", "#d45454"],
};
const GRAD_NAMES = Object.keys(DEFAULT_STOPS);

// Stable objects: gradient arrays and the colors map are MUTATED in place on
// theme change, so any box that cached `theme.gradients.cpu` sees new colors
// automatically without being re-instantiated.
const gradients = {};
for (const n of GRAD_NAMES) gradients[n] = new Array(101).fill("#000000");
const colors = { ...DEFAULT_COLORS };
const listeners = new Set();

function applyCssVars() {
  if (typeof document === "undefined") return;
  const r = document.documentElement.style;
  r.setProperty("--th-bg", colors.main_bg);
  r.setProperty("--th-fg", colors.main_fg);
  r.setProperty("--th-title", colors.title);
  r.setProperty("--th-cpu-box", colors.cpu_box);
  r.setProperty("--th-mem-box", colors.mem_box);
  r.setProperty("--th-net-box", colors.net_box);
  r.setProperty("--th-proc-box", colors.proc_box);
  r.setProperty("--th-meter-bg", colors.meter_bg);
  r.setProperty("--th-dim", colors.graph_text);
}

function rebuild(colorSet, stopSet) {
  Object.keys(colors).forEach((k) => delete colors[k]);
  Object.assign(colors, DEFAULT_COLORS, colorSet);
  for (const n of GRAD_NAMES) {
    const s = stopSet[n] || DEFAULT_STOPS[n];
    const ng = buildGradient(s[0] || DEFAULT_STOPS[n][0], s[1] || null, s[2] || null);
    for (let i = 0; i <= 100; i++) gradients[n][i] = ng[i];
  }
  applyCssVars();
  listeners.forEach((fn) => fn());
}

// Parse a btop theme file: lines like  theme[cpu_start]="#77ca9b"
function parseBtop(text) {
  const colorSet = {}; const stopSet = {};
  const re = /theme\[([a-z0-9_]+)\]\s*=\s*"?(#[0-9a-fA-F]{2,8})"?/g;
  let m;
  while ((m = re.exec(text))) {
    const key = m[1], hex = m[2];
    const sm = key.match(/^(.+)_(start|mid|end)$/);
    if (sm && GRAD_NAMES.includes(sm[1])) {
      (stopSet[sm[1]] = stopSet[sm[1]] || [null, null, null])[{ start: 0, mid: 1, end: 2 }[sm[2]]] = hex;
    } else {
      colorSet[key] = hex;
    }
  }
  return { colors: colorSet, stops: stopSet };
}

export const theme = {
  colors, gradients,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  applyDefault() { rebuild({}, {}); },
  loadThemeText(text) { const p = parseBtop(text); rebuild(p.colors, p.stops); },
  applyCockpitDarkClass() {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("pf-v6-theme-dark") ? "dark" : "light";
  },
};

// Initialize gradients to the Default theme at import time.
rebuild({}, {});
