/**
 * The stateless agent orchestrator: the one serverless endpoint that wires
 * reality map generation (realityMap.js), Socratic turns (socratic.js), and
 * session end (transfer question + grading) together, storing nothing.
 *
 * Per ticket 06 and spec sections 6, 8. The endpoint is POST /api/agent; the
 * Netlify function wrapper (netlify/functions/agent/agent.mjs) parses the
 * body, calls handleRequest, and maps {status, body} onto an HTTP response.
 *
 * Statelessness: all session state arrives in the request (word, reality map,
 * learner map, failedAttempts, history, phase) and leaves with the response.
 * No module-level caches, no disk, no DB. Two identical requests produce
 * identical responses for identical upstream results.
 *
 * Errors are a stable envelope, never raw upstream text: 400 bad_request
 * (malformed request), 500 config_error (missing LLM_API_KEY) or internal,
 * 502 upstream_error (provider failure) or invalid_model_output (the model
 * could not produce valid output after the internal repair retry).
 */

import { generateRealityMap } from "./realityMap.js";
import { generateSocraticTurn } from "./socratic.js";
import { parseModelJson } from "./jsonParse.js";
import { callChatCompletion } from "./llm.js";
import { validateLearnerMap, validateRealityMap } from "../mmg/validator.js";

/**
 * @typedef {import("./llm.js").ChatMessage} ChatMessage
 * @typedef {import("../mmg/types.js").RealityMap} RealityMap
 * @typedef {import("../mmg/types.js").LearnerMentalModel} LearnerMentalModel
 * @typedef {import("./socratic.js").FailedAttempts} FailedAttempts
 */

/**
 * The injected transport, same shape as in realityMap.js and socratic.js.
 *
 * @typedef {(request: {
 *   messages: ChatMessage[],
 *   jsonMode: boolean,
 *   thinking: boolean,
 *   maxTokens: number,
 * }) => Promise<{ content: string }>} CallLLM
 */

/**
 * @typedef {object} ApiResult
 * @property {number} status - the HTTP status to return.
 * @property {any} body - the JSON body: the spec turn response on 200, the
 *   stable error envelope otherwise.
 */

/**
 * The session turn cap: after this many learner messages the orchestrator
 * ends the session with the transfer question even if nodes remain untested -
 * a safety valve for pathological sessions. The primary end trigger is
 * sessionEndDue (every reality node known); the cap guarantees termination.
 */
export const MAX_TURNS = 24;

/**
 * Abuse-control caps (ticket 18), enforced server-side before any LLM
 * call: the client is trusted to behave, the endpoint is not.
 */
export const MAX_WORD_CHARS = 100;
export const MAX_MESSAGE_CHARS = 10000;
export const MAX_HISTORY_MESSAGES = 60;

/**
 * Whether the session is due to end: every reality node is known in the
 * learner map (no node left untested), or the learner-message cap is hit.
 * Pure and deterministic; checked by the orchestrator before each active
 * turn. "Known" means state is not untested - the transfer question then
 * tests whether what is known is actually correct.
 *
 * @param {RealityMap} realityMap
 * @param {LearnerMentalModel} learnerMap
 * @param {number} learnerMessageCount - user messages so far, from history.
 * @returns {boolean}
 */
export function sessionEndDue(realityMap, learnerMap, learnerMessageCount) {
  if (learnerMessageCount >= MAX_TURNS) return true;
  const known = new Set(
    learnerMap.nodes.filter((node) => node.state !== "untested").map((node) => node.id)
  );
  return realityMap.nodes.every((node) => known.has(node.id));
}

/**
 * The system prompt for the transfer question turn. The transfer question is
 * the product-level moment (spec section 8, "End"): a novel problem that
 * requires the corrected model.
 *
 * @returns {string}
 */
export function buildTransferSystemPrompt() {
  return `You are first-principled, a Socratic tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

The learner has just finished building their model of a concept through a Socratic conversation. Your job now: ask ONE transfer question.

A transfer question is a novel problem whose solution requires applying the corrected model - a concrete scenario the learner has not discussed, which cannot be answered by quoting a definition, and which reveals whether their understanding transfers beyond the conversation. Put it in plain language, as something they might actually meet (for example: a friend's device misbehaves in a described way; they are asked to explain or fix something they have not been told about before).

Ask it directly, in one or two sentences. No preamble, no hints at the answer, no lesson.`;
}

