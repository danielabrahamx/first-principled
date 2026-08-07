/**
 * Reality Map generation: turns a bare word or phrase into a complete,
 * contiguous Reality Map, per ticket 04 and spec sections 4, 7, 8.
 *
 * Flow: build the prompt (mission principles 11-12, typed edges, soft layer
 * cap, refusal contract), call the LLM in JSON mode, parse defensively
 * (jsonParse.js), validate against validateRealityMap, and retry once with a
 * repair prompt on parse or validation failure. Refusals are honored, not
 * retried - a model that says "not a teachable thing" is the graceful
 * handling for gibberish input.
 *
 * The transport is injected (`callLLM`) so unit tests run against a stub and
 * live verification runs against the real DeepSeek API.
 */

import { callChatCompletion } from "./llm.js";
import { parseModelJson } from "./jsonParse.js";
import { validateRealityMap } from "../mmg/validator.js";

/**
 * @typedef {import("../mmg/types.js").RealityMap} RealityMap
 */

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
 * @typedef {object} GenerateOptions
 * @property {number} [maxLayers] - soft cap on the layer chain length.
 *   Default 6, matching the spec ("the model decides the depth with a soft
 *   cap").
 * @property {boolean} [thinking] - let the model think before answering.
 *   Default false: live verification (ticket 04) showed thinking mode pushes
 *   map generation past the 30s budget (47-54s), so v1 generates with
 *   thinking off and relies on the validator gate plus one repair retry for
 *   structure. Turn on per call if latency budget grows.
 * @property {number} [maxTokens] - headroom for JSON output. Default 4096:
 *   enough for a six-layer map; the 8k default pushed generation latency up.
 * @property {string} [conceptLabel] - display name used in error messages.
 */

/**
 * @typedef {object} MapResult
 * @property {boolean} ok
 * @property {RealityMap | null} map - present when ok.
 * @property {"refused" | "invalid" | "error" | null} kind - why it failed.
 * @property {string | null} reason - refusal reason or error text.
 * @property {string[]} errors - validation errors when kind is "invalid".
 * @property {number} latencyMs - elapsed time of the LLM call(s).
 * @property {boolean} retried - whether the repair attempt was used.
 */

/**
 * The system prompt for Reality Map generation. Contains the word "json" and
 * an example shape - both required by the DeepSeek JSON mode contract
 * (ticket 03 findings).
 *
 * @param {number} maxLayers
 * @returns {string}
 */
export function buildRealityMapSystemPrompt(maxLayers) {
  return `You are first-principled, an AI tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

A learner typed a word or phrase naming a thing or concept they want to understand from first principles. Build the Reality Map of that thing: a canonical graph of what it actually is, from your own knowledge only. No web search, no invented citations.

The map is a contiguous chain of layers, from the deepest observation-level foundation up to the thing itself. Principle: no skipped intermediate steps. Every layer connects to the layer below it; a gap in the chain becomes a gap in understanding. For "laptop" the chain runs physics, materials, electronics, logic gates, operating system, applications - each step built on the one before.

Requirements for the map:
- Around ${maxLayers} layers (a soft cap; do not rabbit-hole deeper unless the thing genuinely requires it).
- A few nodes per layer; each node has an id, label, layer, and a one to two sentence description.
- Edges are typed so the layer structure is explicit. The ONLY allowed types are: built-on, abstraction-of, part-of, depends-on, predicts, contradicts. Never invent an edge type. When a relation tempts a type outside this set, translate it: "X produces Y" means Y depends-on X or Y part-of X; "Y enables X" or "Y makes X possible" means X built-on Y; "X causes Y" means Y depends-on X or X predicts Y; "X contains Y" means Y part-of X. Every layer after the first must have at least one edge connecting it to a lower layer.
- Let the thing decide the depth: deeper where it genuinely builds on foundations, shallower where it is self-contained.

Reply as JSON only. No markdown fences, no commentary. Two shapes:

When the input names a real, teachable thing:
{"isValidConcept": true, "map": {"concept": "...", "layers": [...], "nodes": [...], "edges": [...]}}

When the input is not a teachable thing - gibberish, random characters, an empty phrase, a command, or anything that is not a real concept or object:
{"isValidConcept": false, "reason": "one short sentence explaining why not"}

Example shape for "laptop":
{"isValidConcept": true, "map": {"concept": "laptop", "layers": [{"id": "l0", "name": "physics", "nodes": ["n-electricity"]}, {"id": "l1", "name": "electronics", "nodes": ["n-transistor"]}], "nodes": [{"id": "n-electricity", "label": "electricity", "layer": "l0", "description": "Flow of electric charge; the physical foundation every electronic device exploits."}, {"id": "n-transistor", "label": "transistor", "layer": "l1", "description": "A semiconductor switch that controls current flow; the basic building block of digital circuits."}], "edges": [{"source": "n-transistor", "target": "n-electricity", "type": "depends-on"}]}}`;
}

/**
 * @param {string} concept
 * @returns {import("./llm.js").ChatMessage}
 */
function userMessage(concept) {
  return { role: "user", content: `Word or phrase: ${concept}` };
}

/**
 * Unpacks a parsed model reply into a candidate RealityMap or a refusal.
 *
 * @param {unknown} parsed
 * @returns {{ refused: false; map: any } | { refused: true; reason: string } | null}
 */
function unpackReply(parsed) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const reply = /** @type {any} */ (parsed);
  if (reply.isValidConcept === false) {
    return {
      refused: true,
      reason:
        typeof reply.reason === "string" && reply.reason.length > 0
          ? reply.reason
          : "The model did not recognize a teachable concept here.",
    };
  }
  if (typeof reply.map === "object" && reply.map !== null) {
    return { refused: false, map: reply.map };
  }
  if (Array.isArray(reply.layers)) {
    return { refused: false, map: reply };
  }
  return null;
}

