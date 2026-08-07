import { test } from "node:test";
import assert from "node:assert/strict";

import { realitySections, realityEdgeList, comparisonMetrics } from "./comparison.js";
import { laptopRealityMap } from "../mmg/fixtures.js";

test("realitySections groups nodes by layer, in layer order, with labels and descriptions", () => {
  const sections = realitySections(laptopRealityMap);
  assert.deepEqual(
    sections.map((section) => section.name),
    ["physics", "materials", "electronics", "logic", "OS", "apps"]
  );
  assert.deepEqual(
    sections[2].nodes.map((node) => node.label),
    ["transistor", "circuit"]
  );
  assert.equal(sections[2].nodes[0].description, laptopRealityMap.nodes[2].description);
  // Every reality node appears exactly once, across all layers.
  const ids = sections.flatMap((section) => section.nodes.map((node) => node.id));
  assert.equal(ids.length, laptopRealityMap.nodes.length);
  assert.equal(new Set(ids).size, ids.length);
});

test("realitySections is null-safe", () => {
  assert.deepEqual(realitySections(null), []);
  assert.deepEqual(realitySections(undefined), []);
  assert.deepEqual(realitySections(/** @type {any} */ ({})), []);
});

test("realityEdgeList resolves labels and keeps map order and types", () => {
  const edges = realityEdgeList(laptopRealityMap);
  assert.equal(edges.length, laptopRealityMap.edges.length);
  assert.deepEqual(edges[0], {
    source: "n-silicon",
    target: "n-electricity",
    type: "depends-on",
    sourceLabel: "silicon",
    targetLabel: "electricity",
  });
  assert.deepEqual(edges[4], {
    source: "n-logic-gate",
    target: "n-circuit",
    type: "built-on",
    sourceLabel: "logic gate",
    targetLabel: "circuit",
  });
});

test("realityEdgeList is null-safe", () => {
  assert.deepEqual(realityEdgeList(null), []);
  assert.deepEqual(realityEdgeList(/** @type {any} */ ({ edges: [{ source: "a", target: "b" }] })), []);
});

test("comparisonMetrics reads the store's recorded metrics", () => {
  const metrics = comparisonMetrics({
    closeness: 0.75,
    gapClosures: 4,
    transferResult: { passed: true, assessment: "You traced the failure correctly." },
  });
  assert.deepEqual(metrics, {
    closeness: 0.75,
    gapClosures: 4,
    transferPassed: true,
    transferAssessment: "You traced the failure correctly.",
  });
});

test("comparisonMetrics before the end phase has no transfer result and zeroed metrics", () => {
  const metrics = comparisonMetrics({
    closeness: null,
    gapClosures: 0,
    transferResult: null,
  });
  assert.deepEqual(metrics, {
    closeness: 0,
    gapClosures: 0,
    transferPassed: null,
    transferAssessment: "",
  });
});

test("comparisonMetrics survives a missing gapClosures field", () => {
  const metrics = comparisonMetrics({ closeness: 0.5, transferResult: null });
  assert.equal(metrics.gapClosures, 0);
  assert.equal(metrics.closeness, 0.5);
});