/**
 * @param {RealityMap} realityMap
 * @returns {string}
 */
export function buildTransferUserPrompt(realityMap) {
  return `Concept and reality map (json):

${JSON.stringify(realityMap, null, 2)}

Ask the transfer question now. Reply with a single json object, exactly this shape:
{"question": "the transfer question, one or two sentences"}`;
}

/**
 * The system prompt for the grading turn: judge the learner's answer to the
 * transfer question against the reality map. At this point the comparison is
 * unlocked, so the assessment may reference reality.
 *
 * @returns {string}
 */
export function buildGradeSystemPrompt() {
  return `You are first-principled, a Socratic tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

You are grading the learner's answer to the transfer question you asked at the end of a Socratic session. Judge the answer against reality: does it demonstrate a correct application of the model the session was refining?

Pass when the learner's reasoning is essentially right - minor imprecision or hesitation is fine. Fail when the answer rests on a misconception the session was meant to correct, when it reveals the model did not transfer to the new situation, or when it shows the learner still cannot reason from the concept's foundations. Be fair, specific, and honest.`;
}

/**
 * @param {RealityMap} realityMap
 * @param {LearnerMentalModel} learnerMap
 * @param {string} question - the transfer question from the session history.
 * @param {string} answer - the learner's answer, the last user message.
 * @returns {string}
 */
export function buildGradeUserPrompt(realityMap, learnerMap, question, answer) {
  return `Reality map (json):

${JSON.stringify(realityMap, null, 2)}

Learner model at session end (json):

${JSON.stringify(learnerMap, null, 2)}

Transfer question: ${question}

The learner's answer: ${answer}

Reply with a single json object, exactly this shape:
{"passed": true or false, "assessment": "one or two sentences, learner-facing, explaining how the answer measured up against reality"}`;
}

/* ---------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------- */

/**
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @returns {ApiResult}
 */
function errorResult(status, code, message) {
  return { status, body: { error: { code, message } } };
}

/**
 * @param {string | null} kind - a turn's or generation's failure kind.
 * @returns {ApiResult}
 */
function modelError(kind) {
  if (kind === "error") {
    return errorResult(
      502,
      "upstream_error",
      "The model provider could not be reached. Please try again in a moment."
    );
  }
  return errorResult(
    502,
    "invalid_model_output",
    "The model could not produce a valid response. Please try again."
  );
}

/**
 * The stable error envelope is never built from raw upstream text or the
 * key; a collapsed validation list is safe (it describes the client's own
 * data).
 *
 * @param {string[]} errors
 * @returns {string}
 */
function joined(errors) {
  return errors.slice(0, 3).join("; ");
}

/**
 * @param {unknown} value
 * @param {string} what
 * @returns {string[]}
 */
function historyErrors(value, what) {
  if (!Array.isArray(value)) {
    return [`${what} must be an array`];
  }
  /** @type {string[]} */
  const errors = [];
  value.forEach((message, i) => {
    if (typeof message !== "object" || message === null) {
      errors.push(`${what}[${i}] must be an object with role and content`);
      return;
    }
    const role = /** @type {any} */ (message).role;
    if (role !== "user" && role !== "assistant") {
      errors.push(`${what}[${i}].role must be "user" or "assistant"`);
    }
    if (typeof /** @type {any} */ (message).content !== "string") {
      errors.push(`${what}[${i}].content must be a string`);
    } else if (/** @type {any} */ (message).content.length > MAX_MESSAGE_CHARS) {
      errors.push(
        `${what}[${i}].content is too long (max ${MAX_MESSAGE_CHARS} characters)`
      );
    }
  });
  if (errors.length === 0 && value.length === 0) {
    errors.push(`${what} must not be empty`);
  }
  if (errors.length === 0) {
    const last = /** @type {any} */ (value[value.length - 1]);
    if (last.role !== "user") {
      errors.push(`the last message in ${what} must be the learner's (role "user")`);
    }
  }
  return errors;
}

