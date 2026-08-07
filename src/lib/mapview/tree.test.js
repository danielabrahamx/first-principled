import { test } from "node:test";
import assert from "node:assert/strict";

import { realityTree, treeLayout, cladogramPaths } from "./tree.js";
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

test("treeLayout places the root centered above evenly spaced branch columns", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  assert.equal(layout.root.cx, layout.width / 2);
  assert.equal(layout.branches.length, 6);
  // Branch column centers step by one card width plus the column gap.
  assert.equal(layout.branches[1].cx - layout.branches[0].cx, 280 + 32);
  // The branch line sits below the root card, and cards start below the label.
  assert.ok(layout.branchLineY > layout.root.y + layout.root.height);
  assert.ok(layout.branches[0].firstCardY > layout.branchLineY);
  // Cards stack downward inside a branch.
  const first = layout.branches[3];
  assert.equal(first.cards.length, 2);
  assert.equal(first.cards[1].y - first.cards[0].y, 64 + 12);
});

test("treeLayout handles an empty tree (no branches)", () => {
  const layout = treeLayout({ rootLabel: "laptop", branches: [] });
  assert.equal(layout.branches.length, 0);
  assert.ok(layout.height >= layout.root.height + 16);
  assert.deepEqual(cladogramPaths(layout), []);
});

test("cladogramPaths draws a trunk, a branch line, and a drop per branch", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  const d = cladogramPaths(layout);
  // Trunk + branch line + one drop per branch + the in-branch card connectors.
  const drops = layout.branches.length;
  const connectors = layout.branches.reduce(
    (sum, branch) => sum + Math.max(0, branch.cards.length - 1),
    0
  );
  assert.equal(d.length, 2 + drops + connectors);
  // Every path starts at a move and contains a vertical segment (elbow style).
  for (const path of d) {
    assert.match(path, /^M /);
    assert.match(path, / V | H /);
  }
});
