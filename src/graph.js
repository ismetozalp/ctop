function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function scaleVal(v, maxValue, offset) {
  if (maxValue > 0) return clamp(Math.round((v + offset) * 100 / maxValue), 0, 100);
  return clamp(v, 0, 100);
}

function level(value, curHigh, curLow, clampMin, mod) {
  if (value >= curHigh) return 4;
  if (value <= curLow) return clampMin;
  return clamp(Math.round((value - curLow) * 4 / (curHigh - curLow) + mod), clampMin, 4);
}

export function quantize(data, width, height, opts = {}) {
  const { noZero = false, maxValue = 100, offset = 0 } = opts;
  const need = width * 2;
  const slice = data.slice(Math.max(0, data.length - need));
  const samples = new Array(need - slice.length).fill(0).concat(slice)
    .map((v) => scaleVal(v, maxValue, offset));
  const clampMin = noZero ? 1 : 0;
  const mod = height === 1 ? 0.3 : 0.1;
  const grid = [];
  for (let row = 0; row < height; row++) {
    const curHigh = Math.round(100 * (height - row) / height);
    const curLow = Math.round(100 * (height - (row + 1)) / height);
    const rowCells = [];
    for (let c = 0; c < width; c++) {
      const left = level(samples[c * 2], curHigh, curLow, clampMin, mod);
      const right = level(samples[c * 2 + 1], curHigh, curLow, clampMin, mod);
      rowCells.push([left, right]);
    }
    grid.push(rowCells);
  }
  return grid;
}

// --- appended to src/graph.js ---
// Dot layout inside a braille cell: 2 columns x 4 rows. Level 0..4 = dots filled from bottom.
export class BrailleGraph {
  constructor(canvas, { height, gradient }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rows = height;        // character rows
    this.gradient = gradient;  // string[101]
  }
  render(data, { maxValue = 100, offset = 0, noZero = false } = {}) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth, cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const cols = Math.max(1, Math.floor(cssW / 2)); // 2px per braille column pair min
    const grid = quantize(data, cols, this.rows, { maxValue, offset, noZero });
    const cellW = cssW / cols;              // width of one 2-dot cell
    const cellH = cssH / this.rows;         // height of one 4-dot cell
    const dotW = cellW / 2, dotH = cellH / 4;

    for (let row = 0; row < this.rows; row++) {
      // color this row by its band midpoint percentage
      const pct = Math.round(100 * (this.rows - row - 0.5) / this.rows);
      ctx.fillStyle = this.gradient[Math.max(0, Math.min(100, pct))];
      for (let c = 0; c < cols; c++) {
        const [lv, rv] = grid[row][c];
        const x = c * cellW, y = row * cellH;
        for (let k = 0; k < lv; k++) ctx.fillRect(x, y + (3 - k) * dotH, dotW - 0.5, dotH - 0.5);
        for (let k = 0; k < rv; k++) ctx.fillRect(x + dotW, y + (3 - k) * dotH, dotW - 0.5, dotH - 0.5);
      }
    }
  }
}
