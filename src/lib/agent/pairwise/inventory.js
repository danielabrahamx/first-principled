/**
 * Ticket v9-01: candidate inventory contract for the pairwise generator.
 *
 * One LLM call turns the typed concept into an unordered set of candidate
 * concepts that may be directly necessary to understand the target. Code
 * supplies the target itself; the model never emits edges, ranks, layers,
 * trunk, crown, history, dates, or ordering claims.
 */

export const MIN_CANDIDATES = 8;
export const MAX_CANDIDATES = 10;

const FOUNDATION_FITS = new Set(["DEMONSTRABLE", "ABSTRACT"]);
const ITEM_FIELDS = ["id", "label", "gloss", "kind", "foundation_fit"];
const LABEL_CAP = 120;
const GLOSS_CAP = 300;
const KIND_CAP = 80;
const ID_CAP = 64;

/**
 * Ticket v9-02 rewrote the first paragraph. The Ticket 01 wording asked
 * for "concepts that may be directly necessary to understand the
 * requested target", and "directly" is what produced a one-level set:
 * on the 2026-09-29 laptop run every one of the 10 candidates was judged
 * a direct prerequisite of the target, zero were prerequisites of each
 * other, and the longest walk was 3 nodes.
 *
 * A stronger version that demanded "at least three concepts that some
 * other concept in your own list rests on" was measured and reverted in
 * the same session: it made the inventory more demanding, and the
 * judgment stage answered by refusing more pairs. laptop fell to 2
 * accepted edges out of 55. Do not escalate the demand in the prompt;
 * the remaining gap is a judgment-sparsity question, and it is recorded
 * in `.scratch/first-principled-v9/research/02-realization-evidence.md`.
 * The rest of the prompt is unchanged.
 *
 * @returns {string}
 */
export function buildInventorySystemPrompt() {
  return `Name an unordered set of concepts that a learner would need in
order to understand the requested target at a curious-adult teaching
granularity.

The set must span several levels of depth, not one. Include some
concepts the target directly rests on, and also concepts that those
concepts in turn rest on, down to foundations a learner can point at
or run. A set of peers that all sit at the same distance from the
target is the wrong answer: it has no foundation to walk down to.

Return JSON only with concept and candidates. Each candidate has id,
label, gloss, kind, and foundation_fit. id is an opaque unique key such
as k1, k2. label is a concrete study or search target, not a field
heading, era, person, event, question, or teaching instruction. gloss is
one short sentence saying what the concept is. kind is a short
knowledge-kind caption such as physical behavior, material mechanism,
cell process, computation rule, or software mechanism. foundation_fit is
DEMONSTRABLE when the learner could point to, measure, execute, or
directly observe an instance or behavior, else ABSTRACT.

List 8 to 10 candidates. Do not include the typed concept itself. Do not
emit edges, ranks, layers, trunk, crown, history, dates, discoverers,
chronology, or ordering claims. Array order has no meaning.`;
}

/**
 * User payload for the inventory call. The concept travels verbatim.
 *
 * @param {string} concept
 * @returns {{ concept: string }}
 */
export function buildInventoryUserPayload(concept) {
  return { concept };
}

/**
 * Validate the inventory reply. Mechanical only: shape, counts,
 * uniqueness, caps. Never normalizes semantics or invents fields.
 *
 * @param {unknown} value
 * @param {string} concept
 * @returns {string[]}
 */
export function inventoryProblems(value, concept) {
  if (!isRecord(value)) return ["inventory reply must be an object"];
  const errors = [];
  const topKeys = Object.keys(value);
  for (const key of topKeys) {
    if (key !== "concept" && key !== "candidates") {
      errors.push(`inventory has unexpected top-level field "${key}"`);
    }
  }
  if (value.concept !== concept) errors.push("inventory concept must match the request");
  if (!Array.isArray(value.candidates)) {
    return [...errors, "inventory reply must contain a candidates array"];
  }
  const candidates = value.candidates;
  if (candidates.length < MIN_CANDIDATES || candidates.length > MAX_CANDIDATES) {
    errors.push(
      `inventory must hold ${MIN_CANDIDATES} to ${MAX_CANDIDATES} candidates, got ${candidates.length}`
    );
  }
  const seenIds = new Set();
  const seenLabels = new Set();
  const targetLabel = normalizeLabel(concept);
  candidates.forEach((item, index) => {
    const where = `candidate ${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`${where} must be an object`);
      return;
    }
    for (const key of Object.keys(item)) {
      if (!ITEM_FIELDS.includes(key)) errors.push(`${where} has unexpected field "${key}"`);
    }
    for (const field of ITEM_FIELDS) {
      if (!(field in item)) errors.push(`${where} is missing "${field}"`);
    }
    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      errors.push(`${where}.id must be a non-empty string`);
    } else {
      if (item.id.length > ID_CAP) errors.push(`${where}.id exceeds ${ID_CAP} characters`);
      if (seenIds.has(item.id)) errors.push(`duplicate candidate id "${item.id}"`);
      seenIds.add(item.id);
    }
    if (typeof item.label !== "string" || item.label.trim().length === 0) {
      errors.push(`${where}.label must be a non-empty string`);
    } else {
      if (item.label.length > LABEL_CAP) errors.push(`${where}.label exceeds ${LABEL_CAP} characters`);
      const normalized = normalizeLabel(item.label);
      if (seenLabels.has(normalized)) errors.push(`duplicate candidate label "${item.label}"`);
      seenLabels.add(normalized);
      if (normalized === targetLabel) errors.push(`${where} duplicates the typed target`);
    }
    if (typeof item.gloss !== "string" || item.gloss.trim().length === 0) {
      errors.push(`${where}.gloss must be a non-empty string`);
    } else if (item.gloss.length > GLOSS_CAP) {
      errors.push(`${where}.gloss exceeds ${GLOSS_CAP} characters`);
    }
    if (typeof item.kind !== "string" || item.kind.trim().length === 0) {
      errors.push(`${where}.kind must be a non-empty string`);
    } else if (item.kind.length > KIND_CAP) {
      errors.push(`${where}.kind exceeds ${KIND_CAP} characters`);
    }
    if (!FOUNDATION_FITS.has(item.foundation_fit)) {
      errors.push(`${where}.foundation_fit must be DEMONSTRABLE or ABSTRACT`);
    }
  });
  return errors;
}

/**
 * JSON Schema for constrained inventory decoding. Strict subset: no
 * `const`, `pattern`, or `allOf`/`if`/`then`. Semantic rules stay in
 * inventoryProblems; code validation remains authoritative because some
 * routes treat schemas as hints.
 *
 * @param {string} concept
 * @returns {{ name: string; strict: true; schema: Record<string, any> }}
 */
export function buildInventoryJsonSchema(concept) {
  return {
    name: "inventory",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concept: { type: "string", enum: [concept] },
        candidates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              gloss: { type: "string" },
              kind: { type: "string" },
              foundation_fit: { type: "string", enum: [...FOUNDATION_FITS] },
            },
            required: ["id", "label", "gloss", "kind", "foundation_fit"],
          },
        },
      },
      required: ["concept", "candidates"],
    },
  };
}

/**
 * Normalize a label for duplicate comparison: lowercase, strip
 * punctuation, collapse whitespace.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
