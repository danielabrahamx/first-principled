import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, laptopLearnerMap } from "../mmg/fixtures.js";
import { orderedGaps, nextGaps, hasKnownModel } from "./gaps.js";

/**
 * A typed learner node, so the constructed maps pass the JSDoc typecheck.
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
 * @param {object} overrides
 * @returns {import("./gaps.js").GapPlan}
 */
function planFor(overrides) {
  return nextGaps({ realityMap: laptopRealityMap, learnerMap: laptopLearnerMap, ...overrides });
}

test("orderedGaps returns every non-correct node with its layer", () => {
  const gaps = orderedGaps(laptopRealityMap, laptopLearnerMap);
  const ids = gaps.map((gap) => gap.nodeId);
  // laptopLearnerMap: electricity correct, circuit correct, os correct; the
  // other five nodes are non-correct.
  assert.deepEqual(ids.sort(), [
    "n-app",
    "n-bit",
    "n-logic-gate",
    "n-silicon",
    "n-transistor",
  ]);
  const silicon = gaps.find((gap) => gap.nodeId === "n-silicon");
  assert.ok(silicon, "n-silicon is a gap in the fixture");
  assert.equal(silicon.layerIndex, 1);
  assert.equal(silicon.layerName, "materials");
  assert.equal(silicon.state, "untested");
  assert.equal(silicon.reason, "untested");
});

test("dependency order: lower layers before abstractions", () => {
  const gaps = orderedGaps(laptopRealityMap, laptopLearnerMap);
  const indexes = gaps.map((gap) => gap.layerIndex);
  const sorted = [...indexes].sort((a, b) => a - b);
  assert.deepEqual(indexes, sorted, "candidates are ordered by layer, foundation first");
  assert.equal(gaps[0].nodeId, "n-silicon", "l1 (silicon) is the lowest affected layer");
});

test("within a layer: misconception over missing over untested", () => {
  // Force everything below l2 correct so the lowest affected layer is l2,
  // where n-transistor (misconception) must outrank n-circuit (untested).
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const learner = {
    nodes: [
      ...laptopRealityMap.nodes
        .filter((node) => node.layer === "l0" || node.layer === "l1")
        .map((node) => ln(node.id, "correct", 0.9, ["known"])),
      ln("n-transistor", "misconception", 0.4, ["a switch you flick by hand"]),
    ],
    edges: [],
  };
  const gaps = orderedGaps(laptopRealityMap, learner);
  assert.equal(gaps[0].nodeId, "n-transistor", "misconception first within l2");
  assert.equal(gaps[1].nodeId, "n-circuit", "untested second within l2");
  assert.equal(gaps[0].reason, "misconception");
});

test("missing outranks untested within the same layer", () => {
  // l3 has n-logic-gate (missing) and n-bit (untested); missing must win.
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const learner = {
    nodes: [
      ...laptopRealityMap.nodes
        .filter((node) => ["l0", "l1", "l2"].includes(node.layer))
        .map((node) => ln(node.id, "correct", 0.9, ["known"])),
      ln("n-logic-gate", "missing", 0.1, []),
    ],
    edges: [],
  };
  const gaps = orderedGaps(laptopRealityMap, learner);
  assert.equal(gaps[0].nodeId, "n-logic-gate");
  assert.equal(gaps[0].reason, "missing");
});

test("an empty model opens with observe, not a gap", () => {
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: { nodes: [], edges: [] } });
  assert.equal(plan.mode, "observe");
  assert.equal(plan.reason, "nothing known yet");
  assert.equal(plan.target, null);
});

test("an all-untested map is still an empty model - observation first", () => {
  const learner = {
    nodes: laptopRealityMap.nodes.map((node) => ln(node.id, "untested", 0, [])),
    edges: [],
  };
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: learner });
  assert.equal(plan.mode, "observe");
  assert.equal(hasKnownModel(learner), false);
});

test("a briefing request defers probing entirely", () => {
  const plan = planFor({ briefing: true });
  assert.equal(plan.mode, "deferred");
  assert.equal(plan.reason, "briefing");
  assert.equal(plan.target, null);
});

test("a due explanation defers probing entirely", () => {
  const plan = planFor({ explainDue: true });
  assert.equal(plan.mode, "deferred");
  assert.equal(plan.reason, "explanation due");
  assert.equal(plan.target, null);
});

