/**
 * The Socratic engine: how the agent questions, infers, and updates the
 * learner's Mental Model without leaking the reality map, per ticket 05 and
 * spec sections 3, 7, 8.
 *
 * Division of labour:
 * - Code decides the hard, countable rules: opening vs gap-first mode
 *   (conversationMode), the explanation gate after two failed attempts
 *   (explanationDue, updateFailedAttempts), the deterministic per-turn diff
 *   (computeDiff), and schema/consistency validation of the model's update
 *   (validateTurn). These are pure functions, unit-tested.
 * - The model decides everything semantic: which gap to probe, the wording,
 *   misconception detection, and what the learner's words imply about node
 *   states. The prompts (buildSocraticSystemPrompt, buildSocraticUserPrompt)
 *   carry the immutable mission and principles plus this turn's directive.
 *
 * The model replies with {reply, learnerMap, probe}; the function does NOT
 * trust a model-computed diff - computeDiff derives it from the previous and
 * updated learner maps, so flips are deterministic and testable.
 */

import { callChatCompletion } from "./llm.js";
import { parseModelJson } from "./jsonParse.js";
import { validateLearnerMap } from "../mmg/validator.js";

/**
 * @typedef {import("../mmg/types.js").RealityMap} RealityMap
 * @typedef {import("../mmg/types.js").LearnerMentalModel} LearnerMentalModel
 * @typedef {import("../mmg/types.js").Diff} Diff
 * @typedef {import("../mmg/types.js").NodeState} NodeState
 */

/**
 * Failed attempts per reality node id: how many consecutive probes of a node
 * left it non-correct. Two or more trips the explanation fallback (principle
 * 8). Held by the client as session state, sent with every request.
 *
 * @typedef {Object<string, number>} FailedAttempts
 */

/**
 * What a model turn was about, reported by the model.
 * - observe: the observation-first opening (nodeId usually null).
 * - probe: a gap-first probing question about a specific node.
 * - explain: the explanation fallback fired for this node.
 * - converse: the learner asked a clarifying question; answered without
 *   changing the model.
 *
 * @typedef {"observe" | "probe" | "explain" | "converse"} ProbeKind
 */

/**
 * @typedef {object} Probe
 * @property {string | null} nodeId - the reality node this turn was about.
 * @property {ProbeKind} kind
 */

/**
 * @typedef {object} SocraticState
 * @property {RealityMap} realityMap
 * @property {LearnerMentalModel} learnerMap
 * @property {FailedAttempts} failedAttempts
 * @property {"init" | "active" | "end"} phase - this engine drives active
 *   turns; init (reality map generation) and end (transfer question) are
 *   other tickets.
 * @property {string | null} [learnerUtterance] - the learner's latest message,
 *   verbatim. The orchestrator (ticket 06) passes the word for the opening
 *   turn and the last user message from history on later turns; null when no
 *   utterance is available.
 */

/**
 * @typedef {object} TurnResult
 * @property {boolean} ok
 * @property {string | null} reply - the message to the learner.
 * @property {LearnerMentalModel | null} learnerMap - the updated model.
 * @property {Diff | null} diff - computed by computeDiff, never by the model.
 * @property {Probe | null} probe
 * @property {FailedAttempts | null} failedAttempts - carried forward.
 * @property {"observe" | "gap" | null} mode - the mode of THIS turn.
 * @property {"invalid" | "error" | null} kind - why it failed.
 * @property {string | null} reason
 * @property {string[]} errors
 * @property {number} latencyMs
 * @property {boolean} retried
 */

/* ---------------------------------------------------------------------------
 * Policy - pure and deterministic
 * ------------------------------------------------------------------------- */

/**
 * Opening rule (principle 1, 11): observation-first when nothing is known
 * about the learner's model; gap-first probing once anything is known.
 *
 * @param {LearnerMentalModel} learnerMap
 * @returns {"observe" | "gap"}
 */
export function conversationMode(learnerMap) {
  const known = learnerMap.nodes.some((node) => node.state !== "untested");
  return known ? "gap" : "observe";
}

/**
 * The explanation fallback (principle 8): due when a node has two or more
 * failed attempts. Failed attempts are counted per node by
 * updateFailedAttempts; whether the learner asked for an explanation is the
 * model's judgement, instructed in the prompts.
 *
 * @param {FailedAttempts} failedAttempts
 * @param {string} nodeId
 * @returns {boolean}
 */
