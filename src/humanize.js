const UNITS = {
  byteBin: ["B", "KiB", "MiB", "GiB", "TiB", "PiB"],
  bitBin:  ["b", "Kib", "Mib", "Gib", "Tib", "Pib"],
  byteDec: ["B", "kB", "MB", "GB", "TB", "PB"],
  bitDec:  ["b", "kb", "Mb", "Gb", "Tb", "Pb"],
};

export function humanize(value, { bit = false, perSecond = false, base10 = false } = {}) {
  let v = value * (bit ? 8 : 1);
  const step = base10 ? 1000 : 1024;
  const units = base10 ? (bit ? UNITS.bitDec : UNITS.byteDec) : (bit ? UNITS.bitBin : UNITS.byteBin);
  let i = 0;
  while (v >= step && i < units.length - 1) { v /= step; i++; }
  let s;
  if (i === 0) s = String(Math.round(v));
  else if (v >= 100) s = String(Math.round(v));
  else if (v >= 10) s = v.toFixed(1);
  else s = v.toFixed(2);
  return s + " " + units[i] + (perSecond ? "/s" : "");
}
