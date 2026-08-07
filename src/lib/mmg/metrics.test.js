import { test } from "node:test";
import assert from "node:assert/strict";

import { gapClosuresInDiff } from "./metrics.js";

test("flips from missing or misconception to correct close a gap", () => {
  /** @type {any} */
  const diff = {
    added: ["n-os"],
    flipped: [
      { id: "n-transistor", from: "misconception", to: "correct" },
      { id: "n-app", from: "missing", to: "correct" },
      { id: "n-circuit", from: "untested", to: "correct" },
      { id: "n-bit", from: "correct", to: "misconception" },
      { id: "n-silicon", from: "missing", to: "misconception" },
    ],
    updated: [],
  };
  assert.equal(gapClosuresInDiff(diff), 2);
});

test("flips not ending in correct never count", () => {
  /** @type {any} */
  const diff = {
    added: [],
    flipped: [
      { id: "n-a", from: "correct", to: "misconception" },
      { id: "n-b", from: "missing", to: "untested" },
      { id: "n-c", from: "untested", to: "missing" },
    ],
    updated: [],
  };
  assert.equal(gapClosuresInDiff(diff), 0);
});

test("untested to correct is a first discovery, not a closed gap", () => {
  /** @type {any} */
  const diff = {
    added: ["n-electricity"],
    flipped: [{ id: "n-electricity", from: "untested", to: "correct" }],
    updated: [],
  };
  assert.equal(gapClosuresInDiff(diff), 0);
});

test("an empty diff closes nothing", () => {
  /** @type {any} */
  const diff = { added: [], flipped: [], updated: [] };
  assert.equal(gapClosuresInDiff(diff), 0);
});

test("null, undefined and malformed diffs close nothing", () => {
  assert.equal(gapClosuresInDiff(null), 0);
  assert.equal(gapClosuresInDiff(undefined), 0);
  assert.equal(gapClosuresInDiff(/** @type {any} */ ({})), 0);
  assert.equal(gapClosuresInDiff(/** @type {any} */ ({ flipped: "not-an-array" })), 0);
  assert.equal(
    gapClosuresInDiff(
      /** @type {any} */ ({ flipped: [null, { from: "missing", to: "correct" }] })
    ),
    1
  );
});