export function explanationDue(failedAttempts, nodeId) {
  return (failedAttempts[nodeId] ?? 0) >= 2;
}

/**
 * Carries the failed-attempt counts forward one turn.
 *
 * A failed attempt is an ANSWER that leaves the point non-correct - measured
 * as a node whose map entry changed this turn (added, flipped or updated:
 * the learner just said something about it) and which is still not correct.
 * Asking a question is not a failure: a turn that changes nothing counts
 * nothing. A correct answer or an explanation turn clears the node (a fresh
 * pair of attempts, principle 8). Keys only exist for nodes with an active
 * failure count.
 *
 * @param {FailedAttempts} failedAttempts
 * @param {LearnerMentalModel} prevMap
 * @param {LearnerMentalModel} nextMap
 * @param {Probe} probe
 * @returns {FailedAttempts}
 */
export function updateFailedAttempts(failedAttempts, prevMap, nextMap, probe) {
  const next = { ...failedAttempts };
  if (probe.kind === "explain" && probe.nodeId !== null) {
    delete next[probe.nodeId];
    return next;
  }
  const diff = computeDiff(prevMap, nextMap);
  const changed = new Set([...diff.added, ...diff.updated, ...diff.flipped.map((flip) => flip.id)]);
  for (const nodeId of changed) {
    const state = stateOf(nextMap, nodeId);
    if (state === undefined) continue;
    if (state === "correct") {
      delete next[nodeId];
    } else {
      next[nodeId] = (next[nodeId] ?? 0) + 1;
    }
  }
  return next;
}

/**
 * The deterministic per-turn diff: which nodes were added, which flipped
 * state, which were updated in place (confidence or evidence changed while
 * the state held). Node-only, matching the Diff schema (ticket 02).
 *
 * @param {LearnerMentalModel} prev
 * @param {LearnerMentalModel} next
 * @returns {Diff}
 */
export function computeDiff(prev, next) {
  const prevById = new Map(prev.nodes.map((node) => [node.id, node]));
  /** @type {Diff} */
  const diff = { added: [], flipped: [], updated: [] };
  for (const node of next.nodes) {
    const prior = prevById.get(node.id);
    if (prior === undefined) {
      diff.added.push(node.id);
    } else if (prior.state !== node.state) {
      diff.flipped.push({ id: node.id, from: prior.state, to: node.state });
    } else if (prior.confidence !== node.confidence || !sameArray(prior.evidence, node.evidence)) {
      diff.updated.push(node.id);
    }
  }
  return diff;
}

/* ---------------------------------------------------------------------------
 * Prompts
 * ------------------------------------------------------------------------- */

/**
 * The system prompt for a Socratic turn: the immutable mission, the theory of
 * learning, and the hard behavioural rules. Grounded in docs/MISSION.md;
 * do not weaken the principles when editing.
 *
 * @returns {string}
 */
export function buildSocraticSystemPrompt() {
  return `You are first-principled, a Socratic tutor in a one-on-one conversation with a founder who is building something and learning as they build it. Your mission: reduce the cognitive distance between the learner's mental model and reality. Teaching and answering are side effects, not objectives.

Learning happens by observation, pattern recognition, model building, testing, and integration. You construct understanding through questions; you cannot transmit it directly (principle 6).

You hold two maps of the concept: the Reality Map, which is what the thing actually is, and the learner's Mental Model, which is what they currently believe. Every turn you question, infer from the learner's words, and update the learner's model.

Hard rules:
1. The reality map is private. Never quote it - no description, layer name, or phrase from it may appear in your reply. Never mention the reality map, its layers, or that any comparison is happening. The learner must rebuild the content from their own observations and reasoning.
2. Socratic, not lecture: ask, do not tell. One question at a time, short replies (2 to 4 sentences), conversational tone. Probing turns end with a question.
3. Observation first (principles 1, 11): when the learner's model is empty, ask what they have seen, used, or noticed about the concept before any theory.
4. Gap first (principle 5): when the learner has any model, probe the biggest gap in dependency order - lower layers before abstractions; within the lowest affected layer, misconception over missing over untested.
5. Update the learner's model from their words: node state (untested, missing, misconception, correct), confidence 0..1, and evidence - short verbatim quotes of the learner's words, at most 4 per node. Record the model as it is, not as you wish it were.
6. A misconception is a learner belief that conflicts with reality. Work it through questions that let the learner discover the conflict themselves (principle 6); never correct it by stating the fact.
7. If the learner has no model of a probed concept, teach observationally first - connect it to something they have observed (principle 7) - then re-ask.
8. Productive struggle is valuable when it reveals the learner's model (principle 7). Do not rush to explain.
9. The explanation fallback exists to minimize unnecessary cognitive load (principle 8). Use it ONLY when the learner asks for an explanation, or when the directive says it is due (two failed attempts on the same point). Then explain that ONE concept accurately, in plain first-principles language built from what the learner has said. Still never quote the reality map.
10. Reconnect new knowledge to what the learner already showed (principle 9). Never skip intermediate steps (principle 12): do not introduce an abstraction the learner has not observed.
11. If the learner asks a clarifying question or needs a short aside, answer briefly without changing the model (kind "converse").`;
}

