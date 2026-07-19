// src/boxes/netBox.js
import { BrailleGraph } from "../graph.js";
import { NetScaler } from "../netscale.js";
import { theme } from "../theme.js";
import { humanize } from "../humanize.js";
import { settings } from "../settings.js";

export class NetBox {
  constructor(root) {
    this.root = root;
    this._iface = null;
    this._rxScale = new NetScaler();
    this._txScale = new NetScaler();
    this._rxTop = 0;
    this._txTop = 0;
    this._rxTotal = 0;
    this._txTotal = 0;
  }
  mount() {
    this.root.innerHTML = `
      <div class="box net-box">
        <div class="box-title">net <span class="net-iface"></span></div>
        <div class="net-dir"><span class="net-tag">↓</span><canvas class="net-rx"></canvas><span class="net-rx-val"></span>
          <div class="net-stats"><span class="net-top net-rx-top"></span><span class="net-total net-rx-total"></span></div>
        </div>
        <div class="net-dir"><span class="net-tag">↑</span><canvas class="net-tx"></canvas><span class="net-tx-val"></span>
          <div class="net-stats"><span class="net-top net-tx-top"></span><span class="net-total net-tx-total"></span></div>
        </div>
      </div>`;
    this.rx = new BrailleGraph(this.root.querySelector(".net-rx"), { height: 3, gradient: theme.gradients.download });
    this.tx = new BrailleGraph(this.root.querySelector(".net-tx"), { height: 3, gradient: theme.gradients.upload });
    this.ifaceEl = this.root.querySelector(".net-iface");
    this.rxVal = this.root.querySelector(".net-rx-val");
    this.txVal = this.root.querySelector(".net-tx-val");
    this.rxTopEl = this.root.querySelector(".net-rx-top");
    this.rxTotalEl = this.root.querySelector(".net-rx-total");
    this.txTopEl = this.root.querySelector(".net-tx-top");
    this.txTotalEl = this.root.querySelector(".net-tx-total");
  }
  _pick(m) {
    let best = null, bestSum = -1;
    for (const [name, buf] of Object.entries(m.net)) {
      if (name === "lo") continue;
      const sum = buf.rx.last() + buf.tx.last();
      if (sum > bestSum) { bestSum = sum; best = name; }
    }
    const picked = best || Object.keys(m.net).find((n) => n !== "lo") || null;
    if (picked !== this._iface) {
      this._rxTop = 0;
      this._txTop = 0;
      this._rxTotal = 0;
      this._txTotal = 0;
    }
    return picked;
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
    const rxRate = buf.rx.last();
    const txRate = buf.tx.last();
    this._rxTop = Math.max(this._rxTop, rxRate);
    this._rxTotal += rxRate * 2;
    this._txTop = Math.max(this._txTop, txRate);
    this._txTotal += txRate * 2;
    const bit = settings.get("netBits");
    this.rxVal.textContent = humanize(rxRate, { bit, perSecond: true });
    this.txVal.textContent = humanize(txRate, { bit, perSecond: true });
    this.rxTopEl.textContent = `Top: ${humanize(this._rxTop, { bit, perSecond: true })}`;
    this.rxTotalEl.textContent = `Total: ${humanize(this._rxTotal, { bit })}`;
    this.txTopEl.textContent = `Top: ${humanize(this._txTop, { bit, perSecond: true })}`;
    this.txTotalEl.textContent = `Total: ${humanize(this._txTotal, { bit })}`;
  }
}
