/**
 * Reality Map generation, v3 (ticket 08): gap-free bottom-up layer chain,
 * extending the v2 foundation-first flow (ticket 06) and v1's design (ticket
 * 04, spec sections 4, 7, 8).
 *
 * v1 generated the whole map in one call and validated only structure
 * (contiguity: every layer has an edge to a lower layer), so "plausible
 * chain" was the quality ceiling. v2 derived the chain in two phases - a
 * foundation layer, then the rest in one call - so gaps were still possible
 * and merely caught by validation. v3 makes a skipped intermediate step
 * structurally impossible: the map is built bottom-up, one layer per call,
 * and each call sees ONLY the layer immediately below it. A layer that is
 * not the immediate successor of the last one built cannot be expressed,
 * because the only layer the model can reference is the one it was given.
 *
 *   Phase A (foundation): name the deepest observable layer the thing is
 *   built on - the foundation, always layer l0. Refusal contract unchanged
 *   (a non-teachable input is refused, not mapped).
 *
 *   Phase C (per-layer derive loop): build the remaining layers one at a
 *   time, bottom-up. Each call receives the current top layer and derives
 *   the NEXT layer directly above it - layer l1 from l0, l2 from l1, and so
 *   on. Code assigns the layer ids (l1, l2, ...) and requires at least one
 *   edge from each new layer to the layer below it, so the chain is
 *   contiguous by construction. Every node above the foundation carries a
 *   `basis` - the observation the abstraction compresses (principle 5) -
 *   and nodes with testable behavior emit `predicts` edges (principle 2).
 *   The model reports a per-layer self-review of derivability. The loop
 *   stops when the model says the concept is reached (done), or at the soft
 *   layer cap.
 *
 * Code owns the hard checks at every step: validateRealityMap (structure
 * and contiguity, v1 ticket 02) plus deriveCheck (reachability from the
 * foundation and basis presence, v2 ticket 06) plus the per-layer rule (the
 * new layer must connect to the layer below it). Failures drive the repair
 * loop (v1 ticket 04) - up to two repairs per layer, exactly like v1's
 * escalating repair contract. Both validators run once more on the final
 * assembled map as the backstop gate: a map leaves this function only
 * through both gates.
 *
 * Latency note: per-layer calls are smaller than v2's single derive call,
 * so the chain costs one call per layer plus repairs. Measured live in
 * ticket 08: 30/30 concepts gap-free (research/08-gapfree-verification.md).
 *
 * The transport is injected (`callLLM`) so unit tests run against a stub and
 * live verification runs against the real DeepSeek API.
 */

import { callChatCompletion } from "./llm.js";
import { parseModelJson } from "./jsonParse.js";
import { validateRealityMap, MAX_REALITY_LAYERS } from "../mmg/validator.js";

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
 * Phase C: derive the chain one layer at a time, bottom-up
 * ------------------------------------------------------------------------- */

/**
 * The system prompt for a per-layer derive call (ticket 08): given the
 * current top layer, derive the NEXT layer directly above it - built ONLY on
 * the layer given, so a skipped intermediate step is structurally
 * impossible. Basis per abstraction, typed edges, a per-layer self-review,
 * and a done flag for when the concept is reached. The word "json" and an
 * example shape are both required by the JSON mode contract.
 *
 * @param {number} maxLayers
 * @returns {string}
 */