/**
 * The user prompt for one Socratic turn: the full current state plus this
 * turn's directive, and the exact JSON reply shape. Contains the word "json"
 * and an example - both required by the DeepSeek JSON mode contract (ticket
 * 03 findings).
 *
 * @param {SocraticState} state
 * @returns {string}
 */
export function buildSocraticUserPrompt(state) {
  const stateJson = JSON.stringify(
    {
      concept: state.realityMap.concept,
      phase: state.phase,
      mode: conversationMode(state.learnerMap),
      realityMap: state.realityMap,
      learnerMap: state.learnerMap,
      failedAttempts: state.failedAttempts,
    },
    null,
    2
  );
  return `Current state (json):

${stateJson}

Latest learner message: "${state.learnerUtterance ?? ""}"

This turn: ${buildDirective(state)}

Reply with a single json object, exactly this shape:
{"reply": "your message to the learner", "learnerMap": {"nodes": [{"id": "...", "state": "untested|missing|misconception|correct", "confidence": 0.5, "evidence": ["short verbatim learner quote"]}], "edges": [{"source": "...", "target": "...", "state": "untested|missing|misconception|correct", "confidence": 0.5, "evidence": ["..."]}]}, "probe": {"nodeId": "..." or null, "kind": "observe|probe|explain|converse"}}

Rules for the reply object: "reply" is your message to the learner. "learnerMap" is the COMPLETE learner model - every node and edge from the previous learner map must still be present, with states, confidence and evidence updated. "probe" reports this turn: kind "observe" for the observation opening (nodeId null), "probe" for a gap question about a specific node, "explain" for an explanation fallback turn, "converse" when you answered an aside without changing the model.`;
}

/**
 * This turn's directive: what the engine demands, in plain words. Hard
 * constraints live here so the model cannot drift from them.
 *
 * @param {SocraticState} state
 * @returns {string}
 */
export function buildDirective(state) {
  const concept = state.realityMap.concept;
  if (conversationMode(state.learnerMap) === "observe") {
    return `Opening move: nothing is known yet about this learner's model of "${concept}". Ask an observation question - what they have seen, used, or noticed about it - before any theory. Do not present theory yet.`;
  }
  const stuck = Object.entries(state.failedAttempts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);
  if (stuck.length > 0) {
    const [nodeId, count] = stuck[0];
    const label = nodeLabel(state.realityMap, nodeId) ?? nodeId;
    return `The explanation fallback is due: the learner has failed on "${label}" (${nodeId}) ${count} times. Explain that ONE concept in plain first-principles language - accurate, concise, built from what the learner has said. probe.kind must be "explain".`;
  }
  return `The learner has a partial model. Probe the biggest gap in dependency order: lower layers before abstractions; within the lowest affected layer, misconception over missing over untested. Ask ONE question that reveals their model of that node.`;
}

/* ---------------------------------------------------------------------------
 * Turn generation
 * ------------------------------------------------------------------------- */

/**
 * The injected transport. Returns the reply content for a completion request.
 *
 * @typedef {(request: {
 *   messages: import("./llm.js").ChatMessage[],
 *   jsonMode: boolean,
 *   thinking: boolean,
 *   maxTokens: number,
 * }) => Promise<{ content: string }>} CallLLM
 */

