import { test } from "node:test";
import assert from "node:assert/strict";

import { treeLayout, spinePaths } from "./mapview/tree.js";
import { laptopRealityMap } from "./mmg/fixtures.js";
import {
  GROW_TRUNK_END,
  budDelay,
  elbowLayerIndexes,
  hash,
  layerReveal,
  sapPulsePaths,
  trunkReveal,
} from "./motion.js";

test("hash is deterministic and non-negative", () => {
  assert.equal(hash("laptop"), hash("laptop"));
  assert.equal(hash("n-bit:cd"), hash("n-bit:cd"));
  assert.ok(hash("anything") >= 0);
  assert.notEqual(hash("a"), hash("b"));
});

test("budDelay: root first, labels then cards, deterministic per id", () => {
  assert.equal(budDelay("root", "root"), "0.1s");
  const label = budDelay("l3", "label");
  const card = budDelay("n-bit", "card");
  const labelMs = Number.parseFloat(label);
  const cardMs = Number.parseFloat(card);
  assert.ok(labelMs >= 0.2 && labelMs < 0.9, `label delay ${label}`);
  assert.ok(cardMs >= 0.35 && cardMs < 1, `card delay ${card}`);
  assert.equal(budDelay("l3", "label"), label);
  assert.equal(budDelay("n-bit", "card"), card);
});

test("trunkReveal draws the trunk over the first half of the elapsed grow", () => {
  assert.equal(trunkReveal(0), 0);
  assert.equal(trunkReveal(GROW_TRUNK_END / 2), 0.5);
  assert.equal(trunkReveal(GROW_TRUNK_END), 1);
  assert.equal(trunkReveal(1), 1);
  assert.equal(trunkReveal(-1), 0);
  assert.equal(trunkReveal(2), 1);
});

/**
 * @param {number} actual
 * @param {number} expected
 * @param {string} message
 * @param {number} [epsilon]
 */
const closeTo = (actual, expected, message, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} ~ ${expected}`);

test("layerReveal buds layers deepest-first after the trunk", () => {
  assert.equal(layerReveal(0.5, 3, 2), 0, "deepest starts revealing at 0.5");
  assert.equal(layerReveal(0.75, 3, 2), 1, "deepest fully revealed by 0.75");
  closeTo(layerReveal(0.75, 3, 1), 0.5, "middle half-revealed at 0.75");
  closeTo(layerReveal(0.9, 3, 0), 0.4, "crown 40% at 0.9");
  assert.equal(layerReveal(1, 3, 0), 1);
  assert.equal(layerReveal(0.1, 3, 2), 0, "nothing before the trunk ends");
  assert.equal(layerReveal(1, 0, 0), 1, "no layers renders fully");
});

test("sapPulsePaths: one trunk pulse down the spine from the foundation", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const paths = sapPulsePaths(layout);
  assert.ok(paths.length >= 1);
  assert.equal(paths[0].id, "trunk");
  const electricity = layout.cardById.get("n-electricity");
  assert.ok(electricity);
  const crown = layout.root;
  assert.equal(
    paths[0].d,
    `M ${layout.trunk} ${electricity.y} V ${crown.y + crown.height}`
  );
});

test("sapPulsePaths: empty tree emits no pulses", () => {
  const layout = treeLayout({ concept: "x", layers: [], nodes: [], edges: [] });
  assert.deepEqual(sapPulsePaths(layout), []);
});

test("elbowLayerIndexes aligns with spinePaths", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const paths = spinePaths(layout);
  const elbows = elbowLayerIndexes(layout);
  assert.equal(elbows.length, paths.length);
  assert.ok(elbows.every((i) => i >= 0 && i < layout.branches.length));
});
