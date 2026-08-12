import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, laptopLearnerMap } from "../mmg/fixtures.js";
import {
  handleRequest,
  sessionEndDue,
  MAX_TURNS,
  buildTransferSystemPrompt,
  buildTransferUserPrompt,
  buildGradeSystemPrompt,
  buildGradeUserPrompt,
} from "./orchestrator.js";

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * A scripted transport: replays the given contents in order and throws on
 * any extra call, so unexpected repair attempts or turn calls fail loudly.
 *
 * @param {string[]} contents
 * @param {(request: any) => void} [onCall]
 * @returns {{ callLLM: (request: any) => Promise<{ content: string }>, requests: any[] }}
 */
function scriptedTransport(contents, onCall) {
  const requests = /** @type {any[]} */ ([]);
  let calls = 0;
  const callLLM = async (/** @type {any} */ request) => {
    requests.push(request);
    if (onCall) onCall(request);
    if (calls >= contents.length) {
      throw new Error(`unexpected extra LLM call #${calls + 1}`);
    }
    const content = contents[calls];
    calls += 1;
    return { content };
  };
  return { callLLM, requests };
}

/** @type {string} */
const ENVELOPED_MAP = JSON.stringify({
  isValidConcept: true,
  map: laptopRealityMap,
});

/** @type {string} */
const FOUNDATION_REPLY = JSON.stringify({
  isValidConcept: true,
  foundation: {
    layer: laptopRealityMap.layers[0],
    nodes: laptopRealityMap.nodes.filter(
      (node) => node.layer === laptopRealityMap.layers[0].id
    ),
  },
});

/**
 * The per-layer map-generation script (ticket 08): the foundation reply,
 * then one reply per layer rebuilding the fixture bottom-up. Each layer
 * reply carries the fixture layer, its nodes, and the fixture edges whose
 * higher endpoint sits in that layer, so the assembled map reproduces the
 * fixture (edge order excepted - an edge belongs to the reply of its higher
 * layer).
 *
 * @type {string[]}
 */
const PER_LAYER_MAP_SCRIPT = (() => {
  const layerIndex = new Map(
    laptopRealityMap.layers.map((layer, i) => [layer.id, i])
  );
  const nodeLayer = new Map(
    laptopRealityMap.nodes.map((node) => [node.id, layerIndex.get(node.layer)])
  );
  const script = [FOUNDATION_REPLY];
  for (let k = 1; k < laptopRealityMap.layers.length; k++) {
    const layer = laptopRealityMap.layers[k];
    const nodes = laptopRealityMap.nodes.filter((node) => node.layer === layer.id);
    const edges = laptopRealityMap.edges.filter((edge) => {
      const s = nodeLayer.get(edge.source) ?? -1;
      const t = nodeLayer.get(edge.target) ?? -1;
      return Math.max(s, t) === k;
    });
    script.push(
      JSON.stringify({
        isValidConcept: true,
        done: false,
        layer,
        nodes,
        edges,
        selfReview: { derivable: true, gaps: [] },
      })
    );
  }
  return script;
})();

/**
 * The per-layer assembled map differs from the fixture only in edge ORDER,
 * so compare the reality maps semantically: identical layers, nodes, and
 * edge set.
 *
 * @param {any} actual
 * @param {any} expected
 */
function assertRealityMapEqual(actual, expected) {
  /** @param {any} m */
  const sortEdges = (m) =>
    [...m.edges].sort((a, b) =>
      `${a.source}|${a.target}|${a.type}`.localeCompare(`${b.source}|${b.target}|${b.type}`)
    );
  assert.deepEqual(actual.layers, expected.layers);
  assert.deepEqual(actual.nodes, expected.nodes);
  assert.deepEqual(sortEdges(actual), sortEdges(expected));
  assert.equal(actual.concept, expected.concept);
}