export function buildNextLayerSystemPrompt(maxLayers) {
  return `You are first-principled, an AI tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

You are building the Reality Map of a concept layer by layer, bottom-up, one layer per reply. You are given the CURRENT TOP LAYER - the deepest layer built so far - and you derive the NEXT layer directly above it: the layer that the given layer makes possible. Derive the next layer ONLY from the layer you are given. Never skip an intermediate step and never jump ahead: a gap in the chain becomes a gap in understanding. For "laptop", given the physics foundation, the chain runs materials, electronics, logic gates, operating system, applications - each step built on the one before.

The whole chain will be around ${maxLayers} layers total, foundation included (a soft cap; do not plan deeper unless the thing genuinely requires it).

Requirements for the next layer:
- Build exactly ONE layer, with the id stated in the prompt (l1, l2, ...).
- 1 to 3 nodes; each node has an id, a label, the new layer id, a one to two sentence description, and a "basis" field: the observation the abstraction compresses (principle 5). The basis is what a learner can point at. Example: logic gate -> basis "a password check either lets you in or stops you".
- Give every node a NEW unique id - never reuse a node id from the layers you were given; the same concept at a higher layer is a NEW node with a NEW id.
- 1 to 3 typed edges. At least one edge must connect the new layer to the layer you were given. The ONLY allowed edge types are: built-on, abstraction-of, part-of, depends-on, predicts, contradicts. Never invent an edge type. Edges may also connect nodes within the new layer. Reference only node ids you were given or ids you create.
- Before replying, self-review: is the new layer really built on the layer given? Does every node have a basis? Are there invented steps? Report the review honestly.

Reply as JSON only. No markdown fences, no commentary. Three shapes:

When the layer you were given is not yet the top of the chain:
{"isValidConcept": true, "done": false, "layer": {"id": "l2", "name": "...", "nodes": ["n-..."]}, "nodes": [{"id": "n-...", "label": "...", "layer": "l2", "description": "...", "basis": "..."}], "edges": [{"source": "n-...", "target": "n-...", "type": "built-on"}], "selfReview": {"derivable": true, "gaps": []}}

When the layer you were given already contains the thing itself - the concept is reached:
{"isValidConcept": true, "done": true}

When the concept turns out not to be derivable from the foundation (or is not a real thing):
{"isValidConcept": false, "reason": "one short sentence explaining why not"}

Example node with a basis:
{"id": "n-logic-gate", "label": "logic gate", "layer": "l3", "description": "A circuit computing a boolean function such as AND, OR or NOT from input voltages.", "basis": "a password check either lets you in or stops you"}`;
}

/**
 * The per-layer user message: the concept, the layer immediately below (the
 * ONLY map content the model sees - this is what makes skipping impossible),
 * and the fixed id of the next layer to build.
 *
 * @param {string} concept
 * @param {any} belowLayer
 * @param {any[]} belowNodes
 * @param {string} nextLayerId
 * @returns {import("./llm.js").ChatMessage}
 */
function nextLayerUserMessage(concept, belowLayer, belowNodes, nextLayerId) {
  return {
    role: "user",
    content: `Concept: ${concept}\n\nCurrent top layer (json):\n\n${JSON.stringify(
      { layer: belowLayer, nodes: belowNodes },
      null,
      2
    )}\n\nBuild layer ${nextLayerId}, the next layer directly above ${belowLayer.id}: what does the layer below make possible? Derive ${nextLayerId} ONLY from ${belowLayer.id} - do not skip a step. Reply with the required JSON shape: the new layer, its nodes, its edges, and the self-review. If ${belowLayer.id} already contains the thing the concept names, reply {"isValidConcept": true, "done": true} instead.`,
  };
}

/**
 * The repair message for a failed layer attempt (v1 ticket 04's escalating
 * repair contract, per layer): cites the problems and narrows the
 * instructions.
 *
 * @param {string} concept
 * @param {any} belowLayer
 * @param {any[]} belowNodes
 * @param {string} nextLayerId
 * @param {string} problems
 * @param {boolean} finalAttempt
 * @returns {import("./llm.js").ChatMessage}
 */
function nextLayerRepairMessage(
  concept,
  belowLayer,
  belowNodes,
  nextLayerId,
  problems,
  finalAttempt
) {
  return {
    role: "user",
    content: `Concept: ${concept}\n\nCurrent top layer (json):\n\n${JSON.stringify(
      { layer: belowLayer, nodes: belowNodes },
      null,
      2
    )}\n\nYour previous attempt to build layer ${nextLayerId} did not meet the contract: ${problems}\n\nReply with JSON only, no markdown, exactly the required shape: the layer ${nextLayerId}, its nodes, its edges to ${belowLayer.id}, and the self-review. Do not rename or re-list existing layers or nodes. Every new node needs a NEW unique id - never reuse a node id from the layer below. Fix EVERY problem listed.${
      finalAttempt ? " This is your final attempt." : ""
    }`,
  };
}

