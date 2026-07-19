export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (h.length === 2) { const v = parseInt(h, 16); return [v, v, v]; }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
export function buildGradient(startHex, midHex, endHex) {
  const start = hexToRgb(startHex);
  const out = new Array(101);
  if (!endHex) { out.fill(rgbToHex(start)); return out; }
  const end = hexToRgb(endHex);
  const mid = midHex ? hexToRgb(midHex) : null;
  for (let i = 0; i <= 100; i++) {
    let a, b, offset, range;
    if (mid) {
      if (i <= 50) { a = start; b = mid; offset = 0; range = 50; }
      else { a = mid; b = end; offset = 50; range = 50; }
    } else { a = start; b = end; offset = 0; range = 100; }
    const c = [0, 1, 2].map((k) => a[k] + (i - offset) * (b[k] - a[k]) / range);
    out[i] = rgbToHex(c);
  }
  return out;
}
