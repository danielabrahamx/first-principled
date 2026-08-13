import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  spinePaths,
  layoutEdges,
  dependenceRanks,
  convergenceFanPaths,
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

test("320 and 375: stage width equals the viewport, cards stay inside", () => {
  for (const width of [320, 375]) {
    const layout = treeLayout(laptopRealityMap, { width });
    assert.equal(layout.width, width);
    for (const card of layout.cards) {
      assert.ok(card.x >= 0, `${card.id} left`);
      assert.ok(card.x + card.width <= layout.width + 0.01, `${card.id} right`);
    }
    assert.ok(layout.root.x >= 0);
    assert.ok(layout.root.x + layout.root.width <= layout.width + 0.01);
  }
});

test("layers are named bands on one spine, not left/right columns", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  assert.deepEqual(
    layout.branches.map((branch) => branch.name),
    ["apps", "OS", "logic", "electronics", "materials", "physics"]
  );
  const spineCx = new Set(layout.cards.filter((card) => !card.rib).map((card) => card.cx));
  assert.equal(spineCx.size, 1);
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

test("llm transformer extra parents sit as ribs, not a wide column", () => {
  const layout = treeLayout(llmRealityMap, { width: 375 });
  assert.equal(layout.cardById.get("n-transformer")?.combines, 3);
  const ribs = layout.cards.filter((card) => card.rib);
  assert.ok(ribs.length >= 2);
  const span =
    Math.max(...layout.cards.map((c) => c.x + c.width)) -
    Math.min(...layout.cards.map((c) => c.x));
  assert.ok(span < 375);
  assert.ok(spinePaths(layout).some((d) => d.includes("H ")));
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
