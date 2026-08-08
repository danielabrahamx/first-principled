import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, laptopLearnerMap } from "../mmg/fixtures.js";
import { validateLearnerMap } from "../mmg/validator.js";
import { closenessScore } from "../mmg/closeness.js";
import {
  conversationMode,
  explanationDue,
  explanationRequested,
  explainDirective,
  briefingRequested,
  updateFailedAttempts,
  computeDiff,
  buildSocraticSystemPrompt,
  buildSocraticUserPrompt,
  buildDirective,
  generateSocraticTurn,
  validateTurn,
} from "./socratic.js";

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * A fresh active-phase state around the laptop fixtures.
 *
 * @param {object} [overrides]
 * @returns {import("./socratic.js").SocraticState}
 */
function baseState(overrides = {}) {
  return {
    realityMap: laptopRealityMap,
    learnerMap: { nodes: [], edges: [] },
    failedAttempts: {},
    phase: "active",
    ...overrides,
  };
}

/**
 * A stub transport that returns the given contents in order and throws on
 * any extra call, so unexpected repair attempts fail loudly.
 *
 * @param {string[]} contents
 * @param {(request: any) => void} [onCall]
 * @returns {import("./socratic.js").CallLLM}
 */
function strictModel(contents, onCall) {
  let calls = 0;
  return async (request) => {
    if (onCall) onCall(request);
    if (calls >= contents.length) throw new Error(`unexpected extra LLM call #${calls + 1}`);
    const content = contents[calls];
    calls += 1;
    return { content };
  };
}

/* ---------------------------------------------------------------------------
 * Policy: conversationMode
 * ------------------------------------------------------------------------- */

test("conversationMode opens with observe when the learner map is empty", () => {
  assert.equal(conversationMode({ nodes: [], edges: [] }), "observe");
});

test("conversationMode stays observe while every node is untested", () => {
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const learner = {
    nodes: [
      { id: "n-silicon", state: "untested", confidence: 0, evidence: [] },
      { id: "n-bit", state: "untested", confidence: 0, evidence: [] },
    ],
    edges: [],
  };
  assert.equal(conversationMode(learner), "observe");
});

test("conversationMode switches to gap as soon as anything is known", () => {
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const learner = {
    nodes: [{ id: "n-app", state: "correct", confidence: 0.7, evidence: ["I use one daily"] }],
    edges: [],
  };
  assert.equal(conversationMode(learner), "gap");
});

/* ---------------------------------------------------------------------------
 * Policy: explanationDue and updateFailedAttempts
 * ------------------------------------------------------------------------- */

test("explanationDue fires at two failed attempts and not before", () => {
  assert.equal(explanationDue({}, "n-transistor"), false);
  assert.equal(explanationDue({ "n-transistor": 1 }, "n-transistor"), false);
  assert.equal(explanationDue({ "n-transistor": 2 }, "n-transistor"), true);
  assert.equal(explanationDue({ "n-transistor": 3 }, "n-transistor"), true);
});

test("an answer that leaves the point non-correct counts one failed attempt", () => {
  const prev = laptopLearnerMap;
  const next = clone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-transistor"
      ? { ...node, confidence: 0.3, evidence: [...node.evidence, "actually it's just a big switch"] }
      : node
  );
  const after = updateFailedAttempts({}, prev, next, {
    nodeId: "n-silicon",
    kind: "probe",
  });
  assert.deepEqual(after, { "n-transistor": 1 });
});

test("failed attempts accumulate across consecutive wrong answers", () => {
  const prev = laptopLearnerMap;
  const next = clone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-transistor"
      ? { ...node, confidence: 0.3, evidence: [...node.evidence, "no, it's a relay really"] }
      : node
  );
  const after = updateFailedAttempts({ "n-transistor": 1 }, prev, next, {
    nodeId: "n-transistor",
    kind: "probe",
  });
  assert.deepEqual(after, { "n-transistor": 2 });
});

test("an answer that flips the point to correct clears its failed attempts", () => {
  const next = clone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-transistor" ? { ...node, state: "correct", confidence: 0.8 } : node
  );
  const after = updateFailedAttempts({ "n-transistor": 2 }, laptopLearnerMap, next, {
    nodeId: "n-transistor",
    kind: "probe",
  });
  assert.deepEqual(after, {});
});

test("an explanation turn clears the explained point", () => {
  const after = updateFailedAttempts({ "n-transistor": 2 }, laptopLearnerMap, laptopLearnerMap, {
    nodeId: "n-transistor",
    kind: "explain",
  });
  assert.deepEqual(after, {});
});

