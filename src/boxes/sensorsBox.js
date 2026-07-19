// src/boxes/sensorsBox.js
// Self-contained hwmon sensors box (temperatures + fan speeds beyond the
// CPU package). Polls sysfs directly on its own 2s timer.
import { settings } from "../settings.js";

// Enumerate every /sys/class/hwmon/hwmonN directory, read its chip name,
// and for each temp*_input / fan*_input file emit a "chip|file|value|label"
// line. The _label file path is derived from the _input path via shell
// parameter expansion (${f%_input}_label).
const SCRIPT = `
for d in /sys/class/hwmon/hwmon*; do
  [ -d "$d" ] || continue
  name=$(cat "$d/name" 2>/dev/null)
  [ -n "$name" ] || name="?"
  for f in "$d"/temp*_input "$d"/fan*_input; do
    [ -e "$f" ] || continue
    v=$(cat "$f" 2>/dev/null)
    [ -n "$v" ] || continue
    lf="\${f%_input}_label"
    label=$(cat "$lf" 2>/dev/null)
    echo "$name|$(basename "$f")|$v|$label"
  done
done
`;

export class SensorsBox {
  constructor(root) { this.root = root; }

  mount() {
    this.root.innerHTML = `
      <div class="box sensors-box">
        <div class="box-title">sensors</div>
        <div class="sensors-rows"></div>
      </div>`;
    this.rowsEl = this.root.querySelector(".sensors-rows");
    this._refresh();
    this._timer = setInterval(() => this._refresh(), 2000);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _parse(out) {
    const rows = [];
    out.split("\n").forEach((line) => {
      if (!line.trim()) return;
      const parts = line.split("|");
      if (parts.length < 3) return;
      const chip = parts[0];
      const file = parts[1];
      const value = parts[2];
      const label = parts.length > 3 ? parts.slice(3).join("|").trim() : "";
      rows.push({ chip, file, value, label });
    });
    return rows;
  }

  _render(rows) {
    this.rowsEl.innerHTML = "";
    const tempScale = settings.get("tempScale") || "C";
    rows.forEach((r) => {
      const div = document.createElement("div");
      div.className = "sensors-row";

      const nameEl = document.createElement("span");
      nameEl.className = "sensors-name";
      const label = r.label || r.file;
      nameEl.textContent = `${r.chip} ${label}:`;

      const valEl = document.createElement("span");
      valEl.className = "sensors-val";

      if (r.file.startsWith("temp")) {
        const raw = parseFloat(r.value);
        if (Number.isNaN(raw)) return;
        let c = raw / 1000;
        if (tempScale === "F") {
          const f = c * 9 / 5 + 32;
          valEl.textContent = `${f.toFixed(1)}°F`;
        } else {
          valEl.textContent = `${c.toFixed(1)}°C`;
        }
      } else if (r.file.startsWith("fan")) {
        const rpm = parseInt(r.value, 10);
        if (Number.isNaN(rpm)) return;
        valEl.textContent = `${rpm} RPM`;
      } else {
        return;
      }

      div.appendChild(nameEl);
      div.appendChild(valEl);
      this.rowsEl.appendChild(div);
    });
  }

  _refresh() {
    if (!window.cockpit) return;
    if (this._inFlight) return;
    this._inFlight = true;
    window.cockpit.spawn(["sh", "-c", SCRIPT], { err: "message" })
      .then((out) => {
        this._inFlight = false;
        const rows = this._parse(out);
        // Hide the box when there are no readable sensors (like gpu/battery boxes).
        if (!rows.length) { this.root.style.display = "none"; return; }
        this.root.style.display = "";
        this._render(rows);
      })
      .catch(() => { this._inFlight = false; this.root.style.display = "none"; });
  }
}
