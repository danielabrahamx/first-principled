/**
 * Ticket v9-02: realization contract for the pairwise generator.
 *
 * The fourth stage, between topology and assembly. `selectTopology` has
 * already decided the entire shape: which nodes exist, which edges
 * connect them, which is the trunk, what rank each node holds. This
 * module only asks the model for the strings a learner reads on cards
 * that already exist.
 *
 * The boundary is the whole point. The model is given node ids and edge
 * ids and may only write copy against them. It may not add a node, drop
 * a node, invent an edge, or reorder anything. If a reply names an id
 * that topology did not select, that is a gate failure, not a row to
 * filter out quietly: silently dropping it would hide a model that has
 * crossed back into r2 and started doing the job code already did
 * (`docs/DESIGN.md`, "Where the seams are for the next change").
 *
 * Follows the same four-part Contract as every other LLM boundary in
 * this codebase: PROMPT, SCHEMA, COERCE (frame only), GATE
 * (authoritative). No history, no dates, no discoverers. UNKNOWN is
 * not an option here, because a card with no copy is a change to the
 * product and needs a human decision, not a default
 * (`docs/DESIGN.md`, "Honesty as an architectural property").
 */

import { steProblems } from "../realityMap.js";

const NODE_FIELDS = ["id", "heading", "gloss"];
const EDGE_FIELDS = ["id", "because"];
const HEADING_CAP = 60;
const GLOSS_CAP = 240;
const BECAUSE_CAP = 200;
// Realization is the surface a learner reads, so it is held to the same
// sentence rules as the hand-written copy in docs/ste.md. Vocabulary is
// not enforced here: steProblems is imported rather than reimplemented,
// so the rules live in one place.
const MIN_SENTENCE_WORDS = 5;
/**
 * Hard cap on one sentence, matching docs/ste.md. The prompt states the
 * same number in the same words, so the model is never asked to meet a
 * rule it was not told. steProblems stays the authority; this number is
 * only here so the prompt and the gate cannot drift apart silently.
 */
export const MAX_SENTENCE_WORDS = 25;

/**
 * @typedef {object} RealizeNodeInput
 * @property {string} id
 * @property {string} label
 * @property {string} gloss
 * @property {string} kind
 */

/**
 * @typedef {object} RealizeEdgeInput
 * @property {string} id
 * @property {string} source
 * @property {string} target
 */

/**
 * Realization system prompt. The semantic question is narrow on purpose:
 * say what this node is, in words a curious adult uses, and say why this
 * one rests on that one. Everything structural is already decided.
 *
 * @returns {string}
 */
export function buildRealizeSystemPrompt() {
  return `You are writing the words a learner reads on a Dependence Tree
whose shape is already fixed. For each node you are given, write a
heading and a short gloss. For each edge you are given, write one
sentence saying why the source rests on the target.

Return JSON only with node_copy and edge_copy. node_copy is one entry
per node you were given, each with id, heading, and gloss. edge_copy is
one entry per edge you were given, each with id and because.

The target node is the concept the learner typed. Its card describes
that concept in full. Do not copy a description of a node's role or
place in the map onto its card; write about the thing itself.

heading is at most a few words, the thing itself, not a topic or a
question. gloss is one or two plain sentences saying what the thing is
and why it matters here. because is one plain sentence naming the
dependency, phrased for a learner: no chronology, no position, no
history, no discoverer, no date.

Keep every sentence under ${MAX_SENTENCE_WORDS} words. Count them. A
sentence the learner has to read twice is the wrong sentence.

Write only about the ids you were given. Never add, drop, merge, or
reorder a node or an edge. No contractions. No em dash.`;
}

/**
 * @param {string} concept
 * @param {RealizeNodeInput[]} nodes
 * @param {RealizeEdgeInput[]} edges
 * @returns {{ concept: string; nodes: RealizeNodeInput[]; edges: RealizeEdgeInput[] }}
 */