test("a turn that changes nothing never counts a failure - asking is not failing", () => {
  const after = updateFailedAttempts({}, laptopLearnerMap, clone(laptopLearnerMap), {
    nodeId: "n-silicon",
    kind: "probe",
  });
  assert.deepEqual(after, {});
});

test("an answer recorded during an aside counts like any other answer", () => {
  const next = clone(laptopLearnerMap);
  next.nodes = next.nodes.map((node) =>
    node.id === "n-app"
      ? { ...node, confidence: 0.4, evidence: [...node.evidence, "well, actually it runs on the power"] }
      : node
  );
  const after = updateFailedAttempts({}, laptopLearnerMap, next, {
    nodeId: null,
    kind: "converse",
  });
  assert.deepEqual(after, { "n-app": 1 });
});

test("an 'I don't know' answer adds a missing node and counts a failure", () => {
  const next = clone(laptopLearnerMap);
  next.nodes.push({ id: "n-bit", state: "missing", confidence: 0.1, evidence: [] });
  const after = updateFailedAttempts({}, laptopLearnerMap, next, {
    nodeId: "n-bit",
    kind: "probe",
  });
  assert.deepEqual(after, { "n-bit": 1 });
});

/* ---------------------------------------------------------------------------
 * Policy: computeDiff
 * ------------------------------------------------------------------------- */

test("computeDiff reports added, flipped and updated nodes exactly", () => {
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const prev = {
    nodes: [
      { id: "n-app", state: "correct", confidence: 0.7, evidence: ["runs on top"] },
      {
        id: "n-transistor",
        state: "misconception",
        confidence: 0.4,
        evidence: ["a switch you flick by hand"],
      },
      { id: "n-os", state: "correct", confidence: 0.7, evidence: ["runs the programs"] },
    ],
    edges: [],
  };
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const next = {
    nodes: [
      { id: "n-app", state: "correct", confidence: 0.7, evidence: ["runs on top"] },
      { id: "n-transistor", state: "correct", confidence: 0.8, evidence: ["a voltage switch"] },
      {
        id: "n-os",
        state: "correct",
        confidence: 0.9,
        evidence: ["runs the programs", "manages memory"],
      },
      { id: "n-bit", state: "correct", confidence: 0.8, evidence: ["binary digits"] },
    ],
    edges: [],
  };
  const diff = computeDiff(prev, next);
  assert.deepEqual(diff.added, ["n-bit"]);
  assert.deepEqual(diff.flipped, [{ id: "n-transistor", from: "misconception", to: "correct" }]);
  assert.deepEqual(diff.updated, ["n-os"]);
});

test("computeDiff of an unchanged map is empty", () => {
  const diff = computeDiff(laptopLearnerMap, clone(laptopLearnerMap));
  assert.deepEqual(diff, { added: [], flipped: [], updated: [] });
});

/* ---------------------------------------------------------------------------
 * Prompts
 * ------------------------------------------------------------------------- */

test("the system prompt carries the mission, Socratic style and the no-quote rule", () => {
  const prompt = buildSocraticSystemPrompt();
  assert.match(prompt, /mission: reduce the cognitive distance/i);
  assert.match(prompt, /Never quote/i);
  assert.match(prompt, /Socratic, not lecture/);
  assert.match(prompt, /One question at a time/);
  assert.match(prompt, /two failed attempts/);
});

test("the user prompt satisfies the JSON mode contract and carries the state", () => {
  const prompt = buildSocraticUserPrompt(baseState());
  assert.match(prompt, /json/i);
  assert.match(prompt, /\{"reply":/);
  assert.match(prompt, /"realityMap"/);
  assert.match(prompt, /"learnerMap"/);
});

test("the directive demands observation when nothing is known", () => {
  const prompt = buildSocraticUserPrompt(baseState());
  assert.match(prompt, /Opening move/);
  assert.match(prompt, /observation question/);
  assert.doesNotMatch(prompt, /explanation fallback is due/);
});

test("the directive demands gap probing when the learner has a model", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const prompt = buildSocraticUserPrompt(state);
  assert.match(prompt, /Probe the biggest gap/);
  assert.doesNotMatch(prompt, /Opening move/);
});

