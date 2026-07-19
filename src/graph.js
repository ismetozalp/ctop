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
