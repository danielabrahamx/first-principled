import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, laptopLearnerMap } from "../mmg/fixtures.js";
import {
  nodePanelView,
  RABBIT_HOLE_INVITE,
  layerStory,
  timelineStops,
  snapshotAt,
  snapshotDiff,
} from "./history.js";

/**
 * A typed learner node, so constructed maps pass the JSDoc typecheck.
 *
 * @param {string} id
 * @param {import("../mmg/types.js").NodeState} state
 * @param {number} confidence
 * @param {string[]} evidence
 * @returns {import("../mmg/types.js").LearnerNode}
 */
function ln(id, state, confidence, evidence) {
  return { id, state, confidence, evidence };
}

/**
 * A scripted ledger that takes n-transistor through misconception ->
 * updated -> correct, then adds n-bit, mirroring a real session's turns.
 *
 * @returns {import("../../state/session.js").LedgerEntry[]}
 */
function scriptedLedger() {
  const transistor = ln("n-transistor", "misconception", 0.4, [
    "a transistor is a switch you flick by hand",
  ]);
  const updated = {
    ...transistor,
    confidence: 0.35,
    evidence: [...transistor.evidence, "transistors mainly amplify audio"],
  };
  const correct = ln("n-transistor", "correct", 0.85, [
    "so it's a tiny switch controlled by a voltage",
  ]);
  const bit = ln("n-bit", "correct", 0.85, ["a bit is a binary digit"]);
  return [
    {
      turn: 1,
      diff: { added: ["n-transistor"], flipped: [], updated: [] },
      reply: "What have you noticed?",
      probe: { nodeId: "n-transistor", kind: "probe" },
      learnerMap: { nodes: [transistor], edges: [] },
    },
    {
      turn: 2,
      diff: { added: [], flipped: [], updated: ["n-transistor"] },
      reply: "Interesting - and what does a transistor mainly do?",
      probe: { nodeId: "n-transistor", kind: "probe" },
      learnerMap: { nodes: [updated], edges: [] },
    },
    {
      turn: 3,
      diff: { added: [], flipped: [{ id: "n-transistor", from: "misconception", to: "correct" }], updated: [] },
      reply: "Exactly - a tiny switch a signal controls.",
      probe: { nodeId: "n-transistor", kind: "probe" },
      learnerMap: { nodes: [correct], edges: [] },
    },
    {
      turn: 4,
      diff: { added: ["n-bit"], flipped: [], updated: [] },
      reply: "And what carries the result?",
      probe: { nodeId: "n-bit", kind: "probe" },
      learnerMap: { nodes: [correct, bit], edges: [] },
    },
  ];
}

/** @returns {any} */
function historyState(overrides = {}) {
  return {
    realityMap: laptopRealityMap,
    learnerMap: scriptedLedger()[scriptedLedger().length - 1].learnerMap,
    ledger: scriptedLedger(),
    ...overrides,
  };
}

test("nodePanelView is an invitation card: description, observation, neighbors", () => {
  const panel = nodePanelView(historyState(), "n-transistor");
  assert.equal(panel.label, "transistor");
  assert.match(panel.description, /Semiconductor switch/);
  assert.equal(panel.invitation, RABBIT_HOLE_INVITE);
  assert.match(panel.invitation, /rabbit hole/);
  assert.match(panel.invitation, /not a chat topic/);
  assert.ok(panel.observation);
  // The crux (ticket 04): since ticket 03 the fixture carries the
  // structured observation record, rendered with marks - never a gap.
  assert.equal(panel.observation.present, true);
  assert.equal(panel.observation.legacy, false);
  assert.equal(
    panel.observation.discoverer?.value,
    "John Bardeen, Walter Brattain, William Shockley"
  );
  assert.equal(
    panel.observation.keyObservation?.value,
    "A small voltage controls a larger current through a germanium crystal."
  );
  // Learner-state chrome is off the card (v6 ticket 06).
  assert.equal("state" in panel, false);
  assert.equal("confidence" in panel, false);
  assert.equal("engaged" in panel, false);
  assert.equal("evidence" in panel, false);
  assert.equal("trail" in panel, false);
  assert.equal("neighbors" in panel, false);
});

