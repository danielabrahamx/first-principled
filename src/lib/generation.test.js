import { test } from "node:test";
import assert from "node:assert/strict";

import { createSessionStore } from "../state/session.js";
import { generateTree, runAgentTurn, errorMessage } from "./generation.js";

/**
 * A fake callAgent that records the request bodies it saw and returns a
 * fixed result.
 *
 * @param {any} result
 * @param {any[]} [seen]
 * @returns {(body: any) => Promise<any>}
 */
function agent(result, seen = []) {
  return async (body) => {
    seen.push(body);
    return result;
  };
}

/** A valid init-turn response: a reality map plus the opening Socratic turn. */
const okTurn = {
  reply: "What have you noticed about electricity?",
  realityMap: { concept: "laptop", layers: [], nodes: [], edges: [] },
  learnerMap: { nodes: [], edges: [] },
  diff: { added: [], flipped: [], updated: [] },
  phase: "active",
  failedAttempts: {},
};

test("generateTree starts a session for the word and runs the init turn", async () => {
  const store = createSessionStore();
  /** @type {any[]} */
  const seen = [];
  const result = await generateTree(store, "laptop", {
    callAgent: agent({ ok: true, data: okTurn }, seen),
  });
  assert.deepEqual(result, { ok: true });
  const state = store.getState();
  assert.equal(state.word, "laptop");
  assert.equal(state.phase, "active");
  assert.equal(state.realityMap?.concept, "laptop");
  assert.equal(state.history.length, 1);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].phase, "init");
  assert.equal(seen[0].word, "laptop");
  assert.equal(seen[0].fastPath, true, "init always requests one-shot");
});

test("generateTree always requests the one-shot path", async () => {
  const store = createSessionStore();
  /** @type {any[]} */
  const seen = [];
  await generateTree(store, "photosynthesis", {
    callAgent: agent({ ok: true, data: okTurn }, seen),
  });
  assert.equal(seen[0].fastPath, true);
});

test("generateTree rejects an empty word without touching the store", async () => {
  const store = createSessionStore();
  const result = await generateTree(store, "   ", {
    callAgent: agent({ ok: true, data: okTurn }),
  });
  assert.deepEqual(result, { ok: false, code: "bad_request" });
  assert.equal(store.getState().word, null);
});

test("generateTree returns the transport code and leaves the store untouched on failure", async () => {
  const store = createSessionStore();
  /** @type {any[]} */
  const seen = [];
  const result = await generateTree(store, "laptop", {
    callAgent: agent({ ok: false, code: "upstream_error" }, seen),
  });
  assert.deepEqual(result, { ok: false, code: "upstream_error" });
  const state = store.getState();
  assert.equal(state.word, "laptop");
  assert.equal(state.realityMap, null);
  assert.equal(state.history.length, 0);
  assert.equal(seen.length, 1);
});

test("runAgentTurn applies a 200 response to the store", async () => {
  const store = createSessionStore();
  assert.ok(store.startSession("laptop"));
  const result = await runAgentTurn(store, {
    callAgent: agent({ ok: true, data: okTurn }),
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(store.getState().phase, "active");
  assert.equal(store.getState().realityMap?.concept, "laptop");
});

test("runAgentTurn collapses an unreadable 200 to internal", async () => {
  const store = createSessionStore();
  assert.ok(store.startSession("laptop"));
  const result = await runAgentTurn(store, {
    callAgent: agent({ ok: true, data: null }),
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
  assert.equal(store.getState().history.length, 0);
});

test("runAgentTurn does not apply a failed response", async () => {
  const store = createSessionStore();
  assert.ok(store.startSession("laptop"));
  const result = await runAgentTurn(store, {
    callAgent: agent({ ok: false, code: "network" }),
  });
  assert.deepEqual(result, { ok: false, code: "network" });
  assert.equal(store.getState().history.length, 0);
});

test("every transport code has a friendly line, never raw text", () => {
  const known = [
    "bad_request",
    "config_error",
    "internal",
    "upstream_error",
    "invalid_model_output",
    "network",
    "too_large",
    "rate_limited",
    "captcha_required",
    "captcha_failed",
  ];
  for (const code of known) {
    const message = errorMessage(code);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 0);
    assert.ok(!message.includes("{"), `${code} leaked raw JSON`);
    assert.ok(!message.includes("fetch"), `${code} leaked raw text`);
  }
  assert.equal(errorMessage("mystery"), errorMessage("unknown"));
  assert.equal(errorMessage(""), errorMessage("unknown"));
});
