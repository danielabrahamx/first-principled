import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, llmRealityMap } from "./sample-map.js";
import { dependenceRanks, layoutEdges, treeLayout, spinePaths } from "./tree.js";

test("layout edges ignore part-of and predicts", () => {
  const types = layoutEdges(laptopRealityMap).map((edge) => edge.type);
  assert.ok(types.every((type) => ["built-on", "depends-on", "abstraction-of"].includes(type)));
  assert.equal(types.includes("part-of"), false);
  assert.equal(types.includes("predicts"), false);
});

test("laptop ranks: electricity below silicon below transistor", () => {
  const ranks = dependenceRanks(laptopRealityMap);
  assert.ok(ranks.get("n-electricity") < ranks.get("n-silicon"));
  assert.ok(ranks.get("n-silicon") < ranks.get("n-transistor"));
  assert.ok(ranks.get("n-transistor") < ranks.get("n-circuit"));
});

test("treeLayout: electricity sits below transistor (and below silicon)", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const y = (id) => layout.cardById.get(id).y;
  assert.ok(y("n-electricity") > y("n-silicon"), "electricity below silicon");
  assert.ok(y("n-silicon") > y("n-transistor"), "silicon below transistor");
  assert.ok(y("n-transistor") > y("n-circuit"), "transistor below circuit");
  assert.equal(layout.root.y, 0, "crown at the top");
});

test("dates are not the layout sort", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const y = (id) => layout.cardById.get(id).y;
  // Boole 1847 is earlier than Shockley 1947, but logic-gate built-on circuit
  // built-on transistor, so the gate sits above the transistor.
  assert.ok(y("n-logic-gate") < y("n-transistor"));
  const swapped = {
    ...laptopRealityMap,
    nodes: laptopRealityMap.nodes.map((node) =>
      node.id === "n-electricity"
        ? { ...node, date: "9999" }
        : node.id === "n-transistor"
          ? { ...node, date: "1" }
          : node
    ),
  };
  const after = treeLayout(swapped, { width: 375 });
  assert.equal(after.cardById.get("n-electricity").y, layout.cardById.get("n-electricity").y);
  assert.equal(after.cardById.get("n-transistor").y, layout.cardById.get("n-transistor").y);
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

test("layers are named bands, not left/right columns", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  assert.deepEqual(
    layout.bands.map((band) => band.name),
    ["physics", "materials", "electronics", "logic", "OS", "apps"]
  );
  const spineCx = new Set(layout.cards.filter((card) => !card.rib).map((card) => card.cx));
  assert.equal(spineCx.size, 1, "on-spine cards share one x");
});

test("llm transformer: extra parents sit as ribs, not a wide column", () => {
  const layout = treeLayout(llmRealityMap, { width: 375 });
  const transformer = layout.cardById.get("n-transformer");
  assert.equal(transformer.combines, 3);
  const ribs = layout.cards.filter((card) => card.rib);
  assert.ok(ribs.length >= 2, "at least two rib parents");
  const span = Math.max(...layout.cards.map((c) => c.x + c.width)) - Math.min(...layout.cards.map((c) => c.x));
  assert.ok(span < 375, "rib span is short, not a cladogram column set");
  const paths = spinePaths(layout);
  assert.ok(paths.some((d) => d.includes("H ")), "rib elbows use a horizontal run");
});
