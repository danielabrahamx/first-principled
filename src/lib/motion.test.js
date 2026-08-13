import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  cladogramPaths,
  TREE_CARD_HEIGHT,
} from "./mapview/tree.js";
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
  // 3 layers; chronological = count - 1 - index, so the deepest (index 2)
  // reveals first and the crown-most (index 0) reveals last.
  assert.equal(layerReveal(0.5, 3, 2), 0, "deepest starts revealing at 0.5");
  assert.equal(layerReveal(0.75, 3, 2), 1, "deepest fully revealed by 0.75");
  closeTo(layerReveal(0.75, 3, 1), 0.5, "middle half-revealed at 0.75");
  closeTo(layerReveal(0.9, 3, 0), 0.4, "crown 40% at 0.9");
  assert.equal(layerReveal(1, 3, 0), 1);
  assert.equal(layerReveal(0.1, 3, 2), 0, "nothing before the trunk ends");
  assert.equal(layerReveal(1, 0, 0), 1, "no layers renders fully");
});

test("sapPulsePaths: one trunk pulse plus one per branch, all rising", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  const paths = sapPulsePaths(layout);

  assert.equal(paths.length, 7);
  assert.equal(paths[0].id, "trunk");

  const last = layout.branches[layout.branches.length - 1];
  const trunkTop = layout.root.y + layout.root.height;
  assert.equal(paths[0].d, `M ${layout.trunk} ${last.divergenceY} V ${trunkTop}`);

  layout.branches.forEach((branch, i) => {
    const sap = paths[i + 1];
    assert.equal(sap.id, branch.id);
    const lastCard = branch.cards[branch.cards.length - 1];
    const startY = lastCard ? lastCard.y + TREE_CARD_HEIGHT : branch.firstCardY;
    assert.ok(
      sap.d.startsWith(`M ${branch.cx} ${startY} V ${branch.divergenceY} H ${layout.trunk}`)
    );
  });
});

test("sapPulsePaths: empty tree emits no pulses", () => {
  const layout = treeLayout({ rootLabel: "x", branches: [] });
  assert.deepEqual(sapPulsePaths(layout), []);
});

test("elbowLayerIndexes aligns with cladogramPaths past the trunk", () => {
  const layout = treeLayout(realityTree(laptopRealityMap));
  const clad = cladogramPaths(layout);
  const elbows = elbowLayerIndexes(layout);
  assert.equal(elbows.length, clad.length - 1);
  let cursor = 0;
  layout.branches.forEach((branch, i) => {
    assert.equal(elbows[cursor], i);
    cursor += 1;
    for (let j = 1; j < branch.cards.length; j++) {
      assert.equal(elbows[cursor], i);
      cursor += 1;
    }
  });
  assert.equal(cursor, elbows.length);
});