export function buildRealizeUserPayload(concept, nodes, edges) {
  return {
    concept,
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.label,
      gloss: node.gloss,
      kind: node.kind,
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}

/**
 * JSON Schema for the constrained decode. Both id lists are restricted
 * to the exact ids topology selected, so a constrained route cannot
 * invent one. Routes that treat schemas as hints still reach
 * realizeProblems, which stays authoritative.
 *
 * @param {RealizeNodeInput[]} nodes
 * @param {RealizeEdgeInput[]} edges
 * @returns {{ name: string; strict: true; schema: Record<string, any> }}
 */
export function buildRealizeJsonSchema(nodes, edges) {
  return {
    name: "realize",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concept: { type: "string" },
        node_copy: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", enum: nodes.map((node) => node.id) },
              heading: { type: "string" },
              gloss: { type: "string" },
            },
            required: ["id", "heading", "gloss"],
          },
        },
        edge_copy: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", enum: edges.map((edge) => edge.id) },
              because: { type: "string" },
            },
            required: ["id", "because"],
          },
        },
      },
      required: ["concept", "node_copy", "edge_copy"],
    },
  };
}

/**
 * Mechanical envelope coercion. Frame only, same classes as
 * normalizePairBatch and for the same measured reason: the recorded
 * v9 failures were envelope shape while the content underneath was
 * sound. Handles a bare array, an echoed `type` field, a keyed-object
 * envelope keyed by id, and a copy array under the payload's key name
 * (`nodes` / `edges`) instead of the schema's (`node_copy` /
 * `edge_copy`).
 *
 * Never touches content: it does not write a heading, complete a
 * gloss, shorten a sentence, or drop a row it does not understand.
 *
 * @param {unknown} value
 * @returns {{ value: unknown; coerced: string[] }}
 */
export function normalizeRealize(value) {
  /** @type {string[]} */
  const coerced = [];
  if (!isRecord(value)) {
    if (Array.isArray(value)) {
      coerced.push("bare array wrapped as {node_copy}");
      return { value: { node_copy: value, edge_copy: [] }, coerced };
    }
    return { value, coerced };
  }
  const out = { ...value };
  if ("type" in out) {
    delete out.type;
    coerced.push("dropped the echoed type field");
  }
  for (const [payloadKey, schemaKey] of [
    ["nodes", "node_copy"],
    ["edges", "edge_copy"],
  ]) {
    if (Array.isArray(out[payloadKey]) && out[schemaKey] === undefined) {
      out[schemaKey] = out[payloadKey];
      delete out[payloadKey];
      coerced.push(`renamed envelope key "${payloadKey}" to "${schemaKey}"`);
    }
  }
  // Keyed-object envelope: ids as keys, bodies as values.
  for (const key of ["node_copy", "edge_copy"]) {
    const value = out[key];
    if (!isRecord(value)) continue;
    const keys = Object.keys(value);
    if (keys.length === 0) continue;
    if (keys.every((id) => isRecord(value[id]))) {
      out[key] = keys.map((id) => ({ id, ...value[id] }));
      coerced.push(`keyed-object envelope for ${key} lifted to an array`);
    }
  }
  // A repeated id is a repetition defect, not several judgments. The
  // measured case (2026-09-29, battery) was one edge id answered four
  // times with four rewordings of the same warrant. Only collapses rows
  // that are byte-identical, so two genuinely different answers to the
  // same id still reach the gate and fail it: picking between them would
  // be choosing the content, which is the model's job and not code's.
  for (const key of ["node_copy", "edge_copy"]) {
    if (!Array.isArray(out[key])) continue;
    const seen = new Set();
    const kept = [];
    let collapsed = 0;
    for (const row of out[key]) {
      const signature = JSON.stringify(row);
      if (seen.has(signature)) {
        collapsed += 1;
        continue;
      }
      seen.add(signature);
      kept.push(row);
    }
    if (collapsed > 0) {
      out[key] = kept;
      coerced.push(`dropped ${collapsed} byte-identical repeat${collapsed === 1 ? "" : "s"} from ${key}`);
    }
  }
  return { value: out, coerced };
}

/**
 * The authoritative gate. Runs after normalizeRealize and decides
 * everything the coercion is not allowed to.
 *
 * Three things must hold:
 *
 * 1. Exact coverage. Every selected node and every selected edge has
 *    exactly one copy entry. A missing entry is a failure, not a card
 *    with a blank face.
 * 2. No invented ids. An id the selection did not contain means the
 *    model started choosing structure, which is r2's job.
 * 3. The copy is learner-facing. Length caps, a minimum substance, and
 *    the shared sentence rules from docs/ste.md.
 *
 * @param {unknown} value
 * @param {RealizeNodeInput[]} nodes
 * @param {RealizeEdgeInput[]} edges
 * @returns {string[]}
 */