/** @type {string} */
const OPENING_TURN = JSON.stringify({
  reply: "What have you noticed about how what you type becomes letters on the screen?",
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

const INIT_REQUEST = { word: "laptop", history: [], phase: "init" };

/** @type {string} */
const TRANSFER_QUESTION = JSON.stringify({
  question: "Your friend's laptop stops working mid-day. Where would you start looking and why?",
});

/** @type {string} */
const GRADE = JSON.stringify({
  passed: true,
  assessment: "You traced the failure to the power path - exactly right.",
});

/** @type {string} */
const GARBAGE = "this is not json";

/* ---------------------------------------------------------------------------
 * sessionEndDue
 * ------------------------------------------------------------------------- */

test("sessionEndDue is false while any reality node is untested", () => {
  const due = sessionEndDue(laptopRealityMap, laptopLearnerMap, 5);
  assert.equal(due, false);
});

test("sessionEndDue is true when every reality node is known", () => {
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const learner = {
    nodes: laptopRealityMap.nodes.map((node) => ({
      id: node.id,
      state: "correct",
      confidence: 0.7,
      evidence: ["known"],
    })),
    edges: [],
  };
  assert.equal(sessionEndDue(laptopRealityMap, learner, 5), true);
});

test("sessionEndDue is true at the turn cap even with untested nodes", () => {
  assert.equal(sessionEndDue(laptopRealityMap, laptopLearnerMap, MAX_TURNS), true);
  assert.equal(sessionEndDue(laptopRealityMap, laptopLearnerMap, MAX_TURNS - 1), false);
});

/* ---------------------------------------------------------------------------
 * Prompts
 * ------------------------------------------------------------------------- */

test("transfer prompts carry the JSON mode contract and the reality map", () => {
  assert.match(buildTransferSystemPrompt(), /transfer question/i);
  assert.match(buildTransferSystemPrompt(), /novel problem/i);
  const user = buildTransferUserPrompt(laptopRealityMap);
  assert.match(user, /json/i);
  assert.match(user, /"concept": "laptop"/);
  assert.match(user, /Ask the transfer question now/);
});

test("grade prompts carry the JSON mode contract and the question and answer", () => {
  assert.match(buildGradeSystemPrompt(), /pass when/i);
  assert.match(buildGradeSystemPrompt(), /fail when/i);
  const user = buildGradeUserPrompt(
    laptopRealityMap,
    laptopLearnerMap,
    "Where would you start looking?",
    "The battery and the power path."
  );
  assert.match(user, /json/i);
  assert.match(user, /Transfer question: Where would you start looking\?/);
  assert.match(user, /The learner's answer: The battery and the power path\./);
  assert.match(user, /"passed": true or false/);
});

/* ---------------------------------------------------------------------------
 * init
 * ------------------------------------------------------------------------- */

test("init generates the map (per-layer bottom-up) and runs the opening turn, contract-exact", async () => {
  const { callLLM, requests } = scriptedTransport([...PER_LAYER_MAP_SCRIPT, OPENING_TURN]);
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM });

  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), [
    "diff",
    "failedAttempts",
    "learnerMap",
    "phase",
    "realityMap",
    "reply",
  ]);
  assertRealityMapEqual(result.body.realityMap, laptopRealityMap);
  assert.equal(result.body.phase, "active");
  assert.equal(result.body.reply, "What have you noticed about how what you type becomes letters on the screen?");
  assert.deepEqual(result.body.learnerMap, {
    nodes: [
      {
        id: "n-app",
        state: "correct",
        confidence: 0.7,
        evidence: ["I use a laptop every day"],
      },
    ],
    edges: [],
  });
  assert.deepEqual(result.body.diff, { added: ["n-app"], flipped: [], updated: [] });
  assert.deepEqual(result.body.failedAttempts, {});
  assert.equal(requests.length, laptopRealityMap.layers.length + 1, "foundation + one call per layer, then one opening turn - no more calls");
  assert.match(requests[0].messages[1].content, /Word or phrase: laptop/);
  assert.match(requests[1].messages[1].content, /Build layer l1/);
  assert.match(requests[laptopRealityMap.layers.length - 1].messages[1].content, /Build layer l5/);
  const openingPrompt = requests[laptopRealityMap.layers.length].messages[1].content;
  assert.match(openingPrompt, /Opening move/);
  assert.match(openingPrompt, /Latest learner message: "laptop"/);
});

test("init refuses a non-teachable word gracefully, staying on phase init", async () => {
  const { callLLM, requests } = scriptedTransport([
    JSON.stringify({ isValidConcept: false, reason: "that is not a real concept" }),
  ]);
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM });

  assert.equal(result.status, 200);
  assert.equal(result.body.phase, "init");
  assert.equal(result.body.reply, "that is not a real concept");
  assert.deepEqual(result.body.learnerMap, { nodes: [], edges: [] });
  assert.deepEqual(result.body.diff, { added: [], flipped: [], updated: [] });
  assert.equal(result.body.realityMap, undefined, "no reality map on refusal");
  assert.equal(requests.length, 1);
});