test("the directive demands an explanation at two failed attempts, not before", () => {
  const once = baseState({ learnerMap: laptopLearnerMap, failedAttempts: { "n-transistor": 1 } });
  assert.doesNotMatch(buildSocraticUserPrompt(once), /explanation fallback is due/);

  const twice = baseState({ learnerMap: laptopLearnerMap, failedAttempts: { "n-transistor": 2 } });
  const prompt = buildSocraticUserPrompt(twice);
  assert.match(prompt, /explanation fallback is due/);
  assert.match(prompt, /probe.kind must be "explain"/);
});

test("the directive picks the most-failed node when several are stuck", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    failedAttempts: { "n-os": 2, "n-transistor": 4 },
  });
  assert.match(buildDirective(state), /n-transistor/);
});

test("a learner who asks for an explanation triggers the directive with zero failures", () => {
  const plain = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "I use it for email and spreadsheets.",
  });
  assert.doesNotMatch(buildSocraticUserPrompt(plain), /explanation fallback is due/);
  assert.doesNotMatch(buildSocraticUserPrompt(plain), /learner asked for an explanation/);

  const asks = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "Can you explain how a keypress becomes a letter on the screen?",
  });
  const prompt = buildSocraticUserPrompt(asks);
  assert.match(prompt, /learner asked for an explanation/);
  assert.match(prompt, /probe.kind must be "explain"/);
  assert.match(prompt, /must BE the explanation/);
  assert.match(prompt, /do not ask the learner a new question/);
});

test("explanationRequested is conservative about ordinary answers", () => {
  assert.equal(explanationRequested(null), false);
  assert.equal(explanationRequested("I use it for email and spreadsheets."), false);
  assert.equal(explanationRequested("A transistor is a switch you flick by hand."), false);
  assert.equal(explanationRequested("I don't know - some kind of chip?"), false);
  assert.equal(explanationRequested("I don't really know what a logic gate is."), false);
  assert.equal(explanationRequested("the screen dims when I unplug the charger"), false);
  assert.equal(explanationRequested("Can you explain how a keypress becomes a letter?"), true);
  assert.equal(explanationRequested("What is a transistor?"), true);
  assert.equal(explanationRequested("Why does it get warm?"), true);
  assert.equal(explanationRequested("help me understand the operating system"), true);
  assert.equal(explanationRequested("I don't understand"), true);
});

test("explainDirective prioritises the failed-attempts gate over a request", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    failedAttempts: { "n-transistor": 2 },
    learnerUtterance: "Can you explain how a keypress becomes a letter?",
  });
  const d = explainDirective(state);
  assert.equal(d.due, true);
  assert.equal(d.nodeId, "n-transistor");
  assert.equal(d.reason, "failed attempts");
});

/* ---------------------------------------------------------------------------
 * Policy: briefingRequested
 * ------------------------------------------------------------------------- */

test("briefingRequested is conservative about ordinary answers", () => {
  assert.equal(briefingRequested(null), false);
  assert.equal(briefingRequested(""), false);
  assert.equal(briefingRequested("I use it for email and spreadsheets."), false);
  assert.equal(briefingRequested("A transistor is a switch you flick by hand."), false);
  assert.equal(briefingRequested("I don't know - some kind of chip?"), false);
  assert.equal(briefingRequested("the screen dims when I unplug the charger"), false);
  assert.equal(briefingRequested("Can you explain how a keypress becomes a letter?"), false);
  assert.equal(briefingRequested("What is a transistor?"), false);
  assert.equal(briefingRequested("Why does it get warm?"), false);
  assert.equal(briefingRequested("just tell me if I'm right"), false);
});

test("briefingRequested fires on direct-information and decision phrasings", () => {
  assert.equal(briefingRequested("brief me on the power path"), true);
  assert.equal(briefingRequested("give me a brief on the power path"), true);
  assert.equal(briefingRequested("just tell me about the power path"), true);
  assert.equal(briefingRequested("just explain the whole power path to me"), true);
  assert.equal(briefingRequested("just tell me how this works"), true);
  assert.equal(briefingRequested("walk me through how a keypress becomes a letter"), true);
  assert.equal(briefingRequested("tell me everything about how it boots"), true);
  assert.equal(briefingRequested("tell me about the power path"), true);
  assert.equal(briefingRequested("how do I decide between a new laptop and an upgrade"), true);
  assert.equal(briefingRequested("what do I need to know about batteries"), true);
  assert.equal(briefingRequested("give me the rundown on the power path"), true);
  assert.equal(briefingRequested("how does the whole chain work end to end"), true);
});

