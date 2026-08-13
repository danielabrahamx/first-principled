import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  cladogramPaths,
  TREE_CARD_HEIGHT,
  TREE_CARD_WIDTH,
  TREE_COLUMN_GAP,
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

test("trunkReveal draws the trunk over the first half of the scroll", () => {
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
  const layout = treeLayout(tree, { width: 375 });
  const paths = sapPulsePaths(layout);

  // 6 layers, all single-column at 375px: 1 trunk + 6 branch pulses.
  assert.equal(paths.length, 7);
  assert.equal(paths[0].id, "trunk");

  // The trunk runs from the deepest card bottom up to the crown: written
  // bottom-to-top so the pulse travels in the rising direction.
  const trunkTop = layout.root.y + layout.root.height;
  const deepest = Math.max(
    ...layout.branches.map((branch) =>
      branch.cards.length === 0
        ? branch.firstCardY
        : Math.max(...branch.cards.map((card) => card.y + TREE_CARD_HEIGHT))
    )
  );
  assert.equal(paths[0].d, `M ${layout.root.cx} ${deepest} V ${trunkTop}`);

  // Every branch pulse starts at its last card and rises into the trunk at
  // its divergence: bottom-to-top then a horizontal run to the trunk.
  layout.branches.forEach((branch, i) => {
    const sap = paths[i + 1];
    assert.equal(sap.id, branch.id);
    const lastCard = branch.cards[branch.cards.length - 1];
    const startY = lastCard ? lastCard.y + TREE_CARD_HEIGHT : branch.firstCardY;
    assert.ok(sap.d.startsWith(`M ${branch.cx} ${startY} V ${branch.divergenceY} H ${layout.root.cx}`));
  });
});

test("sapPulsePaths: two-up layers get one pulse per column elbow", () => {
  /**
   * @param {Array<{ id: string; label: string }>} nodes
   */
  const mk = (nodes) => ({
    id: "b0",
    name: "layer 0",
    oldestDate: 0,
    nodes,
  });
  const tree = {
    rootLabel: "x",
    branches: [mk(["a", "b", "c", "d"].map((label) => ({ id: `n-${label}`, label })))],
  };
  const layout = treeLayout(tree, {
    width: 2 * TREE_CARD_WIDTH + TREE_COLUMN_GAP + 100,
  });
  const paths = sapPulsePaths(layout);

  // Trunk + one pulse per column (2 columns).
  assert.equal(paths.length, 3);
  assert.equal(paths[0].id, "trunk");
  const cxs = [...new Set(layout.branches[0].cards.map((card) => card.cx))];
  assert.equal(cxs.length, 2);
  for (let i = 1; i <= 2; i++) {
    assert.match(paths[i].id, /^b0:c\d$/);
    const cx = cxs[i - 1];
    const colCards = layout.branches[0].cards.filter((card) => card.cx === cx);
    const startY = colCards[colCards.length - 1].y + TREE_CARD_HEIGHT;
    assert.ok(paths[i].d.startsWith(`M ${cx} ${startY} V ${layout.branches[0].divergenceY} H ${layout.root.cx}`));
  }
});

test("sapPulsePaths: empty tree emits no pulses", () => {
  const layout = treeLayout({ rootLabel: "x", branches: [] });
  assert.deepEqual(sapPulsePaths(layout), []);
});

test("elbowLayerIndexes aligns with cladogramPaths past the trunk", () => {
  // Single-column tree: no off-trunk strokes, so no elbow mapping.
  const single = treeLayout(realityTree(laptopRealityMap), { width: 375 });
  assert.deepEqual(elbowLayerIndexes(single), []);
  assert.equal(cladogramPaths(single).length, 1);

  // Two-up desktop tree: every stroke after the trunk maps to layer 0.
  /**
   * @param {Array<{ id: string; label: string }>} nodes
   */
  const mk = (nodes) => ({
    id: "b0",
    name: "layer 0",
    oldestDate: 0,
    nodes,
  });
  const tree = {
    rootLabel: "x",
    branches: [mk(["a", "b", "c", "d"].map((label) => ({ id: `n-${label}`, label })))],
  };
  const twoUp = treeLayout(tree, {
    width: 2 * TREE_CARD_WIDTH + TREE_COLUMN_GAP + 100,
  });
  const clad = cladogramPaths(twoUp);
  const elbows = elbowLayerIndexes(twoUp);
  assert.equal(elbows.length, clad.length - 1);
  for (const layer of elbows) assert.equal(layer, 0);
});
