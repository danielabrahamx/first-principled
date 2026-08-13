import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, llmRealityMap } from "../mmg/fixtures.js";
import {
  observationOf,
  observationByNodeId,
  layerObservationStory,
  dependents,
  combinesOf,
} from "./observation.js";

/**
 * A full, valid observation record per the ticket 09 contract section 2.
 *
 * @returns {any}
 */
function record(overrides = {}) {
  return {
    discoverer: { value: "George Boole", mark: "EXACT" },
    date: { value: "1847", mark: "EXACT" },
    keyObservation: { value: "Logical reasoning follows the rules of algebra.", mark: "EXACT" },
    confidence: "high",
    note: "",
    ...overrides,
  };
}

/** @param {any} basis */
function nodeWith(basis) {
  return { id: "n", label: "node", layer: "l0", description: "", basis };
}

test("observationOf renders a full record with marks, confidence and note", () => {
  const view = observationOf(
    nodeWith(record({ note: "Contested credit." }))
  );
  assert.equal(view.present, true);
  assert.equal(view.legacy, false);
  assert.deepEqual(view.discoverer, { value: "George Boole", mark: "EXACT" });
  assert.deepEqual(view.date, { value: "1847", mark: "EXACT" });
  assert.deepEqual(view.keyObservation, {
    value: "Logical reasoning follows the rules of algebra.",
    mark: "EXACT",
  });
  assert.equal(view.confidence, "high");
  assert.equal(view.note, "Contested credit.");
});

test("observationOf accepts APPROXIMATE marks and drops an invalid confidence", () => {
  const view = observationOf(
    nodeWith(record({ date: { value: "c. 1950", mark: "APPROXIMATE" }, confidence: "sure" }))
  );
  assert.equal(view.present, true);
  assert.deepEqual(view.date, { value: "c. 1950", mark: "APPROXIMATE" });
  assert.equal(view.confidence, null);
});

test("observationOf renders a legacy string basis as an unmarked record", () => {
  const view = observationOf(nodeWith("a light switch either passes current or stops it"));
  assert.equal(view.present, true);
  assert.equal(view.legacy, true);
  assert.deepEqual(view.keyObservation, {
    value: "a light switch either passes current or stops it",
    mark: null,
  });
  assert.equal(view.discoverer, null);
  assert.equal(view.date, null);
  assert.equal(view.confidence, null);
});

test("observationOf renders a missing basis as the explicit gap, never blank", () => {
  for (const basis of [undefined, null, "", "   "]) {
    const view = observationOf(nodeWith(basis));
    assert.equal(view.present, false, `basis ${JSON.stringify(basis)} must be a gap`);
    assert.equal(view.legacy, false);
    assert.equal(view.keyObservation, null);
    assert.equal(view.note, null);
  }
});

test("observationOf treats garbage input as the explicit gap", () => {
  for (const input of [null, undefined, 42, "x", [], {}]) {
    const view = observationOf(input);
    assert.equal(view.present, false, `input ${JSON.stringify(input)} must be a gap`);
  }
});

test("observationOf tolerates the wrapped { observation } shape of the ticket 09 schema", () => {
  const view = observationOf(nodeWith({ observation: record() }));
  assert.equal(view.present, true);
  assert.equal(view.discoverer?.value, "George Boole");
});

test("observationOf renders a record whose crux is UNKNOWN as the explicit gap", () => {
  const view = observationOf(
    nodeWith(
      record({
        keyObservation: { value: "", mark: "UNKNOWN" },
        note: "Claimed observation, never confirmed.",
      })
    )
  );
  assert.equal(view.present, false);
  // The hedge note survives into the gap - the Vulcan case.
  assert.equal(view.note, "Claimed observation, never confirmed.");
});

test("observationOf drops a field with a value under an UNKNOWN mark (never a placeholder)", () => {
  const view = observationOf(
    nodeWith(record({ date: { value: "about 1900", mark: "UNKNOWN" } }))
  );
  assert.equal(view.present, true);
  assert.equal(view.date, null);
});

test("observationOf drops malformed fields - bad mark, empty value, non-string", () => {
  const bad = nodeWith(
    record({
      discoverer: { value: "someone", mark: "MAYBE" },
      date: { value: "  ", mark: "EXACT" },
    })
  );
  const view = observationOf(bad);
  assert.equal(view.present, true);
  assert.equal(view.discoverer, null);
  assert.equal(view.date, null);
  assert.equal(view.keyObservation?.value, "Logical reasoning follows the rules of algebra.");
});

test("observationByNodeId maps every node to a view, gaps included", () => {
  const views = observationByNodeId(laptopRealityMap);
  assert.equal(views.size, laptopRealityMap.nodes.length);
  // Since ticket 03 every fixture node carries an observation record -
  // the foundation included.
  assert.equal(views.get("n-electricity")?.present, true, "the foundation carries an observation record (ticket 03)");
  assert.equal(views.get("n-electricity")?.legacy, false);
  assert.equal(views.get("n-transistor")?.present, true);
  assert.equal(views.get("n-transistor")?.legacy, false);
  assert.equal(observationByNodeId(null).size, 0);
});

