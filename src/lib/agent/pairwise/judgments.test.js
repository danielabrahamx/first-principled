import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPairBatchJsonSchema,
  normalizePairBatch,
  pairBatchProblems,
  parsePairBatchText,
} from "./judgments.js";

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

/* ---------------------------------------------------------------------------
 * Envelope coercion. Every shape below was observed live across both routes
 * (v9 research 01). The underlying judgments in those runs were sound, so the
 * envelope is fixed in code and the validator stays authoritative.
 * ------------------------------------------------------------------------- */

test("a bare array of judgments is wrapped and accepted", () => {
  const raw = [judgment("p-a--b"), judgment("p-a--c", { relation: "NONE" })];
  const { value, coerced } = normalizePairBatch(raw, ["p-a--b", "p-a--c"]);
  assert.ok(coerced.some((note) => /bare array/.test(note)));
  assert.deepEqual(pairBatchProblems(value, ["p-a--b", "p-a--c"]), []);
});

test("an echoed type field is dropped and the batch accepted", () => {
  const raw = { type: "json_object", judgments: [judgment("p-a--b")] };
  const { value, coerced } = normalizePairBatch(raw, ["p-a--b"]);
  assert.ok(coerced.some((note) => /type field/.test(note)));
  assert.deepEqual(pairBatchProblems(value, ["p-a--b"]), []);
});

test("a keyed-object envelope is lifted to an array with ids restored", () => {
  const raw = {
    "p-a--b": { relation: "A_RESTS_ON_B", confidence: "HIGH", jump: "SMALL", rationale: "needs B" },
  };
  const { value, coerced } = normalizePairBatch(raw, ["p-a--b"]);
  assert.ok(coerced.some((note) => /keyed-object/.test(note)));
  assert.deepEqual(pairBatchProblems(value, ["p-a--b"]), []);
});

test("a keyed-object envelope with a non-pair key is left to the validator", () => {
  const raw = { notes: { relation: "NONE" } };
  const { value, coerced } = normalizePairBatch(raw, ["p-a--b"]);
  assert.deepEqual(coerced, []);
  assert.ok(pairBatchProblems(value, ["p-a--b"]).length > 0);
});

test("SMALL on a NONE row is coerced to NOT_APPLICABLE", () => {
  const raw = { judgments: [judgment("p-a--b", { relation: "NONE", jump: "SMALL" })] };
  const { value, coerced } = normalizePairBatch(raw, ["p-a--b"]);
  assert.ok(coerced.some((note) => /NOT_APPLICABLE on a NONE row/.test(note)));
  assert.deepEqual(pairBatchProblems(value, ["p-a--b"]), []);
});

test("TOO_LARGE on a SAME_CONCEPT row is coerced, and a directional row is not", () => {
  const same = normalizePairBatch(
    { judgments: [judgment("p-a--b", { relation: "SAME_CONCEPT", jump: "TOO_LARGE" })] },
    ["p-a--b"]
  );
  assert.deepEqual(pairBatchProblems(same.value, ["p-a--b"]), []);
  // A directional row keeps its jump: SMALL and TOO_LARGE are both legal and
  // coercion must not invent a walkable edge or erase a missing bridge.
  for (const jump of ["SMALL", "TOO_LARGE"]) {
    const directional = normalizePairBatch(
      { judgments: [judgment("p-a--b", { jump })] },
      ["p-a--b"]
    );
    assert.deepEqual(directional.coerced, []);
    assert.deepEqual(pairBatchProblems(directional.value, ["p-a--b"]), []);
  }
});

test("prose-case and separated relation tokens are canonicalized", () => {
  // Case and separators are mechanical, not semantic: the same
  // canonicalization the Chronology stage uses. "a rests on b" is the
  // relation written out, not a different claim.
  const raw = {
    judgments: [judgment("p-a--b", { relation: "a rests on b", confidence: "high" })],
  };
  const { value, coerced } = normalizePairBatch(raw, ["p-a--b"]);
  assert.ok(coerced.some((note) => /canonicalized relation to A_RESTS_ON_B/.test(note)));
  assert.deepEqual(pairBatchProblems(value, ["p-a--b"]), []);
});