test("the explanation fallback beats the observation opening even with an all-untested map", () => {
  const allUntested = baseState({
    learnerMap: {
      nodes: [
        { id: "n-transistor", state: "untested", confidence: 0.5, evidence: [] },
      ],
      edges: [],
    },
  });
  assert.match(buildDirective(allUntested), /Opening move/);

  const asked = baseState({
    learnerMap: allUntested.learnerMap,
    learnerUtterance: "Can you explain what a transistor is?",
  });
  const askedPrompt = buildDirective(asked);
  assert.match(askedPrompt, /learner asked for an explanation/);
  assert.doesNotMatch(askedPrompt, /Opening move/);

  const stuck = baseState({
    learnerMap: allUntested.learnerMap,
    failedAttempts: { "n-transistor": 2 },
  });
  const stuckPrompt = buildDirective(stuck);
  assert.match(stuckPrompt, /explanation fallback is due/);
  assert.doesNotMatch(stuckPrompt, /Opening move/);
});

test("validateTurn rejects a probe when an explanation is due and demands explain", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "Can you explain what a transistor is?",
  });
  const turn = {
    reply: "So a transistor is a switch you flick by hand, right?",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: "n-transistor", kind: /** @type {"probe"} */ ("probe") },
  };
  const errors = validateTurn(state, turn);
  assert.ok(errors.some((e) => /probe.kind must be "explain"/.test(e)));
});

/* ---------------------------------------------------------------------------
 * Policy: briefing directive
 * ------------------------------------------------------------------------- */

test("a briefing request triggers the directive and outranks the explanation gate", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    failedAttempts: { "n-transistor": 2 },
    learnerUtterance: "just tell me about the power path",
  });
  const prompt = buildSocraticUserPrompt(state);
  assert.match(prompt, /asked for direct information/);
  assert.match(prompt, /probe.kind must be "brief"/);
  assert.match(prompt, /do not ask the learner a new question/);
  assert.doesNotMatch(prompt, /explanation fallback is due/);
});

test("the briefing beats the observation opening even with an all-untested map", () => {
  const state = baseState({
    learnerMap: {
      nodes: [{ id: "n-transistor", state: "untested", confidence: 0.5, evidence: [] }],
      edges: [],
    },
    learnerUtterance: "brief me on the power path",
  });
  const prompt = buildDirective(state);
  assert.match(prompt, /briefing/);
  assert.doesNotMatch(prompt, /Opening move/);
});

test("the directive never fires a briefing without a request", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const prompt = buildDirective(state);
  assert.doesNotMatch(prompt, /briefing/);
});

test("the briefing directive is the one mode that permits quoting the reality map", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "just explain the whole power path to me",
  });
  const prompt = buildSocraticUserPrompt(state);
  assert.match(prompt, /quote accurately, never embellish/);
  const plain = buildSocraticUserPrompt(baseState({ learnerMap: laptopLearnerMap }));
  assert.doesNotMatch(plain, /never embellish/);
});

test("validateTurn demands a brief probe when the learner asked for a briefing", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "just tell me about the power path",
  });
  const turn = {
    reply: "So what have you noticed about how it powers up?",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: "n-transistor", kind: /** @type {"probe"} */ ("probe") },
  };
  const errors = validateTurn(state, turn);
  assert.ok(errors.some((e) => /probe.kind must be "brief"/.test(e)));
});

test("validateTurn rejects a brief probe when no briefing was requested", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "A transistor is a switch you flick by hand.",
  });
  const turn = {
    reply: "Here is how the whole power path works: ...",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: null, kind: /** @type {"brief"} */ ("brief") },
  };
  const errors = validateTurn(state, turn);
  assert.ok(errors.some((e) => /probe.kind must not be "brief"/.test(e)));
});

test("validateTurn accepts a well-formed briefing turn", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    learnerUtterance: "just tell me about the power path",
  });
  const errors = validateTurn(state, {
    reply: "Here is the whole power path, from first principles up.",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: null, kind: "brief" },
  });
  assert.deepEqual(errors, []);
});

/* ---------------------------------------------------------------------------
 * validateTurn
 * ------------------------------------------------------------------------- */

test("validateTurn accepts a well-formed turn", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const errors = validateTurn(state, {
    reply: "What controls that switch?",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: "n-transistor", kind: "probe" },
  });
  assert.deepEqual(errors, []);
});

