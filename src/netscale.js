const FLOOR = 10 * 1024;
export class NetScaler {
  constructor() { this.ceiling = FLOOR; this.samples = []; this.over = 0; this.under = 0; }
  update(speed) {
    this.samples.push(speed);
    if (this.samples.length > 5) this.samples.shift();
    if (speed > this.ceiling) { this.over++; this.under = 0; }
    else if (speed < this.ceiling / 10) { this.under++; this.over = 0; }
    else { this.over = 0; this.under = 0; }
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (this.over >= 5) { this.ceiling = Math.max(FLOOR, avg * 1.3); this.over = 0; }
    else if (this.under >= 5) { this.ceiling = Math.max(FLOOR, avg * 3.0); this.under = 0; }
    return this.ceiling;
  }
}
