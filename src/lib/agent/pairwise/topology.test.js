import { test } from "node:test";
import assert from "node:assert/strict";

import { TARGET_ID } from "./pairs.js";
import { MIN_NODES, MIN_TRUNK_NODES, selectTopology } from "./topology.js";

/**
 * @param {string} id
 * @param {string} [fit]
 */
function candidate(id, fit = "DEMONSTRABLE") {
  return { id, label: `label ${id}`, gloss: `Gloss for ${id}.`, kind: "mechanism", foundation_fit: fit };
}

/**
 * Build a judgment for an unordered pair. Relation is relative to the
 * sorted A and B, matching enumeratePairs assignment.
 *
 * @param {string} first
 * @param {string} second
 * @param {string} relation
 * @param {object} [override]
 */
function judgment(first, second, relation, override = {}) {
  const [a, b] = first < second ? [first, second] : [second, first];
  return {
    pair_id: `p-${a}--${b}`,
    a_id: a,
    b_id: b,
    relation,
    confidence: "HIGH",
    jump: relation === "NONE" || relation === "SAME_CONCEPT" ? "NOT_APPLICABLE" : "SMALL",
    rationale: "Local dependence verdict.",
    ...override,
  };
}

/**
 * The base fixture: a four-node target-to-foundation trunk (target, k1,
 * k2, k3) plus one side prerequisite k4 that rests on k2. Both floors in
 * topology.js are minima on the *published* tree, not on the judgments:
 * a four-node trunk is the walk, and k4 is the fan-in the map needs to
 * be more than a list with arrows on it.
 */
function chainInput() {
  const candidates = [candidate("k1"), candidate("k2"), candidate("k3"), candidate("k4")];
  return {
    concept: "recursion",
    candidates,
    judgments: [
      // target rests on k1; k1 rests on k2; k2 rests on k3.
      judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
      judgment("k1", "k2", "A_RESTS_ON_B"),
      judgment("k2", "k3", "A_RESTS_ON_B"),
      // k4 rests on k2: one side prerequisite, attached to the trunk.
      judgment("k2", "k4", "B_RESTS_ON_A"),
      judgment("k1", "k3", "NONE"),
      judgment("k1", "k4", "NONE"),
      judgment("k2", TARGET_ID, "NONE"),
      judgment("k3", TARGET_ID, "NONE"),
      judgment("k3", "k4", "NONE"),
      judgment("k4", TARGET_ID, "NONE"),
    ],
  };
}

test("direction follows dependent to prerequisite", () => {
  const result = selectTopology(chainInput());
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  const edge = result.edges.find((item) => item.pair_id === `p-k1--${TARGET_ID}`);
  assert.ok(edge);
  assert.equal(edge.source, TARGET_ID);
  assert.equal(edge.target, "k1");
});

test("truthful chain is accepted with foundation-first trunk", () => {
  const result = selectTopology(chainInput());
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.deepEqual(result.trunk, ["k3", "k2", "k1", TARGET_ID]);
  assert.ok(result.ranks["k3"] < result.ranks[TARGET_ID]);
  assert.ok(result.nodes.length >= 4 && result.nodes.length <= 10);
});

test("every selected edge traces to a pair judgment", () => {
  const result = selectTopology(chainInput());
  assert.ok(result.ok);
  assert.ok(result.ok);
  const known = new Set(chainInput().judgments.map((item) => item.pair_id));
  for (const edge of result.edges) {
    assert.ok(known.has(edge.pair_id), `edge ${edge.edge_id} has no pair judgment`);
    assert.equal(result.provenance[edge.edge_id], edge.pair_id);
  }
});

test("HIGH duplicates merge but the target is never merged away", () => {
  const input = chainInput();
  input.candidates.push(candidate("k5"), candidate("k6"));
  input.judgments.push(
    judgment("k1", "k5", "SAME_CONCEPT"),
    judgment("k2", "k6", "SAME_CONCEPT", { confidence: "MEDIUM", jump: "NOT_APPLICABLE" }),
    judgment("k5", TARGET_ID, "NONE"),
    judgment("k6", TARGET_ID, "NONE"),
    judgment("k3", "k5", "NONE"),
    judgment("k3", "k6", "NONE"),
    judgment("k5", "k6", "NONE")
  );
  const dupTarget = {
    concept: "recursion",
    candidates: [candidate("k1")],
    judgments: [judgment("k1", TARGET_ID, "SAME_CONCEPT")],
  };
  const merged = selectTopology(dupTarget);
  assert.equal(merged.ok, false);
  assert.ok(!merged.ok);
  assert.ok(merged.droppedCandidates.some((item) => item.id === "k1"));

  const result = selectTopology(input);
  assert.ok(result.ok);
  assert.ok(result.ok);
  assert.ok(!result.nodes.includes("k5"), "HIGH duplicate k5 must merge away");
  assert.ok(result.nodes.includes("k1"));
});

