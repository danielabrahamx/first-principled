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
 * and each call sees the layers built so far - the layer immediately below
 * it plus every layer beneath it (ticket 13 extends the ticket 08 contract:
 * adjacent down-edges stay the default, cross-layer edges become legal for
 * true syntheses). A layer that is not the immediate successor of the last
 * one built cannot be expressed, because the only layers the model can
 * reference are the ones it was given.
 *
 * Ticket 03 extends every node with the crux: its `basis` is a real-history
 * OBSERVATION RECORD (ticket 02) - discoverer, date, key observation, with
 * EXACT / APPROXIMATE / UNKNOWN marks per the fail-honest contract (ticket
 * 09). REAL discovery history, never rational reconstruction; UNKNOWN is a
 * legal, first-class state (the node exists, its observation is missing, the
 * layer chain is unbroken); a value under an UNKNOWN mark is an invented
 * placeholder and is rejected. The prompts carry the contract's honesty
 * rules, the repair loop re-states them on every repair (including the
 * empty-reply case), and deriveCheck requires a valid record on every node,
 * foundation included. Observation narratives are written to the approved
 * STE subset (ticket 05, docs/ste.md): the prompt carries the rules, and the
 * exported steProblems check gates the live verification.
 *
 *   Phase A (foundation): name the deepest observable layer the thing is
 *   built on - the foundation, always layer l0. Refusal contract unchanged
 *   (a non-teachable input is refused, not mapped).
 *
 *   Phase C (per-layer derive loop): build the remaining layers one at a
 *   time, bottom-up. Each call receives ALL lower layers (the current top
 *   layer plus every layer beneath it) and derives the NEXT layer directly
 *   above the top - layer l1 from l0, l2 from l1, and so on. Code assigns
 *   the layer ids (l1, l2, ...) and requires at least one edge from each new
 *   layer to the layer below it, so the chain is contiguous by construction.
 *   Every node carries a `basis` observation record (the crux, ticket 02)
 *   and nodes with testable behavior emit `predicts` edges (principle 2). A
 *   convergence node - a true synthesis of discoveries from multiple fields,
 *   ticket 13 - keeps ONE crux record plus a `combines` list of the enabling
 *   observations from other fields, and its cross-layer "combines" edges may
 *   skip layers. The model reports a per-layer self-review of derivability.
 *   The loop stops when the model says the concept is reached (done), or at
 *   the soft layer cap.
 *
 * Code owns the hard checks at every step: validateRealityMap (structure
 * and contiguity, v1 ticket 02) plus deriveCheck (reachability from the
 * foundation, a valid observation record per node, v2 ticket 06 extended
 * by ticket 03, and the convergence rule for combines lists, ticket 13)
 * plus the per-layer rule (the new layer must connect to the layer below
 * it). Failures drive the repair loop (v1 ticket 04) - up to two
 * repairs per layer, exactly like v1's escalating repair contract. Both
 * validators run once more on the final assembled map as the backstop gate:
 * a map leaves this function only through both gates.
 *
 * Latency note: per-layer calls are smaller than v2's single derive call,
 * so the chain costs one call per layer plus repairs. Measured live in
 * ticket 08: 30/30 concepts gap-free (research/08-gapfree-verification.md);
 * ticket 03 re-measured with observation records (research/
 * 03-observations-verification.md).
 *
 * The transport is injected (`callLLM`) so unit tests run against a stub and
 * live verification runs against the real DeepSeek API.
 */

import { callChatCompletion } from "./llm.js";
import { parseModelJson } from "./jsonParse.js";
import { validateRealityMap, MAX_REALITY_LAYERS } from "../mmg/validator.js";
import { observationProblems, dropUnknownValues } from "../mmg/observation.js";

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
 * @property {number} [maxTokens] - headroom for JSON output. Default 4096 -
 *   inside the fail-honest contract's 3000-5000 band (ticket 09 section 3;
 *   a lower cap truncates JSON or burns the budget on reasoning).
 * @property {string} [conceptLabel] - display name used in error messages.
 * @property {boolean} [fastPath] - try the whole map in ONE call first
 *   (the ?fast=1 staging spike 2026-08-14), falling back to the serial
 *   per-layer path when the one-shot map fails the gates. Default false.
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
 * @property {"oneshot" | "serial"} [generationPath] - which pipeline built
 *   the map (staging spike 2026-08-14).
 */

/* ---------------------------------------------------------------------------
 * Phase A: the foundation layer
 * ------------------------------------------------------------------------- */

/**
 * The fail-honest contract block (ticket 09, section 1): EXACT /
 * APPROXIMATE / UNKNOWN marks per fact field, never invent, UNKNOWN is a
 * legal answer. Carried by every prompt that produces observation records.
 *
 * @returns {string}
 */
