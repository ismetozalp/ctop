// src/meter.js
export class Meter {
  constructor(canvas, { gradient, bgColor = "#404040" }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gradient = gradient;
    this.bgColor = bgColor;
  }
  render(value) {
    const v = Math.max(0, Math.min(100, value));
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth, cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const cells = Math.max(1, Math.floor(cssW / 4)); // ~4px per segment
    const cellW = cssW / cells, gap = Math.min(1, cellW * 0.15);
    for (let i = 1; i <= cells; i++) {
      const pos = Math.round(i * 100 / cells);
      const x = (i - 1) * cellW;
      if (v >= pos) ctx.fillStyle = this.gradient[Math.min(100, pos)];
      else ctx.fillStyle = this.bgColor;
      ctx.fillRect(x, 0, cellW - gap, cssH);
    }
  }
}
