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
 * The prompt is unchanged from Ticket 01. An attempt on 2026-09-29 to
 * add a paragraph telling the model the target is not a prerequisite of
 * its own parts was reverted in the same session: recursion's inverted
 * edges were a real observation, but the paragraph pushed the honest
 * per-word call to zero across three of four gold words (tgtOK 0,0,0,5).
 * The real cause of the short trunks is upstream, in the inventory.
 * Do not retry this paragraph without new evidence.
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
 * Mechanical envelope coercion for one pair-batch reply.
 *
 * The recorded live evidence (v9 research 01) is that this stage fails on
 * envelope conformance, not on dependence judgment: across both routes and
 * all four gold words, every terminal failure was one of the shapes below
 * while the underlying relations were judged sensible. These are mechanical
 * corrections - the reply's own content is never changed, only the frame
 * around it, and nothing here infers a relation the model did not state.
 *
 * Handled, each with the live failure it came from:
 * - a bare array of judgment objects with no wrapper (recursion batch 1)
 * - a `type` field echoing the response format alongside `judgments`
 *   (`{"type":"json_object","judgments":[...]}`)
 * - a keyed-object envelope keyed by pair_id instead of an array
 *   (`{"p-k10--k6":{...}}`), which is the same data with ids as keys
 * - newline-delimited judgment objects, one per line (recursion batch 1)
 * - SMALL or TOO_LARGE on a non-directional row, where the jump field has
 *   no referent: NONE and SAME_CONCEPT are not walkable in either
 *   direction, so the only legal value is NOT_APPLICABLE
 * - relation and confidence tokens in free case or with separators
 * - the judgment array under the user payload's key name (`pairs`)
 *   rather than the schema's (`judgments`). From photosynthesis batch 3
 *   on 2026-09-29, after the inventory prompt changed.
 *
 * Deliberately NOT coerced: a missing, unknown, or duplicate pair_id, a
 * rationale that names position or chronology, and unexpected fields. Each
 * of those is a real signal about the judgment itself, and pairBatchProblems
 * stays authoritative over what survives coercion.
 *
 * @param {unknown} value - the parsed reply, or null when nothing parsed.
 * @param {string[]} expectedPairIds
 * @returns {{ value: unknown; coerced: string[] }}
 */
export function normalizePairBatch(value, expectedPairIds) {
  /** @type {string[]} */
  const coerced = [];
  const unwrapped = unwrapJudgmentArray(value, expectedPairIds, coerced);
  if (!Array.isArray(unwrapped)) {
    return { value, coerced };
  }
  const judgments = unwrapped
    .filter((item) => isRecord(item))
    .map((item) => coerceJudgment(item, expectedPairIds, coerced));
  return {
    value: { concept: /** @type {any} */ (isRecord(value) ? value.concept : undefined), judgments },
    coerced,
  };
}

/**
 * Find the judgment array in any of the observed envelopes.
 *
 * @param {unknown} value
 * @param {string[]} expectedPairIds
 * @param {string[]} coerced - mutated with what was changed.
 * @returns {unknown[] | null}
 */
