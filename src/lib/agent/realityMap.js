/**
 * Reality Map generation, v2 (ticket 06): foundation-first iterative
 * derivation, per ticket 04's v1 design and spec sections 4, 7, 8.
 *
 * v1 generated the whole map in one call and validated only structure
 * (contiguity: every layer has an edge to a lower layer), so "plausible
 * chain" was the quality ceiling. v2 derives the chain instead of asserting
 * it, in two phases:
 *
 *   Phase A (foundation): name the deepest observable layer the thing is
 *   built on - the foundation. Refusal contract unchanged (a non-teachable
 *   input is refused, not mapped).
 *
 *   Phase B (derive): given the foundation, derive the remaining layers
 *   upward. Every layer after the foundation must be built on the layer
 *   below it (typed edges), every node above the foundation carries a
 *   `basis` - the observation the abstraction compresses (principle 5) -
 *   and nodes with testable behavior emit `predicts` edges (principle 2).
 *   The model reports a self-review of the chain's derivability.
 *
 * Code owns the hard checks: validateRealityMap (structure) plus
 * deriveCheck (reachability from the foundation and basis presence). The
 * map is repaired up to twice citing both, exactly like v1's repair loop.
 *
 * Latency note: two smaller calls replace one big one; repairs add more. The
 * 30s budget and per-call costs are measured by live verification, which is
 * pending billing (research/03: the .env key returns 402). The flow is
 * prototype-fidelity by design - a per-layer one-call-per-layer loop is the
 * documented next step if latency allows.
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
 *   Default 6, matching the spec.
 * @property {boolean} [thinking] - let the model think before answering.
 *   Default false (v1 live verification showed thinking pushes generation
 *   past the 30s budget).
 * @property {number} [maxTokens] - headroom for JSON output. Default 4096.
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
 * @property {boolean} retried - whether a repair attempt was used.
 */

/* ---------------------------------------------------------------------------
 * Phase A: the foundation layer
 * ------------------------------------------------------------------------- */

/**
 * The system prompt for phase A: name the deepest observable foundation the
 * thing is built on. Contains the word "json" and an example shape (the
 * DeepSeek JSON mode contract, ticket 03 findings).
 *
 * @returns {string}
 */
export function buildFoundationSystemPrompt() {
  return `You are first-principled, an AI tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

A learner typed a word or phrase naming a thing or concept they want to understand from first principles. Step one of building its Reality Map: name the FOUNDATION layer - the deepest, most observable layer the thing is ultimately built on. For "laptop" that foundation is physics (electricity); for "photosynthesis" it is light and matter; for "recursion" it is the call stack. The foundation is what a learner can observe or meet directly, before any abstraction.

Requirements for the foundation:
- Exactly one layer, with 1 to 3 nodes. Each node has an id, label, layer, and a one to two sentence description.
- The foundation must be real and observable, not a metaphor or a slogan.

Reply as JSON only. No markdown fences, no commentary. Two shapes:

When the input names a real, teachable thing:
{"isValidConcept": true, "foundation": {"layer": {"id": "l0", "name": "...", "nodes": ["n-..."]}, "nodes": [{"id": "n-...", "label": "...", "layer": "l0", "description": "..."}]}}

When the input is not a teachable thing - gibberish, random characters, an empty phrase, a command, or anything that is not a real concept or object:
{"isValidConcept": false, "reason": "one short sentence explaining why not"}`;
}

/**
 * @param {string} concept
 * @returns {import("./llm.js").ChatMessage}
 */
function foundationUserMessage(concept) {
  return { role: "user", content: `Word or phrase: ${concept}` };
}

/**
 * Unpacks a phase-A reply into a foundation or a refusal.
 *
 * @param {unknown} parsed
 * @returns {{ refused: true; reason: string } | { refused: false; foundation: any } | null}
 */
