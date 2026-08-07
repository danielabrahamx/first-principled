import { test } from "node:test";
import assert from "node:assert/strict";

import {
  learnerCards,
  learnerEdges,
  nodeDelta,
  stateClass,
} from "./viewmodel.js";
import { laptopRealityMap } from "../mmg/fixtures.js";

/**
 * Session store state with an empty learner map.
 *
 * @param {object} [overrides]
 * @returns {any}
 */
function stateWith(overrides = {}) {
  return {
    word: "laptop",
    realityMap: laptopRealityMap,
    learnerMap: { nodes: [], edges: [] },
    ended: false,
    lastDiff: null,
    ...overrides,
  };
}

test("stateClass maps the four states to state-* classes", () => {
  assert.equal(stateClass("untested"), "state-untested");
  assert.equal(stateClass("missing"), "state-missing");
  assert.equal(stateClass("misconception"), "state-misconception");
  assert.equal(stateClass("correct"), "state-correct");
});

test("learnerCards joins labels only for engaged nodes - reality-only nodes never appear", () => {
  const learner = {
    nodes: [
      { id: "n-transistor", state: "misconception", confidence: 0.4, evidence: ["a switch"] },
      { id: "n-circuit", state: "correct", confidence: 0.8, evidence: ["current flows"] },
    ],
    edges: [],
  };
  const cards = learnerCards(stateWith({ learnerMap: learner }));

  assert.deepEqual(cards, [
    {
      id: "n-transistor",
      label: "transistor",
      state: "misconception",
      confidence: 0.4,
      evidence: ["a switch"],
    },
    {
      id: "n-circuit",
      label: "circuit",
      state: "correct",
      confidence: 0.8,
      evidence: ["current flows"],
    },
  ]);

  // Unengaged reality nodes (silicon, electricity, ...) are absent:
  // their labels must never reach the map page mid-session.
  const ids = new Set(cards.map((c) => c.id));
  assert.ok(!ids.has("n-silicon"));
  assert.ok(!ids.has("n-electricity"));
  assert.ok(!ids.has("n-bit"));
});

test("learnerCards keeps the learner map order and survives a null reality map", () => {
  const learner = {
    nodes: [{ id: "n-os", state: "correct", confidence: 0.7, evidence: [] }],
    edges: [],
  };
  const cards = learnerCards(stateWith({ realityMap: null, learnerMap: learner }));
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, "n-os");
  // No reality map: the raw id is the fallback label, never a leak.
  assert.equal(cards[0].label, "n-os");

  // No learner map at all: no cards.
  assert.deepEqual(learnerCards(stateWith()), []);
});

test("learnerEdges mirrors edges without any reality content", () => {
  const learner = {
    nodes: [],
    edges: [
      {
        source: "n-logic-gate",
        target: "n-circuit",
        state: "correct",
        confidence: 0.6,
        evidence: ["a gate is a small circuit"],
      },
    ],
  };
  assert.deepEqual(learnerEdges(stateWith({ learnerMap: learner })), [
    {
      source: "n-logic-gate",
      target: "n-circuit",
      state: "correct",
      confidence: 0.6,
      evidence: ["a gate is a small circuit"],
    },
  ]);
});

test("nodeDelta reads added, flipped and updated from a diff", () => {
  /** @type {any} */
  const diff = {
    added: ["n-electricity"],
    flipped: [{ id: "n-transistor", from: "untested", to: "misconception" }],
    updated: ["n-circuit"],
  };
  assert.deepEqual(nodeDelta(diff, "n-electricity"), { added: true, flipped: null, updated: false });
  assert.deepEqual(nodeDelta(diff, "n-transistor"), {
    added: false,
    flipped: { from: "untested", to: "misconception" },
    updated: false,
  });
  assert.deepEqual(nodeDelta(diff, "n-circuit"), { added: false, flipped: null, updated: true });
  assert.deepEqual(nodeDelta(diff, "n-absent"), { added: false, flipped: null, updated: false });
});

test("nodeDelta is null-safe", () => {
  assert.deepEqual(nodeDelta(null, "n-transistor"), { added: false, flipped: null, updated: false });
  assert.deepEqual(nodeDelta(undefined, "n-transistor"), { added: false, flipped: null, updated: false });
  assert.deepEqual(nodeDelta(/** @type {any} */ ({}), "n-transistor"), {
    added: false,
    flipped: null,
    updated: false,
  });
});