test("contradictory cycles drop MEDIUM before HIGH", () => {
  const input = chainInput();
  // k3 rests on target closes a directed cycle; MEDIUM must drop.
  input.judgments.push(
    judgment("k3", TARGET_ID, "B_RESTS_ON_A", { confidence: "MEDIUM" })
  );
  const result = selectTopology(input);
  assert.ok(result.ok);
  assert.ok(result.ok);
  assert.ok(
    !result.edges.some((edge) => edge.confidence === "MEDIUM" && edge.source === "k3"),
    "the MEDIUM edge on the cycle must be the one dropped"
  );
  assert.deepEqual(result.trunk, ["k3", "k2", "k1", TARGET_ID]);
});

test("missing bridges fail honestly with no synthesized edge", () => {
  const candidates = [candidate("k1"), candidate("k2")];
  const judgments = [
    judgment("k1", TARGET_ID, "B_RESTS_ON_A", { jump: "TOO_LARGE" }),
    judgment("k1", "k2", "NONE"),
    judgment("k2", TARGET_ID, "NONE"),
  ];
  const result = selectTopology({ concept: "battery", candidates, judgments });
  assert.equal(result.ok, false);
});

test("LOW judgments never shape topology", () => {
  const input = chainInput();
  input.judgments.push(judgment("k3", TARGET_ID, "B_RESTS_ON_A", { confidence: "LOW" }));
  const result = selectTopology(input);
  assert.ok(result.ok);
  assert.ok(result.ok);
  assert.ok(!result.edges.some((edge) => edge.confidence === "LOW"));
});

test("genuine fan-in is kept within caps", () => {
  const input = chainInput();
  input.candidates.push(candidate("k5"));
  input.judgments.push(
    // k5 rests on k1: a second side support attaching to the trunk.
    judgment("k1", "k5", "B_RESTS_ON_A"),
    judgment("k2", "k5", "NONE"),
    judgment("k3", "k5", "NONE"),
    judgment("k4", "k5", "NONE"),
    judgment("k5", TARGET_ID, "NONE")
  );
  const result = selectTopology(input);
  assert.ok(result.ok);
  assert.ok(result.ok);
  assert.ok(result.nodes.includes("k5"));
  assert.ok(result.nodes.length <= 10);
});

test("nothing may rest on the target: the crown invariant", () => {
  // Measured on both realized trees on 2026-09-29: "voltaic cell needs
  // battery" and "light absorption needs photosynthesis" were selected
  // edges, so the crown had incoming edges and the map had no single
  // top. Rejected rather than dropped: dropping would be salvage of a
  // judgment the model made, which is what made v7 unreadable.
  const input = chainInput();
  // k5 rests on the target and on nothing else on the trunk, so the
  // cycle breaker has no reason to drop this edge and it survives into
  // the selection as an incoming edge on the crown.
  input.candidates.push(candidate("k5"));
  input.judgments.push(
    // Sorted ids make A = k5 and B = target, so A_RESTS_ON_B is
    // "k5 rests on target".
    judgment("k5", TARGET_ID, "A_RESTS_ON_B"),
    judgment("k1", "k5", "NONE"),
    judgment("k2", "k5", "NONE"),
    judgment("k3", "k5", "NONE"),
    judgment("k4", "k5", "NONE")
  );
  const result = selectTopology(input);
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.reason, /crown invariant broken/);
  assert.match(result.reason, /no single top/);
});

test("a 2-node graph is not a tree", () => {
  // The measured false success of 2026-09-29: laptop returned 2 nodes
  // and 1 edge and selectTopology reported ok. A Dependence Tree with no
  // walkable chain is not a map, so this must be rejected.
  const candidates = [candidate("k1")];
  const judgments = [judgment("k1", TARGET_ID, "B_RESTS_ON_A")];
  const result = selectTopology({ concept: "laptop", candidates, judgments });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.reason, /degenerate/);
});

test("a trunk shorter than the minimum is rejected, with its length named", () => {
  // Four nodes, so the node floor is cleared, and every node sits one hop
  // from the target, so the longest walk is 2 and the trunk floor is not.
  // Both floors have to be reachable independently or one of them is
  // untested: with the floors at 4 and 3, a 3-node fixture fails on nodes
  // before it ever reaches the trunk check.
  const candidates = [candidate("k1"), candidate("k2"), candidate("k3")];
  const judgments = [
    judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
    judgment("k2", TARGET_ID, "B_RESTS_ON_A"),
    judgment("k3", TARGET_ID, "B_RESTS_ON_A"),
  ];
  const result = selectTopology({ concept: "laptop", candidates, judgments });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.reason, /longest target-to-foundation path is 2 nodes/);
  assert.ok(
    result.reason.includes(String(MIN_TRUNK_NODES)),
    "the diagnostic must name the minimum it failed"
  );
});

