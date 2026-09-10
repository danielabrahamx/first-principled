import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPairBatchJsonSchema, pairBatchProblems } from "./judgments.js";

/**
 * @param {string} pairId
 * @param {object} [override]
 */
function judgment(pairId, override = {}) {
  return {
    pair_id: pairId,
    relation: "A_RESTS_ON_B",
    confidence: "HIGH",
    jump: "SMALL",
    rationale: "A needs the mechanism B provides.",
    ...override,
  };
}

test("pair batch accepts exact coverage", () => {
  const value = { judgments: [judgment("p-a--b"), judgment("p-a--c", { relation: "NONE", jump: "NOT_APPLICABLE" })] };
  assert.deepEqual(pairBatchProblems(value, ["p-a--b", "p-a--c"]), []);
});

test("pair batch rejects missing, unknown, and duplicate ids", () => {
  const missing = { judgments: [judgment("p-a--b")] };
  assert.ok(pairBatchProblems(missing, ["p-a--b", "p-a--c"]).some((e) => e.includes("missing judgment")));
  const unknown = { judgments: [judgment("p-a--b"), judgment("p-x--y")] };
  assert.ok(pairBatchProblems(unknown, ["p-a--b", "p-a--c"]).some((e) => e.includes("not requested")));
  const duplicate = { judgments: [judgment("p-a--b"), judgment("p-a--b")] };
  assert.ok(pairBatchProblems(duplicate, ["p-a--b"]).some((e) => e.includes("duplicate judgment")));
});

test("pair batch enforces jump combinations", () => {
  const badDirectional = { judgments: [judgment("p-a--b", { jump: "NOT_APPLICABLE" })] };
  assert.ok(pairBatchProblems(badDirectional, ["p-a--b"]).some((e) => e.includes("directional")));
  const badNone = { judgments: [judgment("p-a--b", { relation: "NONE", jump: "SMALL" })] };
  assert.ok(pairBatchProblems(badNone, ["p-a--b"]).some((e) => e.includes("non-directional")));
  const okLarge = { judgments: [judgment("p-a--b", { jump: "TOO_LARGE" })] };
  assert.deepEqual(pairBatchProblems(okLarge, ["p-a--b"]), []);
});

test("pair batch rejects position and chronology rationale", () => {
  const value = {
    judgments: [judgment("p-a--b", { rationale: "B came before A in the chronology." })],
  };
  assert.ok(pairBatchProblems(value, ["p-a--b"]).some((e) => e.includes("position or chronology")));
});

test("pair batch rejects unexpected fields", () => {
  const value = { judgments: [{ ...judgment("p-a--b"), crown: true }] };
  assert.ok(pairBatchProblems(value, ["p-a--b"]).some((e) => e.includes("unexpected field")));
});

test("pair batch schema restricts pair ids to the requested set", () => {
  const schema = buildPairBatchJsonSchema("battery", ["p-a--b"]);
  assert.equal(schema.strict, true);
  assert.deepEqual(schema.schema.properties.judgments.items.properties.pair_id, {
    type: "string",
    enum: ["p-a--b"],
  });
});