/**
 * @typedef {object} TurnOptions
 * @property {boolean} [thinking] - let the model think before answering.
 *   Default true: better structure on a JSON update task. The repair attempt
 *   always runs with thinking disabled (empty content is intermittent, and a
 *   no-thinking retry takes a different path).
 * @property {number} [maxTokens] - headroom for the learner map JSON.
 *   Default 4096.
 */

/**
 * @typedef {object} UnpackedTurn
 * @property {string} reply
 * @property {LearnerMentalModel} learnerMap
 * @property {Probe} probe
 */

/**
 * Checks the model's reply object has the expected shape. Deep validation of
 * the learner map and the turn's consistency happen in validateTurn.
 *
 * @param {unknown} parsed
 * @returns {UnpackedTurn | null}
 */
function unpackTurn(parsed) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const turn = /** @type {any} */ (parsed);
  if (typeof turn.reply !== "string" || turn.reply.trim().length === 0) return null;
  const map = turn.learnerMap;
  if (typeof map !== "object" || map === null || !Array.isArray(map.nodes) || !Array.isArray(map.edges)) {
    return null;
  }
  const probe = turn.probe;
  if (typeof probe !== "object" || probe === null) return null;
  const kinds = ["observe", "probe", "explain", "converse"];
  if (typeof probe.kind !== "string" || !kinds.includes(probe.kind)) return null;
  if (probe.nodeId !== null && typeof probe.nodeId !== "string") return null;
  return {
    reply: turn.reply,
    learnerMap: /** @type {LearnerMentalModel} */ (map),
    probe: /** @type {Probe} */ (probe),
  };
}

/**
 * Validates a model turn against the schema and the previous state.
 * Returns a list of human-readable errors; empty means the turn is accepted.
 *
 * Checks: learner map schema-valid against the reality map, the probe targets
 * a real reality node, and the update is a refinement - every node and edge
 * of the previous learner map must still be present (v1 never deletes).
 *
 * @param {SocraticState} state
 * @param {UnpackedTurn} turn
 * @returns {string[]}
 */
export function validateTurn(state, turn) {
  const errors = /** @type {string[]} */ ([]);
  const validation = validateLearnerMap(turn.learnerMap, state.realityMap);
  if (!validation.ok) errors.push(...validation.errors);

  if (turn.probe.nodeId !== null) {
    const exists = state.realityMap.nodes.some((node) => node.id === turn.probe.nodeId);
    if (!exists) errors.push(`probe.nodeId does not exist in the reality map: ${turn.probe.nodeId}`);
  }

  const prevIds = new Set(state.learnerMap.nodes.map((node) => node.id));
  const nextIds = new Set(turn.learnerMap.nodes.map((node) => node.id));
  for (const id of prevIds) {
    if (!nextIds.has(id)) errors.push(`learner map dropped a previously known node: ${id}`);
  }

  const prevEdges = new Set(state.learnerMap.edges.map((edge) => `${edge.source}|${edge.target}`));
  const nextEdges = new Set(turn.learnerMap.edges.map((edge) => `${edge.source}|${edge.target}`));
  for (const key of prevEdges) {
    if (!nextEdges.has(key)) errors.push(`learner map dropped a previously known edge: ${key}`);
  }

  return errors;
}

/**
 * @param {SocraticState} state
 * @param {UnpackedTurn} turn
 * @param {number} latencyMs
 * @param {boolean} retried
 * @returns {TurnResult}
 */
function successResult(state, turn, latencyMs, retried) {
  const diff = computeDiff(state.learnerMap, turn.learnerMap);
  const failedAttempts = updateFailedAttempts(
    state.failedAttempts,
    state.learnerMap,
    turn.learnerMap,
    turn.probe
  );
  return {
    ok: true,
    reply: turn.reply,
    learnerMap: turn.learnerMap,
    diff,
    probe: turn.probe,
    failedAttempts,
    mode: conversationMode(state.learnerMap),
    kind: null,
    reason: null,
    errors: [],
    latencyMs,
    retried,
  };
}

/**
 * @param {SocraticState} state
 * @param {string} problem
 * @returns {import("./llm.js").ChatMessage}
 */
function repairMessage(state, problem) {
  return {
    role: "user",
    content: `${buildSocraticUserPrompt(state)}

Your previous reply did not meet the turn contract: ${problem}

Reply with JSON only, no markdown, no commentary, exactly the one required shape.`,
  };
}