/**
 * Unpacks a per-layer reply into a done flag, a layer, or a refusal.
 *
 * @param {unknown} parsed
 * @returns {{ refused: true; reason: string } | { refused: false; done: boolean; layer: any; nodes: any[]; edges: any[]; selfReview: any } | null}
 */
function unpackNextLayer(parsed) {
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
  if (reply.done === true) {
    return { refused: false, done: true, layer: null, nodes: [], edges: [], selfReview: {} };
  }
  if (reply.layer && typeof reply.layer === "object") {
    return {
      refused: false,
      done: false,
      layer: reply.layer,
      nodes: Array.isArray(reply.nodes) ? reply.nodes : [],
      edges: Array.isArray(reply.edges) ? reply.edges : [],
      selfReview:
        reply.selfReview && typeof reply.selfReview === "object" ? reply.selfReview : {},
    };
  }
  return null;
}

/**
 * Merges a per-layer reply into the assembled map.
 *
 * @param {{ concept: string; layers: any[]; nodes: any[]; edges: any[] }} assembled
 * @param {{ layer: any; nodes?: any; edges?: any }} layerReply
 * @returns {{ concept: string; layers: any[]; nodes: any[]; edges: any[] }}
 */
function mergeLayer(assembled, layerReply) {
  return {
    concept: assembled.concept,
    layers: [...assembled.layers, layerReply.layer],
    nodes: [
      ...assembled.nodes,
      ...(Array.isArray(layerReply.nodes) ? layerReply.nodes : []),
    ],
    edges: [
      ...assembled.edges,
      ...(Array.isArray(layerReply.edges) ? layerReply.edges : []),
    ],
  };
}

/**
 * The per-layer gate (ticket 08): the assembled map must pass the contiguity
 * validator (v1 02) and deriveCheck (v2 06) - the same backstop gates that
 * run on the final map - plus the structural per-layer rule: the new layer
 * must have the expected id and at least one edge connecting it to the layer
 * immediately below (the only layer the derivation call could see). The
 * model's own self-review is honored when it reports problems.
 *
 * @param {any} candidate
 * @param {string} nextLayerId
 * @param {string} belowLayerId
 * @param {any} selfReview
 * @returns {string[]} the problems to feed the next repair attempt
 */
function layerProblems(candidate, nextLayerId, belowLayerId, selfReview) {
  const validation = validateRealityMap(candidate);
  const derive = deriveCheck(candidate);
  const errors = [...validation.errors, ...derive.errors];
  if (!candidate.layers.some(
    /** @param {any} layer */
    (layer) => layer.id === nextLayerId
  )) {
    errors.push(`the new layer id must be ${nextLayerId}`);
  }
  const layerIndex = new Map(
    candidate.layers.map(
      /** @param {any} layer @param {number} i */
      (layer, i) => [layer.id, i]
    )
  );
  const belowIndex = layerIndex.get(belowLayerId);
  const nextIndex = layerIndex.get(nextLayerId);
  if (nextIndex !== undefined && belowIndex !== undefined && nextIndex - belowIndex === 1) {
    const connectsDown = candidate.edges.some(
      /** @param {any} edge */
      (edge) => {
        const s = candidate.nodes.find(
          /** @param {any} node */
          (node) => node.id === edge.source
        );
        const t = candidate.nodes.find(
          /** @param {any} node */
          (node) => node.id === edge.target
        );
        if (!s || !t) return false;
        const si = layerIndex.get(s.layer);
        const ti = layerIndex.get(t.layer);
        return (si === nextIndex && ti === belowIndex) || (ti === nextIndex && si === belowIndex);
      }
    );
    if (!connectsDown) {
      errors.push(
        `layer "${nextLayerId}" has no edge connecting it to the layer below (${belowLayerId}) - every layer must be derived from the layer immediately below it`
      );
    }
  }
  if (selfReview && selfReview.derivable === false) {
    errors.push("your self-review reports the new layer is not derivable from the layer below");
  }
  if (selfReview && Array.isArray(selfReview.gaps) && selfReview.gaps.length > 0) {
    errors.push(`your self-review reports gaps: ${selfReview.gaps.slice(0, 3).join("; ")}`);
  }
  return errors;
}