function failHonestBlock() {
  return `You are a factual history-of-science annotator. The basis of every node is REAL discovery history - the discovery, measurement, experiment, or theoretical result the abstraction compresses - never a reconstructed or plausible history. An invention or first construction counts: the first spreadsheet, the first operating system, the first working transistor - each is a real, documented observation.

For each fact field, respond with EXACT, APPROXIMATE, or UNKNOWN.
- EXACT: a single well-documented value (person, year).
- APPROXIMATE: the record itself is low resolution or contested (a decade, multiple claimants, a convention with no primary source).
- UNKNOWN: you have no defensible value. NEVER invent a plausible answer to avoid UNKNOWN. An observation that never happened is UNKNOWN - do not describe a plausible observation as if it existed. When a mark is UNKNOWN, leave its value empty.

Most concepts in a first-principles chain have documented history in your knowledge. Give the best-documented discoverer and year and mark them EXACT or APPROXIMATE. For an abstract concept, the observation is the idea's first rigorous statement or first construction: for recursion that is McCarthy's 1960 introduction of recursion in LISP (EXACT); where several people contributed, name the best-documented and mark APPROXIMATE. Reserve UNKNOWN for facts with no defensible record - never use UNKNOWN to dodge a fact you actually know, and never invent one to avoid it.

If a year is contested in the historical record, give the best-documented year and mark APPROXIMATE. Where credit is shared or disputed, name all documented parties and mark APPROXIMATE when the primary credit is not settled.`;
}

/**
 * The STE narrative block (ticket 05, docs/ste.md): rules 1-6 plus the
 * contraction and slang bans, applied to every narrative the model writes -
 * descriptions, keyObservation values, notes, and the self-review.
 *
 * @returns {string}
 */
function steBlock() {
  return `Write every narrative (descriptions, keyObservation, note, self-review) in simplified technical English:
- One meaning per word: use each word with one fixed meaning.
- Short sentences: under 20 words.
- Active voice: the subject does the action.
- One idea per sentence.
- No vague words: avoid it, this, that, thing without a clear referent.
- Consistent terminology: the same word for the same concept, no synonyms.
- No slang, idioms, or figurative language.
- No contractions.
- A note is one short sentence or a few words.
- Count the words in every sentence before replying. No sentence has more than 20 words.`;
}

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
- Exactly one layer, with 1 to 3 nodes. Each node has an id, label, layer, a one to two sentence description, and a "basis": the observation record - the REAL discovery history of the phenomenon the node names (who discovered it, when, what was observed). The foundation is the first observation a learner can point at.
- The foundation must be real and observable, not a metaphor or a slogan.

${failHonestBlock()}

${steBlock()}

Reply as JSON only. No markdown fences, no commentary. Two shapes:

When the input names a real, teachable thing:
{"isValidConcept": true, "foundation": {"layer": {"id": "l0", "name": "...", "nodes": ["n-..."]}, "nodes": [{"id": "n-...", "label": "...", "layer": "l0", "description": "...", "basis": {"discoverer": {"value": "...", "mark": "EXACT"}, "date": {"value": "...", "mark": "EXACT"}, "keyObservation": {"value": "...", "mark": "EXACT"}, "confidence": "high", "note": "..."}}]}}

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
          : "The tutor did not find a concept to explain here.",
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
 * The system prompt for a per-layer derive call (ticket 08, extended by
 * ticket 13): given the layers built so far (ALL of them - the current top
 * layer and every layer beneath it), derive the NEXT layer directly above
 * the top. The chain stays gap-free: at least one edge must connect the new
 * layer to the layer immediately below it, so a skipped intermediate step
 * stays structurally impossible. Ticket 13 adds convergence: real discovery
 * history is convergent, so a node whose crux is a TRUE SYNTHESIS of
 * discoveries from several fields may carry a `combines` list (the enabling
 * observations from other fields) and cross-layer edges to those nodes, at
 * any depth. Every node carries an observation record as its basis (ticket
 * 03, the crux), honest marks per the fail-honest contract, narratives in
 * the STE subset. The word "json" and an example shape are both required by
 * the JSON mode contract.
 *
 * @param {number} maxLayers
 * @returns {string}
 */
