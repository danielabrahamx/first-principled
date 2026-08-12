import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createSessionStore,
  sessionStore,
  EMPTY_LEARNER_MAP,
  nodeHistory,
} from "./session.js";
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
    probe: { nodeId: "n-electricity", kind: "probe" },
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
  assert.equal(state.gapClosures, 0);
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

test("gapClosures accumulates only missing/misconception to correct flips", () => {
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

  // Turn 1: one closure, one non-closure (untested -> correct), one flip away.
  store.appendUserMessage("I press keys and letters appear");
  store.applyResponse(
    turnResponse({
      diff: {
        added: ["n-electricity"],
        flipped: [
          { id: "n-transistor", from: "misconception", to: "correct" },
          { id: "n-electricity", from: "untested", to: "correct" },
          { id: "n-circuit", from: "correct", to: "misconception" },
        ],
        updated: [],
      },
    })
  );
  assert.equal(store.getState().gapClosures, 1);

  // Turn 2: another closure accumulates on top.
  store.appendUserMessage("gates are circuits, and bits ride on gates");
  store.applyResponse(
    turnResponse({
      diff: {
        added: [],
        flipped: [{ id: "n-app", from: "missing", to: "correct" }],
        updated: [],
      },
    })
  );
  assert.equal(store.getState().gapClosures, 2);

  // A response with no diff leaves the count untouched.
  store.appendUserMessage("nothing changed here");
  store.applyResponse(turnResponse());
  assert.equal(store.getState().gapClosures, 2);
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
  assert.equal(state.gapClosures, 0);
});

test("the exported singleton is a working store and is shared", () => {
  const state = sessionStore.getState();
  assert.equal(state.phase, "init");
  assert.equal(typeof sessionStore.startSession, "function");
  assert.equal(typeof sessionStore.applyResponse, "function");
  assert.equal(typeof sessionStore.toRequest, "function");
});

/* ---------------------------------------------------------------------------
 * Ticket 08: the turn ledger and per-node rotation history
 * ------------------------------------------------------------------------- */

test("the ledger appends one entry per applied response with diff, reply and map snapshot", () => {
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
      diff: { added: ["n-transistor"], flipped: [], updated: [] },
    })
  );

  const ledger = store.getState().ledger;
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].turn, 1);
  assert.equal(ledger[0].reply, "What have you noticed about how what you type becomes letters on the screen?");
  assert.deepEqual(ledger[0].diff, { added: [], flipped: [], updated: [] });
  assert.deepEqual(ledger[0].learnerMap, EMPTY_LEARNER_MAP);
  assert.equal(ledger[1].turn, 2);
  assert.deepEqual(ledger[1].diff, { added: ["n-transistor"], flipped: [], updated: [] });
  assert.deepEqual(ledger[1].learnerMap, turnResponse().learnerMap);
  assert.deepEqual(ledger[1].probe, { nodeId: "n-electricity", kind: "probe" }, "the probe lands in the ledger");
});

test("lastProbe tracks the most recent response's probe and resets on startSession", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "Opening question",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  assert.equal(store.getState().lastProbe, null, "the opening turn has no probe");
  store.appendUserMessage("I press keys and letters appear");
  store.applyResponse(turnResponse());
  assert.deepEqual(store.getState().lastProbe, { nodeId: "n-electricity", kind: "probe" });
  store.startSession("recursion");
  assert.equal(store.getState().lastProbe, null, "a new session clears the probe");
});

test("ledger snapshots are deep copies - later mutation of the live map never rewrites history", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "Opening question",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  store.appendUserMessage("I press keys and letters appear");
  store.applyResponse(turnResponse());

  const snapshot = store.getState().ledger[1].learnerMap;
  assert.notEqual(snapshot.nodes[0], store.getState().learnerMap.nodes[0], "snapshot must not share node objects with the live map");

  // Mutate the live map in place - as a view layer might - and assert the
  // ledger's earlier snapshot is untouched.
  store.getState().learnerMap.nodes[0].state = "misconception";
  store.getState().learnerMap.nodes[0].evidence.push("mutated later");

  const ledger = store.getState().ledger;
  assert.equal(ledger[1].learnerMap.nodes[0].state, "correct");
  assert.deepEqual(ledger[1].learnerMap.nodes[0].evidence, ["I know it flows"]);
  assert.equal(store.getState().learnerMap.nodes[0].state, "misconception", "the live map itself did change");
});

