import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  cladogramPaths,
  TREE_CARD_WIDTH,
  TREE_CARD_HEIGHT,
  TREE_CARD_GAP,
  TREE_COLUMN_GAP,
  TREE_ROOT_GAP,
  TREE_LABEL_GAP,
  TREE_DIVERGENCE_STEP,
} from "./tree.js";
import { laptopRealityMap } from "../mmg/fixtures.js";

test("realityTree roots on the concept word and branches on layers, top layer first", () => {
  const tree = realityTree(laptopRealityMap);
  assert.equal(tree.rootLabel, "laptop");
  assert.deepEqual(
    tree.branches.map((branch) => branch.name),
    ["apps", "OS", "logic", "electronics", "materials", "physics"]
  );
  assert.deepEqual(
    tree.branches[0].nodes.map((node) => node.label),
    ["application"]
  );
  assert.deepEqual(
    tree.branches[3].nodes.map((node) => node.label),
    ["transistor", "circuit"]
  );
});

test("realityTree is null-safe and falls back on a missing concept", () => {
  assert.deepEqual(realityTree(null), { rootLabel: "", branches: [] });
  assert.deepEqual(realityTree(undefined), { rootLabel: "", branches: [] });
  assert.deepEqual(realityTree(/** @type {any} */ ({ layers: [] })), {
    rootLabel: "",
    branches: [],
  });
});

test("treeLayout: root above a central trunk, branches at successive divergence depths", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  assert.equal(layout.root.cx, layout.width / 2);
  assert.equal(layout.branches.length, 6);

  // Divergence depths step per layer: the top layer (apps) diverges highest
  // (nearest the crown), the deepest foundation (physics) lowest - the
  // chronological reading.
  const ys = layout.branches.map((branch) => branch.divergenceY);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] > ys[i - 1], "divergence depth strictly increasing");
    assert.equal(ys[i] - ys[i - 1], TREE_DIVERGENCE_STEP);
  }
  assert.ok(ys[0] > layout.root.y + layout.root.height);
  assert.equal(ys[0] - (layout.root.y + layout.root.height), TREE_ROOT_GAP);

  // Branch labels sit at the divergence points (strictly increasing label Y
  // from branch 0 to branch 5 - the CDP acceptance check); cards hang below
  // the label.
  for (const branch of layout.branches) {
    assert.equal(branch.labelY, branch.divergenceY + 10);
    assert.equal(branch.firstCardY, branch.divergenceY + TREE_LABEL_GAP);
  }
  for (let i = 1; i < layout.branches.length; i++) {
    assert.ok(layout.branches[i].labelY > layout.branches[i - 1].labelY);
  }

  // Branch columns alternate left and right around the trunk, and on each
  // side the deepest branch sits nearest the trunk.
  const trunk = layout.root.cx;
  assert.ok(layout.branches[0].cx > trunk);
  assert.ok(layout.branches[1].cx < trunk);
  /** @param {{ cx: number }} branch */
  const dist = (branch) => Math.abs(branch.cx - trunk);
  assert.ok(dist(layout.branches[5]) < dist(layout.branches[3]));
  assert.ok(dist(layout.branches[3]) < dist(layout.branches[1]));
  assert.ok(dist(layout.branches[4]) < dist(layout.branches[2]));
  assert.ok(dist(layout.branches[2]) < dist(layout.branches[0]));

  // Columns keep the horizontal spread: 280-wide cards, 32px gaps.
  const cxs = layout.branches.map((branch) => branch.cx).sort((a, b) => a - b);
  for (let i = 1; i < cxs.length; i++) {
    assert.equal(cxs[i] - cxs[i - 1], TREE_CARD_WIDTH + TREE_COLUMN_GAP);
  }

  // No elbow crosses another branch's cards: on each side of the trunk every
  // branch diverges above the first card of every branch nearer the trunk.
  for (let i = 0; i < layout.branches.length; i++) {
    for (let j = 0; j < layout.branches.length; j++) {
      if (i === j || i % 2 !== j % 2) continue;
      const a = layout.branches[i];
      const b = layout.branches[j];
      if (dist(b) < dist(a)) {
        assert.ok(
          a.divergenceY < b.firstCardY,
          `branch ${a.name} elbow must pass above ${b.name}'s cards`
        );
      }
    }
  }

  // Cards stack downward inside a branch.
  const electronics = layout.branches[3];
  assert.equal(electronics.cards.length, 2);
  assert.equal(electronics.cards[1].y - electronics.cards[0].y, TREE_CARD_HEIGHT + TREE_CARD_GAP);
});