test("a token that canonicalizes to something outside the contract is rejected", () => {
  const raw = { judgments: [judgment("p-a--b", { relation: "a rests upon b" })] };
  const { value } = normalizePairBatch(raw, ["p-a--b"]);
  assert.ok(pairBatchProblems(value, ["p-a--b"]).some((e) => /invalid relation/.test(e)));
});

test("coercion does not rescue a missing, unknown, or duplicate pair id", () => {
  const missing = normalizePairBatch({ judgments: [judgment("p-a--b")] }, ["p-a--b", "p-a--c"]);
  assert.ok(pairBatchProblems(missing.value, ["p-a--b", "p-a--c"]).some((e) => /missing judgment/.test(e)));
  const unknown = normalizePairBatch(
    { judgments: [judgment("p-a--b"), judgment("p-x--y")] },
    ["p-a--b", "p-a--c"]
  );
  assert.ok(pairBatchProblems(unknown.value, ["p-a--b", "p-a--c"]).some((e) => /not requested/.test(e)));
  const duplicate = normalizePairBatch(
    { judgments: [judgment("p-a--b"), judgment("p-a--b")] },
    ["p-a--b"]
  );
  assert.ok(pairBatchProblems(duplicate.value, ["p-a--b"]).some((e) => /duplicate judgment/.test(e)));
});

test("coercion does not rescue a chronology rationale or an unexpected field", () => {
  const rationale = normalizePairBatch(
    { judgments: [judgment("p-a--b", { rationale: "B came before A in the chronology." })] },
    ["p-a--b"]
  );
  assert.ok(pairBatchProblems(rationale.value, ["p-a--b"]).some((e) => /position or chronology/.test(e)));
  const extra = normalizePairBatch(
    { judgments: [{ ...judgment("p-a--b"), crown: true }] },
    ["p-a--b"]
  );
  assert.ok(pairBatchProblems(extra.value, ["p-a--b"]).some((e) => /unexpected field/.test(e)));
});

test("a non-object reply is returned unchanged so the validator reports it", () => {
  assert.equal(normalizePairBatch(null, ["p-a--b"]).value, null);
  assert.equal(normalizePairBatch("nope", ["p-a--b"]).value, "nope");
});

test("pair ids are matched case-insensitively but not by fuzzy similarity", () => {
  const cased = normalizePairBatch({ judgments: [judgment("P-A--B")] }, ["p-a--b"]);
  assert.deepEqual(pairBatchProblems(cased.value, ["p-a--b"]), []);
  const near = normalizePairBatch({ judgments: [judgment("p-a--b-extra")] }, ["p-a--b"]);
  assert.ok(pairBatchProblems(near.value, ["p-a--b"]).some((e) => /not requested/.test(e)));
});

test("parsePairBatchText recovers a bare array that JSON.parse accepts", () => {
  const parsed = parsePairBatchText('[{"pair_id":"p-a--b"}]');
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 1);
});

test("parsePairBatchText recovers newline-delimited judgment objects", () => {
  const raw = '{"pair_id":"p-a--b","relation":"A_RESTS_ON_B"}\n{"pair_id":"p-a--c","relation":"NONE"}';
  const parsed = parsePairBatchText(raw);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 2);
  const normalized = normalizePairBatch(parsed, ["p-a--b", "p-a--c"]);
  const out = /** @type {{ judgments: unknown[] }} */ (normalized.value);
  assert.equal(out.judgments.length, 2);
});

test("parsePairBatchText returns null on unrecoverable text", () => {
  assert.equal(parsePairBatchText("I cannot answer that."), null);
  assert.equal(parsePairBatchText(""), null);
});
