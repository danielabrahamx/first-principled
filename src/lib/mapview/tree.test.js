import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  spinePaths,
  layoutEdges,
  dependenceRanks,
  convergenceFanPaths,
  TREE_CARD_WIDTH,
  TREE_STAGE_PAD,
  TREE_LABEL_SLOT,
} from "./tree.js";
import { laptopRealityMap, llmRealityMap } from "../mmg/fixtures.js";

test("layout edges ignore part-of and predicts", () => {
  const types = layoutEdges(laptopRealityMap).map((edge) => edge.type);
  assert.ok(types.every((type) => ["built-on", "depends-on", "abstraction-of"].includes(type)));
  assert.equal(types.includes("part-of"), false);
  assert.equal(types.includes("predicts"), false);
});

test("realityTree roots on the concept and keeps layer chain order, not dates", () => {
  const tree = realityTree(laptopRealityMap);
  assert.equal(tree.rootLabel, "laptop");
  assert.deepEqual(
    tree.branches.map((branch) => branch.name),
    ["apps", "OS", "logic", "electronics", "materials", "physics"]
  );
  assert.deepEqual(
    tree.branches.find((b) => b.name === "electronics")?.nodes.map((n) => n.label),
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

test("treeLayout: electricity sits below transistor (and below silicon)", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const y = (/** @type {string} */ id) => {
    const card = layout.cardById.get(id);
    assert.ok(card, id);
    return card.y;
  };
  assert.equal(layout.root.y, 0);
  assert.ok(y("n-electricity") > y("n-silicon"), "electricity below silicon");
  assert.ok(y("n-silicon") > y("n-transistor"), "silicon below transistor");
  assert.ok(y("n-transistor") > y("n-circuit"), "transistor below circuit");
  const ranks = dependenceRanks(laptopRealityMap);
  assert.ok((ranks.get("n-electricity") ?? 0) < (ranks.get("n-transistor") ?? 0));
});

test("dates are not the layout sort", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const y = (/** @type {string} */ id) => {
    const card = layout.cardById.get(id);
    assert.ok(card, id);
    return card.y;
  };
  assert.ok(y("n-logic-gate") < y("n-transistor"), "edge order beats Boole 1847 vs Shockley 1947");
  const swapped = {
    ...laptopRealityMap,
    nodes: laptopRealityMap.nodes.map((node) => {
      if (node.id === "n-electricity") {
        return { ...node, basis: { .../** @type {any} */ (node).basis, date: { value: "9999", mark: "EXACT" } } };
      }
      if (node.id === "n-transistor") {
        return { ...node, basis: { .../** @type {any} */ (node).basis, date: { value: "1", mark: "EXACT" } } };
      }
      return node;
    }),
  };
  const after = treeLayout(swapped, { width: 375 });
  assert.equal(after.cardById.get("n-electricity")?.y, layout.cardById.get("n-electricity")?.y);
  assert.equal(after.cardById.get("n-transistor")?.y, layout.cardById.get("n-transistor")?.y);
});

test("320 and 375: cards stay inside the stage", () => {
  for (const width of [320, 375]) {
    const layout = treeLayout(laptopRealityMap, { width });
    assert.ok(layout.width >= width - 0.01);
    for (const card of layout.cards) {
      assert.ok(card.x >= 0, `${card.id} left`);
      assert.ok(card.x + card.width <= layout.width + 0.01, `${card.id} right`);
    }
    assert.ok(layout.root.x + layout.root.width <= layout.width + 0.01);
  }
});

test("a linear chain hangs off one side of a continuous trunk", () => {
  const layout = treeLayout(laptopRealityMap, { width: 1024 });
  assert.deepEqual(
    layout.branches.map((branch) => branch.name),
    ["apps", "OS", "logic", "electronics", "materials", "physics"]
  );
  const xs = new Set(layout.cards.map((card) => card.cx));
  assert.equal(xs.size, 1, "one hang column");
  const hang = layout.cards[0];
  assert.ok(hang);
  assert.ok(Math.abs(hang.cx - layout.trunk) > hang.width / 2 - 1, "cards do not sit on the trunk");
  const paths = spinePaths(layout);
  assert.ok(paths[0]?.includes(`M ${layout.trunk}`));
  assert.ok(paths[0]?.includes("V "));
  assert.equal(paths.length, 1 + layout.cards.length, "trunk plus one elbow per card");
  assert.ok(paths.slice(1).every((d) => d.includes("H ")));
});

test("treeLayout handles an empty tree", () => {
  const layout = treeLayout({ concept: "laptop", layers: [], nodes: [], edges: [] });
  assert.equal(layout.branches.length, 0);
  assert.ok(layout.height >= layout.root.height + 16);
  assert.deepEqual(spinePaths(layout), []);
});

test("realityTree records the distinct-layer count of a convergence node", () => {
  const tree = realityTree(llmRealityMap);
  const transformer = tree.branches
    .flatMap((branch) => branch.nodes)
    .find((node) => node.id === "n-transformer");
  assert.ok(transformer);
  assert.equal(transformer?.combines, 3);
  for (const branch of tree.branches) {
    for (const node of branch.nodes) {
      if (node.id !== "n-transformer") assert.equal(node.combines, 0);
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

test("convergence parents occupy full columns, not 44px ribs", () => {
  const layout = treeLayout(llmRealityMap, { width: 1024 });
  assert.equal(layout.cardById.get("n-transformer")?.combines, 3);
  const transformer = layout.cardById.get("n-transformer");
  const attention = layout.cardById.get("n-attention");
  const embedding = layout.cardById.get("n-embedding");
  const turing = layout.cardById.get("n-turing");
  assert.ok(transformer && attention && embedding && turing);
  const parentXs = [attention.cx, embedding.cx, turing.cx];
  assert.equal(new Set(parentXs).size, 3, "three parents sit in three columns");
  const spread = Math.max(...parentXs) - Math.min(...parentXs);
  assert.ok(spread >= transformer.width, `branch spread ${spread} should clear one card`);
  assert.ok(Math.abs(attention.cx - transformer.cx) < 1, "main parent continues the hang column");
  const span =
    Math.max(...layout.cards.map((c) => c.x + c.width)) -
    Math.min(...layout.cards.map((c) => c.x));
  assert.ok(span > 375, "branches may be wider than a phone viewport");
  const attach =
    embedding.cx >= layout.trunk ? embedding.x : embedding.x + embedding.width;
  const paths = spinePaths(layout);
  assert.ok(paths.some((d) => d.includes("H ")));
  assert.ok(
    paths.some((d) => d.includes(`H ${attach}`)),
    "an elbow reaches the extra parent column"
  );
});

test("convergenceFanPaths emits one fan per convergence node", () => {
  const layout = treeLayout(llmRealityMap, { width: 1024 });
  const fans = convergenceFanPaths(layout);
  assert.equal(fans.length, 1);
  assert.equal(fans[0].id, "n-transformer");
  const strokes = fans[0].d.split(" M ").filter((s) => s.length > 0);
  assert.equal(strokes.length, 3);
});

test("convergenceFanPaths is empty for a map with no convergence nodes", () => {
  const layout = treeLayout(laptopRealityMap, { width: 1024 });
  assert.deepEqual(convergenceFanPaths(layout), []);
});

test("layer captions stay on their hang and do not share a box", () => {
  const map = {
    concept: "computer",
    layers: [
      { id: "l0", name: "electronic and sequential logic", nodes: ["n-left"] },
      { id: "l1", name: "sequential circuits and microarchitecture", nodes: ["n-right"] },
      { id: "l2", name: "machine", nodes: ["n-top"] },
    ],
    nodes: [
      { id: "n-left", label: "OR Gate", layer: "l0" },
      { id: "n-right", label: "NOT Gate", layer: "l1" },
      { id: "n-top", label: "CPU", layer: "l2" },
    ],
    edges: [
      { source: "n-top", target: "n-left", type: "built-on" },
      { source: "n-top", target: "n-right", type: "built-on" },
    ],
  };
  const layout = treeLayout(/** @type {any} */ (map), { width: 1024 });
  const left = layout.branches.find((branch) => branch.id === "l0");
  const right = layout.branches.find((branch) => branch.id === "l1");
  assert.ok(left && right);
  assert.equal(left.labelWidth, layout.cardWidth);
  assert.equal(right.labelWidth, layout.cardWidth);
  assert.equal(left.labelY + TREE_LABEL_SLOT, left.firstCardY);
  assert.equal(right.labelY + TREE_LABEL_SLOT, right.firstCardY);
  assert.equal(left.labelY, right.labelY);
  assert.notEqual(left.labelX, right.labelX);
  assert.equal(left.labelX, left.cards[0].x);
  assert.equal(right.labelX, right.cards[0].x);
  const sides = [left.cards[0].cx < layout.trunk, right.cards[0].cx < layout.trunk];
  assert.notEqual(sides[0], sides[1], "same-rank parents occupy opposite hangs");
  for (const branch of [left, right]) {
    const card = branch.cards[0];
    if (card.cx < layout.trunk) {
      assert.ok(branch.labelX + branch.labelWidth <= layout.trunk + 1, `${branch.id} stays on the left hang`);
    } else {
      assert.ok(branch.labelX >= layout.trunk - 1, `${branch.id} stays on the right hang`);
    }
  }
});

test("a linear chain gives each layer caption its own y", () => {
  const layout = treeLayout(laptopRealityMap, { width: 1024 });
  const ys = layout.branches.map((branch) => branch.labelY);
  assert.equal(new Set(ys).size, ys.length);
});

test("a single-column tree fits the viewport at 375 and 320 with no horizontal overflow", () => {
  const map = {
    concept: "computer",
    layers: [
      { id: "l0", name: "logic", nodes: ["n-a"] },
      { id: "l1", name: "circuit", nodes: ["n-b"] },
      { id: "l2", name: "machine", nodes: ["n-c"] },
    ],
    nodes: [
      { id: "n-a", label: "gate", layer: "l0" },
      { id: "n-b", label: "circuit board", layer: "l1" },
      { id: "n-c", label: "CPU", layer: "l2" },
    ],
    edges: [
      { source: "n-b", target: "n-a", type: "built-on" },
      { source: "n-c", target: "n-b", type: "built-on" },
    ],
  };
  for (const viewport of [375, 320]) {
    const layout = treeLayout(/** @type {any} */ (map), { width: viewport });
    assert.equal(layout.width, viewport, `stage equals the viewport at ${viewport}px`);
    assert.ok(layout.cardWidth < TREE_CARD_WIDTH, `cards shrink at ${viewport}px`);
    const maxRight = Math.max(...layout.branches.flatMap((branch) => branch.cards.map((card) => card.x + card.width)));
    assert.ok(maxRight + TREE_STAGE_PAD <= viewport, `every card is fully on-stage at ${viewport}px (maxRight ${maxRight})`);
  }
});