test("init without a word is a bad request", async () => {
  const result = await handleRequest({ word: "   ", history: [], phase: "init" }, { callLLM: async () => ({ content: "" }) });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
});

test("an unknown phase is a bad request", async () => {
  const result = await handleRequest({ phase: "warp" }, { callLLM: async () => ({ content: "" }) });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
  assert.match(result.body.error.message, /warp/);
});

test("a transport failure on init maps to a structured upstream error, never the raw text", async () => {
  const transport = async () => {
    throw new Error("boom: provider secrets inside");
  };
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM: transport });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "upstream_error");
  assert.doesNotMatch(result.body.error.message, /boom|secret/);
});

test("unparseable model output maps to invalid_model_output", async () => {
  const { callLLM } = scriptedTransport([GARBAGE, GARBAGE, GARBAGE]);
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "invalid_model_output");
});

test("a missing API key maps to a stable config error", async () => {
  const original = process.env.LLM_API_KEY;
  delete process.env.LLM_API_KEY;
  try {
    const result = await handleRequest(clone(INIT_REQUEST));
    assert.equal(result.status, 500);
    assert.equal(result.body.error.code, "config_error");
  } finally {
    if (original === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = original;
    }
  }
});

/* ---------------------------------------------------------------------------
 * active
 * ------------------------------------------------------------------------- */

/** @type {any} */
const ACTIVE_REQUEST = {
  phase: "active",
  realityMap: laptopRealityMap,
  learnerMap: laptopLearnerMap,
  failedAttempts: { "n-transistor": 1 },
  history: [
    { role: "user", content: "laptop" },
    { role: "assistant", content: "What have you noticed about your laptop?" },
    { role: "user", content: "transistors are switches you flick by hand" },
  ],
};

/** @type {string} */
const SOCRATIC_TURN = JSON.stringify({
  reply: "And what controls that switch inside the laptop?",
  learnerMap: {
    nodes: laptopLearnerMap.nodes.map((node) =>
      node.id === "n-transistor"
        ? { ...node, confidence: 0.3, evidence: ["no, it's a relay really"] }
        : node
    ),
    edges: laptopLearnerMap.edges,
  },
  probe: { nodeId: "n-transistor", kind: "probe" },
});

test("active runs one Socratic turn, wired to the learner's latest message", async () => {
  const { callLLM, requests } = scriptedTransport([SOCRATIC_TURN]);
  const result = await handleRequest(clone(ACTIVE_REQUEST), { callLLM });

  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ["diff", "failedAttempts", "learnerMap", "phase", "reply"]);
  assert.equal(result.body.phase, "active");
  assert.deepEqual(result.body.diff, { added: [], flipped: [], updated: ["n-transistor"] });
  assert.deepEqual(result.body.failedAttempts, { "n-transistor": 2 });

  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /Latest learner message: "transistors are switches you flick by hand"/);
  assert.match(prompt, /Phase: active/);
  assert.doesNotMatch(prompt, /explanation fallback is due/);
});

test("active returns the transfer question with phase end when the session is due", async () => {
  /** @type {import("../mmg/types.js").LearnerMentalModel} */
  const learner = {
    nodes: laptopRealityMap.nodes.map((node) => ({
      id: node.id,
      state: "correct",
      confidence: 0.7,
      evidence: ["learner showed this"],
    })),
    edges: [],
  };
  const request = { ...clone(ACTIVE_REQUEST), learnerMap: learner, failedAttempts: {} };
  const { callLLM, requests } = scriptedTransport([TRANSFER_QUESTION]);
  const result = await handleRequest(request, { callLLM });

  assert.equal(result.status, 200);
  assert.equal(result.body.phase, "end");
  assert.equal(result.body.reply, "Your friend's laptop stops working mid-day. Where would you start looking and why?");
  assert.deepEqual(result.body.learnerMap, learner, "the learner map is untouched");
  assert.deepEqual(result.body.diff, { added: [], flipped: [], updated: [] });
  assert.deepEqual(result.body.failedAttempts, {});
  assert.equal(result.body.sessionEnded, undefined, "session ends only after grading");
  assert.equal(requests.length, 1, "no Socratic turn runs once the session is due");
  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /Ask the transfer question now/);
});

