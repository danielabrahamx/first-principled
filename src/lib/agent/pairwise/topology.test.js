import { test } from "node:test";
import assert from "node:assert/strict";

import { TARGET_ID } from "./pairs.js";
import { selectTopology } from "./topology.js";

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

function chainInput() {
  const candidates = [candidate("k1"), candidate("k2"), candidate("k3")];
  return {
    concept: "recursion",
    candidates,
    judgments: [
      // target rests on k1; k1 rests on k2; k2 rests on k3.
      judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
      judgment("k1", "k2", "A_RESTS_ON_B"),
      judgment("k2", "k3", "A_RESTS_ON_B"),
      judgment("k1", "k3", "NONE"),
      judgment("k2", TARGET_ID, "NONE"),
      judgment("k3", TARGET_ID, "NONE"),
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
  input.candidates.push(candidate("k4"), candidate("k5"));
  input.judgments.push(
    judgment("k1", "k4", "SAME_CONCEPT"),
    judgment("k2", "k5", "SAME_CONCEPT", { confidence: "MEDIUM", jump: "NOT_APPLICABLE" }),
    judgment("k4", TARGET_ID, "NONE"),
    judgment("k5", TARGET_ID, "NONE"),
    judgment("k3", "k4", "NONE"),
    judgment("k3", "k5", "NONE"),
    judgment("k4", "k5", "NONE")
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
  assert.ok(!result.nodes.includes("k4"), "HIGH duplicate k4 must merge away");
  assert.ok(result.nodes.includes("k1"));
});

test("contradictory cycles drop MEDIUM before HIGH", () => {
  const candidates = [candidate("k1"), candidate("k2")];
  const judgments = [
    judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
    judgment("k1", "k2", "A_RESTS_ON_B"),
    // k2 rests on target closes a directed cycle; MEDIUM must drop.
    judgment("k2", TARGET_ID, "B_RESTS_ON_A", { confidence: "MEDIUM" }),
  ];
  const result = selectTopology({ concept: "battery", candidates, judgments });
  assert.ok(result.ok);
  assert.ok(result.ok);
  assert.ok(!result.edges.some((edge) => edge.confidence === "MEDIUM" && edge.source === "k2"));
  assert.deepEqual(result.trunk, ["k2", "k1", TARGET_ID]);
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
  input.candidates.push(candidate("k4"));
  input.judgments.push(
    // k4 rests on k1: side support attaching to the trunk.
    judgment("k1", "k4", "B_RESTS_ON_A"),
    judgment("k2", "k4", "NONE"),
    judgment("k3", "k4", "NONE"),
    judgment("k4", TARGET_ID, "NONE")
  );
  const result = selectTopology(input);
  assert.ok(result.ok);
  assert.ok(result.ok);
  assert.ok(result.nodes.includes("k4"));
  assert.ok(result.nodes.length <= 10);
});
