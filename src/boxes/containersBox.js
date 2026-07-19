// src/boxes/containersBox.js
// Self-contained podman containers box. Polls `podman stats` on its own
// timer — it is not fed by the shared metrics channel.
import { theme } from "../theme.js";

const POLL_MS = 3000;

export class ContainersBox {
  constructor(root) { this.root = root; }

  mount() {
    this.root.innerHTML = `
      <div class="box containers-box">
        <div class="box-title">containers</div>
        <div class="containers-scroll">
          <table class="containers-table">
            <thead><tr><th>Name</th><th>CPU%</th><th>Mem</th><th>Net I/O</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>`;
    this.tbody = this.root.querySelector("tbody");
    this._refresh();
    this._timer = setInterval(() => this._refresh(), POLL_MS);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async _refresh() {
    if (!window.cockpit) return;
    if (this._inFlight) return;
    this._inFlight = true;
    try {
      const out = await window.cockpit.spawn(
        ["podman", "stats", "--no-stream", "--format", "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"],
        { err: "message" }
      ).catch(() => null);

      if (out == null) {
        this.root.style.display = "none";
        return;
      }

      const rows = out.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const parts = line.split("\t");
        return { name: parts[0] || "", cpu: parts[1] || "", mem: parts[2] || "", net: parts[3] || "" };
      });

      if (rows.length === 0) {
        this.root.style.display = "none";
        return;
      }

      this.root.style.display = "";
      this.tbody.innerHTML = "";
      for (const row of rows) {
        const tr = document.createElement("tr");

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
