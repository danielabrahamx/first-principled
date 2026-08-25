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

const THREE_STAGE_SCRIPT = [
  JSON.stringify({
    concept: "laptop",
    chronology: [
      {
        id: "c1",
        regime: "electronic switching",
        new_capability: "controllable binary signals",
        enabled_by_previous: [],
        ancestry_kind: "TECHNICAL",
        target_relevance: "A laptop needs controllable electronic state.",
      },
      {
        id: "c2",
        regime: "programmable computing",
        new_capability: "general information processing",
        enabled_by_previous: ["c1"],
        ancestry_kind: "TECHNICAL",
        target_relevance: "A laptop is a portable programmable computer.",
      },
    ],
  }),
  JSON.stringify({
    concept: "laptop",
    epiphanies: [
      {
        id: "e1",
        from_regimes: ["c1"],
        to_regimes: ["c2"],
        result: "Stored programs control electronic switches.",
        joint_kind: "ENGINEERED_RESULT",
        history: {
          certainty: "EXACT",
          who: ["Manchester computer team"],
          when: "1948",
          observation: "A stored program ran on an electronic computer.",
          uncertainty_note: "",
        },
        candidate_node: "stored program",
      },
    ],
  }),
  JSON.stringify({
    concept: "laptop",
    edges: [
      {
        from: "e1",
        to: "c1",
        because: "Stored-program control rests on controllable electronic switching.",
        evidence_ids: ["e1"],
      },
      {
        from: "c2",
        to: "c1",
        because: "Programmable computing rests on controllable electronic switching.",
        evidence_ids: [],
      },
    ],
  }),
];

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

test("init uses exactly the three-stage generator and strips diagnostics", async () => {
  const { callLLM, requests } = scriptedTransport(THREE_STAGE_SCRIPT);
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM });

  assert.equal(result.status, 200);
  assert.equal(result.body.phase, "active");
  assert.equal(result.body.reply, undefined, "no tutor question on init");
  assert.deepEqual(result.body.learnerMap, { nodes: [], edges: [] });
  assert.equal(requests.length, 3);
  assert.match(requests[0].messages[0].content, /capability regimes/);
  assert.match(requests[1].messages[0].content, /A result is the joint/);
  assert.match(requests[2].messages[0].content, /Dependence Tree/);
  assert.equal(result.body.realityMap.nodes.at(-1).label, "laptop");
  assert.equal("provenance" in result.body, false);
  assert.equal("diagnostics" in result.body, false);
  assert.equal("generationPath" in result.body, false);
});

test("a failed Chronology stage repairs once with the gate errors fed back, then fails", async () => {
  // The repair attempt returns a valid chronology, so the build continues
  // and completes: the script is the bad attempt, then the full valid run.
  const { callLLM, requests } = scriptedTransport([
    JSON.stringify({ concept: "laptop", chronology: [] }),
    ...THREE_STAGE_SCRIPT,
  ]);
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM });
  assert.equal(result.status, 200);
  assert.equal(result.body.phase, "active");
  // One repair call for Chronology plus the three stage calls.
  assert.equal(requests.length, THREE_STAGE_SCRIPT.length + 1);
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

test("unparseable model output repairs once, then maps to invalid_model_output", async () => {
  const { callLLM, requests } = scriptedTransport([GARBAGE, GARBAGE]);
  const result = await handleRequest(clone(INIT_REQUEST), { callLLM });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "invalid_model_output");
  // First attempt plus one repair attempt - no more.
  assert.equal(requests.length, 2, "a failed stage is repaired at most once");
});

test("a missing API key maps to a stable config error", async () => {
  const original = process.env.LLM_API_KEY;
  const originalProvider = process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_PROVIDER;
  try {
    const result = await handleRequest(clone(INIT_REQUEST));
    assert.equal(result.status, 500);
    assert.equal(result.body.error.code, "config_error");
    assert.match(result.body.error.message, /LLM_API_KEY/);
  } finally {
    if (original === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = original;
    }
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
  }
});

test("deepseek provider requires DEEPSEEK_API_KEY not LLM_API_KEY", async () => {
  const originalKey = process.env.LLM_API_KEY;
  const originalProvider = process.env.LLM_PROVIDER;
  const originalDeepseek = process.env.DEEPSEEK_API_KEY;
  process.env.LLM_API_KEY = "openrouter-key";
  process.env.LLM_PROVIDER = "deepseek";
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const result = await handleRequest(clone(INIT_REQUEST));
    assert.equal(result.status, 500);
    assert.equal(result.body.error.code, "config_error");
    assert.match(result.body.error.message, /DEEPSEEK_API_KEY/);
  } finally {
    if (originalKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = originalProvider;
    if (originalDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalDeepseek;
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
const BRIEF_TURN = JSON.stringify({
  reply: "A transistor is a switch made of silicon that electricity controls, not a hand switch.",
  learnerMap: {
    nodes: laptopLearnerMap.nodes.map((node) =>
      node.id === "n-transistor"
        ? { ...node, confidence: 0.3, evidence: ["no, it's a relay really"] }
        : node
    ),
    edges: laptopLearnerMap.edges,
  },
  probe: { nodeId: "n-transistor", kind: "brief" },
});

test("active runs one briefing turn, wired to the learner's latest message", async () => {
  const { callLLM, requests } = scriptedTransport([BRIEF_TURN]);
  const result = await handleRequest(clone(ACTIVE_REQUEST), { callLLM });

  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ["diff", "failedAttempts", "learnerMap", "phase", "reply"]);
  assert.equal(result.body.phase, "active");
  assert.deepEqual(result.body.diff, { added: [], flipped: [], updated: ["n-transistor"] });
  assert.deepEqual(result.body.failedAttempts, {});

  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /Latest learner message: "transistors are switches you flick by hand"/);
  assert.match(prompt, /"phase": "active"/);
  assert.match(prompt, /probe.kind must be "brief"/);
  assert.doesNotMatch(prompt, /explanation fallback is due/);
  assert.doesNotMatch(result.body.reply, /\?/);
});

test("active still briefs when every node is known (no transfer push)", async () => {
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
  const brief = JSON.stringify({
    reply: "The chain runs from electricity through silicon to the apps you use.",
    learnerMap: learner,
    probe: { nodeId: null, kind: "brief" },
  });
  const { callLLM, requests } = scriptedTransport([brief]);
  const result = await handleRequest(request, { callLLM });

  assert.equal(result.status, 200);
  assert.equal(result.body.phase, "active");
  assert.equal(result.body.reply, "The chain runs from electricity through silicon to the apps you use.");
  assert.doesNotMatch(result.body.reply, /\?/);
  assert.deepEqual(result.body.learnerMap, learner);
  assert.equal(requests.length, 1);
  const prompt = requests[0].messages[1].content;
  assert.match(prompt, /probe.kind must be "brief"/);
  assert.doesNotMatch(prompt, /Ask the transfer question now/);
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
  const first = scriptedTransport(THREE_STAGE_SCRIPT);
  const second = scriptedTransport(THREE_STAGE_SCRIPT);
  const resultA = await handleRequest(clone(INIT_REQUEST), { callLLM: first.callLLM });
  const resultB = await handleRequest(clone(INIT_REQUEST), { callLLM: second.callLLM });
  assert.deepEqual(resultA, resultB);
});
