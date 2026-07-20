import test from "node:test";
import assert from "node:assert/strict";
import { fileBrowserUrl } from "../src/navigate.js";

test("Cockpit Files: hash path, segments encoded", () => {
  assert.equal(fileBrowserUrl("/home/ismet", "files"), "/files#/home/ismet");
  assert.equal(fileBrowserUrl("/a b/c", "files"), "/files#/a%20b/c");
  assert.equal(fileBrowserUrl("/", "files"), "/files#/");
});
test("Explorer: open=<encoded abs path> in the hash", () => {
  assert.equal(fileBrowserUrl("/home/ismet", "explorer"), "/explorer#open=%2Fhome%2Fismet");
  assert.equal(fileBrowserUrl("/a b/c", "explorer"), "/explorer#open=%2Fa%20b%2Fc");
});
test("normalizes to an absolute path", () => {
  assert.equal(fileBrowserUrl("home/ismet", "files"), "/files#/home/ismet");
  assert.equal(fileBrowserUrl("", "files"), "/files#/");
});

import { availableFileBrowsers } from "../src/navigate.js";
test("availableFileBrowsers reads the manifests map", () => {
  assert.deepEqual(availableFileBrowsers({ files: {}, explorer: {} }), ["files", "explorer"]);
  assert.deepEqual(availableFileBrowsers({ files: {} }), ["files"]);
  assert.deepEqual(availableFileBrowsers({ explorer: {} }), ["explorer"]);
  assert.deepEqual(availableFileBrowsers({ system: {} }), []);
  assert.deepEqual(availableFileBrowsers(null), []);
});