function unwrapJudgmentArray(value, expectedPairIds, coerced) {
  if (Array.isArray(value)) {
    coerced.push("bare array wrapped as {judgments}");
    return value;
  }
  if (!isRecord(value)) return null;

  const keys = Object.keys(value);

  // Keyed-object envelope: every key is a requested pair id and every value
  // is a judgment body. The id lives in the key, so lift it back onto the
  // record. Only applied when the key set actually matches the request, so a
  // genuinely malformed reply still reaches the validator and fails.
  if (typeof value.judgments !== "object" || value.judgments === null) {
    const expected = new Set(expectedPairIds);
    const keyed = keys.filter((key) => expected.has(key));
    if (keys.length > 0 && keyed.length === keys.length) {
      coerced.push("keyed-object envelope lifted to an array");
      return keys.map((key) => {
        const body = value[key];
        return isRecord(body) ? { pair_id: key, ...body } : body;
      });
    }
  }
  if (!Array.isArray(value.judgments)) {
    // Wrong key for the same array. The user payload names the rows
    // `pairs` and the schema names them `judgments`; the model reached
    // for the payload's name. Lifted only when the record holds exactly
    // one array and every row in it carries a string pair_id, so a reply
    // with real content problems still reaches the validator untouched.
    const arrays = keys.filter((key) => Array.isArray(value[key]));
    const looksLikeJudgments = (/** @type {unknown[]} */ rows) =>
      rows.length > 0 &&
      rows.every((row) => isRecord(row) && typeof row.pair_id === "string");
    if (arrays.length === 1 && looksLikeJudgments(value[arrays[0]])) {
      coerced.push(`renamed envelope key "${arrays[0]}" to "judgments"`);
      return value[arrays[0]];
    }
    return null;
  }

  if ("type" in value) {
    coerced.push("dropped the echoed type field");
  }
  return value.judgments;
}

/**
 * Coerce one judgment's enum tokens and its jump-where-NONE mismatch.
 *
 * @param {Record<string, any>} item
 * @param {string[]} expectedPairIds
 * @param {string[]} coerced - mutated with what was changed.
 * @returns {Record<string, any>}
 */
function coerceJudgment(item, expectedPairIds, coerced) {
  const out = { ...item };
  for (const field of ["relation", "confidence", "jump"]) {
    if (typeof out[field] !== "string") continue;
    const token = out[field].trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (token !== out[field]) {
      out[field] = token;
      coerced.push(`canonicalized ${field} to ${token}`);
    }
  }
  // A pair id may be a name rather than the id, or vice versa, when the
  // model re-keys the envelope. Match case-insensitively before giving up.
  if (typeof out.pair_id === "string") {
    const wanted = out.pair_id.trim().toLowerCase();
    const hit = expectedPairIds.find((id) => id.toLowerCase() === wanted);
    if (hit !== undefined && hit !== out.pair_id) {
      coerced.push(`repaired pair_id ${out.pair_id} to ${hit}`);
      out.pair_id = hit;
    }
  }
  const directional =
    out.relation === "A_RESTS_ON_B" || out.relation === "B_RESTS_ON_A";
  if (!directional && (out.jump === "SMALL" || out.jump === "TOO_LARGE")) {
    coerced.push(`set jump to NOT_APPLICABLE on a ${out.relation} row`);
    out.jump = "NOT_APPLICABLE";
  }
  return out;
}

/**
 * Parse a raw pair-batch reply, including the newline-delimited form that
 * JSON.parse rejects. `parseModelJson` returns null for a top-level array by
 * design, so the array and JSONL cases are recovered from the raw text here.
 *
 * @param {string} raw
 * @returns {unknown}
 */
export function parsePairBatchText(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const text = raw.trim();

  const parsed = tryParse(text);
  if (parsed !== undefined) return parsed;

  // Newline-delimited objects: one complete JSON object per line.
  const lines = text
    .split("\n")
    .map((line) => line.trim().replace(/^```(?:json)?$/, "").trim())
    .filter((line) => line.length > 0);
  if (lines.length > 1 && lines.every((line) => line.startsWith("{") || line.startsWith("["))) {
    const objects = [];
    for (const line of lines) {
      const value = tryParse(line);
      if (value === undefined) return null;
      objects.push(value);
    }
    return objects;
  }
  return null;
}

/**
 * @param {string} text
 * @returns {unknown} the parsed value, or undefined when it does not parse.
 */
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Validate one pair batch. Mechanical only. Any missing or malformed
 * batch is a terminal model-output failure: no inference, no repair.
 *
 * Run this AFTER `normalizePairBatch`: normalization fixes the envelope,
 * this is the authority on the judgment.
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