/**
 * @param {unknown} value
 * @param {string} what
 * @returns {string[]}
 */
function failedAttemptsErrors(value, what) {
  if (value === undefined || value === null) return [];
  if (typeof value !== "object" || Array.isArray(value)) {
    return [`${what} must be an object mapping node ids to counts`];
  }
  /** @type {string[]} */
  const errors = [];
  for (const [id, count] of Object.entries(/** @type {any} */ (value))) {
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
      errors.push(`${what}.${id} must be a non-negative number`);
    }
  }
  return errors;
}

/**
 * @param {unknown} value
 * @returns {FailedAttempts}
 */
function coerceFailedAttempts(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {FailedAttempts} */ (value)
    : {};
}

/* ---------------------------------------------------------------------------
 * JSON turns (transfer question, grading)
 * ------------------------------------------------------------------------- */

/**
 * @typedef {object} UnpackedJson
 * @property {boolean} ok
 * @property {unknown} value - present when ok.
 * @property {"invalid" | "error" | null} kind - why it failed.
 */

/**
 * @param {unknown} parsed
 * @param {(parsed: any) => unknown | null} unpack
 * @returns {unknown | null}
 */
function unpackOrNull(parsed, unpack) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return unpack(/** @type {any} */ (parsed));
}

/**
 * One two-attempt JSON turn: call the model, parse defensively, unpack; on a
 * malformed or shape-invalid reply, repair once with the problem cited and
 * thinking disabled (the same repair policy as the engines in tickets 04 and
 * 05). The transport failure path never carries raw upstream text.
 *
 * @param {{ callLLM: CallLLM; system: string; user: string; unpack: (parsed: any) => unknown | null; thinking?: boolean; maxTokens?: number }} input
 * @returns {Promise<UnpackedJson>}
 */
async function generateJson({ callLLM, system, user, unpack, thinking = true, maxTokens = 2048 }) {
  /** @type {ChatMessage} */
  const sys = { role: "system", content: system };
  /** @type {ChatMessage} */
  const initial = { role: "user", content: user };

  let first;
  try {
    first = await callLLM({
      messages: [sys, initial],
      jsonMode: true,
      thinking,
      maxTokens,
    });
  } catch {
    return { ok: false, value: null, kind: "error" };
  }
  const firstValue = unpackOrNull(parseModelJson(first.content), unpack);
  if (firstValue !== null) return { ok: true, value: firstValue, kind: null };

  /** @type {ChatMessage} */
  const repair = {
    role: "user",
    content: `${user}

Your previous reply did not meet the contract: it was not valid JSON in the required shape.

Reply with JSON only, no markdown, no commentary, exactly the required shape.`,
  };
  let second;
  try {
    second = await callLLM({
      messages: [sys, repair],
      jsonMode: true,
      thinking: false,
      maxTokens,
    });
  } catch {
    return { ok: false, value: null, kind: "error" };
  }
  const secondValue = unpackOrNull(parseModelJson(second.content), unpack);
  if (secondValue !== null) return { ok: true, value: secondValue, kind: null };
  return { ok: false, value: null, kind: "invalid" };
}

/**
 * @param {unknown} parsed
 * @returns {{ question: string } | null}
 */
function unpackQuestion(parsed) {
  const reply = /** @type {any} */ (parsed);
  if (typeof reply.question !== "string" || reply.question.trim().length === 0) return null;
  return { question: reply.question };
}

/**
 * @param {unknown} parsed
 * @returns {{ passed: boolean; assessment: string } | null}
 */
function unpackGrade(parsed) {
  const reply = /** @type {any} */ (parsed);
  if (typeof reply.passed !== "boolean") return null;
  if (typeof reply.assessment !== "string" || reply.assessment.trim().length === 0) return null;
  return { passed: reply.passed, assessment: reply.assessment };
}

/* ---------------------------------------------------------------------------
 * Phases
 * ------------------------------------------------------------------------- */

/**
 * Keep only the tail of a validated history. Real sessions end at
 * MAX_TURNS learner messages (48 messages at most); anything longer is an
 * attacker padding the prompt, so it is dropped before it reaches the
 * model. The tail keeps the transfer question and the last utterance.
 *
 * @param {any[]} messages
 * @returns {any[]}
 */
