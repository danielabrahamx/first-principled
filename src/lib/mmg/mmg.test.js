import { test } from "node:test";
import assert from "node:assert/strict";

import {
  laptopRealityMap,
  laptopLearnerMap,
} from "./fixtures.js";
import {
  validateRealityMap,
  validateLearnerMap,
  validateDiff,
} from "./validator.js";
import { closenessScore } from "./closeness.js";

/**
 * Clones a fixture so a test can corrupt one copy without mutating the
 * shared module-level fixture.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

test("laptop reality fixture is valid", () => {
  const result = validateRealityMap(laptopRealityMap);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.errors, []);
});

test("laptop learner fixture is valid against the reality map", () => {
  const result = validateLearnerMap(laptopLearnerMap, laptopRealityMap);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.deepEqual(result.errors, []);
});

test("validator rejects a gapped layer chain", () => {
  const map = clone(laptopRealityMap);
  map.edges = map.edges.filter(
    (e) => !(e.source === "n-logic-gate" && e.target === "n-circuit")
  );
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  const gap = result.errors.find((e) => e.startsWith("layer chain gap"));
  assert.ok(gap, `expected a layer chain gap error, got: ${result.errors.join("; ")}`);
  assert.match(gap, /logic/);
});

test("a single-layer map is valid (trivially contiguous)", () => {
  const map = {
    concept: "laptop",
    layers: [{ id: "l0", name: "physics", nodes: ["n-electricity"] }],
    nodes: [
      {
        id: "n-electricity",
        label: "electricity",
        layer: "l0",
        description: "flow of electric charge",
      },
    ],
    edges: [],
  };
  const result = validateRealityMap(map);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("validator rejects an unknown edge type", () => {
  const map = clone(laptopRealityMap);
  const edges = /** @type {any[]} */ (map.edges);
  edges[0].type = "smells-like";
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith("realityMap.edges[0].type")));
});

test("validator rejects a node pointing at an unknown layer", () => {
  const map = clone(laptopRealityMap);
  map.nodes[0].layer = "l9";
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("unknown layer")));
});

test("validator rejects a layer listing an unknown node", () => {
  const map = clone(laptopRealityMap);
  map.layers[0].nodes = ["n-ghost"];
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("unknown node")));
});

test("validator rejects a node missing from its layer's list", () => {
  const map = clone(laptopRealityMap);
  map.layers[2].nodes = ["n-transistor"];
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("not listed")));
});

test("validator rejects duplicate node ids", () => {
  const map = clone(laptopRealityMap);
  map.nodes.push(clone(map.nodes[0]));
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("duplicate node id")));
});

test("validator accepts a convergence node's combines list and rejects broken entries", () => {
  // llmRealityMap (ticket 13): a convergence node combines attention,
  // embeddings, and compute - structurally valid combines entries.
  const llm = structuredClone(laptopRealityMap);
  const bit = llm.nodes.find((node) => node.id === "n-bit");
  assert.ok(bit);
  bit.combines = [
    {
      id: "n-logic-gate",
      observation: {
        discoverer: { value: "George Boole", mark: "EXACT" },
        date: { value: "1847", mark: "EXACT" },
        keyObservation: { value: "Boole links logical reasoning to the rules of algebra.", mark: "EXACT" },
        confidence: "high",
        note: "",
      },
    },
    {
      id: "n-electricity",
      observation: {
        discoverer: { value: "Thales of Miletus", mark: "APPROXIMATE" },
        date: { value: "600 BC", mark: "APPROXIMATE" },
        keyObservation: { value: "Amber rubbed with fur attracts feathers and dry leaves.", mark: "EXACT" },
        confidence: "medium",
        note: "",
      },
    },
  ];
  assert.equal(validateRealityMap(llm).ok, true);

  const ghost = /** @type {any} */ (clone(llm));
  ghost.nodes = ghost.nodes.map(
    /** @param {any} node */
    (node) =>
      node.id === "n-bit" && Array.isArray(node.combines)
        ? { ...node, combines: [{ id: "n-ghost", observation: node.combines[0].observation }] }
        : node
  );
  const ghostResult = validateRealityMap(ghost);
  assert.equal(ghostResult.ok, false);
  assert.ok(ghostResult.errors.some((e) => e.includes("n-ghost")));

  const badObs = /** @type {any} */ (clone(llm));
  badObs.nodes = badObs.nodes.map(
    /** @param {any} node */
    (node) =>
      node.id === "n-bit"
        ? {
          ...node,
          combines: [
            {
              id: "n-logic-gate",
              observation: {
                discoverer: { value: "George Boole", mark: "EXACT" },
                date: { value: "1847", mark: "EXACT" },
                keyObservation: { value: "Boole links logical reasoning to the rules of algebra.", mark: "EXACT" },
                confidence: "high",
                note: "",
              },
            },
            {
              id: "n-electricity",
              observation: { discoverer: { value: "x", mark: "EXACT" } },
            },
          ],
        }
      : node
  );
  const badObsResult = validateRealityMap(badObs);
  assert.equal(badObsResult.ok, false);
  assert.ok(badObsResult.errors.some((e) => e.includes("observation record")));
});

