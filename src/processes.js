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
}
