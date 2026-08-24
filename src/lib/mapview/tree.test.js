import { test } from "node:test";
import assert from "node:assert/strict";

import {
  realityTree,
  treeLayout,
  spinePaths,
  layoutEdges,
  dependenceRanks,
  convergenceFanPaths,
  isCardNode,
  arrowHoverFromBasis,
  TREE_CARD_WIDTH,
  TREE_STAGE_PAD,
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

test("treeLayout: electricity sits above transistor (crown at the bottom)", () => {
  const layout = treeLayout(laptopRealityMap, { width: 375 });
  const y = (/** @type {string} */ id) => {
    const card = layout.cardById.get(id);
    assert.ok(card, id);
    return card.y;
  };
  assert.ok(layout.root.y > y("n-electricity"), "crown below foundations");
  assert.ok(y("n-electricity") < y("n-silicon"), "electricity above silicon");
  assert.ok(y("n-silicon") < y("n-transistor"), "silicon above transistor");
  assert.ok(y("n-transistor") < y("n-circuit"), "transistor above circuit");
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
  assert.ok(y("n-logic-gate") > y("n-transistor"), "edge order beats Boole 1847 vs Shockley 1947");
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
      assert.ok(card.tag, `${card.id} has a layer tag`);
      assert.equal(typeof card.gloss, "string");
    }
    assert.ok(layout.root.x + layout.root.width <= layout.width + 0.01);
  }
});

test("a linear chain sits on the spine, not a hanging cladogram", () => {
  const layout = treeLayout(laptopRealityMap, { width: 1024 });
  const spine = layout.cards.filter((card) => !card.rib);
  assert.ok(spine.length >= 1);
  for (const card of spine) {
    assert.ok(Math.abs(card.cx - layout.trunk) < 2, `${card.id} sits on the trunk`);
  }
  const paths = spinePaths(layout);
  assert.ok(paths.length >= 1);
  assert.ok(paths.every((d) => d.startsWith("M ")));
  assert.equal(
    paths.some((d) => d.includes("H ") && !d.includes("V ")),
    false,
    "no hang-only elbows"
  );
});

