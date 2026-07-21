// src/boxes/containersBox.js
// Self-contained containers box. Polls `podman stats` and `docker stats` on
// its own timer — it is not fed by the shared metrics channel. Rows from both
// engines are merged into one table; an Engine column appears only when both
// engines currently have containers.
import { theme } from "../theme.js";
import { ENGINES, statsArgs, parseStats, mergeRows } from "../containers.js";

const POLL_MS = 3000;

export class ContainersBox {
  constructor(root) {
    this.root = root;
    // Per-engine state: "missing" (binary absent — stop asking) or
    // "sudo" (docker only: plain spawn failed once, use superuser:"try").
    this._engineState = {};
  }

  mount() {
    this.root.innerHTML = `
      <div class="box containers-box">
        <div class="box-title">containers</div>
        <div class="containers-scroll">
          <table class="containers-table">
            <thead><tr><th class="cengine-th">Eng</th><th>Name</th><th>CPU%</th><th>Mem</th><th>Net I/O</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>`;
    this.tbody = this.root.querySelector("tbody");
    this.engineTh = this.root.querySelector(".cengine-th");
    this._refresh();
    this._timer = setInterval(() => this._refresh(), POLL_MS);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  // Poll one engine; returns [] on any failure so one dead engine never
  // blanks the other's rows.
  async _pollEngine(engine) {
    const state = this._engineState[engine.id];
    if (state === "missing") return [];
    const argv = statsArgs(engine);
    const opts = { err: "message" };
    // docker usually needs the daemon socket; after a plain-spawn failure fall
    // back to the session's admin privilege (no prompt if not unlocked).
    if (state === "sudo") opts.superuser = "try";
    try {
      const out = await window.cockpit.spawn(argv, opts);
      return parseStats(out, engine.id);
    } catch (e) {
      if (e && e.problem === "not-found") { this._engineState[engine.id] = "missing"; return []; }
      if (engine.id === "docker" && state !== "sudo") {
        this._engineState[engine.id] = "sudo";
        try {
          const out = await window.cockpit.spawn(argv, { err: "message", superuser: "try" });
          return parseStats(out, engine.id);
        } catch (e2) {
          if (e2 && e2.problem === "not-found") this._engineState[engine.id] = "missing";
          return [];
        }
      }
      return [];
    }
  }

  async _refresh() {
    if (!window.cockpit) return;
    if (this._inFlight) return;
    this._inFlight = true;
    try {
      const lists = await Promise.all(ENGINES.map((e) => this._pollEngine(e)));
      const rows = mergeRows(lists);

      if (rows.length === 0) {
        this.root.style.display = "none";
        return;
      }
      const engines = new Set(rows.map((r) => r.engine));
      const showEngine = engines.size > 1;

      this.root.style.display = "";
      this.engineTh.style.display = showEngine ? "" : "none";
      this.tbody.innerHTML = "";
      for (const row of rows) {
        const tr = document.createElement("tr");

        if (showEngine) {
          const tdEng = document.createElement("td");
          tdEng.className = "cengine";
          tdEng.textContent = row.engine;
          tr.appendChild(tdEng);
        }

        const tdName = document.createElement("td");
        tdName.className = "cname";
        tdName.textContent = row.name;

        const tdCpu = document.createElement("td");
        const cpuNum = parseFloat(row.cpu);
        const pct = Number.isNaN(cpuNum) ? 0 : Math.max(0, Math.min(100, Math.round(cpuNum)));
        tdCpu.style.color = theme.gradients.cpu[pct];
        tdCpu.textContent = row.cpu;

        const tdMem = document.createElement("td");
        tdMem.textContent = row.mem;

        const tdNet = document.createElement("td");
        tdNet.textContent = row.net;

        tr.append(tdName, tdCpu, tdMem, tdNet);
        this.tbody.appendChild(tr);
      }
    } catch (e) {
      // leave last-known rows in place on unexpected error
    } finally {
      this._inFlight = false;
    }
  }
}
