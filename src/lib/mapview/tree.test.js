import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  cladogramPaths,
  convergenceFanPaths,
  TREE_CARD_WIDTH,
  TREE_CARD_HEIGHT,
  TREE_CARD_GAP,
  TREE_COLUMN_GAP,
  TREE_ROOT_GAP,
  TREE_LABEL_GAP,
  TREE_BRANCH_GAP,
  TREE_TWO_UP_MIN_WIDTH,
  TREE_TWO_UP_MIN_NODES,
} from "./tree.js";
import { laptopRealityMap, llmRealityMap } from "../mmg/fixtures.js";

test("realityTree roots on the concept word and orders layers chronologically", () => {
  const tree = realityTree(laptopRealityMap);
  assert.equal(tree.rootLabel, "laptop");
  // Layers order by their oldest observation date, oldest at the bottom
  // (nearest the foundation). Apps 1979 tops the crown; physics 600 BC is the
  // deepest foundation.
  assert.deepEqual(
    tree.branches.map((branch) => branch.name),
    ["apps", "OS", "electronics", "logic", "materials", "physics"]
  );
  // Within a layer, cards sort oldest first.
  assert.deepEqual(
    tree.branches[2].nodes.map((node) => node.label),
    ["transistor", "circuit"]
  );
  assert.deepEqual(
    tree.branches[3].nodes.map((node) => node.label),
    ["logic gate", "bit"]
  );
});

test("realityTree sorts cards oldest-first and unknowns last, stable", () => {
  const map = {
    concept: "x",
    layers: [
      { id: "l0", name: "base", nodes: ["n3", "n2", "n1"] },
    ],
    nodes: [
      { id: "n1", label: "newest", layer: "l0", basis: { date: { value: "1950", mark: "EXACT" }, keyObservation: { value: "k", mark: "EXACT" } } },
      { id: "n2", label: "oldest", layer: "l0", basis: { date: { value: "1800", mark: "EXACT" }, keyObservation: { value: "k", mark: "EXACT" } } },
      { id: "n3", label: "unknown date", layer: "l0" },
    ],
    edges: [],
  };
  const tree = realityTree(/** @type {any} */ (map));
  assert.deepEqual(
    tree.branches[0].nodes.map((node) => node.label),
    ["oldest", "newest", "unknown date"]
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

test("treeLayout: vertical path - root top, trunk center, layers as centered bands", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree, { width: 375 });
  assert.equal(layout.width, 375);
  const trunk = layout.root.cx;
  assert.equal(trunk, 375 / 2);
  assert.equal(layout.root.x, trunk - layout.root.width / 2);
  assert.equal(layout.root.y, 0);

  assert.equal(layout.branches.length, 6);
  // Divergence depths increase down the tree: each layer hangs below the one
  // above it (oldest at the bottom, nearest the foundation).
  const ys = layout.branches.map((branch) => branch.divergenceY);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] > ys[i - 1], "divergence depth strictly increasing");
  }
  assert.equal(ys[0], layout.root.y + layout.root.height + TREE_ROOT_GAP);

  // Every layer is a single column centered on the trunk at this width.
  for (const branch of layout.branches) {
    assert.equal(branch.cx, trunk);
    for (const card of branch.cards) {
      assert.equal(card.cx, trunk);
      assert.equal(card.x, trunk - TREE_CARD_WIDTH / 2);
    }
  }

  // Cards stack downward inside a band.
  const electronics = layout.branches[2];
  assert.equal(electronics.cards.length, 2);
  assert.equal(electronics.cards[1].y - electronics.cards[0].y, TREE_CARD_HEIGHT + TREE_CARD_GAP);

  // Bands are separated by the branch gap.
  for (let i = 1; i < layout.branches.length; i++) {
    const prevLast = layout.branches[i - 1].cards[layout.branches[i - 1].cards.length - 1];
    assert.equal(
      layout.branches[i].divergenceY,
      prevLast.y + TREE_CARD_HEIGHT + TREE_BRANCH_GAP
    );
  }

  // No card overflows the stage horizontally (the 375px bar).
  for (const branch of layout.branches) {
    for (const card of branch.cards) {
      assert.ok(card.x >= 0, "card left edge inside stage");
      assert.ok(card.x + TREE_CARD_WIDTH <= layout.width, "card right edge inside stage");
    }
  }
});