test("treeLayout handles an empty tree", () => {
  const layout = treeLayout({ concept: "laptop", layers: [], nodes: [], edges: [] });
  assert.equal(layout.branches.length, 0);
  assert.ok(layout.height >= layout.root.height);
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

test("extra parents merge in from the side (fan-in, not a second hang column)", () => {
  const layout = treeLayout(llmRealityMap, { width: 1024 });
  const transformer = layout.cardById.get("n-transformer");
  const attention = layout.cardById.get("n-attention");
  const embedding = layout.cardById.get("n-embedding");
  const turing = layout.cardById.get("n-turing");
  assert.ok(transformer && attention && embedding && turing);
  const parentXs = [attention.cx, embedding.cx, turing.cx];
  assert.ok(new Set(parentXs).size >= 2, "fan-in uses more than one column on a wide stage");
  const paths = spinePaths(layout);
  assert.ok(paths.some((d) => d.includes("H ")), "merge arrows reach side parents");
});

test("convergenceFanPaths is unused: fan-in lives on spinePaths", () => {
  const layout = treeLayout(llmRealityMap, { width: 1024 });
  assert.deepEqual(convergenceFanPaths(layout), []);
});

test("a single-column tree fits the viewport at 375 and 320", () => {
  const map = {
    concept: "computer",
    layers: [
      { id: "l0", name: "logic", nodes: ["n-a"] },
      { id: "l1", name: "circuit", nodes: ["n-b"] },
      { id: "l2", name: "machine", nodes: ["n-c"] },
    ],
    nodes: [
      { id: "n-a", label: "gate", layer: "l0", description: "A boolean switch." },
      { id: "n-b", label: "circuit board", layer: "l1", description: "Wired gates." },
      { id: "n-c", label: "CPU", layer: "l2", description: "The machine." },
    ],
    edges: [
      { source: "n-b", target: "n-a", type: "built-on" },
      { source: "n-c", target: "n-b", type: "built-on" },
    ],
  };
  for (const viewport of [375, 320]) {
    const layout = treeLayout(/** @type {any} */ (map), { width: viewport });
    assert.equal(layout.width, viewport, `stage equals the viewport at ${viewport}px`);
    assert.ok(layout.cardWidth <= TREE_CARD_WIDTH);
    const maxRight = Math.max(...layout.cards.map((card) => card.x + card.width));
    assert.ok(maxRight + TREE_STAGE_PAD <= viewport, `on-stage at ${viewport}px (maxRight ${maxRight})`);
    assert.ok(layout.cardById.get("n-c")?.y > layout.cardById.get("n-a")?.y);
  }
});

test("two same-rank extras never land on the same spot", () => {
  const map = {
    concept: "x",
    layers: [
      { id: "l0", name: "base", nodes: ["n-a", "n-b", "n-c", "n-d"] },
      { id: "l1", name: "mid", nodes: ["n-x", "n-y"] },
      { id: "l2", name: "crown", nodes: ["n-e", "n-f"] },
    ],
    nodes: [
      { id: "n-a", label: "A", layer: "l0" },
      { id: "n-b", label: "B", layer: "l0" },
      { id: "n-c", label: "C", layer: "l0" },
      { id: "n-d", label: "D", layer: "l0" },
      { id: "n-x", label: "X", layer: "l1" },
      { id: "n-y", label: "Y", layer: "l1" },
      { id: "n-e", label: "E", layer: "l2" },
      { id: "n-f", label: "F", layer: "l2" },
    ],
    edges: [
      { source: "n-x", target: "n-a", type: "built-on" },
      { source: "n-x", target: "n-b", type: "built-on" },
      { source: "n-y", target: "n-c", type: "built-on" },
      { source: "n-y", target: "n-d", type: "built-on" },
      { source: "n-e", target: "n-x", type: "built-on" },
      { source: "n-f", target: "n-y", type: "built-on" },
    ],
  };
  const layout = treeLayout(/** @type {any} */ (map), { width: 1024 });
  const seen = new Set();
  for (const card of layout.cards) {
    const spot = `${card.x},${card.y}`;
    assert.equal(seen.has(spot), false, `no two cards share a spot (${spot} = ${card.label})`);
    seen.add(spot);
  }
});

const chapelMap = {
  concept: "battery",
  layers: [
    { id: "l0", name: "chemistry", nodes: ["ions", "joint"] },
    { id: "l1", name: "the cell", nodes: ["cell"] },
  ],
  nodes: [
    {
      id: "ions",
      label: "ions",
      layer: "l0",
      role: "DOMAIN",
      description: "Charged particles that carry current inside the cell.",
    },
    {
      id: "joint",
      label: "voltaic joint",
      layer: "l0",
      role: "EPIPHANY",
      description: "Dissimilar metals in electrolyte produce a current.",
      basis: {
        discoverer: { value: "Alessandro Volta", mark: "EXACT" },
        date: { value: "1800", mark: "EXACT" },
        keyObservation: { value: "Stacked metals yield a steady current.", mark: "EXACT" },
        confidence: "high",
        note: "Credit is shared with Galvani's prior frog-leg work.",
      },
    },
    {
      id: "cell",
      label: "battery",
      layer: "l1",
      role: "DOMAIN",
      description: "A cell that converts stored chemistry into a terminal voltage.",
    },
  ],
  edges: [
    {
      source: "joint",
      target: "ions",
      type: "depends-on",
      because: "The joint needs mobile charge carriers.",
    },
    {
      source: "cell",
      target: "joint",
      type: "depends-on",
      because: "The cell rests on that electrochemical joint.",
    },
  ],
};

test("EPIPHANY nodes are not cards; because labels the shaft", () => {
  assert.equal(isCardNode(chapelMap.nodes[1]), false);
  const layout = treeLayout(/** @type {any} */ (chapelMap), { width: 800 });
  assert.equal(layout.cardById.has("joint"), false);
  assert.ok(layout.cardById.has("ions"));
  assert.ok(layout.cardById.has("cell"));
  const shaft = layout.arrows.find((arrow) => arrow.source === "cell" && arrow.target === "ions");
  assert.ok(shaft);
  assert.equal(shaft.because, "The cell rests on that electrochemical joint.");
  assert.equal(shaft.hover?.discoverer, "Alessandro Volta");
  assert.equal(shaft.hover?.date, "1800");
});

test("UNKNOWN discoverer and date yield no hover chrome", () => {
  assert.equal(
    arrowHoverFromBasis({
      discoverer: { value: "", mark: "UNKNOWN" },
      date: { value: "", mark: "UNKNOWN" },
      note: "a note is not enough",
    }),
    null
  );
  assert.deepEqual(
    arrowHoverFromBasis({
      discoverer: { value: "Faraday", mark: "EXACT" },
      date: { value: "", mark: "UNKNOWN" },
      note: "contested year",
    }),
    { discoverer: "Faraday", date: "", note: "contested year" }
  );
});