/**
 * The number of LLM attempts before giving up: the initial generation plus
 * two repair attempts. More attempts buy little (each repair narrows the
 * instructions) and cost latency; the typical failure is recovered on the
 * first repair.
 */
const MAX_ATTEMPTS = 3;

/**
 * @param {string} concept
 * @param {GenerateOptions} options
 * @param {CallLLM} callLLM
 * @param {number} maxTokens
 * @returns {Promise<{ content: string }>}
 */
async function attempt(concept, options, callLLM, maxTokens) {
  return callLLM({
    messages: [
      { role: "system", content: buildRealityMapSystemPrompt(options.maxLayers ?? 6) },
      userMessage(concept),
    ],
    jsonMode: true,
    thinking: options.thinking === true,
    maxTokens,
  });
}

/**
 * @param {string} concept
 * @param {string} problem
 * @param {boolean} finalAttempt - true on the last allowed attempt: narrow
 *   the instructions to fixing exactly the listed problems.
 * @returns {import("./llm.js").ChatMessage}
 */
function repairMessage(concept, problem, finalAttempt) {
  return {
    role: "user",
    content: `Word or phrase: ${concept}

Your previous reply did not meet the contract: ${problem}

Reply with JSON only, no markdown, no commentary, exactly one of the two shapes.${
      finalAttempt
        ? " This is your final attempt. Fix EVERY problem listed above. Do not add or rename layers or nodes; only fix the edges, ids and types that were flagged."
        : ""
    }`,
  };
}

/**
 * Mechanical cleanup of a candidate map before validation: drops edges that
 * reference node ids that do not exist in the map (the model occasionally
 * emits stray edges, e.g. pasted example fragments). The validator remains
 * the gate - the repaired map must still pass it.
 *
 * @param {any} map
 * @returns {any} the same object when its edges are clean, else a copy with
 *   the garbage edges removed.
 */
function repairMap(map) {
  if (typeof map !== "object" || map === null || !Array.isArray(map.nodes)) {
    return map;
  }
  if (!Array.isArray(map.edges)) {
    return map;
  }
  const nodeIds = new Set(
    map.nodes
      .filter(
        /** @param {any} node */
        (node) => typeof node === "object" && node !== null && typeof node.id === "string"
      )
      .map(
        /** @param {any} node */
        (node) => node.id
      )
  );
  const clean = map.edges.filter(
    /** @param {any} edge */
    (edge) =>
      typeof edge === "object" &&
      edge !== null &&
      typeof edge.source === "string" &&
      typeof edge.target === "string" &&
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target)
  );
  if (clean.length === map.edges.length) {
    return map;
  }
  return { ...map, edges: clean };
}