test("an init refusal also lands in the ledger", () => {
  const store = createSessionStore();
  store.startSession("gibberish");
  store.applyResponse({
    reply: "I could not find a teachable concept in that input.",
    learnerMap: { nodes: [], edges: [] },
    diff: { added: [], flipped: [], updated: [] },
    phase: "init",
    failedAttempts: {},
  });
  assert.equal(store.getState().ledger.length, 1);
  assert.equal(store.getState().ledger[0].reply, "I could not find a teachable concept in that input.");
});

test("nodeHistory derives the full rotation trail with evidence at each turn", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "Opening question",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });

  // Turn 2: the node appears as a misconception.
  store.appendUserMessage("a transistor is a switch you flick by hand");
  store.applyResponse(
    turnResponse({
      learnerMap: {
        nodes: [
          {
            id: "n-transistor",
            state: "misconception",
            confidence: 0.4,
            evidence: ["a transistor is a switch you flick by hand"],
          },
        ],
        edges: [],
      },
      diff: { added: ["n-transistor"], flipped: [], updated: [] },
    })
  );

  // Turn 3: confidence shifts while the state holds (an update).
  store.appendUserMessage("ok, a voltage-controlled switch?");
  store.applyResponse(
    turnResponse({
      learnerMap: {
        nodes: [
          {
            id: "n-transistor",
            state: "misconception",
            confidence: 0.3,
            evidence: ["a transistor is a switch you flick by hand", "ok, a voltage-controlled switch?"],
          },
        ],
        edges: [],
      },
      diff: { added: [], flipped: [], updated: ["n-transistor"] },
    })
  );

  // Turn 4: the flip to correct.
  store.appendUserMessage("small signals flip it on and off");
  store.applyResponse(
    turnResponse({
      learnerMap: {
        nodes: [
          {
            id: "n-transistor",
            state: "correct",
            confidence: 0.85,
            evidence: ["a transistor is a switch you flick by hand", "small signals flip it on and off"],
          },
        ],
        edges: [],
      },
      diff: {
        added: [],
        flipped: [{ id: "n-transistor", from: "misconception", to: "correct" }],
        updated: [],
      },
    })
  );

  const trail = nodeHistory(store.getState(), "n-transistor");
  assert.deepEqual(trail, [
    {
      state: "misconception",
      confidence: 0.4,
      evidence: ["a transistor is a switch you flick by hand"],
      turn: 2,
    },
    {
      state: "misconception",
      confidence: 0.3,
      evidence: ["a transistor is a switch you flick by hand", "ok, a voltage-controlled switch?"],
      turn: 3,
    },
    {
      state: "correct",
      confidence: 0.85,
      evidence: ["a transistor is a switch you flick by hand", "small signals flip it on and off"],
      turn: 4,
    },
  ]);
});

test("nodeHistory is empty for a node that was never engaged", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "Opening question",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  assert.deepEqual(nodeHistory(store.getState(), "n-os"), []);
});

test("startSession resets the ledger and history - no cross-session leakage", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "Opening question",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  assert.equal(store.getState().ledger.length, 1);
  assert.equal(store.startSession("recursion"), true);
  assert.deepEqual(store.getState().ledger, []);
  assert.deepEqual(nodeHistory(store.getState(), "n-transistor"), []);
});

test("a frozen store does not append to the ledger", () => {
  const store = createSessionStore();
  store.startSession("laptop");
  store.applyResponse({
    reply: "Opening question",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  store.applyResponse({
    reply: "End",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "end",
    failedAttempts: {},
    sessionEnded: true,
    transferResult: { passed: true, assessment: "Good." },
  });
  const count = store.getState().ledger.length;
  assert.ok(count >= 2);
  assert.equal(store.applyResponse(turnResponse()), false);
  assert.equal(store.getState().ledger.length, count);
});

test("subscribe fires on startSession and applyResponse, and unsubscribes", () => {
  const store = createSessionStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  store.startSession("laptop");
  assert.equal(calls, 1);

  store.applyResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: EMPTY_LEARNER_MAP,
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
    realityMap: laptopRealityMap,
  });
  assert.equal(calls, 2);

  // Failed operations do not notify.
  store.startSession("   ");
  assert.equal(calls, 2);
  store.applyResponse(null);
  assert.equal(calls, 2);

  unsubscribe();
  store.startSession("recursion");
  assert.equal(calls, 2);
});