test("nodePanelView of any node still shows the reality description", () => {
  const panel = nodePanelView(historyState(), "n-os");
  assert.match(panel.description, /Software layer/);
  assert.equal(panel.invitation, RABBIT_HOLE_INVITE);
  assert.deepEqual(panel.restsOn, [
    { nodeId: "n-bit", label: "bit", type: "built-on" },
  ]);
  assert.deepEqual(panel.restsOnIt, [
    { nodeId: "n-app", label: "application", type: "depends-on" },
  ]);
});

test("nodePanelView of a node without a basis omits observation", () => {
  const realityMap = structuredClone(laptopRealityMap);
  realityMap.nodes = realityMap.nodes.map((node) => {
    if (node.id === "n-os") {
      const { basis, ...rest } = node;
      return rest;
    }
    return node;
  });
  const panel = nodePanelView(historyState({ realityMap }), "n-os");
  assert.equal(panel.observation, null);
});

test("nodePanelView lists what the node rests on from Reality Map edges", () => {
  const panel = nodePanelView(historyState(), "n-transistor");
  assert.deepEqual(panel.restsOn, [
    { nodeId: "n-silicon", label: "silicon", type: "built-on" },
  ]);
});

test("nodePanelView lists what rests on the node, skipping non-dependence edges", () => {
  const panel = nodePanelView(historyState(), "n-transistor");
  // circuit built-on transistor; electricity predicts and silicon part-of
  // are not dependence and stay off the card.
  assert.deepEqual(panel.restsOnIt, [
    { nodeId: "n-circuit", label: "circuit", type: "built-on" },
  ]);
});

test("layerStory lists engaged nodes in engagement order and unengaged ids", () => {
  const story = layerStory(historyState(), "l3");
  assert.equal(story.layerName, "logic");
  // l3 has n-logic-gate and n-bit; only n-bit is engaged in the script.
  assert.deepEqual(story.engaged.map((entry) => entry.nodeId), ["n-bit"]);
  assert.equal(story.engaged[0].firstTurn, 4);
  assert.equal(story.engaged[0].current, "correct");
  assert.deepEqual(story.unengaged, ["n-logic-gate"]);
});

test("layerStory of the foundation layer shows a full rotation story", () => {
  // Build a ledger where n-transistor (l2) rotates and l0 stays unengaged.
  const story = layerStory(historyState(), "l2");
  assert.equal(story.layerName, "electronics");
  assert.deepEqual(story.engaged.map((entry) => entry.nodeId), ["n-transistor"]);
  assert.deepEqual(
    story.engaged[0].rotations.map((entry) => entry.state),
    ["misconception", "misconception", "correct"]
  );
  assert.deepEqual(story.unengaged.sort(), ["n-circuit"]);
});

test("timelineStops returns one stop per ledger turn with reply and probe", () => {
  const stops = timelineStops(historyState());
  assert.equal(stops.length, 4);
  assert.deepEqual(stops[0], {
    turn: 1,
    reply: "What have you noticed?",
    probe: { nodeId: "n-transistor", kind: "probe" },
  });
  assert.equal(stops[3].probe && stops[3].probe.nodeId, "n-bit");
});

test("snapshotAt returns the learner map as of turn t and clamps to live", () => {
  const state = historyState();
  assert.equal(snapshotAt(state, 1)?.nodes[0].state, "misconception");
  assert.equal(snapshotAt(state, 3)?.nodes[0].state, "correct");
  assert.equal(snapshotAt(state, 2)?.nodes[0].confidence, 0.35);
  // Clamping: turn 0 -> first snapshot; turn 99 -> last (live).
  assert.deepEqual(snapshotAt(state, 0), snapshotAt(state, 1));
  assert.deepEqual(snapshotAt(state, 99), snapshotAt(state, 4));
  // The snapshot is the ledger's own deep copy, never the live map.
  assert.notEqual(snapshotAt(state, 4), state.learnerMap);
});

test("snapshotAt returns null when the ledger is empty", () => {
  assert.equal(snapshotAt({ realityMap: laptopRealityMap, learnerMap: laptopLearnerMap, ledger: [] }, 1), null);
});

test("snapshotDiff returns the turn's diff for animation replay", () => {
  const state = historyState();
  assert.deepEqual(snapshotDiff(state, 3), {
    added: [],
    flipped: [{ id: "n-transistor", from: "misconception", to: "correct" }],
    updated: [],
  });
  assert.equal(snapshotDiff(state, 99), snapshotDiff(state, 4));
});