test("active without a reality map is a bad request", async () => {
  const request = { ...clone(ACTIVE_REQUEST), realityMap: undefined };
  const result = await handleRequest(request, { callLLM: async () => ({ content: "" }) });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
});

test("active with a learner map that does not mirror the reality map is a bad request", async () => {
  const learner = clone(laptopLearnerMap);
  learner.nodes.push({ id: "n-ghost", state: "correct", confidence: 0.9, evidence: [] });
  const result = await handleRequest({ ...clone(ACTIVE_REQUEST), learnerMap: learner }, {
    callLLM: async () => ({ content: "" }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
  assert.match(result.body.error.message, /n-ghost/);
});

test("active with malformed failedAttempts is a bad request", async () => {
  const result = await handleRequest({ ...clone(ACTIVE_REQUEST), failedAttempts: { "n-bit": "two" } }, {
    callLLM: async () => ({ content: "" }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
});

test("active with a history that does not end in the learner's message is a bad request", async () => {
  const history = [
    { role: "user", content: "laptop" },
    { role: "assistant", content: "What have you noticed?" },
  ];
  const result = await handleRequest({ ...clone(ACTIVE_REQUEST), history }, {
    callLLM: async () => ({ content: "" }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
});

test("a Socratic turn that fails to produce a valid update maps to a structured error", async () => {
  const { callLLM } = scriptedTransport([GARBAGE, GARBAGE]);
  const result = await handleRequest(clone(ACTIVE_REQUEST), { callLLM });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "invalid_model_output");
});

/* ---------------------------------------------------------------------------
 * end
 * ------------------------------------------------------------------------- */

/** @type {any} */
const END_REQUEST = {
  phase: "end",
  realityMap: laptopRealityMap,
  learnerMap: laptopLearnerMap,
  failedAttempts: {},
  history: [
    { role: "user", content: "laptop" },
    { role: "assistant", content: "What have you noticed about your laptop?" },
    { role: "user", content: "I use it daily" },
    { role: "assistant", content: "Your friend's laptop stops working mid-day. Where would you start looking and why?" },
    { role: "user", content: "The battery and the power path, since nothing else can kill everything at once." },
  ],
};

test("end grades the answer, closes the session, and echoes the state", async () => {
  const { callLLM, requests } = scriptedTransport([GRADE]);
  const result = await handleRequest(clone(END_REQUEST), { callLLM });

  assert.equal(result.status, 200);
  assert.equal(result.body.phase, "end");
  assert.equal(result.body.sessionEnded, true);
  assert.deepEqual(result.body.transferResult, {
    passed: true,
    assessment: "You traced the failure to the power path - exactly right.",
  });
  assert.equal(result.body.reply, "You traced the failure to the power path - exactly right.");
  assert.deepEqual(result.body.learnerMap, laptopLearnerMap, "the learner map is untouched");
  assert.deepEqual(result.body.diff, { added: [], flipped: [], updated: [] });
  assert.deepEqual(result.body.failedAttempts, {});

  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /Transfer question: Your friend's laptop stops working mid-day/);
  assert.match(prompt, /The learner's answer: The battery and the power path/);
});

test("end without the transfer question in history is a bad request", async () => {
  const history = [{ role: "user", content: "I'd check the battery." }];
  const result = await handleRequest({ ...clone(END_REQUEST), history }, {
    callLLM: async () => ({ content: "" }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "bad_request");
  assert.match(result.body.error.message, /transfer question/);
});

test("an unparseable grade after the repair attempt maps to a structured error", async () => {
  const { callLLM } = scriptedTransport([GARBAGE, GARBAGE]);
  const result = await handleRequest(clone(END_REQUEST), { callLLM });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "invalid_model_output");
});

/* ---------------------------------------------------------------------------
 * Statelessness
 * ------------------------------------------------------------------------- */

test("two identical requests with identical upstream results give identical responses", async () => {
  const first = scriptedTransport([...PER_LAYER_MAP_SCRIPT, OPENING_TURN]);
  const second = scriptedTransport([...PER_LAYER_MAP_SCRIPT, OPENING_TURN]);
  const resultA = await handleRequest(clone(INIT_REQUEST), { callLLM: first.callLLM });
  const resultB = await handleRequest(clone(INIT_REQUEST), { callLLM: second.callLLM });
  assert.deepEqual(resultA, resultB);
});
