/**
 * Map page viewmodel: pure functions that turn session state into the
 * map page's visual model, with the no-leak rule enforced here.
 *
 * The map page (ticket 09) may only show the learner's own model: nodes
 * that exist in the learner mental model, colored by their state. Node
 * labels live in the reality map (learner nodes carry only ids), so
 * `learnerCards` joins them - but only for nodes the learner has engaged
 * with, i.e. nodes present in the learner map. Reality-only content -
 * layer names, node descriptions, unengaged node labels - never enters
 * the visual model, so the rendered DOM cannot contain it.
 *
 * Pure and DOM-free so node:test covers the leak rule directly.
 */

/** @typedef {import("../mmg/types.js").NodeState} NodeState */
/** @typedef {import("../mmg/types.js").Diff} Diff */

/**
 * The slice of the session store state the map page reads.
 *
 * @typedef {object} MapState
 * @property {import("../mmg/types.js").RealityMap | null} realityMap
 * @property {import("../mmg/types.js").LearnerMentalModel} learnerMap
 */

/**
 * The four learner states map to one CSS class each; the stylesheet
 * paints the colors (untested gray, missing red, misconception orange,
 * correct green).
 *
 * @param {NodeState} state
 * @returns {string}
 */
export function stateClass(state) {
  return `state-${state}`;
}

/**
 * The card model for every learner node: its label (from the held
 * reality map - safe because the node is already in the learner's model)
 * plus its state, confidence, and evidence.
 *
 * @param {MapState} state - the session store state (ticket 07 shape).
 * @returns {Array<{ id: string; label: string; state: NodeState; confidence: number; evidence: string[] }>}
 */
export function learnerCards(state) {
  const labels = new Map(
    (state.realityMap && Array.isArray(state.realityMap.nodes)
      ? state.realityMap.nodes
      : []
    ).map((node) => [node.id, node.label])
  );
  return state.learnerMap.nodes.map((node) => ({
    id: node.id,
    label: labels.get(node.id) ?? node.id,
    state: node.state,
    confidence: node.confidence,
    evidence: node.evidence,
  }));
}

/**
 * The edge model for the learner's edges. Edge endpoints reference node
 * ids only - no reality content.
 *
 * @param {MapState} state - the session store state.
 * @returns {Array<{ source: string; target: string; state: NodeState; confidence: number; evidence: string[] }>}
 */
export function learnerEdges(state) {
  return state.learnerMap.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    state: edge.state,
    confidence: edge.confidence,
    evidence: edge.evidence,
  }));
}

/**
 * What a turn's diff says about one node: whether it appeared this turn,
 * whether its state flipped (and from what to what), and whether its
 * evidence or confidence changed. Drives the per-turn animation. Accepts
 * null or undefined (a missing or empty diff means no changes).
 *
 * @param {Diff | null | undefined} diff - the store's lastDiff, or null.
 * @param {string} id
 * @returns {{ added: boolean; flipped: { from: NodeState; to: NodeState } | null; updated: boolean }}
 */
export function nodeDelta(diff, id) {
  if (diff === null || diff === undefined || typeof diff !== "object") {
    return { added: false, flipped: null, updated: false };
  }
  const added = Array.isArray(diff.added) && diff.added.includes(id);
  const updated = Array.isArray(diff.updated) && diff.updated.includes(id);
  const found =
    Array.isArray(diff.flipped) &&
    /** @type {Array<{ id: string; from: NodeState; to: NodeState }>} */ (diff.flipped).find(
      (f) => f.id === id
    );
  const flipped = found ? { from: found.from, to: found.to } : null;
  return { added, flipped, updated };
}
