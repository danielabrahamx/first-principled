import { test } from "node:test";
import assert from "node:assert/strict";

import { inventoryProblems, buildInventoryJsonSchema } from "./inventory.js";

/**
 * @param {string} id
 * @param {string} label
 * @returns {{ id: string; label: string; gloss: string; kind: string; foundation_fit: string }}
 */
function candidate(id, label) {
  return { id, label, gloss: `What ${label} is.`, kind: "mechanism", foundation_fit: "DEMONSTRABLE" };
}

/**
 * @returns {{ concept: string; candidates: Record<string, any>[] }}
 */
function validReply() {
  return {
    concept: "battery",
    candidates: [
      "charge transfer",
      "ion movement",
      "electrochemical cell",
      "electrode surface",
      "electrolyte medium",
      "circuit load",
      "energy storage",
      "redox reaction",
    ].map((label, index) => candidate(`k${index + 1}`, label)),
  };
}

test("inventory accepts eight unordered candidates", () => {
  assert.deepEqual(inventoryProblems(validReply(), "battery"), []);
});

test("inventory rejects too few and too many candidates", () => {
  const few = validReply();
  few.candidates = few.candidates.slice(0, 7);
  assert.ok(inventoryProblems(few, "battery").some((error) => error.includes("8 to 10")));
  const many = validReply();
  many.candidates.push(candidate("k9", "extra bridge"), candidate("k10", "second extra"), candidate("k11", "third extra"));
  assert.ok(inventoryProblems(many, "battery").some((error) => error.includes("8 to 10")));
});

test("inventory rejects duplicate ids and duplicate labels", () => {
  const dupId = validReply();
  dupId.candidates[1] = candidate("k1", "ion movement");
  assert.ok(inventoryProblems(dupId, "battery").some((error) => error.includes("duplicate candidate id")));
  const dupLabel = validReply();
  dupLabel.candidates[1] = candidate("k2", "Charge Transfer!");
  assert.ok(inventoryProblems(dupLabel, "battery").some((error) => error.includes("duplicate candidate label")));
});

test("inventory rejects a candidate duplicating the target", () => {
  const reply = validReply();
  reply.candidates[0] = candidate("k1", "Battery");
  assert.ok(inventoryProblems(reply, "battery").some((error) => error.includes("typed target")));
});

test("inventory rejects unexpected fields and bad enums", () => {
  const reply = validReply();
  const withEdges = /** @type {Record<string, any>} */ ({ ...candidate("k1", "charge transfer"), edges: [] });
  reply.candidates[0] = withEdges;
  assert.ok(inventoryProblems(reply, "battery").some((error) => error.includes("unexpected field")));
  const badFit = validReply();
  badFit.candidates[0] = { ...candidate("k1", "charge transfer"), foundation_fit: "MAYBE" };
  assert.ok(inventoryProblems(badFit, "battery").some((error) => error.includes("foundation_fit")));
  const wrongConcept = validReply();
  assert.ok(inventoryProblems(wrongConcept, "laptop").some((error) => error.includes("concept")));
});
test("inventory schema pins concept and candidate fields", () => {
  const schema = buildInventoryJsonSchema("battery");
  assert.equal(schema.strict, true);
  assert.deepEqual(schema.schema.required, ["concept", "candidates"]);
  assert.deepEqual(schema.schema.properties.concept, { type: "string", enum: ["battery"] });
});