export function buildNextLayerSystemPrompt(maxLayers) {
  return `You are first-principled, an AI tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

You are building the Reality Map of a concept layer by layer, bottom-up, one layer per reply. You are given the CURRENT MAP - every layer built so far, from the foundation up to the current top layer - and you derive the NEXT layer directly above the top: the layer that the layers below make possible. The chain must stay contiguous: at least one edge of the new layer must connect it to the layer immediately below, so no intermediate step is ever skipped. For "laptop", given the physics foundation, the chain runs materials, electronics, logic gates, operating system, applications - each step built on the one before.

Real discovery history is CONVERGENT: independent streams meet at a layer and combine. An LLM is not only transformers - it also needs encoders, decoders, embeddings, and compute. When a node's crux is a TRUE SYNTHESIS - its discovery combines observations from several different fields - you may:
- list the enabling observations from the OTHER fields in that node's "combines" array (each entry: the id of the enabling node you were given, plus its observation record), and
- emit cross-layer edges from that node to those enabling nodes at ANY depth, even if that skips layers.
A convergence node always keeps ONE crux "basis" - the discovery that combined the streams (e.g. Vaswani 2017) - and its combines list holds the enabling observations. A convergence node must have combines from 2+ DISTINCT LAYERS: one stream combined with itself is not convergence. Cross-layer edges are for true syntheses only, never to hide a skipped step: the contiguous chain stays the rule.

The whole chain will be around ${maxLayers} layers total, foundation included (a soft cap; do not plan deeper unless the thing genuinely requires it).

Requirements for the next layer:
- Build exactly ONE layer, with the id stated in the prompt (l1, l2, ...).
- 1 to 3 nodes; each node has an id, a label, the new layer id, a one to two sentence description, and a "basis": the observation record - the REAL discovery history the abstraction compresses (who discovered it, when, what was observed). Example: logic gate -> basis: Boole 1847, logical reasoning follows the rules of algebra.
- A node whose crux is a true synthesis across fields may additionally carry "combines": an array of {"id": "n-...", "observation": {...}} entries naming the enabling nodes you were given and their observation records. Keep combines to real enabling discoveries you were shown - never invent a stream.
- Give every node a NEW unique id - never reuse a node id from the layers you were given; the same concept at a higher layer is a NEW node with a NEW id.
- 1 to 3 typed edges. At least one edge must connect the new layer to the layer immediately below it. The ONLY allowed edge types are: built-on, abstraction-of, part-of, depends-on, predicts, contradicts. Never invent an edge type. Edges may also connect nodes within the new layer, and cross-layer edges to any lower layer are legal for a true synthesis (pair them with a combines entry). Reference only node ids you were given or ids you create.
- Before replying, self-review: is the new layer really built on the layers given? Does every node carry a real observation record? Does every convergence node list only real enabling observations it was shown? Are there invented steps or invented observations? Report only STRUCTURAL problems in gaps: an invented step, a layer not built on the layers given, a missing derivation. Do NOT report UNKNOWN observations in gaps - UNKNOWN is a legal, honest state, not a gap.

${failHonestBlock()}

${steBlock()}

Reply as JSON only. No markdown fences, no commentary. Three shapes:

When the layers you were given are not yet the top of the chain:
{"isValidConcept": true, "done": false, "layer": {"id": "l2", "name": "...", "nodes": ["n-..."]}, "nodes": [{"id": "n-...", "label": "...", "layer": "l2", "description": "...", "basis": {"discoverer": {"value": "...", "mark": "EXACT"}, "date": {"value": "...", "mark": "EXACT"}, "keyObservation": {"value": "...", "mark": "EXACT"}, "confidence": "high", "note": "..."}, "combines": [{"id": "n-...", "observation": {"discoverer": {"value": "...", "mark": "EXACT"}, "date": {"value": "...", "mark": "EXACT"}, "keyObservation": {"value": "...", "mark": "EXACT"}, "confidence": "high", "note": "..."}}]}], "edges": [{"source": "n-...", "target": "n-...", "type": "built-on"}], "selfReview": {"derivable": true, "gaps": []}}

When the layers you were given already contain the thing itself - the concept is reached:
{"isValidConcept": true, "done": true}

When the concept turns out not to be derivable from the foundation (or is not a real thing):
{"isValidConcept": false, "reason": "one short sentence explaining why not"}

Example node with a basis:
{"id": "n-logic-gate", "label": "logic gate", "layer": "l3", "description": "A circuit computing a boolean function such as AND, OR or NOT from input voltages.", "basis": {"discoverer": {"value": "George Boole", "mark": "EXACT"}, "date": {"value": "1847", "mark": "EXACT"}, "keyObservation": {"value": "Boole links logical reasoning to the rules of algebra.", "mark": "EXACT"}, "confidence": "high", "note": ""}}`;
}

/**
 * The per-layer user message: the concept, ALL layers built so far (the
 * current top layer plus every layer beneath it - the ticket 13 extension,
 * because a convergence node must be able to reference the enabling
 * observations from any depth, not only the layer below), and the fixed id
 * of the next layer to build. The chain stays gap-free: the new layer must
 * still connect to the layer immediately below it.
 *
 * @param {string} concept
 * @param {any[]} allLayers - every layer built so far, in order.
 * @param {any[]} allNodes - every node built so far.
 * @param {string} nextLayerId
 * @returns {import("./llm.js").ChatMessage}
 */
function nextLayerUserMessage(concept, allLayers, allNodes, nextLayerId) {
  const belowLayer = allLayers[allLayers.length - 1];
  return {
    role: "user",
    content: `Concept: ${concept}\n\nCurrent map (json) - all layers built so far:\n\n${JSON.stringify(
      { layers: allLayers, nodes: allNodes },
      null,
      2
    )}\n\nBuild layer ${nextLayerId}, the next layer directly above ${belowLayer.id}: what do the layers below make possible? Connect ${nextLayerId} to ${belowLayer.id} by at least one edge - do not skip a step in the chain. If a node is a true synthesis of discoveries from several fields, you may add cross-layer edges to lower layers and list the enabling observations in its combines array. Reply with the required JSON shape: the new layer, its nodes, its edges, and the self-review. If the layers given already contain the thing the concept names, reply {"isValidConcept": true, "done": true} instead.`,
  };
}

