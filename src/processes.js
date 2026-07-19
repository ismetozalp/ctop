// src/processes.js
import { parsePs } from "./procparse.js";

const PS_ARGS = ["ps", "-eo", "pid,ppid,nlwp,user:20,rss,pcpu,comm,args", "--no-headers"];

export class Processes {
  constructor({ interval = 2000 } = {}) { this.interval = interval; }
  start(onlist) {
    const tick = () => {
      window.cockpit.spawn(PS_ARGS, { err: "message" })
        .then((out) => onlist(parsePs(out)))
        .catch(() => {});
    };
    tick();
    this._timer = setInterval(tick, this.interval);
  }
  stop() { if (this._timer) clearInterval(this._timer); }
  kill(pid, signal = "TERM") {
    return window.cockpit.spawn(["kill", "-" + signal, String(pid)], { superuser: "try", err: "message" });
  }
  renice(pid, value) {
    return window.cockpit.spawn(["renice", "-n", String(value), "-p", String(pid)], { superuser: "try", err: "message" });
  }
  // Map a pid to its systemd unit via /proc/<pid>/cgroup. Returns the last
  // *.service in the path (excluding the per-user manager user@N.service),
  // or null for session/app scopes with no service unit.
  unitOf(pid) {
    return window.cockpit.file("/proc/" + Number(pid) + "/cgroup").read()
      .then((c) => {
        if (!c) return null;
        const svcs = (c.match(/[\w@.\-\\]+\.service/g) || []).filter((s) => !/^user@\d+\.service$/.test(s));
        return svcs.length ? svcs[svcs.length - 1] : null;
      })
      .catch(() => null);
  }
  // Resolve a pid's current working directory (needs privilege for other users).
  cwdOf(pid) {
    return window.cockpit.spawn(["readlink", "/proc/" + Number(pid) + "/cwd"], { superuser: "try", err: "message" })
      .then((s) => (s || "").trim() || null)
      .catch(() => null);
  }
}