test("validator rejects a self-loop edge", () => {
  const map = clone(laptopRealityMap);
  map.edges.push({
    source: "n-os",
    target: "n-os",
    type: "depends-on",
  });
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("self-loop")));
});

test("validator rejects a duplicate edge", () => {
  const map = clone(laptopRealityMap);
  map.edges.push(clone(map.edges[0]));
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("duplicate edge")));
});

test("validator rejects a map with no layers", () => {
  const map = clone(laptopRealityMap);
  map.layers = [];
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("at least one layer")));
});

test("validator does not throw when a layer lacks a nodes list", () => {
  const map = /** @type {any} */ (clone(laptopRealityMap));
  map.layers[0].nodes = undefined;
  const result = validateRealityMap(map);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("nodes must be an array")));
});

test("an empty learner map is valid (session start)", () => {
  const result = validateLearnerMap({ nodes: [], edges: [] }, laptopRealityMap);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("validator rejects a learner node not in the reality map", () => {
  const learner = clone(laptopLearnerMap);
  learner.nodes.push({
    id: "n-ghost",
    state: "correct",
    confidence: 0.9,
    evidence: [],
  });
  const result = validateLearnerMap(learner, laptopRealityMap);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("n-ghost")));
});

test("validator rejects confidence outside 0..1", () => {
  for (const confidence of [1.5, -0.1, Number.NaN]) {
    const learner = clone(laptopLearnerMap);
    learner.nodes[0].confidence = confidence;
    const result = validateLearnerMap(learner, laptopRealityMap);
    assert.equal(result.ok, false, `confidence ${confidence} should be rejected`);
  }
});

test("validator rejects an invalid learner node state", () => {
  const learner = /** @type {any} */ (clone(laptopLearnerMap));
  learner.nodes[0].state = "wizard";
  const result = validateLearnerMap(learner, laptopRealityMap);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith("learnerMap.nodes[0].state")));
});

test("validator rejects non-string evidence", () => {
  const learner = /** @type {any} */ (clone(laptopLearnerMap));
  learner.nodes[0].evidence = ["fine", 42];
  const result = validateLearnerMap(learner, laptopRealityMap);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("evidence")));
});

test("a valid diff passes", () => {
  /** @type {import("./types.js").Diff} */
  const diff = {
    added: ["n-bit"],
    flipped: [{ id: "n-transistor", from: "misconception", to: "correct" }],
    updated: ["n-os"],
  };
  const result = validateDiff(diff, laptopLearnerMap);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("validator rejects a flip to the same state", () => {
  /** @type {import("./types.js").Diff} */
  const diff = {
    added: [],
    flipped: [{ id: "n-os", from: "correct", to: "correct" }],
    updated: [],
  };
  const result = validateDiff(diff, laptopLearnerMap);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("same state")));
});

test("validator rejects diff entries for unknown learner nodes", () => {
  /** @type {import("./types.js").Diff} */
  const diff = {
    added: ["n-ghost"],
    flipped: [{ id: "n-ghost", from: "untested", to: "correct" }],
    updated: ["n-ghost"],
  };
  const result = validateDiff(diff, laptopLearnerMap);
  assert.equal(result.ok, false);
  assert.equal(
    result.errors.filter((e) => e.includes("n-ghost")).length,
    3
  );
});

test("closeness score matches the hand calculation on the fixture", () => {
  assert.equal(closenessScore(laptopLearnerMap), 0.5);
});

test("closeness score is 0 when no nodes are known", () => {
  /** @type {import("./types.js").LearnerMentalModel} */
  const learner = {
    nodes: [
      { id: "n-silicon", state: "untested", confidence: 0, evidence: [] },
      { id: "n-bit", state: "untested", confidence: 0, evidence: [] },
    ],
    edges: [],
  };
  assert.equal(closenessScore(learner), 0);
});

test("closeness score is 1 when every known node is correct", () => {
  /** @type {import("./types.js").LearnerMentalModel} */
  const learner = {
    nodes: [
      { id: "n-os", state: "correct", confidence: 0.9, evidence: ["x"] },
      { id: "n-silicon", state: "untested", confidence: 0, evidence: [] },
    ],
    edges: [],
  };
  assert.equal(closenessScore(learner), 1);
});

test("closeness score is deterministic", () => {
  assert.equal(closenessScore(laptopLearnerMap), closenessScore(laptopLearnerMap));
});