/**
 * Runs one Socratic turn: build the prompts, call the model (injected
 * transport), parse defensively, validate, compute the diff, and carry the
 * failed-attempt counts forward. On a malformed or schema-invalid update,
 * retries once with the errors cited, mirroring the reality map flow.
 *
 * @param {{ state: SocraticState; callLLM?: CallLLM }} input
 * @param {TurnOptions} [options]
 * @returns {Promise<TurnResult>}
 */
export async function generateSocraticTurn({ state, callLLM }, options = {}) {
  const transport =
    callLLM ??
    /** @type {CallLLM} */ (async (request) => {
      const result = await callChatCompletion(request);
      return { content: result.content };
    });
  const maxTokens = options.maxTokens ?? 4096;
  const thinking = options.thinking !== false;

  /** @type {import("./llm.js").ChatMessage} */
  const system = { role: "system", content: buildSocraticSystemPrompt() };
  /** @type {import("./llm.js").ChatMessage} */
  const user = { role: "user", content: buildSocraticUserPrompt(state) };

  /**
   * Runs one LLM attempt. The repair attempt disables thinking: empty
   * content (a known DeepSeek JSON-mode failure, ticket 03 findings) is
   * intermittent, and a no-thinking retry takes a genuinely different path.
   *
   * @param {import("./llm.js").ChatMessage} userMessage
   * @param {boolean} [useThinking]
   * @returns {Promise<{ latencyMs: number; content: string }>}
   */
  async function attempt(userMessage, useThinking) {
    const started = Date.now();
    const reply = await transport({
      messages: [system, userMessage],
      jsonMode: true,
      thinking: useThinking ?? thinking,
      maxTokens,
    });
    return { latencyMs: Date.now() - started, content: reply.content };
  }

  let first;
  try {
    first = await attempt(user);
  } catch (err) {
    return {
      ok: false,
      reply: null,
      learnerMap: null,
      diff: null,
      probe: null,
      failedAttempts: null,
      mode: conversationMode(state.learnerMap),
      kind: "error",
      reason: err instanceof Error ? err.message : String(err),
      errors: [],
      latencyMs: 0,
      retried: false,
    };
  }

  const firstParsed = parseModelJson(first.content);
  const firstTurn = firstParsed === null ? null : unpackTurn(firstParsed);
  const firstErrors = firstTurn === null ? ["the reply was not a valid turn object"] : validateTurn(state, firstTurn);
  if (firstTurn !== null && firstErrors.length === 0) {
    return successResult(state, firstTurn, first.latencyMs, false);
  }

  let second;
  try {
    second = await attempt(repairMessage(state, firstErrors.join("; ")), false);
  } catch (err) {
    return {
      ok: false,
      reply: null,
      learnerMap: null,
      diff: null,
      probe: null,
      failedAttempts: null,
      mode: conversationMode(state.learnerMap),
      kind: "error",
      reason: err instanceof Error ? err.message : String(err),
      errors: [],
      latencyMs: first.latencyMs,
      retried: true,
    };
  }
  const totalLatency = first.latencyMs + second.latencyMs;

  const secondParsed = parseModelJson(second.content);
  const secondTurn = secondParsed === null ? null : unpackTurn(secondParsed);
  const secondErrors = secondTurn === null ? ["the reply was not a valid turn object"] : validateTurn(state, secondTurn);
  if (secondTurn !== null && secondErrors.length === 0) {
    return successResult(state, secondTurn, totalLatency, true);
  }
  return {
    ok: false,
    reply: null,
    learnerMap: null,
    diff: null,
    probe: null,
    failedAttempts: null,
    mode: conversationMode(state.learnerMap),
    kind: "invalid",
    reason: "The model could not produce a valid turn after one repair attempt.",
    errors: secondErrors,
    latencyMs: totalLatency,
    retried: true,
  };
}

/* ---------------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------------- */

/**
 * @param {LearnerMentalModel} map
 * @param {string} nodeId
 * @returns {NodeState | undefined}
 */
function stateOf(map, nodeId) {
  return map.nodes.find((node) => node.id === nodeId)?.state;
}

/**
 * @param {RealityMap} map
 * @param {string} nodeId
 * @returns {string | undefined}
 */
function nodeLabel(map, nodeId) {
  return map.nodes.find((node) => node.id === nodeId)?.label;
}

/**
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @returns {boolean}
 */
function sameArray(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