test("treeLayout balances an odd branch count around the trunk", () => {
  /** @param {number} i */
  const mk = (i) => ({
    id: `b${i}`,
    name: `layer ${i}`,
    nodes: [{ id: `n${i}`, label: `node ${i}` }],
  });
  const layout = treeLayout({
    rootLabel: "x",
    branches: [mk(0), mk(1), mk(2), mk(3), mk(4)],
  });
  const trunk = layout.root.cx;
  // The trunk lane stays clear of every column (odd count = empty center
  // lane), and the box is balanced: columns span the full width.
  for (const branch of layout.branches) {
    assert.ok(Math.abs(branch.cx - trunk) >= TREE_CARD_WIDTH / 2 + TREE_COLUMN_GAP / 2);
  }
  const cxs = layout.branches.map((branch) => branch.cx);
  assert.equal(Math.min(...cxs) - TREE_CARD_WIDTH / 2, 0);
  assert.equal(Math.max(...cxs) + TREE_CARD_WIDTH / 2, layout.width);
  // Divergence depths still step per layer, strictly increasing.
  const ys = layout.branches.map((branch) => branch.divergenceY);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1]);
});

test("treeLayout centers a single branch on the trunk", () => {
  const layout = treeLayout({
    rootLabel: "x",
    branches: [{ id: "b", name: "layer", nodes: [{ id: "n", label: "node" }] }],
  });
  assert.equal(layout.width, TREE_CARD_WIDTH);
  assert.equal(layout.branches[0].cx, layout.root.cx);
  assert.equal(layout.branches[0].cx, layout.width / 2);
});

test("treeLayout handles an empty tree (no branches)", () => {
  const layout = treeLayout({ rootLabel: "laptop", branches: [] });
  assert.equal(layout.branches.length, 0);
  assert.ok(layout.height >= layout.root.height + 16);
  assert.deepEqual(cladogramPaths(layout), []);
});

test("cladogramPaths: trunk to the deepest divergence, one elbow per branch", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  const d = cladogramPaths(layout);

  const connectors = layout.branches.reduce(
    (sum, branch) => sum + Math.max(0, branch.cards.length - 1),
    0
  );
  assert.equal(d.length, 1 + layout.branches.length + connectors);

  // Trunk: root card bottom down to the deepest branch's divergence point.
  const last = layout.branches[layout.branches.length - 1];
  assert.equal(
    d[0],
    `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${last.divergenceY}`
  );

  // Then, per branch in order: its elbow (from the trunk at its own
  // divergence depth, across to its column, down into its cards) followed by
  // the in-branch card connectors.
  let at = 1;
  for (const branch of layout.branches) {
    assert.equal(
      d[at],
      `M ${layout.root.cx} ${branch.divergenceY} H ${branch.cx} V ${branch.firstCardY}`
    );
    at += 1;
    for (let j = 1; j < branch.cards.length; j++) {
      const prev = branch.cards[j - 1];
      const card = branch.cards[j];
      assert.equal(d[at], `M ${branch.cx} ${prev.y + TREE_CARD_HEIGHT} V ${card.y}`);
      at += 1;
    }
  }
  assert.equal(at, d.length);

  // Every path is a move (elbow style throughout).
  for (const path of d) assert.match(path, /^M /);
});

test("cladogramPaths: a single branch still gets a trunk and a drop", () => {
  const layout = treeLayout({
    rootLabel: "x",
    branches: [{ id: "b", name: "layer", nodes: [{ id: "n", label: "node" }] }],
  });
  const d = cladogramPaths(layout);
  assert.equal(d.length, 2);
  assert.ok(d[0].endsWith(`V ${layout.branches[0].divergenceY}`));
  assert.ok(d[1].endsWith(`V ${layout.branches[0].firstCardY}`));
});
