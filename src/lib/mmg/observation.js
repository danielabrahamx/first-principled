/**
 * The observation record: the real-history record every node carries as its
 * `basis` (ticket 02, the crux decision), validated against the fail-honest
 * contract (ticket 09, research/09-fail-honest-contract.md section 2).
 *
 * An observation is REAL discovery history - the discovery, measurement,
 * experiment, or theoretical result the abstraction compresses - never a
 * rational reconstruction. Every fact field carries a mark:
 *
 * - EXACT: a single well-documented value (person, year).
 * - APPROXIMATE: the record itself is low resolution or contested (a decade,
 *   multiple claimants, a convention with no primary source).
 * - UNKNOWN: no defensible value exists. UNKNOWN is a legal, first-class
 *   state, not an error: the node exists, its observation is missing, the
 *   layer chain is unbroken. The value field is then dropped - writing a
 *   value under an UNKNOWN mark would be an invented placeholder.
 *
 * This module is the single definition of "valid record", shared by the
 * generator's deriveCheck (the repair-loop gate), the schema validator, and
 * the live verification script - one rule set rules all three.
 */

/**
 * The three honesty marks (contract section 2). A value with mark UNKNOWN is
 * dropped at validation; the node keeps its gap.
 *
 * @type {readonly ["EXACT", "APPROXIMATE", "UNKNOWN"]}
 */
export const OBSERVATION_MARKS = Object.freeze([
  "EXACT",
  "APPROXIMATE",
  "UNKNOWN",
]);

/**
 * The record-level confidence. Distinct from the per-field marks: the model's
 * own estimate of how sure it is about the record as a whole.
 *
 * @type {readonly ["high", "medium", "low"]}
 */
export const OBSERVATION_CONFIDENCE = Object.freeze(["high", "medium", "low"]);

/**
 * Problems of one fact field (value + mark). Empty array means the field is
 * valid. The fail-honest rules: the mark must be from the enum; a non-UNKNOWN
 * mark requires a non-empty value; an UNKNOWN mark requires the value to be
 * dropped (contract rule 5 - a value under an UNKNOWN mark is an invented
 * placeholder, never acceptable).
 *
 * @param {unknown} field
 * @param {string} name - the field name for error messages.
 * @returns {string[]}
 */
function fieldProblems(field, name) {
  const errors = /** @type {string[]} */ ([]);
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    errors.push(`${name} must be an object with a value and a mark`);
    return errors;
  }
  const f = /** @type {any} */ (field);
  if (!OBSERVATION_MARKS.includes(f.mark)) {
    errors.push(`${name}.mark must be one of EXACT, APPROXIMATE, UNKNOWN`);
  }
  if (f.mark === "UNKNOWN") {
    if (typeof f.value === "string" && f.value.trim().length > 0) {
      errors.push(
        `${name} is marked UNKNOWN but carries a value - never invent a placeholder`
      );
    }
  } else if (typeof f.value !== "string" || f.value.trim().length === 0) {
    errors.push(`${name} must carry a non-empty value`);
  }
  return errors;
}

/**
 * Problems of a whole observation record (contract section 2): the three
 * marked fields, the confidence enum, and the note string. Empty array means
 * the record is valid. A node whose record is valid may still be UNKNOWN in
 * whole or part - that is legal; only a structurally broken record is not.
 *
 * @param {unknown} record
 * @returns {string[]}
 */
export function observationProblems(record) {
  const errors = /** @type {string[]} */ ([]);
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return [
      "must be an observation record with discoverer, date, keyObservation, confidence and note",
    ];
  }
  const r = /** @type {any} */ (record);
  errors.push(...fieldProblems(r.discoverer, "discoverer"));
  errors.push(...fieldProblems(r.date, "date"));
  errors.push(...fieldProblems(r.keyObservation, "keyObservation"));
  if (!OBSERVATION_CONFIDENCE.includes(r.confidence)) {
    errors.push("confidence must be one of high, medium, low");
  }
  if (typeof r.note !== "string") {
    errors.push("note must be a string");
  }
  return errors;
}

/**
 * Whether a value is a valid observation record.
 *
 * @param {unknown} record
 * @returns {boolean}
 */
export function isObservationRecord(record) {
  return observationProblems(record).length === 0;
}

/**
 * The contract's "a value with mark UNKNOWN is dropped at validation" (rule
 * 5), implemented as the generator's mechanical cleanup: returns a copy of
 * the record with every UNKNOWN-marked field's value emptied. The model
 * occasionally writes a hedge value under an UNKNOWN mark; the value never
 * surfaces - the node keeps its visible gap. Raw records that still carry a
 * value under an UNKNOWN mark stay invalid (observationProblems rejects
 * them); the generator normalizes before validation, so the final map only
 * ever contains dropped values.
 *
 * @param {unknown} record
 * @returns {unknown} the record unchanged when it is not an object; a copy
 *   with UNKNOWN values dropped otherwise.
 */
export function dropUnknownValues(record) {
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return record;
  }
  const r = /** @type {any} */ (record);
  const next = { ...r };
  for (const field of ["discoverer", "date", "keyObservation"]) {
    const f = r[field];
    if (f !== null && typeof f === "object" && !Array.isArray(f) && f.mark === "UNKNOWN") {
      next[field] = { ...f, value: "" };
    }
  }
  return next;
}