/**
 * The problem statement for the next layer repair attempt.
 *
 * @param {string[]} problems
 * @param {boolean} parseable
 * @returns {string}
 */
function layerProblemsText(problems, parseable) {
  if (!parseable) {
    return "your reply was not valid JSON in the required shape";
  }
  return [...new Set(problems)].slice(0, 6).join("; ");
}

/**
 * Structural check of a phase-A foundation reply. The foundation is locked
 * in by the per-layer loop, so phase A must own its shape - phase B can no
 * longer patch a malformed foundation the way v2's single derive call could.
 *
 * @param {any} foundation
 * @returns {string[]}
 */
function foundationProblems(foundation) {
  const errors = /** @type {string[]} */ ([]);
  const layer = foundation && foundation.layer;
  if (typeof layer !== "object" || layer === null) {
    errors.push("foundation.layer must be an object");
    return errors;
  }
  if (typeof layer.id !== "string" || layer.id.length === 0) {
    errors.push("foundation.layer.id must be a non-empty string");
  }
  if (typeof layer.name !== "string" || layer.name.length === 0) {
    errors.push("foundation.layer.name must be a non-empty string");
  }
  if (!Array.isArray(layer.nodes)) {
    errors.push("foundation.layer.nodes must be an array");
  }
  const nodes = foundation.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push("foundation.nodes must be a non-empty array");
  } else {
    for (const node of nodes) {
      if (typeof node !== "object" || node === null) {
        errors.push("foundation nodes must be objects");
        continue;
      }
      if (typeof node.id !== "string" || node.id.length === 0) {
        errors.push("foundation node ids must be non-empty strings");
      }
      if (typeof node.label !== "string" || node.label.length === 0) {
        errors.push("foundation node labels must be non-empty strings");
      }
      if (typeof node.description !== "string") {
        errors.push("foundation node descriptions must be strings");
      }
    }
  }
  return errors;
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

/** Per-layer attempts: initial derivation plus two repairs. */
const MAX_LAYER_ATTEMPTS = 3;
/** Phase A attempts: initial foundation plus one repair. */
const MAX_FOUNDATION_ATTEMPTS = 2;

