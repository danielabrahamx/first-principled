/**
 * Confidence anchoring (ticket 05): the operational definition of a learner
 * node's confidence 0..1, so it is not whatever number the model felt like.
 *
 * Confidence is anchored to the two things the engine can count and the
 * learner's own words: how many independent observations (evidence quotes)
 * the state is based on, and the state's own semantics:
 *
 * - Evidence bands (countable, code-owned): 0 quotes = 0.0-0.2 (guess),
 *   1 = 0.3-0.6 (one observation), 2 = 0.5-0.8 (consistent), 3+ = 0.7-0.95
 *   (multiple independent observations).
 * - State guards (semantic, code-owned): untested never above 0.2, missing
 *   never above 0.4, a misconception never above 0.7, a correct node never
 *   below 0.5 - so a flip from misconception to correct moves confidence
 *   meaningfully.
 *
 * The model assigns confidence within these bands (the system prompt states
 * them); anchorConfidence gently snaps a value that landed far outside the
 * intersection of its evidence band and state guard. Small deviations are
 * left alone - the model's read of verbal confidence is real signal.
 *
 * The schema is unchanged: confidence stays 0..1 (spec section 7).
 */

/**
 * @typedef {import("../mmg/types.js").LearnerMentalModel} LearnerMentalModel
 * @typedef {import("../mmg/types.js").NodeState} NodeState
 */

/** How far outside the band a value must be before it is snapped. */
export const SNAP_TOLERANCE = 0.15;

/**
 * The evidence band for a number of quotes. Pure.
 *
 * @param {number} evidenceCount
 * @returns {{ min: number; max: number }}
 */
export function evidenceBand(evidenceCount) {
  if (evidenceCount <= 0) return { min: 0, max: 0.2 };
  if (evidenceCount === 1) return { min: 0.3, max: 0.6 };
  if (evidenceCount === 2) return { min: 0.5, max: 0.8 };
  return { min: 0.7, max: 0.95 };
}

/**
 * The confidence guard for a state. Pure.
 *
 * @param {NodeState} state
 * @returns {{ min: number; max: number }}
 */
export function stateGuard(state) {
  switch (state) {
    case "untested":
      return { min: 0, max: 0.2 };
    case "missing":
      return { min: 0, max: 0.4 };
    case "misconception":
      return { min: 0.1, max: 0.7 };
    case "correct":
      return { min: 0.5, max: 0.95 };
    default:
      return { min: 0, max: 1 };
  }
}

/**
 * The anchored confidence for one node: the model's value clamped into the
 * intersection of its evidence band and state guard, returned only when the
 * model's value was far enough outside to matter.
 *
 * @param {number} value - the model-assigned confidence.
 * @param {NodeState} state
 * @param {number} evidenceCount
 * @returns {number | null} the anchored value, or null when no snap is due.
 */
export function anchoredConfidence(value, state, evidenceCount) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const evidence = evidenceBand(evidenceCount);
  const guard = stateGuard(state);
  const min = Math.max(evidence.min, guard.min);
  const max = Math.min(evidence.max, guard.max);
  const clamped = Math.min(max, Math.max(min, value));
  if (Math.abs(clamped - value) > SNAP_TOLERANCE) {
    return Math.round(clamped * 100) / 100;
  }
  return null;
}

/**
 * The suggested confidence for a node from its state and evidence alone - the
 * midpoint of the intersection. Useful for tests and for nodes the model
 * leaves without a meaningful value.
 *
 * @param {NodeState} state
 * @param {number} evidenceCount
 * @returns {number}
 */
export function suggestedConfidence(state, evidenceCount) {
  const evidence = evidenceBand(evidenceCount);
  const guard = stateGuard(state);
  const min = Math.max(evidence.min, guard.min);
  const max = Math.min(evidence.max, guard.max);
  return Math.round(((min + max) / 2) * 100) / 100;
}

/**
 * The post-turn anchor: for every learner node that changed this turn, snap
 * the model's confidence into its band/guard intersection when it landed far
 * outside. Pure; returns a new map only when something changed.
 *
 * @param {LearnerMentalModel} prev
 * @param {LearnerMentalModel} next
 * @returns {LearnerMentalModel}
 */
export function anchorConfidence(prev, next) {
  const prevById = new Map(prev.nodes.map((node) => [node.id, node]));
  let changed = false;
  const nodes = next.nodes.map((node) => {
    const prior = prevById.get(node.id);
    const sameState = prior !== undefined && prior.state === node.state;
    const sameEvidence =
      prior !== undefined &&
      prior.evidence.length === node.evidence.length &&
      prior.evidence.every((quote, i) => quote === node.evidence[i]);
    if (sameState && sameEvidence && prior.confidence === node.confidence) {
      return node;
    }
    const anchor = anchoredConfidence(node.confidence, node.state, node.evidence.length);
    if (anchor === null) return node;
    changed = true;
    return { ...node, confidence: anchor };
  });
  return changed ? { nodes, edges: next.edges } : next;
}

/**
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @returns {boolean}
 */
function sameEvidenceList(a, b) {
  return a.length === b.length && a.every((quote, i) => quote === b[i]);
}

/**
 * Whether a node was touched this turn (state, evidence or confidence
 * changed) - the set anchorConfidence operates on.
 *
 * @param {LearnerMentalModel} prev
 * @param {LearnerMentalModel} next
 * @param {string} nodeId
 * @returns {boolean}
 */
export function nodeChanged(prev, next, nodeId) {
  const prior = prev.nodes.find((node) => node.id === nodeId);
  const current = next.nodes.find((node) => node.id === nodeId);
  if (prior === undefined || current === undefined) return prior !== current;
  return (
    prior.state !== current.state ||
    prior.confidence !== current.confidence ||
    !sameEvidenceList(prior.evidence, current.evidence)
  );
}
