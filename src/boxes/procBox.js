// src/boxes/procBox.js
import { sortProcs } from "../sort.js";
import { humanize } from "../humanize.js";
import { theme } from "../theme.js";
import { BrailleGraph } from "../graph.js";
import { RingBuffer } from "../ringbuffer.js";

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

const COLS = [
  { key: "pid", label: "Pid" }, { key: "program", label: "Program" },
  { key: "threads", label: "Thr" }, { key: "user", label: "User" },
  { key: "memory", label: "Mem" }, { key: "cpu", label: "Cpu%" },
];

export class ProcBox {
  constructor(root, { onkill, onrenice, unitOf, cwdOf } = {}) {
    this.root = root; this.onkill = onkill; this.onrenice = onrenice; this.unitOf = unitOf; this.cwdOf = cwdOf;
    this.sortKey = "cpu"; this.reversed = false;
    this._list = []; this._selected = null; this.filter = ""; this.tree = false; this._collapsed = new Set();
    this._cpuHist = new Map();
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
  update(list) {
    this._list = list;
    const seen = new Set();
    for (const p of list) {
      seen.add(p.pid);
      let hist = this._cpuHist.get(p.pid);
      if (!hist) { hist = new RingBuffer(60); this._cpuHist.set(p.pid, hist); }
      hist.push(p.cpu);
    }
    for (const pid of Array.from(this._cpuHist.keys())) {
      if (!seen.has(pid)) this._cpuHist.delete(pid);
    }
    this._render();
  }
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
    this._detailUnit = null;
    this.popup.classList.remove("hidden");
    this.popup.innerHTML = `
      <div class="popup-head">${esc(p.program)} <span class="popup-pid">pid ${p.pid}</span>
        <button class="popup-close">✕</button></div>
      <div class="popup-body">
        <div>User: ${esc(p.user)}</div><div>Parent: ${p.ppid}</div>
        <div>Threads: ${p.threads}</div><div>Memory: ${humanize(p.rss)}</div>
        <div>Cpu: ${p.cpu.toFixed(1)}%</div>
        <div class="popup-unit">Unit: <span class="popup-unit-val">…</span></div>
        <div class="popup-cmd">${esc(p.command || p.program)}</div>
        <canvas class="popup-spark"></canvas>
      </div>
      <div class="popup-label">Signal</div>
      <div class="popup-actions">
        <button data-sig="TERM">TERM (15)</button>
        <button data-sig="KILL">KILL (9)</button>
        <button data-sig="HUP">HUP (1)</button>
      </div>
      <div class="popup-label">Go to (Cockpit)</div>
      <div class="popup-links">
        <button class="link-service" disabled>Service ↗</button>
        <button class="link-logs" disabled>Logs ↗</button>
        <button class="link-files">Files: cwd ↗</button>
      </div>
      <div class="popup-label">Renice</div>
      <div class="popup-renice">
        <input class="renice-val" type="number" min="-20" max="19" value="0" title="niceness -20..19">
        <button class="renice-apply">Apply</button>
      </div>
      <div class="popup-label">Sockets</div>
      <div class="popup-sockets">…</div>
      <div class="popup-msg"></div>`;
    const msg = (t) => { this.popup.querySelector(".popup-msg").textContent = t; };
    const jump = (path) => { if (window.cockpit && window.cockpit.jump) window.cockpit.jump(path); };
    this.popup.querySelector(".popup-close").addEventListener("click", () => this.popup.classList.add("hidden"));
    this.popup.querySelectorAll(".popup-actions button").forEach((b) => {
      b.addEventListener("click", () => {
        this.onkill(p.pid, b.dataset.sig)
          .then(() => msg(`Sent SIG${b.dataset.sig}`))
          .catch((e) => msg("Failed: " + (e.message || e.problem || "denied")));
      });
    });
    const svcBtn = this.popup.querySelector(".link-service");
    const logBtn = this.popup.querySelector(".link-logs");
    svcBtn.addEventListener("click", () => { if (this._detailUnit) jump("/system/services#/" + this._detailUnit); });
    logBtn.addEventListener("click", () => { if (this._detailUnit) jump("/system/logs#/?prio=debug&_SYSTEMD_UNIT=" + encodeURIComponent(this._detailUnit)); });
    this.popup.querySelector(".link-files").addEventListener("click", () => {
      if (!this.cwdOf) { msg("cwd unavailable"); return; }
      this.cwdOf(p.pid).then((cwd) => {
        if (this._selected !== p) return;
        if (cwd) jump("/files#" + cwd.split("/").map(encodeURIComponent).join("/"));
        else msg("cwd not accessible — turn on Administrative access for other users' processes (kernel threads have no cwd).");
      });
    });
    this.popup.querySelector(".renice-apply").addEventListener("click", () => {
      if (!this.onrenice) { msg("renice unavailable"); return; }
      const v = this.popup.querySelector(".renice-val").value;
      this.onrenice(p.pid, v)
        .then(() => { if (this._selected === p) msg("Reniced to " + v); })
        .catch((e) => { if (this._selected === p) msg("Renice failed: " + (e.message || e.problem || "denied")); });
    });
    if (this.unitOf) this.unitOf(p.pid).then((unit) => {
      if (this._selected !== p) return; // popup moved on
      this._detailUnit = unit;
      this.popup.querySelector(".popup-unit-val").textContent = unit || "—";
      if (unit) { svcBtn.disabled = false; logBtn.disabled = false; }
    });
    const hist = this._cpuHist.get(p.pid);
    if (hist && hist.length) {
      const sparkCanvas = this.popup.querySelector(".popup-spark");
      new BrailleGraph(sparkCanvas, { height: 2, gradient: theme.gradients.process }).render(hist.toArray(), { maxValue: 100 });
    }
    this._loadSockets(p);
  }
  _loadSockets(p) {
    const el = this.popup.querySelector(".popup-sockets");
    if (!window.cockpit || !window.cockpit.spawn) { el.textContent = "no listening/connected sockets"; return; }
    window.cockpit.spawn(["ss", "-tunpH"], { superuser: "try", err: "message" })
      .then((out) => {
        if (this._selected !== p) return;
        const needle = `pid=${p.pid},`;
        const entries = [];
        for (const line of out.split("\n")) {
          if (!line.includes(needle)) continue;
          const cols = line.trim().split(/\s+/);
          if (cols.length < 5) continue;
          const local = cols[4];
          const peer = cols[5] || "";
          entries.push(`${local} -> ${peer}`);
          if (entries.length >= 6) break;
        }
        el.textContent = "";
        if (!entries.length) { el.textContent = "no listening/connected sockets"; return; }
        const ul = document.createElement("ul");
        for (const entry of entries) {
          const li = document.createElement("li");
          li.textContent = entry;
          ul.appendChild(li);
        }
        el.appendChild(ul);
      })
      .catch(() => { if (this._selected === p) el.textContent = "no listening/connected sockets"; });
  }
}