function truncateHistory(messages) {
  return messages.length > MAX_HISTORY_MESSAGES
    ? messages.slice(messages.length - MAX_HISTORY_MESSAGES)
    : messages;
}

/**
 * The init phase: generate the reality map and return it with no tutor
 * question (v4 ticket 04). The dock stays empty until the learner asks.
 * A refused word stays on phase "init" with the refusal as the reply and
 * no reality map, so the client can ask again.
 *
 * @param {any} request
 * @param {CallLLM} callLLM
 * @returns {Promise<ApiResult>}
 */
async function handleInit(request, callLLM) {
  const word = typeof request.word === "string" ? request.word.trim() : "";
  if (word.length === 0) {
    return errorResult(
      400,
      "bad_request",
      'A word or phrase is required to start a session (field "word").'
    );
  }
  if (word.length > MAX_WORD_CHARS) {
    return errorResult(
      400,
      "bad_request",
      `The word or phrase is too long (max ${MAX_WORD_CHARS} characters).`
    );
  }

  const generation = await generateRealityMap({ concept: word, callLLM });
  if (!generation.ok) {
    if (generation.kind === "refused") {
      return {
        status: 200,
        body: {
          reply:
            generation.reason ??
            "I could not find a concept in that input. Use a word or phrase that names an idea.",
          learnerMap: { nodes: [], edges: [] },
          diff: { added: [], flipped: [], updated: [] },
          phase: "init",
          failedAttempts: {},
        },
      };
    }
    return modelError(generation.kind);
  }

  return {
    status: 200,
    body: {
      learnerMap: { nodes: [], edges: [] },
      diff: { added: [], flipped: [], updated: [] },
      phase: "active",
      failedAttempts: {},
      realityMap: /** @type {RealityMap} */ (generation.map),
    },
  };
}

/**
 * The active phase: one Socratic turn, or - when the session is due to end -
 * the transfer question with phase "end". The deterministic end check runs
 * before the turn on the map the client holds.
 *
 * @param {any} request
 * @param {CallLLM} callLLM
 * @returns {Promise<ApiResult>}
 */
async function handleActive(request, callLLM) {
  const reality = validateRealityMap(request.realityMap);
  if (!reality.ok) {
    return errorResult(400, "bad_request", `realityMap failed validation: ${joined(reality.errors)}`);
  }
  const learner = validateLearnerMap(request.learnerMap, request.realityMap);
  if (!learner.ok) {
    return errorResult(400, "bad_request", `learnerMap failed validation: ${joined(learner.errors)}`);
  }
  const attempts = failedAttemptsErrors(request.failedAttempts, "failedAttempts");
  if (attempts.length > 0) {
    return errorResult(400, "bad_request", attempts.join("; "));
  }
  const history = historyErrors(request.history, "history");
  if (history.length > 0) {
    return errorResult(400, "bad_request", history.join("; "));
  }

  /** @type {RealityMap} */
  const realityMap = request.realityMap;
  /** @type {LearnerMentalModel} */
  const learnerMap = request.learnerMap;
  const failedAttempts = coerceFailedAttempts(request.failedAttempts);
  const messages = truncateHistory(/** @type {any[]} */ (request.history));
  const utterance = /** @type {any} */ (messages[messages.length - 1]).content;

  /** @type {import("./socratic.js").SocraticState} */
  const state = {
    realityMap,
    learnerMap,
    failedAttempts,
    phase: "active",
    learnerUtterance: utterance,
    forceBrief: true,
  };

  const turn = await generateSocraticTurn({ state, callLLM });
  if (!turn.ok) return modelError(turn.kind);
  return {
    status: 200,
    body: {
      reply: turn.reply,
      learnerMap: turn.learnerMap,
      diff: turn.diff,
      phase: "active",
      failedAttempts: turn.failedAttempts,
    },
  };
}

/**
 * The transfer question turn: asks the novel problem and returns phase "end"
 * without touching the learner map (nothing is left to probe). The response
 * carries sessionEnded only when the answer has been graded (handleEnd).
 *
 * @param {{ realityMap: RealityMap; learnerMap: LearnerMentalModel; failedAttempts: FailedAttempts }} state
 * @param {CallLLM} callLLM
 * @returns {Promise<ApiResult>}
 */