test("validateTurn rejects a model that drops a previously known node", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const next = clone(laptopLearnerMap);
  next.nodes = next.nodes.filter((node) => node.id !== "n-app");
  const errors = validateTurn(state, {
    reply: "What controls that switch?",
    learnerMap: next,
    probe: { nodeId: "n-transistor", kind: "probe" },
  });
  assert.ok(errors.some((error) => error.includes("dropped a previously known node: n-app")));
});

test("validateTurn rejects a model that drops a previously known edge", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const next = clone(laptopLearnerMap);
  next.edges = next.edges.filter((edge) => edge.source !== "n-silicon");
  const errors = validateTurn(state, {
    reply: "What controls that switch?",
    learnerMap: next,
    probe: { nodeId: "n-transistor", kind: "probe" },
  });
  assert.ok(errors.some((error) => error.includes("dropped a previously known edge")));
});

test("validateTurn rejects a probe of a node outside the reality map", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const errors = validateTurn(state, {
    reply: "What is a dragon?",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: "n-dragon", kind: "probe" },
  });
  assert.ok(errors.some((error) => error.includes("n-dragon")));
});

test("validateTurn rejects a learner map that does not mirror the reality map", () => {
  const state = baseState({ learnerMap: laptopLearnerMap });
  const next = clone(laptopLearnerMap);
  next.nodes.push({
    id: "n-ghost",
    state: "correct",
    confidence: 0.9,
    evidence: [],
  });
  const errors = validateTurn(state, {
    reply: "What controls that switch?",
    learnerMap: next,
    probe: { nodeId: "n-transistor", kind: "probe" },
  });
  assert.ok(errors.some((error) => error.includes("n-ghost")));
});

/* ---------------------------------------------------------------------------
 * generateSocraticTurn
 * ------------------------------------------------------------------------- */

const validTurnContent = JSON.stringify({
  reply: "What have you noticed about how your typing becomes letters on screen?",
  learnerMap: {
    nodes: [
      {
        id: "n-app",
        state: "correct",
        confidence: 0.7,
        evidence: ["I use a laptop every day"],
      },
    ],
    edges: [],
  },
  probe: { nodeId: null, kind: "observe" },
});

test("a valid turn produces a reply, an updated map and a computed diff", async () => {
  const result = await generateSocraticTurn({
    state: baseState(),
    callLLM: strictModel([validTurnContent]),
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.retried, false);
  assert.equal(result.mode, "observe");
  assert.equal(result.probe && result.probe.kind, "observe");
  assert.deepEqual(result.diff, { added: ["n-app"], flipped: [], updated: [] });
  assert.deepEqual(result.failedAttempts, {});
  const validation = validateLearnerMap(result.learnerMap, laptopRealityMap);
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("a malformed first reply triggers one repair attempt and recovers", async () => {
  /** @type {any[]} */
  const requests = [];
  const transport = strictModel(["This is not JSON at all, sorry.", validTurnContent], (request) => {
    requests.push(request);
  });
  const result = await generateSocraticTurn({ state: baseState(), callLLM: transport });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.retried, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].thinking, true, "first attempt thinks");
  assert.equal(requests[1].thinking, false, "repair attempt runs thinking-off");
});

test("an invalid learner map triggers a repair attempt that cites the errors", async () => {
  const invalidMap = JSON.stringify({
    reply: "What have you noticed?",
    learnerMap: {
      nodes: [{ id: "n-ghost", state: "correct", confidence: 0.9, evidence: [] }],
      edges: [],
    },
    probe: { nodeId: null, kind: "observe" },
  });
  /** @type {string[]} */
  const repairPrompts = [];
  const transport = strictModel([invalidMap, validTurnContent], (request) => {
    const user = request.messages[1];
    if (typeof user.content === "string" && user.content.includes("did not meet the turn contract")) {
      repairPrompts.push(user.content);
    }
  });
  const result = await generateSocraticTurn({ state: baseState(), callLLM: transport });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.retried, true);
  assert.equal(repairPrompts.length, 1);
  assert.match(repairPrompts[0], /n-ghost/);
});

