import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap } from "../../src/lib/mmg/fixtures.js";
import {
  GOLD_MAPS,
  recursionRealityMap,
  photosynthesisRealityMap,
  batteryRealityMap,
} from "./gold.js";
import {
  adjacentDownEdges,
  candidateFromOneShot,
  crownReached,
  goldOverlap,
  hasDependenceEdges,
  labelsMatch,
  scoreMap,
} from "./gate.js";

test("gold laptop passes structural gates and fails crown (fixture names application)", () => {
  const score = scoreMap(laptopRealityMap, { gold: laptopRealityMap, requireCrown: false });
  assert.equal(score.pass, true, score.errors.join("; "));
  assert.equal(score.checks.schemaValid, true);
  assert.equal(score.checks.deriveOk, true);
  assert.equal(score.checks.hasDependence, true);
  assert.equal(score.checks.noSkippedLayer, true);
  assert.equal(crownReached("laptop", laptopRealityMap), false);
});

test("gold recursion, photosynthesis, and battery pass the full gate including crown", () => {
  for (const gold of [recursionRealityMap, photosynthesisRealityMap, batteryRealityMap]) {
    const score = scoreMap(gold, { gold });
    assert.equal(score.pass, true, `${gold.concept}: ${score.errors.join("; ")}`);
    assert.equal(score.checks.crownReached, true, gold.concept);
  }
});

test("each gold map overlaps itself completely", () => {
  for (const gold of GOLD_MAPS) {
    const overlap = goldOverlap(gold, gold);
    assert.equal(overlap.labelRatio, 1, gold.concept);
    assert.equal(overlap.pairRatio, 1, gold.concept);
  }
});

test("labelsMatch requires a token boundary", () => {
  assert.equal(labelsMatch("bit", "orbit"), false);
  assert.equal(labelsMatch("silicon", "silicon crystal"), true);
  assert.equal(labelsMatch("logic gate", "cmos logic gate"), true);
});

test("a skipped intermediate layer fails the adjacent-down rule but can stay contiguous", () => {
  const map = {
    concept: "skip",
    layers: [
      { id: "l0", name: "bottom", nodes: ["n-a"] },
      { id: "l1", name: "middle", nodes: ["n-b"] },
      { id: "l2", name: "top", nodes: ["n-skip"] },
    ],
    nodes: [
      {
        id: "n-a",
        label: "bottom",
        layer: "l0",
        description: "foundation",
        basis: laptopRealityMap.nodes[0].basis,
      },
      {
        id: "n-b",
        label: "middle",
        layer: "l1",
        description: "middle",
        basis: laptopRealityMap.nodes[0].basis,
      },
      {
        id: "n-skip",
        label: "skip",
        layer: "l2",
        description: "skips middle",
        basis: laptopRealityMap.nodes[0].basis,
      },
    ],
    edges: [
      { source: "n-b", target: "n-a", type: "built-on" },
      { source: "n-skip", target: "n-a", type: "depends-on" },
    ],
  };
  const adjacent = adjacentDownEdges(map);
  assert.equal(adjacent.ok, false);
  const score = scoreMap(map, { concept: "skip" });
  assert.equal(score.pass, false);
  assert.equal(score.checks.noSkippedLayer, false);
  assert.equal(score.checks.contiguous, true);
});

test("a map with only predicts edges fails the dependence check", () => {
  const map = structuredClone(recursionRealityMap);
  map.edges = map.edges.map((edge) => ({ ...edge, type: "predicts" }));
  assert.equal(hasDependenceEdges(map), false);
  const score = scoreMap(map, { gold: recursionRealityMap });
  assert.equal(score.pass, false);
  assert.equal(score.checks.hasDependence, false);
});

test("gold overlap is checkable when ids differ but labels match", () => {
  const candidate = structuredClone(batteryRealityMap);
  candidate.nodes = candidate.nodes.map((node, i) => ({ ...node, id: `x${i}` }));
  candidate.layers = candidate.layers.map((layer) => ({
    ...layer,
    nodes: layer.nodes.map((id) => {
      const index = batteryRealityMap.nodes.findIndex((node) => node.id === id);
      return `x${index}`;
    }),
  }));
  candidate.edges = batteryRealityMap.edges.map((edge) => ({
    ...edge,
    source: `x${batteryRealityMap.nodes.findIndex((node) => node.id === edge.source)}`,
    target: `x${batteryRealityMap.nodes.findIndex((node) => node.id === edge.target)}`,
  }));
  const overlap = goldOverlap(candidate, batteryRealityMap);
  assert.equal(overlap.labelRatio, 1);
  assert.equal(overlap.pairRatio, 1);
});

test("candidateFromOneShot rebinds model layer ids and still gates", () => {
  const parsed = {
    isValidConcept: true,
    layers: [
      { id: "foundation", name: "execution", nodes: ["stack"] },
      { id: "pattern", name: "the pattern", nodes: ["recursion"] },
    ],
    nodes: [
      { ...recursionRealityMap.nodes[0], id: "stack", layer: "foundation" },
      { ...recursionRealityMap.nodes[3], id: "recursion", layer: "pattern" },
    ],
    edges: [{ source: "recursion", target: "stack", type: "abstraction-of" }],
  };
  const map = candidateFromOneShot("recursion", parsed);
  assert.ok(map);
  assert.deepEqual(map.layers.map((layer) => layer.id), ["l0", "l1"]);
  const score = scoreMap(map, { gold: recursionRealityMap });
  assert.equal(score.checks.crownReached, true);
  assert.equal(score.checks.hasDependence, true);
  assert.equal(score.checks.noSkippedLayer, true);
});
