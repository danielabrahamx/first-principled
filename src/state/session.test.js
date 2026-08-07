import { test } from "node:test";
import assert from "node:assert/strict";

import { createSessionStore, sessionStore, EMPTY_LEARNER_MAP } from "./session.js";
import { laptopRealityMap } from "../lib/mmg/fixtures.js";

/**
 * A fully-loaded response as the orchestrator would send it: an active turn
 * with an updated learner map, a diff, and a carried failedAttempts map.
 *
 * @param {object} [overrides]
 * @returns {any}
 */
function turnResponse(overrides = {}) {
  return {
    reply: "What have you noticed about how electricity reaches the chips?",
    learnerMap: {
      nodes: [
        { id: "n-electricity", state: "correct", confidence: 0.9, evidence: ["I know it flows"] },
      ],
      edges: [],
    },
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    ...overrides,
  };
}

test("a fresh store starts empty, in phase init", () => {
  const store = createSessionStore();
  const state = store.getState();
  assert.equal(state.word, null);
  assert.equal(state.realityMap, null);
  assert.deepEqual(state.learnerMap, { nodes: [], edges: [] });
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.failedAttempts, {});
  assert.equal(state.phase, "init");
  assert.equal(state.ended, false);
  assert.equal(state.transferResult, null);
  assert.equal(state.closeness, null);
});

test("startSession rejects a blank word and changes nothing", () => {
  const store = createSessionStore();
  assert.equal(store.startSession("   "), false);
  assert.equal(store.getState().word, null);
});

test("the init request serializes to the spec shape", () => {
  const store = createSessionStore();
  assert.equal(store.startSession("laptop"), true);
  assert.deepEqual(store.toRequest(), {
    word: "laptop",
    history: [],
    phase: "init",
  });
});

test("applying an init response adopts the reality map and moves to active", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  const applied = store.applyResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  assert.equal(applied, true);

  const state = store.getState();
  assert.equal(state.phase, "active");
  assert.deepEqual(state.realityMap, laptopRealityMap);
  assert.equal(state.lastReply, "What have you noticed about how what you type becomes letters on the screen?");
  assert.deepEqual(state.history, [
    { role: "assistant", content: "What have you noticed about how what you type becomes letters on the screen?" },
  ]);
});

test("an init refusal stays on phase init with no reality map", () => {
  const store = createSessionStore();
  store.startSession("gibberish");
  store.applyResponse({
    reply: "I could not find a teachable concept in that input.",
    learnerMap: { nodes: [], edges: [] },
    diff: { added: [], flipped: [], updated: [] },
    phase: "init",
    failedAttempts: {},
  });

  const state = store.getState();
  assert.equal(state.phase, "init");
  assert.equal(state.realityMap, null);
  assert.equal(state.history.length, 1);
  assert.match(state.history[0].content, /teachable concept/);
});

test("an active turn round-trips: user message, request, response, history order", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });

  assert.equal(store.appendUserMessage("I press keys and letters appear"), true);
  assert.deepEqual(store.toRequest(), {
    realityMap: laptopRealityMap,
    learnerMap: EMPTY_LEARNER_MAP,
    failedAttempts: {},
    history: [
      { role: "assistant", content: "What have you noticed about how what you type becomes letters on the screen?" },
      { role: "user", content: "I press keys and letters appear" },
    ],
    phase: "active",
  });

  store.applyResponse(turnResponse());
  const state = store.getState();
  assert.equal(state.history.length, 3);
  assert.equal(state.history[2].role, "assistant");
  assert.equal(state.history[2].content, "What have you noticed about how electricity reaches the chips?");
  assert.equal(state.learnerMap.nodes.length, 1);
  assert.equal(state.learnerMap.nodes[0].state, "correct");
  assert.equal(state.closeness, 1);
});

test("failedAttempts and diff are adopted from responses", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  store.appendUserMessage("I press keys and letters appear");
  store.applyResponse(
    turnResponse({
      failedAttempts: { "n-transistor": 2 },
      diff: { added: [], flipped: [{ id: "n-transistor", from: "untested", to: "misconception" }], updated: [] },
    })
  );

  const state = store.getState();
  assert.deepEqual(state.failedAttempts, { "n-transistor": 2 });
  assert.deepEqual(state.lastDiff, {
    added: [],
    flipped: [{ id: "n-transistor", from: "untested", to: "misconception" }],
    updated: [],
  });
});

test("sessionEnded freezes the store and keeps comparison data", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  store.applyResponse({
    reply: "Your friend's laptop stops working mid-day. Where would you start looking and why?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "end",
    failedAttempts: {},
  });
  assert.equal(store.appendUserMessage("I would check the power path first."), true);

  store.applyResponse({
    reply: "You traced the failure to the power path - exactly right.",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "end",
    failedAttempts: {},
    sessionEnded: true,
    transferResult: { passed: true, assessment: "You traced the failure to the power path - exactly right." },
  });

  const state = store.getState();
  assert.equal(state.ended, true);
  assert.deepEqual(state.transferResult, {
    passed: true,
    assessment: "You traced the failure to the power path - exactly right.",
  });
  assert.equal(state.phase, "end");

  // Frozen: no further user messages, no further responses.
  assert.equal(store.appendUserMessage("one more thing"), false);
  const historyLength = store.getState().history.length;
  assert.equal(store.applyResponse(turnResponse()), false);
  assert.equal(store.getState().history.length, historyLength);
  assert.deepEqual(store.getState().realityMap, laptopRealityMap);
});

test("startSession resets all state - no cross-session leakage", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  store.appendUserMessage("I press keys and letters appear");
  store.applyResponse(turnResponse());

  assert.equal(store.startSession("recursion"), true);
  const state = store.getState();
  assert.equal(state.word, "recursion");
  assert.equal(state.realityMap, null);
  assert.deepEqual(state.learnerMap, { nodes: [], edges: [] });
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.failedAttempts, {});
  assert.equal(state.phase, "init");
  assert.equal(state.ended, false);
  assert.equal(state.transferResult, null);
  assert.equal(state.closeness, null);
});

test("the exported singleton is a working store and is shared", () => {
  const state = sessionStore.getState();
  assert.equal(state.phase, "init");
  assert.equal(typeof sessionStore.startSession, "function");
  assert.equal(typeof sessionStore.applyResponse, "function");
  assert.equal(typeof sessionStore.toRequest, "function");
});