test("layerObservationStory reads chronologically - oldest at the foundation", () => {
  const map = {
    concept: "x",
    layers: [{ id: "l2", name: "electronics", nodes: ["n-transistor", "n-circuit", "n-gap"] }],
    nodes: [
      {
        id: "n-transistor",
        label: "transistor",
        layer: "l2",
        description: "",
        basis: record({ date: { value: "December 1947", mark: "EXACT" } }),
      },
      {
        id: "n-circuit",
        label: "circuit",
        layer: "l2",
        description: "",
        basis: record({ date: { value: "1958", mark: "EXACT" } }),
      },
      { id: "n-gap", label: "gap node", layer: "l2", description: "" },
    ],
    edges: [],
  };
  const story = layerObservationStory(map, "l2");
  assert.equal(story.layerName, "electronics");
  assert.deepEqual(
    story.entries.map((entry) => entry.label),
    ["transistor", "circuit", "gap node"]
  );
  // The gap entry is present, never dropped - the chain stays visibly unbroken.
  assert.equal(story.entries[2].observation.present, false);
});

test("layerObservationStory sorts APPROXIMATE decade dates like the rest", () => {
  const map = {
    concept: "x",
    layers: [{ id: "l0", name: "physics", nodes: ["n-a", "n-b"] }],
    nodes: [
      {
        id: "n-a",
        label: "older",
        layer: "l0",
        description: "",
        basis: record({ date: { value: "c. 1600", mark: "APPROXIMATE" } }),
      },
      {
        id: "n-b",
        label: "newer",
        layer: "l0",
        description: "",
        basis: record({ date: { value: "1752", mark: "APPROXIMATE" } }),
      },
    ],
    edges: [],
  };
  const story = layerObservationStory(map, "l0");
  assert.deepEqual(
    story.entries.map((entry) => entry.label),
    ["older", "newer"]
  );
});

test("layerObservationStory is null-safe and falls back on the layer id", () => {
  assert.deepEqual(layerObservationStory(null, "l0"), {
    layerId: "l0",
    layerName: "l0",
    entries: [],
  });
  const story = layerObservationStory(laptopRealityMap, "nope");
  assert.equal(story.layerName, "nope");
  assert.deepEqual(story.entries, []);
});

test("dependents lists direct higher-layer nodes an observation built", () => {
  // n-silicon (l1) -> transistor (l2, built-on) and silicon (l1) -> electricity (l0).
  assert.deepEqual(dependents(laptopRealityMap, "n-silicon"), ["transistor"]);
  assert.deepEqual(dependents(laptopRealityMap, "n-electricity"), ["silicon"]);
  assert.deepEqual(dependents(laptopRealityMap, "n-app"), []);
  assert.deepEqual(dependents(null, "n-silicon"), []);
});

test("combinesOf resolves a convergence node's enabling observations with their layers", () => {
  const combined = combinesOf(llmRealityMap, "n-transformer");
  assert.equal(combined.length, 3);
  const labels = combined.map((entry) => entry.label);
  assert.ok(labels.includes("attention"), "attention is one combined field");
  assert.ok(labels.includes("word embedding"), "embeddings is one combined field");
  assert.ok(labels.includes("computability"), "compute is one combined field");
  // Each entry carries the source layer name and a renderable observation.
  for (const entry of combined) {
    assert.ok(entry.layer.length > 0, "the source layer id is resolved");
    assert.ok(entry.layerName.length > 0, "the source layer name is resolved");
    assert.equal(entry.observation.present, true, "the enabling observation is present");
  }
});

test("combinesOf returns an empty array for a non-convergence node and null-safely", () => {
  assert.deepEqual(combinesOf(llmRealityMap, "n-llm"), []);
  assert.deepEqual(combinesOf(laptopRealityMap, "n-transistor"), []);
  assert.deepEqual(combinesOf(null, "n-transformer"), []);
  assert.deepEqual(combinesOf(llmRealityMap, "nope"), []);
});

test("combinesOf is defensive about a combine entry that references a missing node", () => {
  const map = /** @type {any} */ (structuredClone(llmRealityMap));
  const transformer = map.nodes.find(
    /** @param {any} node */
    (node) => node.id === "n-transformer"
  );
  assert.ok(transformer);
  transformer.combines = [
    ...transformer.combines,
    { id: "n-ghost", observation: transformer.combines[0].observation },
  ];
  const combined = combinesOf(map, "n-transformer");
  assert.equal(combined.length, 4);
  const ghost = combined.find((entry) => entry.sourceId === "n-ghost");
  assert.ok(ghost, "the ghost entry is still surfaced");
  assert.equal(ghost.observation.present, false, "a missing source renders as the gap");
  assert.equal(ghost.layer, "", "no layer to resolve");
});