test("both attempts invalid fails with the validation errors", async () => {
  const invalidMap = JSON.stringify({
    reply: "What have you noticed?",
    learnerMap: {
      nodes: [{ id: "n-ghost", state: "correct", confidence: 0.9, evidence: [] }],
      edges: [],
    },
    probe: { nodeId: null, kind: "observe" },
  });
  const result = await generateSocraticTurn({
    state: baseState(),
    callLLM: strictModel([invalidMap, invalidMap]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.ok(result.errors.some((error) => error.includes("n-ghost")));
});

test("a dropped previously known node is repaired, not accepted", async () => {
  const dropped = JSON.stringify({
    reply: "And what about the silicon?",
    learnerMap: {
      nodes: laptopLearnerMap.nodes.filter((node) => node.id !== "n-app"),
      edges: laptopLearnerMap.edges,
    },
    probe: { nodeId: "n-silicon", kind: "probe" },
  });
  const repaired = JSON.stringify({
    reply: "And what about the silicon?",
    learnerMap: laptopLearnerMap,
    probe: { nodeId: "n-silicon", kind: "probe" },
  });
  const result = await generateSocraticTurn({
    state: baseState({ learnerMap: laptopLearnerMap }),
    callLLM: strictModel([dropped, repaired]),
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.retried, true);
});

test("a transport failure surfaces as an error result", async () => {
  const transport = async () => {
    throw new Error("boom");
  };
  const result = await generateSocraticTurn({ state: baseState(), callLLM: transport });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "error");
  assert.match(result.reason || "", /boom/);
  assert.equal(result.retried, false);
});

test("an explanation on request is accepted with zero failed attempts", async () => {
  const explainTurn = JSON.stringify({
    reply:
      "A transistor is a tiny switch controlled by a voltage: a small signal lets current flow or stops it.",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: "n-transistor", kind: "explain" },
  });
  const result = await generateSocraticTurn({
    state: baseState({ learnerMap: laptopLearnerMap }),
    callLLM: strictModel([explainTurn]),
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.probe && result.probe.kind, "explain");
  assert.deepEqual(result.failedAttempts, {});
});

test("a briefing turn delivers a direct answer and resets all failed attempts", async () => {
  const briefTurn = JSON.stringify({
    reply:
      "Here is the whole power path, from first principles up. A transistor is a semiconductor switch that controls current flow; the basic building block of digital circuits. ...",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: null, kind: "brief" },
  });
  const result = await generateSocraticTurn({
    state: baseState({
      learnerMap: laptopLearnerMap,
      failedAttempts: { "n-transistor": 2, "n-app": 3 },
      learnerUtterance: "just tell me about the power path",
    }),
    callLLM: strictModel([briefTurn]),
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.probe && result.probe.kind, "brief");
  assert.deepEqual(result.failedAttempts, {}, "a briefing resets the struggle counts");
});

test("an unrequested brief probe is repaired, not accepted", async () => {
  const unrequestedBrief = JSON.stringify({
    reply: "Here is everything you need to know about laptops.",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: null, kind: "brief" },
  });
  const fixedTurn = JSON.stringify({
    reply: "What do you think controls that switch?",
    learnerMap: clone(laptopLearnerMap),
    probe: { nodeId: "n-transistor", kind: "probe" },
  });
  const result = await generateSocraticTurn({
    state: baseState({ learnerMap: laptopLearnerMap }),
    callLLM: strictModel([unrequestedBrief, fixedTurn]),
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.retried, true);
  assert.equal(result.probe && result.probe.kind, "probe");
});

/* ---------------------------------------------------------------------------
 * Simulated session
 * ------------------------------------------------------------------------- */

const SIM_REPLIES = [
  "What have you noticed about how what you type becomes letters on the screen?",
  "Interesting - how do you think that switch gets controlled inside the laptop?",
  "If transistors were mainly audio parts, what in the laptop flips millions of times a second to do arithmetic?",
  "A transistor is a tiny switch controlled by a voltage: a small signal lets current flow or stops it. Computers chain millions of these together to do arithmetic. How does that change your picture?",
  "Exactly. So what sits between those switches and the numbers you see?",
  "Have you ever noticed how a password check either lets you in or stops you?",
  "Here is the whole power path, from first principles up. A transistor is: \"Semiconductor switch that controls current flow; the basic building block of digital circuits.\" Logic gates are circuits that compute AND, OR and NOT from input voltages. Bits are the binary digits carried by a gate's output state. The operating system is the software layer that manages hardware resources, and applications are the programs you interact with, running on top of the OS.",
  "Exactly - a gate's output carries a bit. So what carries the result of those gates?",
];

const SIM_TURNS = [
  {
    learner: "I use a laptop every day for email and spreadsheets.",
    reply: SIM_REPLIES[0],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
      ],
      edges: [],
    },
    probe: { nodeId: null, kind: "observe" },
  },
  {
    learner: "A transistor is a switch you flick by hand.",
    reply: SIM_REPLIES[1],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "misconception",
          confidence: 0.4,
          evidence: ["a transistor is a switch you flick by hand"],
        },
      ],
      edges: [],
    },
    probe: { nodeId: "n-transistor", kind: "probe" },
  },
  {
    learner: "Transistors mainly amplify audio, like in guitar amps.",
    reply: SIM_REPLIES[2],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "misconception",
          confidence: 0.35,
          evidence: ["a transistor is a switch you flick by hand", "transistors mainly amplify audio"],
        },
      ],
      edges: [],
    },
    probe: { nodeId: "n-transistor", kind: "probe" },
  },
  {
    learner: "I don't know - some kind of chip?",
    reply: SIM_REPLIES[3],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "misconception",
          confidence: 0.35,
          evidence: ["a transistor is a switch you flick by hand", "transistors mainly amplify audio"],
        },
      ],
      edges: [],
    },
    probe: { nodeId: "n-transistor", kind: "explain" },
  },
  {
    learner: "Oh - so it's a tiny switch controlled by a voltage, and chaining them does arithmetic!",
    reply: SIM_REPLIES[4],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "correct",
          confidence: 0.85,
          evidence: ["so it's a tiny switch controlled by a voltage, and chaining them does arithmetic"],
        },
      ],
      edges: [],
    },
    probe: { nodeId: "n-transistor", kind: "probe" },
  },
  {
    learner: "I don't really know what a logic gate is.",
    reply: SIM_REPLIES[5],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "correct",
          confidence: 0.85,
          evidence: ["so it's a tiny switch controlled by a voltage, and chaining them does arithmetic"],
        },
        { id: "n-logic-gate", state: "missing", confidence: 0.1, evidence: [] },
      ],
      edges: [],
    },
    probe: { nodeId: "n-logic-gate", kind: "probe" },
  },
  {
    learner: "Just tell me about the power path - how does the whole thing work end to end?",
    reply: SIM_REPLIES[6],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "correct",
          confidence: 0.85,
          evidence: ["so it's a tiny switch controlled by a voltage, and chaining them does arithmetic"],
        },
        { id: "n-logic-gate", state: "missing", confidence: 0.1, evidence: [] },
      ],
      edges: [],
    },
    probe: { nodeId: null, kind: "brief" },
  },
  {
    learner:
      "Oh I see - so a transistor is a semiconductor switch that controls current flow, and logic gates are circuits that compute AND, OR and NOT from voltages!",
    reply: SIM_REPLIES[7],
    learnerMap: {
      nodes: [
        {
          id: "n-app",
          state: "correct",
          confidence: 0.7,
          evidence: ["I use a laptop every day for email and spreadsheets"],
        },
        {
          id: "n-transistor",
          state: "correct",
          confidence: 0.9,
          evidence: [
            "so it's a tiny switch controlled by a voltage, and chaining them does arithmetic",
            "a transistor is a semiconductor switch that controls current flow",
          ],
        },
        {
          id: "n-logic-gate",
          state: "correct",
          confidence: 0.85,
          evidence: ["logic gates are circuits that compute AND, OR and NOT from voltages"],
        },
      ],
      edges: [],
    },
    probe: { nodeId: "n-bit", kind: "probe" },
  },
];