/**
 * Generates a Reality Map for a word or phrase, bottom-up and layer by
 * layer: the foundation first, then each layer derived only from the layer
 * immediately below it, so a skipped intermediate step is structurally
 * impossible rather than merely validated against. The contiguity validator
 * and deriveCheck gate every layer and the final map as the backstop; the
 * repair loop fixes flagged layers up to twice each.
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
  /** The soft layer cap, hard-clamped to the validator's structural max. */
  const maxLayers = Math.min(
    Math.max(1, Math.floor(options.maxLayers ?? 6)),
    MAX_REALITY_LAYERS
  );
  const totalStarted = Date.now();
  /** Whether any repair attempt was used across any phase. */
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
  /** @type {string} */
  let foundationProblemsText = "it was not valid JSON in the required shape";
  for (let attempt = 0; attempt < MAX_FOUNDATION_ATTEMPTS; attempt++) {
    const isRepair = attempt > 0;
    if (isRepair) repaired = true;
    /** @type {import("./llm.js").ChatMessage[]} */
    const messages = isRepair
      ? [
          { role: "system", content: buildFoundationSystemPrompt() },
          {
            role: "user",
            content: `Word or phrase: ${trimmed}\n\nYour previous reply did not meet the contract: ${foundationProblemsText}\n\nReply with JSON only, exactly one of the two shapes.`,
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
    if (unpack === null) {
      foundationProblemsText = "it was not valid JSON in the required shape";
      continue;
    }
    const problems = foundationProblems(unpack.foundation);
    if (problems.length === 0) {
      foundation = unpack.foundation;
      break;
    }
    foundationProblemsText = problems.slice(0, 6).join("; ");
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

  /* The foundation is always layer l0 - code owns the ids from here on, so
   * the layer id sequence itself cannot skip (l1, l2, ... in order). */
  const assembled = {
    concept: trimmed,
    layers: [{ ...foundation.layer, id: "l0" }],
    nodes: (foundation.nodes ?? []).map(
      /** @param {any} node */
      (node) => ({ ...node, layer: "l0" })
    ),
    edges: [],
  };

  /* Phase C: derive the remaining layers one at a time, bottom-up. Each call
   * sees only the layer immediately below - a skipped intermediate step
   * cannot be expressed, because the layer it would skip is the only map
   * content the call receives. */
  /** @type {string[]} */
  let lastProblems = [];
  let lastParseable = true;
  let done = false;

  for (let layerCount = 1; layerCount < maxLayers && !done; layerCount++) {
    const nextLayerId = `l${layerCount}`;
    const belowLayer = assembled.layers[assembled.layers.length - 1];
    const belowNodes = assembled.nodes.filter(
      /** @param {any} node */
      (node) => node.layer === belowLayer.id
    );
    let layerOk = false;
    lastProblems = [];
    lastParseable = true;

    for (let attempt = 0; attempt < MAX_LAYER_ATTEMPTS; attempt++) {
      const isRepair = attempt > 0;
      if (isRepair) repaired = true;
      const finalAttempt = attempt === MAX_LAYER_ATTEMPTS - 1;
      /** @type {import("./llm.js").ChatMessage[]} */
      const messages = isRepair
        ? [
            { role: "system", content: buildNextLayerSystemPrompt(maxLayers) },
            nextLayerRepairMessage(
              trimmed,
              belowLayer,
              belowNodes,
              nextLayerId,
              layerProblemsText(lastProblems, lastParseable),
              finalAttempt
            ),
          ]
        : [
            { role: "system", content: buildNextLayerSystemPrompt(maxLayers) },
            nextLayerUserMessage(trimmed, belowLayer, belowNodes, nextLayerId),
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
      const unpack = unpackNextLayer(parsed);
      if (unpack === null) {
        lastParseable = false;
        lastProblems = [];
        continue;
      }
      if (unpack.refused) {
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
      if (unpack.done) {
        done = true;
        layerOk = true;
        break;
      }
      lastParseable = true;
      const candidate = repairMap(mergeLayer(assembled, unpack));
      const problems = layerProblems(candidate, nextLayerId, belowLayer.id, unpack.selfReview);
      if (problems.length === 0) {
        assembled.layers = candidate.layers;
        assembled.nodes = candidate.nodes;
        assembled.edges = candidate.edges;
        layerOk = true;
        break;
      }
      lastProblems = problems;
    }

    if (!layerOk) {
      return {
        ok: false,
        map: null,
        kind: "invalid",
        reason: lastParseable
          ? "The model could not produce a valid, derivable next layer after two repair attempts."
          : "The model could not produce parseable JSON for a layer after two repair attempts.",
        errors: lastProblems,
        latencyMs: Date.now() - totalStarted,
        retried: true,
      };
    }
  }

  /* Final backstop gate: the assembled map leaves only through both
   * validators - the contiguity validator (v1 02) and deriveCheck (v2 06).
   * Every layer already passed them on merge, so this is the belt-and-braces
   * gate the ticket keeps by design. */
  const finalValidation = validateRealityMap(assembled);
  const finalDerive = deriveCheck(assembled);
  if (finalValidation.ok && finalDerive.ok) {
    return {
      ok: true,
      map: /** @type {RealityMap} */ (assembled),
      kind: null,
      reason: null,
      errors: [],
      latencyMs: Date.now() - totalStarted,
      retried: repaired,
    };
  }

  return {
    ok: false,
    map: null,
    kind: "invalid",
    reason: "The assembled map failed the final validator gates.",
    errors: [...finalValidation.errors, ...finalDerive.errors],
    latencyMs: Date.now() - totalStarted,
    retried: true,
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
