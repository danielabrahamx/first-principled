import { test } from "node:test";
import assert from "node:assert/strict";

import { phaseLabel, errorMessage } from "./chat.js";

/**
 * A minimal session state for the pure helpers.
 *
 * @param {object} overrides
 * @returns {any}
 */
function state(overrides = {}) {
  return {
    word: null,
    realityMap: null,
    learnerMap: { nodes: [], edges: [] },
    history: [],
    failedAttempts: {},
    phase: "init",
    ended: false,
    transferResult: null,
    lastDiff: null,
    lastReply: null,
    closeness: null,
    ...overrides,
  };
}

test("the phase indicator starts at Starting and survives an init refusal", () => {
  assert.deepEqual(phaseLabel(state()), { kind: "starting", label: "Starting" });
  assert.deepEqual(
    phaseLabel(state({ phase: "init", history: [{ role: "assistant", content: "refused" }] })),
    { kind: "starting", label: "Starting" }
  );
});

test("active with an empty learner map is Exploring (observation-first)", () => {
  assert.deepEqual(phaseLabel(state({ phase: "active" })), {
    kind: "exploring",
    label: "Exploring",
  });
});

test("active with a populated learner map is Refining (gap-first)", () => {
  assert.deepEqual(
    phaseLabel(
      state({
        phase: "active",
        learnerMap: {
          nodes: [{ id: "n1", state: "correct", confidence: 0.9, evidence: [] }],
          edges: [],
        },
      })
    ),
    { kind: "refining", label: "Refining" }
  );
});

test("phase end is Session end, before and after the session freezes", () => {
  assert.deepEqual(phaseLabel(state({ phase: "end" })), {
    kind: "end",
    label: "Session end",
  });
  assert.deepEqual(phaseLabel(state({ phase: "end", ended: true })), {
    kind: "end",
    label: "Session end",
  });
});

test("every transport code has a friendly line, never raw text", () => {
  const known = [
    "bad_request",
    "config_error",
    "internal",
    "upstream_error",
    "invalid_model_output",
    "network",
  ];
  for (const code of known) {
    const message = errorMessage(code);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 0);
    assert.ok(!message.includes("{"), `${code} leaked raw JSON`);
    assert.ok(!message.includes("fetch"), `${code} leaked raw text`);
  }
});

test("unknown codes fall back to the generic message", () => {
  assert.equal(errorMessage("mystery"), errorMessage("unknown"));
  assert.equal(errorMessage(""), errorMessage("unknown"));
});
