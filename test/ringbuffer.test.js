import test from "node:test";
import assert from "node:assert/strict";
import { RingBuffer } from "../src/ringbuffer.js";

test("fills and reports oldest->newest", () => {
  const rb = new RingBuffer(3);
  rb.push(1); rb.push(2);
  assert.deepEqual(rb.toArray(), [1, 2]);
  assert.equal(rb.length, 2);
});
test("drops oldest when full", () => {
  const rb = new RingBuffer(3);
  [1, 2, 3, 4, 5].forEach((n) => rb.push(n));
  assert.deepEqual(rb.toArray(), [3, 4, 5]);
  assert.equal(rb.last(), 5);
  assert.equal(rb.length, 3);
});
test("last on empty is 0", () => {
  assert.equal(new RingBuffer(2).last(), 0);
});