test("simulated session: valid maps, real flips, explanation exactly at the gate", async () => {
  /** @type {string[]} */
  const userPrompts = [];
  let state = baseState();
  /** @type {Awaited<ReturnType<typeof generateSocraticTurn>>[]} */
  const results = [];

  for (const turn of SIM_TURNS) {
    const content = JSON.stringify({
      reply: turn.reply,
      learnerMap: turn.learnerMap,
      probe: turn.probe,
    });
    const transport = strictModel([content], (request) => {
      const user = request.messages[1];
      if (typeof user.content === "string") userPrompts.push(user.content);
    });
    const result = await generateSocraticTurn(
      { state: { ...state, learnerUtterance: turn.learner }, callLLM: transport },
    );
    assert.equal(result.ok, true, `turn failed: ${result.errors.join("; ")}`);
    assert.equal(result.retried, false);
    results.push(result);
    const validation = validateLearnerMap(result.learnerMap, laptopRealityMap);
    assert.equal(validation.ok, true, `turn left an invalid map: ${validation.errors.join("; ")}`);
    state = baseState({
      learnerMap: /** @type {any} */ (result.learnerMap),
      failedAttempts: /** @type {any} */ (result.failedAttempts),
    });
  }

  const kinds = results.map((result) => result.probe && result.probe.kind);
  assert.deepEqual(kinds, [
    "observe",
    "probe",
    "probe",
    "explain",
    "probe",
    "probe",
    "brief",
    "probe",
  ]);

  const modes = results.map((result) => result.mode);
  assert.deepEqual(modes, ["observe", "gap", "gap", "gap", "gap", "gap", "gap", "gap"]);

  const failures = results.map((result) => result.failedAttempts);
  assert.deepEqual(failures[0], {});
  assert.deepEqual(failures[1], { "n-transistor": 1 });
  assert.deepEqual(failures[2], { "n-transistor": 2 });
  assert.deepEqual(failures[3], {});
  assert.deepEqual(failures[4], {});
  assert.deepEqual(failures[5], { "n-logic-gate": 1 });
  assert.deepEqual(failures[6], {}, "the briefing resets the failure count");
  assert.deepEqual(failures[7], {});

  assert.deepEqual(results[0].diff, { added: ["n-app"], flipped: [], updated: [] });
  assert.deepEqual(results[1].diff, { added: ["n-transistor"], flipped: [], updated: [] });
  assert.deepEqual(results[2].diff, { added: [], flipped: [], updated: ["n-transistor"] });
  assert.deepEqual(results[3].diff, { added: [], flipped: [], updated: [] });
  assert.deepEqual(results[4].diff, {
    added: [],
    flipped: [{ id: "n-transistor", from: "misconception", to: "correct" }],
    updated: [],
  });
  assert.deepEqual(results[5].diff, { added: ["n-logic-gate"], flipped: [], updated: [] });
  assert.deepEqual(results[6].diff, { added: [], flipped: [], updated: [] }, "a briefing alone changes no states");
  assert.deepEqual(results[7].diff, {
    added: [],
    flipped: [{ id: "n-logic-gate", from: "missing", to: "correct" }],
    updated: ["n-transistor"],
  }, "the learner's post-briefing demonstration updates the map");

  assert.equal(closenessScore(/** @type {any} */ (results[0].learnerMap)), 1);
  assert.equal(closenessScore(/** @type {any} */ (results[1].learnerMap)), 0.5);
  assert.equal(closenessScore(/** @type {any} */ (results[4].learnerMap)), 1);
  assert.equal(closenessScore(/** @type {any} */ (results[5].learnerMap)), 2 / 3);
  assert.equal(closenessScore(/** @type {any} */ (results[6].learnerMap)), 2 / 3);
  assert.equal(closenessScore(/** @type {any} */ (results[7].learnerMap)), 1);

  assert.match(userPrompts[0], /Opening move/);
  assert.doesNotMatch(userPrompts[1], /explanation fallback is due/);
  assert.doesNotMatch(userPrompts[2], /explanation fallback is due/);
  assert.match(userPrompts[3], /explanation fallback is due/);
  assert.match(userPrompts[3], /n-transistor/);
  assert.match(userPrompts[6], /asked for direct information/);
});