test("the node floor rejects a tree smaller than the derived minimum", () => {
  // Three nodes including the target. The trunk floor is met, so this is
  // the node floor doing its own work and naming itself.
  const candidates = [candidate("k1"), candidate("k2")];
  const judgments = [
    judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
    judgment("k1", "k2", "A_RESTS_ON_B"),
  ];
  const result = selectTopology({ concept: "battery", candidates, judgments });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.reason, /degenerate tree: 3 nodes selected/);
  assert.ok(result.reason.includes(String(MIN_NODES)));
});

test("a 2-node stub is still not a tree", () => {
  // The 2026-09-29 defect, still guarded after the floors moved. One hop
  // from the target and nothing else is not a Dependence Tree at any
  // threshold, so this fixture has to fail at every setting of MIN_NODES
  // and MIN_TRUNK_NODES.
  const candidates = [candidate("k1")];
  const judgments = [judgment("k1", TARGET_ID, "B_RESTS_ON_A")];
  const result = selectTopology({ concept: "laptop", candidates, judgments });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
});

test("RETIRED PREMISE: a bare four-node chain now passes, and that is the decision", () => {
  // 2026-10-01. This fixture was "a chain with no fan-in is rejected on
  // the node minimum", and it was rejected because 4 < MIN_NODES = 5.
  // The product decision was that a 4-node map IS a rabbit hole, so
  // MIN_NODES dropped to 4 and the premise stopped being true. Keeping a
  // red test here would have been dishonest and keeping a green one that
  // asserted the old rejection would have been worse.
  //
  // The real consequence is that the node floor was carrying a second
  // duty it no longer carries: rejecting a map with no side prerequisites.
  // Measured against the hand-written maps, the property that separates
  // `battery` (4 nodes, 2 dependents at one node) from this bare chain
  // (4 nodes, 1 dependent everywhere) is max fan-in, not node count. All
  // four hand-written maps have max fan-in 2 to 3; a pure chain has 1.
  // That rule is NOT applied here. It is recorded in
  // `.scratch/first-principled-v9/research/04-derived-threshold-application.md`
  // as a proposal for the next ticket, because it is a new acceptance
  // rule and this ticket applies a derivation rather than inventing one.
  const candidates = [candidate("k1"), candidate("k2"), candidate("k3")];
  const judgments = [
    judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
    judgment("k1", "k2", "A_RESTS_ON_B"),
    judgment("k2", "k3", "A_RESTS_ON_B"),
  ];
  const result = selectTopology({ concept: "battery", candidates, judgments });
  assert.ok(result.ok, "a 4-node chain is a 4-node map, and 4-node maps were ruled acceptable");
  assert.equal(result.nodes.length, 4);
  assert.ok(result.trunk.length >= MIN_TRUNK_NODES);
});

test("the trunk floor is a floor, not a preference", () => {
  // Two routes from the target. target->k1 is one HIGH edge, so before
  // the floor it out-scored the three-edge MEDIUM chain purely on
  // confidence and the selector returned a 2-node "trunk". The floor
  // has to exclude the short path before scoring runs, so the chain wins.
  const candidates = [candidate("k1"), candidate("k2"), candidate("k3"), candidate("k4"), candidate("k5")];
  const judgments = [
    judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
    judgment("k2", TARGET_ID, "B_RESTS_ON_A", { confidence: "MEDIUM" }),
    judgment("k2", "k3", "A_RESTS_ON_B", { confidence: "MEDIUM" }),
    judgment("k3", "k4", "A_RESTS_ON_B", { confidence: "MEDIUM" }),
    // k5 rests on k2: the fan-in that keeps the tree above the node floor.
    judgment("k2", "k5", "B_RESTS_ON_A"),
  ];
  const result = selectTopology({ concept: "battery", candidates, judgments });
  assert.ok(result.ok, "a four-node trunk exists and must be selected");
  assert.ok(result.ok);
  assert.ok(
    result.trunk.length >= MIN_TRUNK_NODES,
    `selected trunk ${result.trunk.join(" -> ")} is below the floor`
  );
  assert.ok(!result.trunk.includes("k1"), "the 2-node path must not be selected");
  assert.ok(result.nodes.includes("k5"), "the side prerequisite must be kept");
});