test("a gap turn names the forced target and the next candidates", () => {
  const plan = planFor({});
  assert.equal(plan.mode, "gap");
  assert.ok(plan.target, "a populated learner map has a gap");
  assert.equal(plan.target.nodeId, "n-silicon", "the fixture's lowest affected layer is l1");
  assert.equal(plan.target.reason, "untested");
  assert.ok(plan.candidates.length >= 3, "the report carries the next few candidates");
  assert.equal(plan.candidates[0].nodeId, plan.target.nodeId);
});

test("no gaps left means observe (session is about to end)", () => {
  const learner = {
    nodes: laptopRealityMap.nodes.map((node) => ln(node.id, "correct", 0.9, ["known"])),
    edges: [],
  };
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: learner });
  assert.equal(plan.mode, "observe");
  assert.equal(plan.reason, "no gaps left");
});

/* ---------------------------------------------------------------------------
 * Ticket 04: the prediction move (principle 2)
 * ------------------------------------------------------------------------- */

/**
 * A learner map with l0-l2 foundations correct and a stated misconception
 * on n-transistor (evidence present) while n-circuit stays untested.
 *
 * @returns {import("../mmg/types.js").LearnerMentalModel}
 */
function statedTransistorLearner() {
  return {
    nodes: [
      ...laptopRealityMap.nodes
        .filter((node) => node.layer === "l0" || node.layer === "l1")
        .map((node) => ln(node.id, "correct", 0.9, ["known"])),
      ln("n-transistor", "misconception", 0.4, ["a transistor is a switch you flick by hand"]),
    ],
    edges: [],
  };
}

test("a misconception on the learner's own correct foundation triggers confront", () => {
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: statedTransistorLearner() });
  assert.equal(plan.mode, "confront");
  assert.equal(plan.reason, "misconception collides with the learner's own correct foundation");
  assert.ok(plan.target);
  assert.equal(plan.target.nodeId, "n-transistor");
  assert.equal(plan.target.reason, "misconception");
});

test("a misconception with no correct foundation below triggers predict instead", () => {
  // The foundation layer itself carries the misconception - there is nothing
  // sound beneath it to confront, so the belief is turned into a prediction.
  const learner = {
    nodes: [
      ln("n-electricity", "misconception", 0.4, ["electricity is stored in the battery like a liquid"]),
    ],
    edges: [],
  };
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: learner });
  assert.equal(plan.mode, "predict");
  assert.ok(plan.target);
  assert.equal(plan.target.nodeId, "n-electricity");
});

test("an unstated gap stays a plain probe", () => {
  const learner = statedTransistorLearner();
  learner.nodes = learner.nodes.map((node) =>
    node.id === "n-transistor" ? ln(node.id, "misconception", 0.4, []) : node
  );
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: learner });
  assert.equal(plan.mode, "gap");
  assert.ok(plan.target);
  assert.equal(plan.target.nodeId, "n-transistor");
});

test("a missing node with a statement is prediction-testable too", () => {
  const learner = statedTransistorLearner();
  learner.nodes = learner.nodes.map((node) =>
    node.id === "n-transistor"
      ? ln(node.id, "missing", 0.2, ["I keep hearing it's important but I can't say what it does"])
      : node
  );
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: learner });
  assert.equal(plan.mode, "predict");
  assert.ok(plan.target);
  assert.equal(plan.target.nodeId, "n-transistor");
});

test("a stated belief in a higher layer does not override an untested foundation", () => {
  // l1 silicon is untested (no statement); the stated transistor belief sits
  // in l2. Dependency order wins: the plan stays a plain probe of silicon.
  const learner = {
    nodes: [
      ln("n-electricity", "correct", 0.9, ["known"]),
      ln("n-transistor", "misconception", 0.4, ["a transistor is a switch you flick by hand"]),
    ],
    edges: [],
  };
  const plan = nextGaps({ realityMap: laptopRealityMap, learnerMap: learner });
  assert.equal(plan.mode, "gap", "dependency order rules over the prediction move");
  assert.ok(plan.target);
  assert.equal(plan.target.nodeId, "n-silicon");
});

test("nextGaps is pure: identical inputs produce identical plans", () => {
  const a = planFor({});
  const b = planFor({});
  assert.deepEqual(a, b);
  const c = planFor({ briefing: true });
  assert.notDeepEqual(a, c);
});
