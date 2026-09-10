/**
 * Ticket v9-01: local Dependence judgment contract for the pairwise
 * generator.
 *
 * Each batch call judges explicit independent pairs against one local
 * semantic question: does A rest on B, B rest on A, neither, or are they
 * the same concept. The model never emits nodes, layers, trunk, crown,
 * provenance, or layout. Rationale supports only the local judgment.
 */

export const RELATIONS = new Set(["A_RESTS_ON_B", "B_RESTS_ON_A", "NONE", "SAME_CONCEPT"]);
export const CONFIDENCES = new Set(["HIGH", "MEDIUM", "LOW"]);
export const JUMPS = new Set(["SMALL", "TOO_LARGE", "NOT_APPLICABLE"]);

const JUDGMENT_FIELDS = ["pair_id", "relation", "confidence", "jump", "rationale"];
const RATIONALE_CAP = 500;
// Rationale must judge the pair, not its presentation. Ban position and
// chronology talk; the dependence definition is the only vocabulary.
const BANNED_RATIONALE = /(input order|list position|position in|first in the list|earlier in the list|chronolog|came before|led to|discovered first)/i;

/**
 * Locked Ticket 01 pair-batch system prompt.
 *
 * @returns {string}
 */
export function buildPairBatchSystemPrompt() {
  return `Judge explicit pairs of concepts for a Dependence relation.
Dependence: A rests on B only when A cannot exist or be understood
without B at a curious-adult teaching granularity. Earlier, related,
useful, component-adjacent, historically prior, or merely explanatory
is NONE, not Dependence.

Return JSON only with judgments. Each judgment has pair_id, relation,
confidence, jump, and rationale. relation is A_RESTS_ON_B,
B_RESTS_ON_A, NONE, or SAME_CONCEPT, relative to the pair's A and B as
given. SAME_CONCEPT means the pair is the same abstraction under
different wording. confidence is HIGH, MEDIUM, or LOW. jump is SMALL
when the relation can be walked without an omitted intermediate
concept, TOO_LARGE when the dependency may be directionally true but a
bridge is missing, NOT_APPLICABLE for NONE and SAME_CONCEPT. rationale
is one short machine-facing reason for the local judgment only. Never
mention input position, list order, or chronology. Judge every listed
pair exactly once. Invent no pairs and no candidate ids.`;
}

/**
 * User payload for one pair batch: only explicit pairs with labels and
 * glosses plus the concept for context.
 *
 * @param {string} concept
 * @param {Array<{ pair_id: string; a_id: string; b_id: string }>} pairs
 * @param {Map<string, { id: string; label: string; gloss: string }>} byId
 * @returns {{ concept: string; pairs: Array<{ pair_id: string; a: { id: string; label: string; gloss: string }; b: { id: string; label: string; gloss: string } }> }}
 */
export function buildPairBatchUserPayload(concept, pairs, byId) {
  return {
    concept,
    pairs: pairs.map((pair) => {
      const a = byId.get(pair.a_id);
      const b = byId.get(pair.b_id);
      return {
        pair_id: pair.pair_id,
        a: { id: pair.a_id, label: a ? a.label : pair.a_id, gloss: a ? a.gloss : "" },
        b: { id: pair.b_id, label: b ? b.label : pair.b_id, gloss: b ? b.gloss : "" },
      };
    }),
  };
}

/**
 * Validate one pair batch. Mechanical only. Any missing or malformed
 * batch is a terminal model-output failure: no inference, no repair.
 *
 * @param {unknown} value
 * @param {string[]} expectedPairIds
 * @returns {string[]}
 */
export function pairBatchProblems(value, expectedPairIds) {
  if (!isRecord(value)) return ["pair batch reply must be an object"];
  const errors = [];
  for (const key of Object.keys(value)) {
    if (key !== "judgments" && key !== "concept") {
      errors.push(`pair batch has unexpected top-level field "${key}"`);
    }
  }
  if (!Array.isArray(value.judgments)) {
    return [...errors, "pair batch reply must contain a judgments array"];
  }
  const expected = new Set(expectedPairIds);
  const seen = new Set();
  for (const item of value.judgments) {
    if (!isRecord(item)) {
      errors.push("every judgment must be an object");
      continue;
    }
    for (const key of Object.keys(item)) {
      if (!JUDGMENT_FIELDS.includes(key)) errors.push(`judgment has unexpected field "${key}"`);
    }
    for (const field of JUDGMENT_FIELDS) {
      if (!(field in item)) errors.push(`judgment is missing "${field}"`);
    }
    const pairId = item.pair_id;
    if (typeof pairId !== "string" || pairId.length === 0) {
      errors.push("every judgment needs a non-empty pair_id");
      continue;
    }
    if (!expected.has(pairId)) errors.push(`judgment pair_id "${pairId}" was not requested`);
    if (seen.has(pairId)) errors.push(`duplicate judgment for pair_id "${pairId}"`);
    seen.add(pairId);
    if (!RELATIONS.has(item.relation)) {
      errors.push(`judgment "${pairId}" has invalid relation`);
      continue;
    }
    if (!CONFIDENCES.has(item.confidence)) {
      errors.push(`judgment "${pairId}" has invalid confidence`);
    }
    if (!JUMPS.has(item.jump)) {
      errors.push(`judgment "${pairId}" has invalid jump`);
      continue;
    }
    const directional = item.relation === "A_RESTS_ON_B" || item.relation === "B_RESTS_ON_A";
    if (directional && item.jump !== "SMALL" && item.jump !== "TOO_LARGE") {
      errors.push(`judgment "${pairId}" directional relation needs jump SMALL or TOO_LARGE`);
    }
    if (!directional && item.jump !== "NOT_APPLICABLE") {
      errors.push(`judgment "${pairId}" non-directional relation needs jump NOT_APPLICABLE`);
    }
    if (typeof item.rationale !== "string" || item.rationale.trim().length === 0) {
      errors.push(`judgment "${pairId}" needs a non-empty rationale`);
    } else {
      if (item.rationale.length > RATIONALE_CAP) {
        errors.push(`judgment "${pairId}" rationale exceeds ${RATIONALE_CAP} characters`);
      }
      if (BANNED_RATIONALE.test(item.rationale)) {
        errors.push(`judgment "${pairId}" rationale must not mention position or chronology`);
      }
    }
  }
  for (const id of expected) {
    if (!seen.has(id)) errors.push(`missing judgment for pair_id "${id}"`);
  }
  return errors;
}

/**
 * JSON Schema for one constrained pair-batch decode. Pair ids are
 * restricted to the requested set. Strict subset; code validation in
 * pairBatchProblems remains authoritative.
 *
 * @param {string} concept
 * @param {string[]} pairIds
 * @returns {{ name: string; strict: true; schema: Record<string, any> }}
 */
export function buildPairBatchJsonSchema(concept, pairIds) {
  const pairRef = { type: "string", enum: pairIds };
  return {
    name: "pair_batch",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concept: { type: "string", enum: [concept] },
        judgments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              pair_id: pairRef,
              relation: { type: "string", enum: [...RELATIONS] },
              confidence: { type: "string", enum: [...CONFIDENCES] },
              jump: { type: "string", enum: [...JUMPS] },
              rationale: { type: "string" },
            },
            required: ["pair_id", "relation", "confidence", "jump", "rationale"],
          },
        },
      },
      required: ["concept", "judgments"],
    },
  };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
