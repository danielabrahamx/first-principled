import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evidenceBand,
  stateGuard,
  anchoredConfidence,
  suggestedConfidence,
  anchorConfidence,
  nodeChanged,
  SNAP_TOLERANCE,
} from "./confidence.js";
import { laptopLearnerMap } from "../mmg/fixtures.js";

test("evidence bands widen with the number of observations", () => {
  assert.deepEqual(evidenceBand(0), { min: 0, max: 0.2 });
  assert.deepEqual(evidenceBand(1), { min: 0.3, max: 0.6 });
  assert.deepEqual(evidenceBand(2), { min: 0.5, max: 0.8 });
  assert.deepEqual(evidenceBand(3), { min: 0.7, max: 0.95 });
  assert.deepEqual(evidenceBand(7), { min: 0.7, max: 0.95 });
});

test("state guards keep semantics: correct is never low, misconception never high", () => {
  assert.equal(stateGuard("untested").max, 0.2);
  assert.equal(stateGuard("missing").max, 0.4);
  assert.equal(stateGuard("misconception").max, 0.7);
  assert.equal(stateGuard("correct").min, 0.5);
});

test("anchoredConfidence leaves in-band values alone", () => {
  // one quote + misconception: intersection [0.3, 0.6]
  assert.equal(anchoredConfidence(0.4, "misconception", 1), null);
  assert.equal(anchoredConfidence(0.6, "misconception", 1), null);
});

test("anchoredConfidence snaps values far outside the intersection", () => {
  // one quote + misconception: intersection [0.3, 0.6]; 0.95 is 0.35 outside
  assert.equal(anchoredConfidence(0.95, "misconception", 1), 0.6);
  // three quotes + misconception: intersection [0.7, 0.7]; 0.2 is 0.5 outside
  assert.equal(anchoredConfidence(0.2, "misconception", 3), 0.7);
  // one quote + correct: intersection [0.5, 0.6]; 0.95 is 0.35 outside
  assert.equal(anchoredConfidence(0.95, "correct", 1), 0.6);
});

test("small deviations are preserved - verbal confidence is real signal", () => {
  // one quote + misconception: intersection [0.3, 0.6]; 0.7 is 0.1 outside
  assert.equal(anchoredConfidence(0.7, "misconception", 1), null);
  assert.ok(SNAP_TOLERANCE === 0.15);
});

test("suggestedConfidence rises as consistent correct answers accumulate", () => {
  const one = suggestedConfidence("correct", 1); // [0.5, 0.6] -> 0.55
  const two = suggestedConfidence("correct", 2); // [0.5, 0.8] -> 0.65
  const three = suggestedConfidence("correct", 3); // [0.7, 0.95] -> 0.83 (rounded)
  assert.equal(one, 0.55);
  assert.equal(two, 0.65);
  assert.equal(three, 0.83);
  assert.ok(one < two && two < three, "consistent correct answers raise confidence");
});

test("a flip from misconception to correct moves confidence meaningfully", () => {
  // misconception with 2 quotes: [0.5, 0.7]; correct with 2: [0.5, 0.8]
  const mis = suggestedConfidence("misconception", 2);
  const cor = suggestedConfidence("correct", 2);
  assert.equal(mis, 0.6);
  assert.equal(cor, 0.65);
  // the guard matters more than the midpoint: a misconception cannot sit at 0.9
  assert.equal(anchoredConfidence(0.9, "misconception", 2), 0.7);
  assert.equal(anchoredConfidence(0.2, "correct", 2), 0.5);
});

test("anchorConfidence snaps only nodes that changed this turn", () => {
  const next = structuredClone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-transistor"
      ? { ...node, state: "correct", confidence: 0.95, evidence: ["small signals flip it on and off"] }
      : node
  );
  const anchored = anchorConfidence(laptopLearnerMap, next);
  const transistor = anchored.nodes.find((node) => node.id === "n-transistor");
  assert.ok(transistor, "n-transistor is in the map");
  assert.equal(transistor.confidence, 0.6, "one quote + correct caps at 0.6");
  const app = anchored.nodes.find((node) => node.id === "n-app");
  const priorApp = laptopLearnerMap.nodes.find((node) => node.id === "n-app");
  assert.ok(app && priorApp, "n-app is in both maps");
  assert.equal(app.confidence, priorApp.confidence, "untouched nodes keep their value");
});

test("anchorConfidence returns the same map when nothing needs snapping", () => {
  // n-app is correct with one quote at 0.7; adding a quote keeps 0.7 inside
  // the [0.5, 0.8] intersection, so nothing snaps and no copy is made.
  const next = structuredClone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-app"
      ? { ...node, evidence: [...node.evidence, "it also stores my files"] }
      : node
  );
  const anchored = anchorConfidence(laptopLearnerMap, next);
  assert.equal(anchored, next, "no snap means no copy");
});

test("nodeChanged reports only genuinely changed nodes", () => {
  assert.equal(nodeChanged(laptopLearnerMap, laptopLearnerMap, "n-transistor"), false);
  const next = structuredClone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-transistor" ? { ...node, confidence: 0.35 } : node
  );
  assert.equal(nodeChanged(laptopLearnerMap, next, "n-transistor"), true);
  assert.equal(nodeChanged(laptopLearnerMap, next, "n-app"), false);
});
