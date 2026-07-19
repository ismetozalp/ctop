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
  constructor(root, { onkill } = {}) {
    this.root = root; this.onkill = onkill; this.sortKey = "cpu"; this.reversed = false;
    this._list = []; this._selected = null; this.filter = ""; this.tree = false; this._collapsed = new Set();
  }
  mount() {
    this.root.innerHTML = `
      <div class="box proc-box">
        <div class="box-title">proc</div>
        <div class="proc-toolbar">
          <input class="proc-filter" placeholder="filter…">
          <button class="proc-tree-toggle">tree</button>
        </div>
        <div class="proc-scroll"><table class="proc-table"><thead><tr></tr></thead><tbody></tbody></table></div>
        <div class="proc-popup hidden"></div>
      </div>`;
    this.root.querySelector(".proc-filter").addEventListener("input", (e) => {
      this.filter = e.target.value.toLowerCase();
      this._render();
    });
    this.root.querySelector(".proc-tree-toggle").addEventListener("click", () => {
      this.tree = !this.tree;
      this.root.querySelector(".proc-tree-toggle").classList.toggle("active", this.tree);
      this._render();
    });
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
  _filtered() {
    if (!this.filter) return this._list;
    const f = this.filter;
    return this._list.filter((p) =>
      String(p.program).toLowerCase().includes(f) ||
      String(p.user).toLowerCase().includes(f) ||
      String(p.command || "").toLowerCase().includes(f)
    );
  }
  _renderRow(p, depth, hasChildren) {
    const tr = document.createElement("tr");
    const cpuColor = theme.gradients.process[Math.min(100, Math.round(p.cpu))];
    const td0 = document.createElement("td"); td0.textContent = String(p.pid);
    const td1 = document.createElement("td"); td1.className = "prog";
    if (this.tree) {
      const indent = document.createElement("span");
      indent.style.paddingLeft = `${depth * 2}ch`;
      const caret = document.createElement("span");
      caret.className = "tree-caret";
      if (hasChildren) {
        caret.textContent = this._collapsed.has(p.pid) ? "▸" : "▾";
        caret.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._collapsed.has(p.pid)) this._collapsed.delete(p.pid);
          else this._collapsed.add(p.pid);
          this._render();
        });
      } else {
        caret.textContent = "";
      }
      td1.appendChild(indent);
      td1.appendChild(caret);
      const label = document.createElement("span");
      label.textContent = p.program;
      td1.appendChild(label);
    } else {
      td1.textContent = p.program;
    }
    const td2 = document.createElement("td"); td2.textContent = String(p.threads);
    const td3 = document.createElement("td"); td3.textContent = p.user;
    const td4 = document.createElement("td"); td4.textContent = humanize(p.rss);
    const td5 = document.createElement("td"); td5.style.color = cpuColor; td5.textContent = p.cpu.toFixed(1);
    tr.append(td0, td1, td2, td3, td4, td5);
    tr.addEventListener("click", () => this._openDetail(p));
    this.tbody.appendChild(tr);
  }
  _render() {
    const list = this._filtered();
    this.tbody.innerHTML = "";
    if (!this.tree) {
      const sorted = sortProcs(list, this.sortKey, this.reversed);
      for (const p of sorted.slice(0, 200)) this._renderRow(p, 0, false);
      return;
    }
    // tree mode
    const pidSet = new Set(list.map((p) => p.pid));
    const childrenMap = new Map();
    for (const p of list) {
      const key = p.ppid;
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key).push(p);
    }
    const roots = list.filter((p) => !p.ppid || !pidSet.has(p.ppid));
    const sortSiblings = (arr) => sortProcs(arr, this.sortKey, this.reversed);
    let count = 0;
    const walk = (p, depth) => {
      if (count >= 200) return;
      const kids = childrenMap.get(p.pid) || [];
      this._renderRow(p, depth, kids.length > 0);
      count++;
      if (kids.length && !this._collapsed.has(p.pid)) {
        for (const child of sortSiblings(kids)) walk(child, depth + 1);
      }
    };
    for (const root of sortSiblings(roots)) walk(root, 0);
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
