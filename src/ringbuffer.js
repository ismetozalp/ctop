export class RingBuffer {
  constructor(capacity) { this._cap = capacity; this._buf = []; }
  push(n) { this._buf.push(n); if (this._buf.length > this._cap) this._buf.shift(); }
  toArray() { return this._buf.slice(); }
  last() { return this._buf.length ? this._buf[this._buf.length - 1] : 0; }
  get length() { return this._buf.length; }
  get capacity() { return this._cap; }
}