async function runTransferTurn(state, callLLM) {
  const result = await generateJson({
    callLLM,
    system: buildTransferSystemPrompt(),
    user: buildTransferUserPrompt(state.realityMap),
    unpack: unpackQuestion,
  });
  if (!result.ok) return modelError(result.kind);
  const question = /** @type {{ question: string }} */ (result.value).question;
  return {
    status: 200,
    body: {
      reply: question,
      learnerMap: state.learnerMap,
      diff: { added: [], flipped: [], updated: [] },
      phase: "end",
      failedAttempts: state.failedAttempts,
    },
  };
}

/**
 * The end phase: grade the learner's answer to the transfer question (the
 * last assistant message in history is the question, the last user message
 * the answer), and close the session.
 *
 * @param {any} request
 * @param {CallLLM} callLLM
 * @returns {Promise<ApiResult>}
 */
async function handleEnd(request, callLLM) {
  const reality = validateRealityMap(request.realityMap);
  if (!reality.ok) {
    return errorResult(400, "bad_request", `realityMap failed validation: ${joined(reality.errors)}`);
  }
  const learner = validateLearnerMap(request.learnerMap, request.realityMap);
  if (!learner.ok) {
    return errorResult(400, "bad_request", `learnerMap failed validation: ${joined(learner.errors)}`);
  }
  const attempts = failedAttemptsErrors(request.failedAttempts, "failedAttempts");
  if (attempts.length > 0) {
    return errorResult(400, "bad_request", attempts.join("; "));
  }
  const history = historyErrors(request.history, "history");
  if (history.length > 0) {
    return errorResult(400, "bad_request", history.join("; "));
  }

  const messages = truncateHistory(/** @type {any[]} */ (request.history));
  const answer = /** @type {any} */ (messages[messages.length - 1]).content;
  let question = null;
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      question = messages[i].content;
      break;
    }
  }
  if (question === null) {
    return errorResult(
      400,
      "bad_request",
      "Cannot grade phase \"end\" without the transfer question in history."
    );
  }

  const result = await generateJson({
    callLLM,
    system: buildGradeSystemPrompt(),
    user: buildGradeUserPrompt(request.realityMap, request.learnerMap, question, answer),
    unpack: unpackGrade,
    maxTokens: 1024,
  });
  if (!result.ok) return modelError(result.kind);
  const grade = /** @type {{ passed: boolean; assessment: string }} */ (result.value);
  return {
    status: 200,
    body: {
      reply: grade.assessment,
      learnerMap: request.learnerMap,
      diff: { added: [], flipped: [], updated: [] },
      phase: "end",
      failedAttempts: coerceFailedAttempts(request.failedAttempts),
      sessionEnded: true,
      transferResult: { passed: grade.passed, assessment: grade.assessment },
    },
  };
}

/* ---------------------------------------------------------------------------
 * Entry point
 * ------------------------------------------------------------------------- */

/**
 * Dispatches one request through the turn contract. The environment check
 * runs only when no transport was injected, so unit tests can stub the LLM
 * without an API key; production always goes through the real transport and
 * reports a missing key as a stable config_error instead of a thrown error.
 *
 * @param {any} request - the parsed request body.
 * @param {{ callLLM?: CallLLM }} [options]
 * @returns {Promise<ApiResult>}
 */
export async function handleRequest(request, options = {}) {
  const callLLM =
    options.callLLM ??
    /** @type {CallLLM} */ (async (llmRequest) => {
      const result = await callChatCompletion(llmRequest);
      return { content: result.content };
    });
  if (!options.callLLM && !process.env.LLM_API_KEY) {
    return errorResult(
      500,
      "config_error",
      "The server is not configured with an LLM key (LLM_API_KEY)."
    );
  }

  const phase = request && request.phase;
  if (phase === "init") return handleInit(request, callLLM);
  if (phase === "active") return handleActive(request, callLLM);
  if (phase === "end") return handleEnd(request, callLLM);
  return errorResult(
    400,
    "bad_request",
    `Unknown phase: ${String(phase)}. Expected "init", "active" or "end".`
  );
}
