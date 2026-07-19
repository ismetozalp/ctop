import { buildGradient } from "./gradient.js";

const colors = {
  main_bg: "#000000", main_fg: "#cccccc", title: "#eeeeee", hi_fg: "#b54040",
  selected_bg: "#6a2f2f", meter_bg: "#404040", div_line: "#303030", graph_text: "#606060",
  cpu_box: "#556d59", mem_box: "#6c6c4b", net_box: "#5c588d", proc_box: "#805252",
  proc_misc: "#0de756", inactive_fg: "#404040",
};
const g = {
  cpu:       buildGradient("#77ca9b", "#cbc06c", "#dc4c4c"),
  temp:      buildGradient("#4897d4", "#5474e8", "#ff40b6"),
  used:      buildGradient("#592b26", "#d9626d", "#ff4769"),
  cached:    buildGradient("#163350", "#74e6fc", "#26c5ff"),
  available: buildGradient("#4e3f0e", "#ffd77a", "#ffb814"),
  free:      buildGradient("#384f21", "#b5e685", "#dcff85"),
  download:  buildGradient("#291f75", "#4f43a3", "#b0a9de"),
  upload:    buildGradient("#620665", "#7d4180", "#dcafde"),
  process:   buildGradient("#80d0a3", "#dcd179", "#d45454"),
};
export const theme = {
  colors, gradients: g,
  applyCockpitDarkClass() {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("pf-v6-theme-dark") ? "dark" : "light";
  },
};
