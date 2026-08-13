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
  TREE_ROOT_HEIGHT,
  TREE_ROOT_GAP,
  TREE_LABEL_GAP,
  TREE_DIVERGENCE_STEP,
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

test("treeLayout: cladogram - crown top, even right odd left, deepest-nearest", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  assert.equal(layout.branches.length, 6);
  const trunk = layout.root.cx;
  assert.equal(layout.root.y, 0);
  assert.equal(layout.trunk, trunk);

  const ys = layout.branches.map((branch) => branch.divergenceY);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] > ys[i - 1], "divergence depth strictly increasing");
    assert.equal(ys[i] - ys[i - 1], TREE_DIVERGENCE_STEP);
  }
  assert.equal(ys[0], TREE_ROOT_HEIGHT + TREE_ROOT_GAP);

  layout.branches.forEach((branch, i) => {
    if (i % 2 === 0) {
      assert.ok(branch.cx >= trunk, `even branch ${i} is on the right`);
    } else {
      assert.ok(branch.cx <= trunk, `odd branch ${i} is on the left`);
    }
    for (const card of branch.cards) {
      assert.equal(card.cx, branch.cx);
      assert.equal(card.x, branch.cx - TREE_CARD_WIDTH / 2);
    }
  });

  const right = layout.branches.filter((_, i) => i % 2 === 0);
  const left = layout.branches.filter((_, i) => i % 2 === 1);
  for (let i = 1; i < right.length; i++) {
    assert.ok(
      Math.abs(right[i].cx - trunk) < Math.abs(right[i - 1].cx - trunk),
      "right side deepest-nearest"
    );
  }
  for (let i = 1; i < left.length; i++) {
    assert.ok(
      Math.abs(left[i].cx - trunk) < Math.abs(left[i - 1].cx - trunk),
      "left side deepest-nearest"
    );
  }

  const electronics = layout.branches[2];
  assert.equal(electronics.cards.length, 2);
  assert.equal(
    electronics.cards[1].y - electronics.cards[0].y,
    TREE_CARD_HEIGHT + TREE_CARD_GAP
  );
  assert.equal(electronics.firstCardY, electronics.divergenceY + TREE_LABEL_GAP);

  for (const branch of layout.branches) {
    for (const card of branch.cards) {
      assert.ok(card.x >= 0, "card left edge inside stage");
      assert.ok(card.x + TREE_CARD_WIDTH <= layout.width, "card right edge inside stage");
    }
  }
});

test("treeLayout balances an odd branch count around the trunk", () => {
  const layout = treeLayout({
    rootLabel: "x",
    branches: [0, 1, 2, 3, 4].map((i) => ({
      id: `b${i}`,
      name: `l${i}`,
      oldestDate: i,
      nodes: [{ id: `n${i}`, label: "n" }],
    })),
  });
  const trunk = layout.trunk;
  for (const branch of layout.branches) {
    assert.ok(
      Math.abs(branch.cx - trunk) >= TREE_CARD_WIDTH / 2 + TREE_COLUMN_GAP / 2
    );
  }
  const cxs = layout.branches.map((branch) => branch.cx);
  assert.equal(Math.min(...cxs) - TREE_CARD_WIDTH / 2, 0);
  assert.equal(Math.max(...cxs) + TREE_CARD_WIDTH / 2, layout.width);
});

test("treeLayout centers a single branch on the trunk", () => {
  const layout = treeLayout({
    rootLabel: "x",
    branches: [{ id: "b0", name: "only", oldestDate: 0, nodes: [{ id: "n0", label: "n" }] }],
  });
  assert.equal(layout.branches[0].cx, layout.trunk);
  assert.equal(layout.width, TREE_CARD_WIDTH);
});

test("cladogramPaths: trunk to deepest divergence, one elbow per branch", () => {
  const tree = realityTree(laptopRealityMap);
  const layout = treeLayout(tree);
  const d = cladogramPaths(layout);
  const last = layout.branches[layout.branches.length - 1];
  assert.equal(
    d[0],
    `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${last.divergenceY}`
  );
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
  assert.equal(d.length, at);
});

test("treeLayout handles an empty tree (no branches)", () => {
  const layout = treeLayout({ rootLabel: "laptop", branches: [] });
  assert.equal(layout.branches.length, 0);
  assert.ok(layout.height >= layout.root.height + 16);
  assert.deepEqual(cladogramPaths(layout), []);
});

test("cladogramPaths: stacked cards get in-column connectors", () => {
  const layout = treeLayout({
    rootLabel: "x",
    branches: [
      {
        id: "b0",
        name: "layer 0",
        oldestDate: 0,
        nodes: [
          { id: "n0", label: "a" },
          { id: "n1", label: "b" },
        ],
      },
    ],
  });
  const d = cladogramPaths(layout);
  assert.equal(d.length, 3);
  const branch = layout.branches[0];
  assert.equal(
    d[2],
    `M ${branch.cx} ${branch.cards[0].y + TREE_CARD_HEIGHT} V ${branch.cards[1].y}`
  );
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