function unpackFoundation(parsed) {
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
  if (reply.foundation && typeof reply.foundation === "object") {
    return { refused: false, foundation: reply.foundation };
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Phase B: derive the rest of the chain
 * ------------------------------------------------------------------------- */

/**
 * The system prompt for phase B: derive the remaining layers from the given
 * foundation, foundation-first, with a basis observation per abstraction,
 * predicts edges, and a self-review. The word "json" and an example shape
 * are both required by the JSON mode contract.
 *
 * @param {number} maxLayers
 * @returns {string}
 */
export function buildRealityMapSystemPrompt(maxLayers) {
  return `You are first-principled, an AI tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

You are given the FOUNDATION layer of a Reality Map - the deepest observable layer a thing is built on. Derive the REST of the map, layer by layer, from the foundation up to the thing itself. Each layer answers: what do the layers below make possible? Principle: no skipped intermediate steps - a gap in the chain becomes a gap in understanding. For "laptop", given the physics foundation, the chain runs materials, electronics, logic gates, operating system, applications - each step built on the one before.

Requirements for the map:
- Around ${maxLayers} layers total, foundation included (a soft cap; do not rabbit-hole deeper unless the thing genuinely requires it).
- A few nodes per layer; each node has an id, label, layer, and a one to two sentence description.
- Every node ABOVE the foundation carries a "basis" field: the observation the abstraction compresses (principle 5). Example: logic gate -> basis "a password check either lets you in or stops you". The basis is what a learner can point at.
- Edges are typed. The ONLY allowed types are: built-on, abstraction-of, part-of, depends-on, predicts, contradicts. Never invent an edge type. Every layer after the foundation must have at least one edge connecting it to a lower layer.
- Where a node's behavior is testable, add a "predicts" edge (principle 2): the node predicts an observable outcome. Example: a battery predicts the torch dimming as it discharges.
- Before replying, self-review the chain: is every layer actually built on the layer below? Does every abstraction have a basis? Are there invented steps? Report the review honestly.

Reply as JSON only. No markdown fences, no commentary. Two shapes:

When the derivation succeeds:
{"isValidConcept": true, "map": {"concept": "...", "layers": [...], "nodes": [...], "edges": [...]}, "selfReview": {"derivable": true, "gaps": []}}

When the concept turns out not to be derivable from the foundation (or is not a real thing):
{"isValidConcept": false, "reason": "one short sentence explaining why not"}

Example node with a basis:
{"id": "n-logic-gate", "label": "logic gate", "layer": "l3", "description": "A circuit computing a boolean function such as AND, OR or NOT from input voltages.", "basis": "a password check either lets you in or stops you"}`;
}

/**
 * @param {string} concept
 * @param {any} foundation
 * @returns {import("./llm.js").ChatMessage}
 */
function deriveUserMessage(concept, foundation) {
  return {
    role: "user",
    content: `Foundation (json):\n\n${JSON.stringify(foundation, null, 2)}\n\nDerive the remaining layers of "${concept}" from this foundation, from the foundation up to the concept itself. Reply with the full map (all layers, all nodes, all edges, foundation included) plus the self-review.`,
  };
}

/**
 * Unpacks a phase-B reply into a map + self-review or a refusal.
 *
 * @param {unknown} parsed
 * @returns {{ refused: true; reason: string } | { refused: false; map: any; selfReview: any } | null}
 */
function unpackDerive(parsed) {
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
          : "The model could not derive a teachable chain here.",
    };
  }
  if (typeof reply.map === "object" && reply.map !== null) {
    return {
      refused: false,
      map: reply.map,
      selfReview: reply.selfReview && typeof reply.selfReview === "object" ? reply.selfReview : {},
    };
  }
  if (Array.isArray(reply.layers)) {
    return { refused: false, map: reply, selfReview: {} };
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * The code-level derivability check
 * ------------------------------------------------------------------------- */

/**
 * The deterministic derivability check (ticket 06, principle 5 and 11-12):
 * every node must be reachable from the foundation layer through the typed
 * edges (no disconnected fragments, no invented side-chains), and every node
 * above the foundation must carry a basis - the observation the abstraction
 * compresses. Pure; used by the generation repair loop.
 *
 * @param {any} map
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function deriveCheck(map) {
  const errors = /** @type {string[]} */ ([]);
  if (
    typeof map !== "object" ||
    map === null ||
    !Array.isArray(map.layers) ||
    map.layers.length === 0 ||
    !Array.isArray(map.nodes) ||
    !Array.isArray(map.edges)
  ) {
    return { ok: false, errors: ["map must have layers, nodes and edges"] };
  }
  const foundationId = map.layers[0].id;

  const nodes = /** @type {any[]} */ (map.nodes);
  const edges = /** @type {any[]} */ (map.edges);
  const adjacency = new Map(nodes.map((node) => [node.id, /** @type {string[]} */ ([])]));
  for (const edge of edges) {
    if (adjacency.has(edge.source)) adjacency.get(edge.source)?.push(edge.target);
    if (adjacency.has(edge.target)) adjacency.get(edge.target)?.push(edge.source);
  }

  const seen = new Set();
  const queue = nodes.filter((node) => node.layer === foundationId).map((node) => node.id);
  for (const id of queue) seen.add(id);
  while (queue.length > 0) {
    const id = queue.shift();
    for (const next of adjacency.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) {
      errors.push(
        `node "${node.label}" (${node.id}) is not reachable from the foundation layer - the chain has an invented gap`
      );
    }
    if (node.layer !== foundationId && (typeof node.basis !== "string" || node.basis.trim().length === 0)) {
      errors.push(
        `node "${node.label}" (${node.id}) has no basis - the observation it compresses (principle 5)`
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
 * Generation flow
 * ------------------------------------------------------------------------- */

/** Phase B attempts: initial derivation plus two repairs. */
const MAX_DERIVE_ATTEMPTS = 3;
/** Phase A attempts: initial foundation plus one repair. */
const MAX_FOUNDATION_ATTEMPTS = 2;

/**
 * @param {string} concept
 * @param {any} foundation
 * @param {string} problems
 * @param {boolean} finalAttempt
 * @returns {import("./llm.js").ChatMessage}
 */
function deriveRepairMessage(concept, foundation, problems, finalAttempt) {
  return {
    role: "user",
    content: `Foundation (json):\n\n${JSON.stringify(foundation, null, 2)}\n\nYour previous derivation of "${concept}" did not meet the contract: ${problems}\n\nReply with JSON only, no markdown, exactly the required shape. Do not drop or rename the foundation layer. Fix EVERY problem listed.${
      finalAttempt ? " This is your final attempt." : ""
    }`,
  };
}

/**
 * Generates a Reality Map for a word or phrase, foundation-first.
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
  const thinking = options.thinking === true;
  const totalStarted = Date.now();
  /** Whether any repair attempt was used across either phase. */
  let repaired = false;

  /**
   * @param {import("./llm.js").ChatMessage[]} messages
   * @returns {Promise<{ content: string }>}
   */
  async function call(messages) {
    return transport({ messages, jsonMode: true, thinking, maxTokens });
  }

  /* Phase A: the foundation. */
  /** @type {any} */
  let foundation = null;
  for (let attempt = 0; attempt < MAX_FOUNDATION_ATTEMPTS; attempt++) {
    const isRepair = attempt > 0;
    if (isRepair) repaired = true;
    /** @type {import("./llm.js").ChatMessage[]} */
    const messages = isRepair
      ? [
          { role: "system", content: buildFoundationSystemPrompt() },
          {
            role: "user",
            content: `Word or phrase: ${trimmed}\n\nYour previous reply did not meet the contract: it was not valid JSON in the required shape.\n\nReply with JSON only, exactly one of the two shapes.`,
          },
        ]
      : [{ role: "system", content: buildFoundationSystemPrompt() }, foundationUserMessage(trimmed)];
    let reply;
    try {
      reply = await call(messages);
    } catch (err) {
      return {
        ok: false,
        map: null,
        kind: "error",
        reason: err instanceof Error ? err.message : String(err),
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: attempt > 0,
      };
    }
    const parsed = parseModelJson(reply.content);
    const unpack = unpackFoundation(parsed);
    if (unpack !== null && unpack.refused) {
      return {
        ok: false,
        map: null,
        kind: "refused",
        reason: unpack.reason,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: attempt > 0,
      };
    }
    if (unpack === null) continue;
    foundation = unpack.foundation;
    break;
  }

  if (foundation === null) {
    return {
      ok: false,
      map: null,
      kind: "invalid",
      reason: "The model could not produce a valid foundation layer.",
      errors: [],
      latencyMs: Date.now() - totalStarted,
      retried: true,
    };
  }

  /* Phase B: derive the rest. */
  let lastValidation = { ok: false, errors: /** @type {string[]} */ ([]) };
  let lastDerive = { ok: false, errors: /** @type {string[]} */ ([]) };
  let lastSelfGaps = /** @type {string[]} */ ([]);
  let parseable = false;

  for (let attempt = 0; attempt < MAX_DERIVE_ATTEMPTS; attempt++) {
    const isRepair = attempt > 0;
    if (isRepair) repaired = true;
    const finalAttempt = attempt === MAX_DERIVE_ATTEMPTS - 1;
    /** @type {import("./llm.js").ChatMessage[]} */
    const messages = isRepair
      ? [
          { role: "system", content: buildRealityMapSystemPrompt(options.maxLayers ?? 6) },
          deriveRepairMessage(
            trimmed,
            foundation,
            deriveProblems(lastValidation, lastDerive, lastSelfGaps, parseable),
            finalAttempt
          ),
        ]
      : [
          { role: "system", content: buildRealityMapSystemPrompt(options.maxLayers ?? 6) },
          deriveUserMessage(trimmed, foundation),
        ];

    let reply;
    try {
      reply = await call(messages);
    } catch (err) {
      return {
        ok: false,
        map: null,
        kind: "error",
        reason: err instanceof Error ? err.message : String(err),
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: true,
      };
    }

    const parsed = parseModelJson(reply.content);
    const unpack = unpackDerive(parsed);
    if (unpack !== null && unpack.refused) {
      return {
        ok: false,
        map: null,
        kind: "refused",
        reason: unpack.reason,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: true,
      };
    }
    if (unpack === null) {
      parseable = false;
      lastValidation = { ok: false, errors: [] };
      lastDerive = { ok: false, errors: [] };
      lastSelfGaps = [];
      continue;
    }

    parseable = true;
    const candidate = repairMap(unpack.map);
    lastValidation = validateRealityMap(candidate);
    lastDerive = deriveCheck(candidate);
    const selfReviewOk =
      unpack.selfReview && unpack.selfReview.derivable !== false
        ? true
        : false;
    lastSelfGaps =
      unpack.selfReview && Array.isArray(unpack.selfReview.gaps) ? unpack.selfReview.gaps : [];

    if (
      lastValidation.ok &&
      lastDerive.ok &&
      selfReviewOk &&
      lastSelfGaps.length === 0
    ) {
      return {
        ok: true,
        map: /** @type {RealityMap} */ (candidate),
        kind: null,
        reason: null,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: repaired,
      };
    }
  }

  return {
    ok: false,
    map: null,
    kind: "invalid",
    reason: parseable
      ? "The model could not produce a derivable, schema-valid Reality Map after two repair attempts."
      : "The model could not produce parseable JSON after two repair attempts.",
    errors: [...lastValidation.errors, ...lastDerive.errors],
    latencyMs: Date.now() - totalStarted,
    retried: true,
  };
}

/**
 * The problem statement for the next derive repair attempt.
 *
 * @param {{ ok: boolean; errors: string[] }} validation
 * @param {{ ok: boolean; errors: string[] }} derive
 * @param {string[]} selfGaps
 * @param {boolean} parseable
 * @returns {string}
 */
function deriveProblems(validation, derive, selfGaps, parseable) {
  if (!parseable) {
    return "your reply was not valid JSON in the required shape";
  }
  const unique = [
    ...new Set([...validation.errors, ...derive.errors, ...selfGaps]),
  ];
  return unique.slice(0, 6).join("; ");
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