test("no simulated reply quotes reality map content verbatim (briefings excepted - the sanctioned mode)", () => {
  const descriptions = laptopRealityMap.nodes.map((node) => node.description);
  for (const turn of SIM_TURNS) {
    if (turn.probe.kind === "brief") continue;
    for (const description of descriptions) {
      assert.equal(
        turn.reply.includes(description),
        false,
        `reply leaked the reality map: "${description}" appears in "${turn.reply}"`
      );
    }
  }
});

test("a briefing reply quotes the reality map accurately and completely", () => {
  const briefing = SIM_TURNS.find((turn) => turn.probe.kind === "brief");
  assert.ok(briefing, "the simulated session has a briefing turn");
  const transistor = laptopRealityMap.nodes.find((node) => node.id === "n-transistor");
  assert.ok(
    transistor && briefing.reply.includes(transistor.description),
    "the briefing quotes the map verbatim"
  );
  assert.ok(
    briefing.reply.includes("Logic gates") && briefing.reply.includes("AND, OR and NOT"),
    "the briefing restates the map's content accurately, not invented claims"
  );
});

test("the directive for the gate turn never instructs quoting the reality map", () => {
  const state = baseState({
    learnerMap: laptopLearnerMap,
    failedAttempts: { "n-transistor": 2 },
  });
  const directive = buildDirective(state);
  assert.doesNotMatch(directive, /quote/i);
  assert.match(directive, /plain first-principles language/);
});