export function realizeProblems(value, nodes, edges) {
  if (!isRecord(value)) return ["realize reply must be an object"];
  const errors = [];
  for (const key of Object.keys(value)) {
    if (key !== "concept" && key !== "node_copy" && key !== "edge_copy") {
      errors.push(`realize reply has unexpected top-level field "${key}"`);
    }
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  errors.push(...copyProblems(value.node_copy, nodeIds, "node_copy", NODE_FIELDS, {
    heading: HEADING_CAP,
    gloss: GLOSS_CAP,
  }));
  errors.push(...copyProblems(value.edge_copy, edgeIds, "edge_copy", EDGE_FIELDS, {
    because: BECAUSE_CAP,
  }));
  return errors;
}

/**
 * @param {unknown} rows
 * @param {Set<string>} allowed
 * @param {string} where
 * @param {string[]} fields
 * @param {Record<string, number>} caps
 * @returns {string[]}
 */
function copyProblems(rows, allowed, where, fields, caps) {
  if (!Array.isArray(rows)) return [`realize reply must contain a ${where} array`];
  const errors = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const at = `${where} ${index + 1}`;
    if (!isRecord(row)) {
      errors.push(`${at} must be an object`);
      return;
    }
    for (const key of Object.keys(row)) {
      if (!fields.includes(key)) errors.push(`${at} has unexpected field "${key}"`);
    }
    for (const field of fields) {
      if (!(field in row)) errors.push(`${at} is missing "${field}"`);
    }
    const id = row.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`${at} needs a non-empty id`);
      return;
    }
    if (!allowed.has(id)) {
      errors.push(
        `${at} names id "${id}", which topology did not select. Realization writes copy for the selected shape; it does not choose the shape.`
      );
    }
    if (seen.has(id)) errors.push(`${where} has a duplicate entry for id "${id}"`);
    seen.add(id);
    for (const [field, cap] of Object.entries(caps)) {
      const text = row[field];
      if (typeof text !== "string" || text.trim().length === 0) {
        errors.push(`${at}.${field} must be a non-empty string`);
        continue;
      }
      if (text.length > /** @type {number} */ (cap)) {
        errors.push(`${at}.${field} exceeds ${cap} characters`);
      }
      if (field !== "heading" && text.trim().split(/\s+/).length < MIN_SENTENCE_WORDS) {
        errors.push(`${at}.${field} is too short to be learner-facing copy`);
      }
      const ste = steProblems(text);
      for (const problem of ste.errors) errors.push(`${at}.${field} ${problem}`);
    }
  });
  for (const id of allowed) {
    if (!seen.has(id)) errors.push(`${where} is missing copy for selected id "${id}"`);
  }
  return errors;
}

/**
 * The learner-facing tree, assembled from copy that passed the gate.
 * Structure comes from the selection argument unchanged; nothing here
 * can add or move a node or an edge.
 *
 * @param {RealizeNodeInput[]} nodes
 * @param {RealizeEdgeInput[]} edges
 * @param {Record<string, unknown>} value - a reply that passed realizeProblems.
 * @returns {{ cards: Array<{ id: string; heading: string; gloss: string }>; warrants: Array<{ id: string; because: string }> }}
 */
export function realizeTree(nodes, edges, value) {
  const nodeRows = isRecord(value) && Array.isArray(value.node_copy) ? value.node_copy : [];
  const edgeRows = isRecord(value) && Array.isArray(value.edge_copy) ? value.edge_copy : [];
  return {
    cards: nodes.map((node) => {
      const row = nodeRows.find((entry) => isRecord(entry) && entry.id === node.id);
      return {
        id: node.id,
        heading: String(isRecord(row) ? row.heading : ""),
        gloss: String(isRecord(row) ? row.gloss : ""),
      };
    }),
    warrants: edges.map((edge) => {
      const row = edgeRows.find((entry) => isRecord(entry) && entry.id === edge.id);
      return { id: edge.id, because: String(isRecord(row) ? row.because : "") };
    }),
  };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