test("treeLayout: layers with 4+ nodes fan two-up on desktop, trunk stays centered", () => {
  /** @param {number} i */
  const mk = (i) => ({
    id: `b${i}`,
    name: `layer ${i}`,
    oldestDate: i,
    nodes: [
      { id: `n${i}-0`, label: "a" },
      { id: `n${i}-1`, label: "b" },
      { id: `n${i}-2`, label: "c" },
      { id: `n${i}-3`, label: "d" },
    ],
  });
  const layout = treeLayout(
    { rootLabel: "x", branches: [mk(0)] },
    { width: 2 * TREE_CARD_WIDTH + TREE_COLUMN_GAP + 100 }
  );
  const trunk = layout.root.cx;
  assert.equal(layout.branches[0].cards.length, 4);
  const cxs = layout.branches[0].cards.map((card) => card.cx);
  // Two columns flank the trunk; the trunk stays centered between them.
  assert.equal(new Set(cxs).size, 2);
  assert.equal(cxs[0], cxs[1], "first half shares the left column");
  assert.equal(cxs[2], cxs[3], "second half shares the right column");
  const left = Math.min(...cxs);
  const right = Math.max(...cxs);
  assert.ok(left < trunk && right > trunk, "columns flank the trunk");
  assert.equal((trunk - left), (right - trunk), "trunk centered between columns");
  // No overflow.
  for (const card of layout.branches[0].cards) {
    assert.ok(card.x >= 0);
    assert.ok(card.x + TREE_CARD_WIDTH <= layout.width);
  }
});

test("treeLayout: 1-up below the two-up threshold even for 4+ node layers", () => {
  /** @param {number} i */
  const mk = (i) => ({
    id: `b${i}`,
    name: `layer ${i}`,
    oldestDate: i,
    nodes: [
      { id: `n${i}-0`, label: "a" },
      { id: `n${i}-1`, label: "b" },
      { id: `n${i}-2`, label: "c" },
      { id: `n${i}-3`, label: "d" },
    ],
  });
  const layout = treeLayout(
    { rootLabel: "x", branches: [mk(0)] },
    { width: TREE_TWO_UP_MIN_WIDTH }
  );
  const trunk = layout.root.cx;
  for (const card of layout.branches[0].cards) {
    assert.equal(card.cx, trunk);
  }
});

test("treeLayout handles an empty tree (no branches)", () => {
  const layout = treeLayout({ rootLabel: "laptop", branches: [] });
  assert.equal(layout.branches.length, 0);
  assert.ok(layout.height >= layout.root.height + 16);
  assert.deepEqual(cladogramPaths(layout), []);
});

test("cladogramPaths: one vertical trunk, one elbow per two-up column", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree, { width: 375 });
  const d = cladogramPaths(layout);

  // Single-column layers sit on the trunk, so the trunk is the only path at
  // 1-up (no off-trunk elbows).
  assert.equal(d.length, 1);
  const lastBottom = Math.max(
    ...layout.branches.map((branch) =>
      Math.max(...branch.cards.map((card) => card.y + TREE_CARD_HEIGHT))
    )
  );
  assert.equal(d[0], `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${lastBottom}`);
});

