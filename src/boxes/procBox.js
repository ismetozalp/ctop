// src/boxes/procBox.js
import { sortProcs } from "../sort.js";
import { humanize } from "../humanize.js";
import { theme } from "../theme.js";

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

const COLS = [
  { key: "pid", label: "Pid" }, { key: "program", label: "Program" },
  { key: "threads", label: "Thr" }, { key: "user", label: "User" },
  { key: "memory", label: "Mem" }, { key: "cpu", label: "Cpu%" },
];

export class ProcBox {
  constructor(root, { onkill } = {}) { this.root = root; this.onkill = onkill; this.sortKey = "cpu"; this.reversed = false; this._list = []; this._selected = null; }
  mount() {
    this.root.innerHTML = `
      <div class="box proc-box">
        <div class="box-title">proc</div>
        <table class="proc-table"><thead><tr></tr></thead><tbody></tbody></table>
        <div class="proc-popup hidden"></div>
      </div>`;
    const tr = this.root.querySelector("thead tr");
    for (const col of COLS) {
      const th = document.createElement("th"); th.textContent = col.label; th.dataset.key = col.key;
      th.addEventListener("click", () => {
        if (this.sortKey === col.key) this.reversed = !this.reversed;
        else { this.sortKey = col.key; this.reversed = false; }
        this._render();
      });
      tr.appendChild(th);
    }
    this.tbody = this.root.querySelector("tbody");
    this.popup = this.root.querySelector(".proc-popup");
  }
  update(list) { this._list = list; this._render(); }
  _render() {
    const sorted = sortProcs(this._list, this.sortKey, this.reversed);
    this.tbody.innerHTML = "";
    for (const p of sorted.slice(0, 200)) {
      const tr = document.createElement("tr");
      const cpuColor = theme.gradients.process[Math.min(100, Math.round(p.cpu))];
      tr.innerHTML = `<td>${p.pid}</td><td class="prog">${esc(p.program)}</td><td>${p.threads}</td>
        <td>${esc(p.user)}</td><td>${humanize(p.rss)}</td><td style="color:${cpuColor}">${p.cpu.toFixed(1)}</td>`;
      tr.addEventListener("click", () => this._openDetail(p));
      this.tbody.appendChild(tr);
    }
  }
  _openDetail(p) {
    this._selected = p;
    this.popup.classList.remove("hidden");
    this.popup.innerHTML = `
      <div class="popup-head">${esc(p.program)} <span class="popup-pid">pid ${p.pid}</span>
        <button class="popup-close">✕</button></div>
      <div class="popup-body">
        <div>User: ${esc(p.user)}</div><div>Parent: ${p.ppid}</div>
        <div>Threads: ${p.threads}</div><div>Memory: ${humanize(p.rss)}</div>
        <div>Cpu: ${p.cpu.toFixed(1)}%</div>
        <div class="popup-cmd">${esc(p.command || p.program)}</div>
      </div>
      <div class="popup-actions">
        <button data-sig="TERM">TERM (15)</button>
        <button data-sig="KILL">KILL (9)</button>
        <button data-sig="HUP">HUP (1)</button>
      </div>
      <div class="popup-msg"></div>`;
    this.popup.querySelector(".popup-close").addEventListener("click", () => this.popup.classList.add("hidden"));
    this.popup.querySelectorAll(".popup-actions button").forEach((b) => {
      b.addEventListener("click", () => {
        this.onkill(p.pid, b.dataset.sig)
          .then(() => { this.popup.querySelector(".popup-msg").textContent = `Sent SIG${b.dataset.sig}`; })
          .catch((e) => { this.popup.querySelector(".popup-msg").textContent = "Failed: " + (e.message || e.problem || "denied"); });
      });
    });
  }
}
