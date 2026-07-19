// src/boxes/netBox.js
import { BrailleGraph } from "../graph.js";
import { NetScaler } from "../netscale.js";
import { theme } from "../theme.js";
import { humanize } from "../humanize.js";

export class NetBox {
  constructor(root) { this.root = root; this._iface = null; this._rxScale = new NetScaler(); this._txScale = new NetScaler(); }
  mount() {
    this.root.innerHTML = `
      <div class="box net-box">
        <div class="box-title">net <span class="net-iface"></span></div>
        <div class="net-dir"><span class="net-tag">↓</span><canvas class="net-rx"></canvas><span class="net-rx-val"></span></div>
        <div class="net-dir"><span class="net-tag">↑</span><canvas class="net-tx"></canvas><span class="net-tx-val"></span></div>
      </div>`;
    this.rx = new BrailleGraph(this.root.querySelector(".net-rx"), { height: 3, gradient: theme.gradients.download });
    this.tx = new BrailleGraph(this.root.querySelector(".net-tx"), { height: 3, gradient: theme.gradients.upload });
    this.ifaceEl = this.root.querySelector(".net-iface");
    this.rxVal = this.root.querySelector(".net-rx-val");
    this.txVal = this.root.querySelector(".net-tx-val");
  }
  _pick(m) {
    let best = null, bestSum = -1;
    for (const [name, buf] of Object.entries(m.net)) {
      if (name === "lo") continue;
      const sum = buf.rx.last() + buf.tx.last();
      if (sum > bestSum) { bestSum = sum; best = name; }
    }
    return best || Object.keys(m.net).find((n) => n !== "lo") || null;
  }
  update(m) {
    if (!this._iface || !m.net[this._iface]) this._iface = this._pick(m);
    if (!this._iface) return;
    this.ifaceEl.textContent = this._iface;
    const buf = m.net[this._iface];
    const rxArr = buf.rx.toArray(), txArr = buf.tx.toArray();
    const rxCeil = this._rxScale.update(buf.rx.last());
    const txCeil = this._txScale.update(buf.tx.last());
    this.rx.render(rxArr, { maxValue: rxCeil });
    this.tx.render(txArr, { maxValue: txCeil });
    this.rxVal.textContent = humanize(buf.rx.last(), { perSecond: true });
    this.txVal.textContent = humanize(buf.tx.last(), { perSecond: true });
  }
}