/**
 * Generates a Reality Map for a word or phrase.
 *
 * @param {{ concept: string; callLLM?: CallLLM }} input
 * @param {GenerateOptions} [options]
 * @returns {Promise<MapResult>}
 */
export async function generateRealityMap({ concept, callLLM }, options = {}) {
  const trimmed = concept.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      map: null,
      kind: "refused",
      reason: "Please type a word or phrase that names something you want to understand.",
      errors: [],
      latencyMs: 0,
      retried: false,
    };
  }

  const transport =
    callLLM ??
    /** @type {CallLLM} */ (async (request) => {
      const result = await callChatCompletion(request);
      return { content: result.content };
    });

  const maxTokens = options.maxTokens ?? 4096;
  const totalStarted = Date.now();
  let lastValidation = { ok: false, errors: /** @type {string[]} */ ([]) };
  let attemptsMade = 0;
  let parseable = false;

  for (let attemptIndex = 0; attemptIndex < MAX_ATTEMPTS; attemptIndex++) {
    const isRepair = attemptIndex > 0;
    const finalAttempt = attemptIndex === MAX_ATTEMPTS - 1;
    /** @type {import("./llm.js").ChatMessage[]} */
    const messages = isRepair
      ? [
          {
            role: "system",
            content: buildRealityMapSystemPrompt(options.maxLayers ?? 6),
          },
          repairMessage(trimmed, currentProblem(lastValidation, parseable), finalAttempt),
        ]
      : [
          {
            role: "system",
            content: buildRealityMapSystemPrompt(options.maxLayers ?? 6),
          },
          userMessage(trimmed),
        ];

    let reply;
    try {
      reply = await transport({ messages, jsonMode: true, thinking: options.thinking === true, maxTokens });
    } catch (err) {
      return {
        ok: false,
        map: null,
        kind: "error",
        reason: err instanceof Error ? err.message : String(err),
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: attemptsMade > 0,
      };
    }
    attemptsMade++;

    const parsed = parseModelJson(reply.content);
    const unpack = unpackReply(parsed);
    if (unpack !== null && unpack.refused) {
      return {
        ok: false,
        map: null,
        kind: "refused",
        reason: unpack.reason,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: attemptsMade > 1,
      };
    }
    if (unpack === null) {
      parseable = false;
      lastValidation = { ok: false, errors: [] };
      continue;
    }

    parseable = true;
    const candidate = repairMap(unpack.map);
    lastValidation = validateRealityMap(candidate);
    if (lastValidation.ok) {
      return {
        ok: true,
        map: /** @type {RealityMap} */ (candidate),
        kind: null,
        reason: null,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: attemptsMade > 1,
      };
    }
  }

  return {
    ok: false,
    map: null,
    kind: "invalid",
    reason: parseable
      ? "The model could not produce a schema-valid Reality Map after two repair attempts."
      : "The model could not produce parseable JSON after two repair attempts.",
    errors: lastValidation.errors,
    latencyMs: Date.now() - totalStarted,
    retried: true,
  };
}

/**
 * The problem statement for the next repair attempt: what went wrong with
 * the previous reply.
 *
 * @param {{ ok: boolean; errors: string[] }} validation
 * @param {boolean} parseable
 * @returns {string}
 */
function currentProblem(validation, parseable) {
  if (!parseable) {
    return "your reply was not valid JSON in one of the two shapes";
  }
  return `your map failed validation: ${validationErrors(validation)}`;
}

/**
 * A stable, deduped, truncated view of validation errors for the repair
 * prompt - enough signal for the model, without dumping the whole list.
 *
 * @param {{ ok: boolean; errors: string[] }} validation
 * @returns {string}
 */
function validationErrors(validation) {
  if (validation.ok) return "the map failed validation";
  const unique = [...new Set(validation.errors)];
  return unique.slice(0, 5).join("; ");
}
