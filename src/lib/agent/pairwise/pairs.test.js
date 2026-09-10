import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PAIRS,
  TARGET_ID,
  buildClosedWorld,
  enumeratePairs,
  partitionBatches,
} from "./pairs.js";

/**
 * @param {string} concept
 * @param {number} count
 */
function world(concept, count) {
  const candidates = Array.from({ length: count }, (_, index) => ({
    id: `k${index + 1}`,
    label: `concept ${index + 1}`,
    gloss: `Gloss ${index + 1}.`,
    kind: "mechanism",
    foundation_fit: index % 2 === 0 ? "DEMONSTRABLE" : "ABSTRACT",
  }));
  return buildClosedWorld(concept, candidates);
}

test("eleven concepts yield every unordered pair exactly once", () => {
  const { nodes } = world("laptop", 10);
  assert.equal(nodes.length, 11);
  assert.ok(nodes.some((node) => node.id === TARGET_ID));
  const pairs = enumeratePairs(nodes);
  assert.equal(pairs.length, MAX_PAIRS);
  const seen = new Set();
  for (const pair of pairs) {
    assert.notEqual(pair.a_id, pair.b_id);
    assert.ok(pair.a_id < pair.b_id);
    const key = `${pair.a_id} ${pair.b_id}`;
    assert.ok(!seen.has(key), `duplicate pair ${key}`);
    seen.add(key);
  }
});

test("fifty-five pairs partition into bounded batches", () => {
  const { nodes } = world("laptop", 10);
  const batches = partitionBatches(enumeratePairs(nodes));
  assert.equal(batches.length, 4);
  const sizes = batches.map((batch) => batch.length);
  assert.deepEqual(sizes.reduce((a, b) => a + b, 0), MAX_PAIRS);
  for (const size of sizes) {
    assert.ok(size >= 12 && size <= 15, `batch size ${size} out of bounds`);
  }
});

test("thirty-six pairs partition into three batches of twelve", () => {
  const { nodes } = world("battery", 8);
  const pairs = enumeratePairs(nodes);
  assert.equal(pairs.length, 36);
  const batches = partitionBatches(pairs);
  assert.deepEqual(batches.map((batch) => batch.length), [12, 12, 12]);
});

test("enumeration beyond the cap throws instead of truncating", () => {
  const { nodes } = world("recursion", 11);
  assert.throws(() => enumeratePairs(nodes), /exceeds the cap/);
});

test("enumeration is deterministic across runs", () => {
  const { nodes } = world("photosynthesis", 9);
  assert.deepEqual(enumeratePairs(nodes), enumeratePairs(nodes));
});