test("cladogramPaths: two-up layers get elbows out to each column plus card connectors", () => {
  /** @param {number} i */
  const mk = (i) => ({
    id: `b${i}`,
    name: `layer ${i}`,
    oldestDate: i,
    nodes: [
      { id: `n${i}-0`, label: "a" },
      { id: `n${i}-1`, label: "b" },
      { id: `n${i}-2`, label: "c" },
      { id: `n${i}-3`, label: "d" },
    ],
  });
  const layout = treeLayout(
    { rootLabel: "x", branches: [mk(0)] },
    { width: 2 * TREE_CARD_WIDTH + TREE_COLUMN_GAP + 100 }
  );
  const d = cladogramPaths(layout);
  // Trunk + two elbows (left and right column) + one in-column connector per
  // column (2 cards each).
  assert.equal(d.length, 1 + 2 + 2);
  // Trunk descends to the deepest card bottom.
  const lastBottom = Math.max(...layout.branches[0].cards.map((card) => card.y + TREE_CARD_HEIGHT));
  assert.ok(d[0].endsWith(`V ${lastBottom}`));
  // Elbows leave the trunk at the divergence depth toward each column.
  const trunk = layout.root.cx;
  const elbows = d.slice(1);
  const cxs = [...new Set(layout.branches[0].cards.map((card) => card.cx))];
  for (const cx of cxs) {
    assert.ok(elbows.some((path) => path === `M ${trunk} ${layout.branches[0].divergenceY} H ${cx} V ${layout.branches[0].firstCardY}`));
  }
});

// --- convergence nodes (ticket 13) -------------------------------------------

test("realityTree records the distinct-layer count of a convergence node", () => {
  const tree = realityTree(llmRealityMap);
  const branches = tree.branches.map((branch) => ({
    name: branch.name,
    nodes: branch.nodes.map((node) => ({ id: node.id, combines: node.combines })),
  }));
  const transformerBranch = branches.find((branch) =>
    branch.nodes.some((node) => node.id === "n-transformer")
  );
  assert.ok(transformerBranch, "the transformer branch exists");
  const transformer = transformerBranch.nodes.find((node) => node.id === "n-transformer");
  assert.ok(transformer, "the transformer node exists");
  assert.equal(transformer.combines, 3, "the transformer combines 3 distinct layers");
  // Non-convergence nodes carry zero.
  for (const branch of branches) {
    for (const node of branch.nodes) {
      if (node.id !== "n-transformer") {
        assert.equal(node.combines, 0, `${node.id} is not a convergence node`);
      }
    }
  }
});

test("realityTree reports zero combines for an ordinary map", () => {
  const tree = realityTree(laptopRealityMap);
  for (const branch of tree.branches) {
    for (const node of branch.nodes) {
      assert.equal(node.combines, 0);
    }
  }
});

test("convergenceFanPaths emits one fan per convergence node with one stroke per combined field", () => {
  const tree = realityTree(llmRealityMap);
  const layout = treeLayout(tree, { width: 1024 });
  const fans = convergenceFanPaths(layout);
  assert.equal(fans.length, 1, "one convergence node");
  assert.equal(fans[0].id, "n-transformer");
  // The fan is 3 strokes (one per combined field), each a rising diagonal.
  const strokes = fans[0].d.split(" M ").filter((s) => s.length > 0);
  assert.equal(strokes.length, 3);
  for (const stroke of strokes) {
    assert.match(stroke, /L .+/, "each stroke rises into the node");
  }
});

test("convergenceFanPaths is empty for a map with no convergence nodes", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree, { width: 1024 });
  assert.deepEqual(convergenceFanPaths(layout), []);
});

test("convergenceFanPaths is empty when a layout card has fewer than 2 combined fields", () => {
  const layout = treeLayout(
    {
      rootLabel: "x",
      branches: [
        {
          id: "b0",
          name: "layer",
          oldestDate: 0,
          nodes: [
            { id: "n1", label: "a", combines: 1 },
            { id: "n2", label: "b", combines: 0 },
          ],
        },
      ],
    },
    { width: 1024 }
  );
  assert.deepEqual(convergenceFanPaths(layout), []);
});