/**
 * The repair message for a failed layer attempt (v1 ticket 04's escalating
 * repair contract, per layer): cites the problems and narrows the
 * instructions. Since ticket 03 it also re-states the honesty rule
 * (contract rule 3) and, since the live run, the done option - a model that
 * reports the concept is already reached must be able to say so instead of
 * being forced to build another layer.
 *
 * @param {string} concept
 * @param {any[]} allLayers - every layer built so far, in order.
 * @param {any[]} allNodes - every node built so far.
 * @param {string} existingIds - every node id built so far (all layers).
 * @param {string} nextLayerId
 * @param {string} problems
 * @param {boolean} finalAttempt
 * @returns {import("./llm.js").ChatMessage}
 */
function nextLayerRepairMessage(
  concept,
  allLayers,
  allNodes,
  existingIds,
  nextLayerId,
  problems,
  finalAttempt
) {
  const belowLayer = allLayers[allLayers.length - 1];
  return {
    role: "user",
    content: `Concept: ${concept}\n\nCurrent map (json) - all layers built so far:\n\n${JSON.stringify(
      { layers: allLayers, nodes: allNodes },
      null,
      2
    )}\n\nYour previous attempt to build layer ${nextLayerId} did not meet the contract: ${problems}\n\nReply with JSON only, no markdown, exactly the required shape: the layer ${nextLayerId}, its nodes, its edges to ${belowLayer.id}, and the self-review. Do not rename or re-list existing layers or nodes. Every new node needs a NEW unique id - never reuse any of these existing ids: ${existingIds}. Every node needs a basis: a real observation record with a discoverer, a date, a keyObservation, a confidence, and a note, each marked EXACT, APPROXIMATE, or UNKNOWN. If you do not know a fact, mark it UNKNOWN and leave the value empty - never invent a fact. If ${belowLayer.id} already contains the thing the concept names, reply {"isValidConcept": true, "done": true} instead of building a new layer. Fix EVERY problem listed.${
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
          : "The tutor could not derive a sequence here.",
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
  // NOTE: selfReview.gaps intentionally does NOT gate. The model files
  // honesty notes there (for example "the observation record is UNKNOWN"),
  // and UNKNOWN observations are legal - gating on free-text gaps turns
  // honest behavior into a false failure. Structural problems are caught
  // by the real gates above: the validator, deriveCheck, and the
  // down-edge rule.
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
 * Since ticket 03 every foundation node also carries a valid observation
 * record (the crux: the first real observation a learner can point at).
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
      const basis = observationProblems(node.basis);
      if (basis.length > 0) {
        errors.push(
          `foundation node ${typeof node.id === "string" ? `"${node.id}" ` : ""}basis: ${basis.join("; ")}`
        );
      }
    }
  }
  return errors;
}

/* ---------------------------------------------------------------------------
 * The code-level derivability check
 * ------------------------------------------------------------------------- */

/**
 * The deterministic derivability check (ticket 06, principle 5 and 11-12,
 * extended by ticket 03 and ticket 13): every node must be reachable from
 * the foundation layer through the typed edges (no disconnected fragments,
 * no invented side-chains) - the trace to a strictly lower layer - and every
 * node, foundation included, must carry a VALID observation record as its
 * basis: a real-history record (ticket 02) with honest EXACT / APPROXIMATE /
 * UNKNOWN marks per the fail-honest contract (ticket 09). UNKNOWN marks are
 * legal (the node keeps its gap); a missing record, a structurally broken
 * one, or a value under an UNKNOWN mark (an invented placeholder) is not.
 *
 * Ticket 13 convergence rule: a node carrying a non-empty `combines` list is
 * a CONVERGENCE node - a true synthesis of discoveries from several fields.
 * Every combine entry must reference a node that exists in the map, in a
 * STRICTLY LOWER layer, and the referenced nodes must span 2+ DISTINCT
 * layers (a convergence node has parents in 2+ distinct layers; a single
 * field combined with itself is not a convergence). Each combine entry's
 * observation record must be valid, and the referenced nodes' own bases stay
 * subject to the every-node rule above. Edges may skip layers - cross-layer
 * "combines" edges are legal - but the reachability rule still holds for
 * every node.
 * Pure; used by the generation repair loop.
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
  const layerIndex = new Map(
    map.layers.map(
      /** @param {any} layer @param {number} i */
      (layer, i) => [layer.id, i]
    )
  );

  const nodes = /** @type {any[]} */ (map.nodes);
  const edges = /** @type {any[]} */ (map.edges);
  const adjacency = new Map(nodes.map((node) => [node.id, /** @type {string[]} */ ([])]));
  const byId = new Map(nodes.map((node) => [node.id, node]));
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
    const label = node.label && typeof node.label === "string" ? node.label : node.id;
    if (node.basis === undefined || node.basis === null) {
      errors.push(
        `node "${label}" (${node.id}) has no basis - every node carries a real-history observation record (ticket 02)`
      );
    } else {
      const problems = observationProblems(node.basis);
      if (problems.length > 0) {
        errors.push(
          `node "${label}" (${node.id}) has an invalid observation record: ${problems.join("; ")}`
        );
      }
    }

    /* Ticket 13 convergence rule: a convergence node (non-empty combines)
     * must reference real nodes in strictly lower layers, spanning 2+
     * distinct layers - the streams that actually combined. */
    const combines = Array.isArray(node.combines) ? node.combines : null;
    if (combines !== null && combines.length > 0) {
      const ownIndex = layerIndex.get(node.layer);
      /** @type {Set<string>} */
      const sourceLayers = new Set();
      for (const entry of combines) {
        const refId = entry && entry.id;
        if (typeof refId !== "string" || refId.length === 0) {
          errors.push(
            `node "${label}" (${node.id}) has a combines entry without an id - every combine entry names the enabling node`
          );
          continue;
        }
        const source = byId.get(refId);
        if (source === undefined) {
          errors.push(
            `node "${label}" (${node.id}) combines unknown node "${refId}" - every combined observation must reference a real node in the map`
          );
          continue;
        }
        const sourceIndex = layerIndex.get(source.layer);
        if (sourceIndex === undefined || ownIndex === undefined || sourceIndex >= ownIndex) {
          errors.push(
            `node "${label}" (${node.id}) combines "${refId}" which is not in a strictly lower layer - a convergence node only combines enabling observations from below`
          );
        } else {
          sourceLayers.add(source.layer);
        }
        const obsProblems = observationProblems(entry.observation);
        if (obsProblems.length > 0) {
          errors.push(
            `node "${label}" (${node.id}) combine "${refId}" has an invalid observation record: ${obsProblems.join("; ")}`
          );
        }
      }
      if (sourceLayers.size < 2) {
        errors.push(
          `node "${label}" (${node.id}) is a convergence node but its combines come from ${sourceLayers.size} distinct layer${sourceLayers.size === 1 ? "" : "s"} - a convergence node must combine observations from 2+ distinct layers`
        );
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
 * Generation flow
 * ------------------------------------------------------------------------- */

/** Per-layer attempts: initial derivation plus two repairs. */
const MAX_LAYER_ATTEMPTS = 3;
/** Phase A attempts: initial foundation plus two repairs. The foundation
 * now carries observation records (ticket 03), so it gets the same three
 * chances as a layer. */
const MAX_FOUNDATION_ATTEMPTS = 3;

/* ---------------------------------------------------------------------------
 * One-shot fast path (staging spike 2026-08-14): the whole map in one call.
 * Same content contract as the serial path (observation records, combines,
 * typed edges, contiguous chain, STE, fail-honest) but one reply instead of
 * one call per layer. The final validator gates (contiguity + deriveCheck)
 * are the SAME gates the serial path ends with, so a map that passes here is
 * structurally as valid as a serial map. Any failure - unparseable, wrong
 * shape, or failing the gates - falls back to the serial path.
 * ------------------------------------------------------------------------- */

/**
 * The one-shot system prompt: ask for the complete bottom-up chain in one
 * reply. Foundation l0 at the bottom, the concept at the crown, each layer
 * built on the layer below.
 *
 * @param {number} maxLayers
 * @returns {string}
 */
export function buildOneShotSystemPrompt(maxLayers) {
  return `You are first-principled, an AI tutor whose mission is to reduce the cognitive distance between a learner's mental model and reality.

A learner typed a word or phrase naming a thing or concept they want to understand from first principles. Build its complete Reality Map in ONE reply: a bottom-up chain of layers, foundation at the bottom, the concept itself at the top.

The foundation (l0) is the deepest, most observable layer the thing is ultimately built on - what a learner can observe or meet directly, before any abstraction. For "laptop" that foundation is physics (electricity); for "photosynthesis" it is light and matter; for "recursion" it is the call stack. The foundation has 1 to 3 nodes.

Above the foundation, derive each next layer as the layer that the layers below make possible. The chain must stay contiguous: at least one edge of every layer must connect it to the layer immediately below, so no intermediate step is ever skipped. For "laptop", given the physics foundation, the chain runs materials, electronics, logic gates, operating system, applications. Keep the whole chain around ${maxLayers} layers total, foundation included (a soft cap; do not plan deeper unless the thing genuinely requires it).

Real discovery history is CONVERGENT: independent streams meet at a layer and combine. When a node's crux is a TRUE SYNTHESIS - its discovery combines observations from several different fields - you may add a "combines" array to that node: entries of {"id": "n-...", "observation": {...}} naming the enabling nodes you created and their observation records, and cross-layer edges to those nodes at any depth. A convergence node always keeps ONE crux "basis" (the discovery that combined the streams, e.g. Vaswani 2017) and must list combines from 2+ DISTINCT LAYERS. Cross-layer edges are for true syntheses only, never to hide a skipped step: the contiguous chain stays the rule.

Requirements:
- Every node has an id, a label, a layer id, a one to two sentence description, and a "basis": the observation record - the REAL discovery history the abstraction compresses (who discovered it, when, what was observed). Give every node a NEW unique id.
- 1 to 3 typed edges per layer. At least one edge per layer connects it to the layer immediately below. The ONLY allowed edge types are: built-on, abstraction-of, part-of, depends-on, predicts, contradicts. Never invent an edge type.
- Before replying, self-review: is every layer really built on the layer below? Does every node carry a real observation record? Are there invented steps or invented observations? Do NOT treat UNKNOWN observations as gaps - UNKNOWN is a legal, honest state.

${failHonestBlock()}

${steBlock()}

Reply as JSON only. No markdown fences, no commentary. Two shapes:

When the input names a real, teachable thing:
{"isValidConcept": true, "layers": [{"id": "l0", "name": "...", "nodes": ["n-..."]}], "nodes": [{"id": "n-...", "label": "...", "layer": "l0", "description": "...", "basis": {"discoverer": {"value": "...", "mark": "EXACT"}, "date": {"value": "...", "mark": "EXACT"}, "keyObservation": {"value": "...", "mark": "EXACT"}, "confidence": "high", "note": "..."}, "combines": [{"id": "n-...", "observation": {"discoverer": {"value": "...", "mark": "EXACT"}, "date": {"value": "...", "mark": "EXACT"}, "keyObservation": {"value": "...", "mark": "EXACT"}, "confidence": "high", "note": "..."}}]}], "edges": [{"source": "n-...", "target": "n-...", "type": "built-on"}]}

When the input is not a teachable thing - gibberish, random characters, an empty phrase, a command, or anything that is not a real concept or object:
{"isValidConcept": false, "reason": "one short sentence explaining why not"}`;
}

/**
 * Unpacks a one-shot reply into a full map or a refusal.
 *
 * @param {unknown} parsed
 * @returns {{ refused: true; reason: string } | { refused: false; layers: any[]; nodes: any[]; edges: any[] } | null}
 */
function unpackOneShot(parsed) {
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
          : "The tutor did not find a concept to explain here.",
    };
  }
  if (!Array.isArray(reply.layers) || !Array.isArray(reply.nodes)) return null;
  return {
    refused: false,
    layers: reply.layers,
    nodes: reply.nodes,
    edges: Array.isArray(reply.edges) ? reply.edges : [],
  };
}

/**
 * Normalizes a one-shot reply into a candidate map: the code owns the layer
 * ids (l0, l1, ... in the order the model returned them, so the id sequence
 * itself cannot skip), every node is re-bound to its layer by the id or name
 * the model used, then the mechanical cleanup runs (stray edges dropped,
 * UNKNOWN values dropped, combine ids validated).
 *
 * @param {string} concept
 * @param {{ layers: any[]; nodes: any[]; edges: any[] }} unpacked
 * @returns {any}
 */
function normalizeOneShot(concept, unpacked) {
  const byOriginal = new Map();
  const layers = unpacked.layers.map((layer, i) => {
    const id = `l${i}`;
    const name =
      layer !== null && typeof layer === "object" && typeof layer.name === "string"
        ? layer.name
        : "";
    const original =
      layer !== null && typeof layer === "object" && typeof layer.id === "string"
        ? layer.id
        : "";
    if (original) byOriginal.set(original, id);
    if (name) byOriginal.set(name, id);
    return {
      id,
      name,
      nodes:
        layer !== null && typeof layer === "object" && Array.isArray(layer.nodes)
          ? layer.nodes
          : [],
    };
  });
  const nodes = unpacked.nodes
    .filter((node) => node !== null && typeof node === "object")
    .map((node) => {
      const original = String(node.layer ?? "");
      return { ...node, layer: byOriginal.get(original) ?? "" };
    });
  return repairMap({ concept, layers, nodes, edges: unpacked.edges });
}

/**
 * The one-shot attempt. Returns a terminal result (ok or refused) - the
 * caller falls back to the serial path on every failure except refusal.
 *
 * @param {{ concept: string; transport: CallLLM; thinking: boolean; maxTokens: number; maxLayers: number }} input
 * @returns {Promise<{ ok: true; map: any } | { ok: false; kind: "refused"; reason: string } | { ok: false; kind: "invalid" | "error"; reason: string }>}
 */
async function generateOneShotMap({ concept, transport, thinking, maxTokens, maxLayers }) {
  let reply;
  try {
    reply = await transport({
      messages: [
        { role: "system", content: buildOneShotSystemPrompt(maxLayers) },
        { role: "user", content: `Word or phrase: ${concept}` },
      ],
      jsonMode: true,
      thinking,
      maxTokens,
    });
  } catch (err) {
    return {
      ok: false,
      kind: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  const parsed = parseModelJson(reply.content);
  const unpacked = unpackOneShot(parsed);
  if (unpacked === null) {
    return {
      ok: false,
      kind: "invalid",
      reason: "The one-shot reply was not valid JSON in the required shape.",
    };
  }
  if (unpacked.refused) {
    return { ok: false, kind: "refused", reason: unpacked.reason };
  }
  const candidate = normalizeOneShot(concept, unpacked);
  const gate = validateRealityMap(candidate);
  const derive = deriveCheck(candidate);
  if (gate.ok && derive.ok) {
    return { ok: true, map: candidate };
  }
  return {
    ok: false,
    kind: "invalid",
    reason: "The one-shot map failed the validator gates.",
  };
}

/**
 * Generates a Reality Map for a word or phrase, bottom-up and layer by
 * layer: the foundation first, then each layer derived only from the layer
 * immediately below it, so a skipped intermediate step is structurally
 * impossible rather than merely validated against. The contiguity validator
 * and deriveCheck gate every layer and the final map as the backstop; the
 * repair loop fixes flagged layers up to twice each. With options.fastPath
 * the whole map is tried in one call first, falling back to this serial
 * path when the one-shot map fails the gates.
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
      reason: "Use a word or phrase that names a concept you want to learn.",
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

  /* One-shot fast path (staging spike 2026-08-14): try the whole map in one
   * call when the client asks for it (?fast=1). Any failure except a refusal
   * falls back to the serial path below; a refusal is terminal - gibberish
   * is refused once, not twice. The one-shot map passes through the SAME
   * final gates (contiguity + deriveCheck) as the serial path, so a map that
   * lands here is structurally as valid as a serial map. */
  if (options.fastPath === true) {
    const fast = await generateOneShotMap({
      concept: trimmed,
      transport,
      thinking,
      maxTokens: 8192,
      maxLayers,
    });
    if (fast.ok) {
      return {
        ok: true,
        map: /** @type {RealityMap} */ (fast.map),
        kind: null,
        reason: null,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: false,
        generationPath: "oneshot",
      };
    }
    if (fast.kind === "refused") {
      return {
        ok: false,
        map: null,
        kind: "refused",
        reason: fast.reason,
        errors: [],
        latencyMs: Date.now() - totalStarted,
        retried: false,
        generationPath: "oneshot",
      };
    }
  }

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
            content: `Word or phrase: ${trimmed}\n\nYour previous reply did not meet the contract: ${foundationProblemsText}\n\nReply with JSON only, exactly one of the two shapes. If you do not know a fact, mark it UNKNOWN and leave the value empty - never invent a fact.`,
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
    /* Normalize before checking: a value under an UNKNOWN mark is dropped
     * (contract rule 5), so the foundation's own records land in the visible
     * gap state instead of failing phase A. */
    const normalizedFoundation = {
      ...unpack.foundation,
      nodes: (unpack.foundation.nodes ?? []).map(
        /** @param {any} node */
        (node) =>
          node !== null && typeof node === "object"
            ? { ...node, basis: dropUnknownValues(node.basis) }
            : node
      ),
    };
    const problems = foundationProblems(normalizedFoundation);
    if (problems.length === 0) {
      foundation = normalizedFoundation;
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
   * sees ALL lower layers (ticket 13) - the current top layer plus every
   * layer beneath it - so a convergence node can reference the enabling
   * observations from any depth. The chain stays gap-free: the per-layer
   * gate still requires an edge to the layer immediately below. */
  /** @type {string[]} */
  let lastProblems = [];
  let lastParseable = true;
  let done = false;

  for (let layerCount = 1; layerCount < maxLayers && !done; layerCount++) {
    const nextLayerId = `l${layerCount}`;
    const belowLayer = assembled.layers[assembled.layers.length - 1];
    const allNodes = assembled.nodes;
    let layerOk = false;
    lastProblems = [];
    lastParseable = true;

    for (let attempt = 0; attempt < MAX_LAYER_ATTEMPTS; attempt++) {
      const isRepair = attempt > 0;
      if (isRepair) repaired = true;
      const finalAttempt = attempt === MAX_LAYER_ATTEMPTS - 1;
      /** Every node id built so far - the repair names them all, because the
       * model may collide with ANY earlier layer, not just the one below. */
      const existingIds = assembled.nodes
        .map(
          /** @param {any} node */
          (node) => node.id
        )
        .filter(
          /** @param {any} id */
          (id) => typeof id === "string"
        )
        .join(", ");
      /** @type {import("./llm.js").ChatMessage[]} */
      const messages = isRepair
        ? [
            { role: "system", content: buildNextLayerSystemPrompt(maxLayers) },
            nextLayerRepairMessage(
              trimmed,
              assembled.layers,
              allNodes,
              existingIds,
              nextLayerId,
              layerProblemsText(lastProblems, lastParseable),
              finalAttempt
            ),
          ]
        : [
            { role: "system", content: buildNextLayerSystemPrompt(maxLayers) },
            nextLayerUserMessage(trimmed, assembled.layers, allNodes, nextLayerId),
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
        /* A mid-chain refusal on a real concept is usually a model error
         * (live run: "money" refused mid-chain). Retry with the repair
         * message; only the final attempt honors the refusal. Phase A
         * refusals stay terminal - gibberish input is refused, not mapped. */
        if (attempt < MAX_LAYER_ATTEMPTS - 1) {
          lastParseable = true;
          lastProblems = [`you refused to derive this layer: ${unpack.reason}`];
          continue;
        }
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
      generationPath: "serial",
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
 * emits stray edges, e.g. pasted example fragments), and drops values under
 * UNKNOWN observation marks (the fail-honest contract rule 5: a value with
 * mark UNKNOWN is dropped at validation; the node keeps its visible gap).
 * Ticket 13: combine observations get the same UNKNOWN-value normalization,
 * and combine entries without a usable id are dropped (they could never
 * trace to a real node).
 * The validator remains the gate - the repaired map must still pass it.
 *
 * @param {any} map
 * @returns {any} the same object when clean, else a copy with the garbage
 *   edges removed and UNKNOWN observation values dropped.
 */
function repairMap(map) {
  if (typeof map !== "object" || map === null || !Array.isArray(map.nodes)) {
    return map;
  }
  let next = map;
  if (Array.isArray(next.edges)) {
    const nodeIds = new Set(
      next.nodes
        .filter(
          /** @param {any} node */
          (node) => typeof node === "object" && node !== null && typeof node.id === "string"
        )
        .map(
          /** @param {any} node */
          (node) => node.id
        )
    );
    const clean = next.edges.filter(
      /** @param {any} edge */
      (edge) =>
        typeof edge === "object" &&
        edge !== null &&
        typeof edge.source === "string" &&
        typeof edge.target === "string" &&
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target)
    );
    if (clean.length !== next.edges.length) {
      next = { ...next, edges: clean };
    }
  }
  const nodes = next.nodes.map(
    /** @param {any} node */
    (node) => {
      if (typeof node !== "object" || node === null) return node;
      let nextNode = node;
      const basis = dropUnknownValues(node.basis);
      if (basis !== node.basis) nextNode = { ...nextNode, basis };
      if (Array.isArray(node.combines)) {
        const combines = node.combines
          .filter(
            /** @param {any} entry */
            (entry) =>
              entry !== null &&
              typeof entry === "object" &&
              typeof entry.id === "string" &&
              entry.id.length > 0
          )
          .map(
            /** @param {any} entry */
            (entry) => ({
              ...entry,
              observation: dropUnknownValues(entry.observation),
            })
          );
        if (combines.length !== node.combines.length) {
          nextNode = { ...nextNode, combines };
        } else if (
          combines.some(
            /** @param {any} entry @param {number} i */
            (entry, i) => entry.observation !== node.combines[i].observation
          )
        ) {
          nextNode = { ...nextNode, combines };
        }
      }
      return nextNode === node ? node : nextNode;
    }
  );
  if (
    nodes.some(
      /** @param {any} node @param {number} i */
      (node, i) => node !== next.nodes[i]
    )
  ) {
    next = { ...next, nodes };
  }
  return next;
}

/* ---------------------------------------------------------------------------
 * STE narrative check (ticket 05, docs/ste.md)
 * ------------------------------------------------------------------------- */

/** Common contractions the STE subset bans (rule 8). Possessives like
 * "Boole's" are not contractions and pass. */
const STE_CONTRACTIONS = new Set([
  "can't", "won't", "don't", "didn't", "doesn't", "isn't", "aren't",
  "wasn't", "weren't", "couldn't", "wouldn't", "shouldn't", "mustn't",
  "it's", "that's", "there's", "here's", "what's", "who's", "let's",
  "i'm", "you're", "we're", "they're", "i've", "you've", "we've",
  "they've", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
  "would've", "should've", "could've",
]);

/** Slang, idioms, and filler the STE subset bans (rule 7). */
const STE_BANNED = new Set([
  "basically", "literally", "kinda", "sorta", "gonna", "wanna",
  "stuff", "kind of", "sort of", "pretty much", "super", "a lot of",
  "e.g.", "i.e.", "etc.",
]);

/** Vague words the subset tells the model to avoid (rule 5). Mechanical
 * detection cannot judge whether a referent is clear, so these are warnings,
 * not failures - the prompt carries the rule. */
const STE_VAGUE = new Set(["it", "this", "that", "thing", "things", "something"]);

/**
 * The mechanical STE narrative check (ticket 05, docs/ste.md): no
 * contractions, no slang or figurative filler, no em/en dashes (repo rule),
 * and no sentence over 25 words. Vague words are reported as warnings - the
 * referent rule is a judgment call the prompt carries.
 *
 * The "under 20 words" rule lives in the PROMPT (ticket 05 applies the
 * rules to generated content via the prompt); this mechanical gate tolerates
 * the boundary at 25 words so a well-written 21-word sentence does not fail
 * a run while genuinely long sentences still do.
 *
 * Used by the live verification script (ticket 03 bar) and unit-tested here;
 * the generator enforces STE through the prompts, not through this function.
 *
 * @param {unknown} text
 * @returns {{ errors: string[]; warnings: string[] }}
 */
export function steProblems(text) {
  const errors = /** @type {string[]} */ ([]);
  const warnings = /** @type {string[]} */ ([]);
  if (typeof text !== "string" || text.trim().length === 0) {
    return { errors, warnings };
  }
  const lower = text.toLowerCase();
  for (const word of STE_CONTRACTIONS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      errors.push(`contraction "${word}"`);
    }
  }
  for (const word of STE_BANNED) {
    if (lower.includes(word)) {
      errors.push(`non-STE word "${word}"`);
    }
  }
  if (/[\u2014\u2013]/.test(text)) {
    errors.push("em dash or en dash");
  }
  if (/--/.test(text)) {
    errors.push("double hyphen");
  }
  const sentences = text.split(/[.!?]+(?:\s+|$)/);
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (words.length > 25) {
      errors.push(`${words.length}-word sentence: "${sentence.trim().slice(0, 40)}..."`);
    }
  }
  for (const word of STE_VAGUE) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      warnings.push(`vague word "${word}"`);
    }
  }
  return { errors, warnings };
}
