/**
 * Gap selection in deterministic code (ticket 01).
 *
 * The v1 question strategy was one line in the system prompt ("probe the
 * biggest gap in dependency order - lower layers before abstractions; within
 * the lowest affected layer, misconception over missing over untested"). The
 * codebase's own philosophy (v1 ticket 05) is that code owns the hard,
 * countable rules and the model owns semantics - gap choice is a countable
 * rule, so it moves here.
 *
 * nextGaps returns the ordered candidate gaps and the forced target for this
 * turn. The Socratic user prompt sends this gap report instead of dumping
 * both full maps, which was the v1 latency and drift source (measured
 * 8.5-14.3s per turn; the eval harness records the probe-prompt size).
 *
 * Outranking: a briefing request or a due explanation is not a probing turn
 * at all - nextGaps reports mode "deferred" and the caller runs that
 * directive instead (buildDirective already does).
 *
 * Ticket 04: the prediction move (principle 2 - models are judged by
 * predictive usefulness). When the lowest affected layer contains a node
 * with a STATED belief (misconception or missing WITH evidence) and no
 * observed outcome, nextGaps reports mode "predict" targeting it: the tutor
 * asks what the learner predicts would happen, turning the belief into a
 * testable hypothesis. Unstated nodes cannot be predicted, and prediction
 * never jumps layers - dependency order still rules (a stated belief in a
 * higher layer does not outrank an untested foundation).
 *
 * Ticket 02 (taxonomy): the confront move. A misconception that sits on top
 * of the learner's OWN correct foundation is the sharpest teachable moment:
 * they hold the observation (the correct lower layer) and a claim that
 * contradicts it at once. nextGaps reports mode "confront" - the tutor asks
 * them to hold both together and see the collision themselves, rather than
 * predicting an outcome (predict) or filling a gap (probe). Confront
 * outranks predict and plain gap probes within the same lowest layer;
 * dependency order still rules across layers.
 */

/**
 * @typedef {import("../mmg/types.js").RealityMap} RealityMap
 * @typedef {import("../mmg/types.js").LearnerMentalModel} LearnerMentalModel
 */

/**
 * One ordered gap candidate.
 *
 * @typedef {object} GapCandidate
 * @property {string} nodeId
 * @property {string} label
 * @property {string} layerId
 * @property {string} layerName
 * @property {number} layerIndex - position in realityMap.layers (0 = foundation).
 * @property {"misconception" | "missing" | "untested"} state
 * @property {string} reason - human-readable why this node is a gap.
 */

/**
 * The gap-selection result for one turn.
 *
 * @typedef {object} GapPlan
 * @property {"deferred" | "observe" | "gap" | "predict" | "confront"} mode
 * @property {string} reason - why this mode: "briefing", "explanation due",
 *   "nothing known yet", "prediction-testable belief", or "gap-first".
 * @property {GapCandidate[]} candidates - ordered gaps; empty for observe
 *   and deferred.
 * @property {GapCandidate | null} target - the forced top candidate for a
 *   gap or predict turn, null otherwise.
 */

/**
 * @param {string} state
 * @returns {number}
 */
function statePriority(state) {
  // misconception (0) outranks missing (1) outranks untested (2)
  switch (state) {
    case "misconception":
      return 0;
    case "missing":
      return 1;
    default:
      return 2;
  }
}

/**
 * The ordered candidate gaps: every reality node that is not correct, sorted
 * by dependency order - lowest layer first, then misconception > missing >
 * untested, then stable map order. Pure and deterministic.
 *
 * @param {RealityMap} realityMap
 * @param {LearnerMentalModel} learnerMap
 * @returns {GapCandidate[]}
 */
export function orderedGaps(realityMap, learnerMap) {
  const stateById = new Map(learnerMap.nodes.map((node) => [node.id, node.state]));
  const layerIndex = new Map(realityMap.layers.map((layer, i) => [layer.id, i]));
  const layerName = new Map(realityMap.layers.map((layer) => [layer.id, layer.name]));
  /** @type {GapCandidate[]} */
  const candidates = [];
  for (const node of realityMap.nodes) {
    const state = stateById.get(node.id) ?? "untested";
    if (state === "correct") continue;
    const index = layerIndex.get(node.layer);
    candidates.push({
      nodeId: node.id,
      label: node.label,
      layerId: node.layer,
      layerName: layerName.get(node.layer) ?? "",
      layerIndex: index === undefined ? Number.MAX_SAFE_INTEGER : index,
      state: /** @type {GapCandidate["state"]} */ (state),
      reason: state,
    });
  }
  candidates.sort(
    (a, b) =>
      a.layerIndex - b.layerIndex ||
      statePriority(a.state) - statePriority(b.state) ||
      // stable: keep the map's node order within a layer/state
      realityMap.nodes.findIndex((node) => node.id === a.nodeId) -
        realityMap.nodes.findIndex((node) => node.id === b.nodeId)
  );
  return candidates;
}

/**
 * Whether anything is known about the learner's model (the opening rule,
 * principle 1): gap-first probing once anything is known, observation-first
 * when the model is empty. Mirrors conversationMode in socratic.js; defined
 * here so gap selection owns the whole decision.
 *
 * @param {LearnerMentalModel} learnerMap
 * @returns {boolean}
 */
export function hasKnownModel(learnerMap) {
  return learnerMap.nodes.some((node) => node.state !== "untested");
}

/**
 * Whether a node carries a stated belief - evidence without a tested
 * outcome (ticket 04). Untested nodes have no statement by definition;
 * correct nodes have already been tested against reality.
 *
 * @param {LearnerMentalModel} learnerMap
 * @param {string} nodeId
 * @returns {boolean}
 */
function hasStatedBelief(learnerMap, nodeId) {
  const node = learnerMap.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return false;
  if (node.state === "untested" || node.state === "correct") return false;
  return Array.isArray(node.evidence) && node.evidence.length > 0;
}

/**
 * Whether any node in a strictly lower layer than the given one is correct -
 * the learner holds a sound foundation beneath the candidate (the confront
 * precondition, ticket 02).
 *
 * @param {RealityMap} realityMap
 * @param {LearnerMentalModel} learnerMap
 * @param {number} layerIndex
 * @returns {boolean}
 */
function hasCorrectFoundationBelow(realityMap, learnerMap, layerIndex) {
  const layerIndexById = new Map(realityMap.layers.map((layer, i) => [layer.id, i]));
  const stateById = new Map(learnerMap.nodes.map((node) => [node.id, node.state]));
  return realityMap.nodes.some((node) => {
    const index = layerIndexById.get(node.layer);
    return index !== undefined && index < layerIndex && stateById.get(node.id) === "correct";
  });
}

/**
 * The plan for this turn: what to probe, in what order, and whether the move
 * is a confrontation (ticket 02), a prediction (ticket 04) or a plain gap
 * probe.
 *
 * Move precedence within the lowest affected layer: confront > predict >
 * gap. Confront: a stated misconception sitting on the learner's own correct
 * foundation - hold the claim against what they already know. Predict: any
 * other stated belief with no tested outcome - commit to what would happen.
 * Gap: everything else, dependency order.
 *
 * @param {{ realityMap: RealityMap; learnerMap: LearnerMentalModel; briefing?: boolean; explainDue?: boolean }} input
 * @returns {GapPlan}
 */
export function nextGaps({ realityMap, learnerMap, briefing = false, explainDue = false }) {
  if (briefing) {
    return { mode: "deferred", reason: "briefing", candidates: [], target: null };
  }
  if (explainDue) {
    return { mode: "deferred", reason: "explanation due", candidates: [], target: null };
  }
  if (!hasKnownModel(learnerMap)) {
    return { mode: "observe", reason: "nothing known yet", candidates: [], target: null };
  }
  const candidates = orderedGaps(realityMap, learnerMap);
  if (candidates.length === 0) {
    return { mode: "observe", reason: "no gaps left", candidates: [], target: null };
  }
  const lowestLayer = candidates[0].layerIndex;
  // Confront (ticket 02): a stated misconception directly on top of the
  // learner's own correct foundation - the collision is the lesson.
  const confront = candidates.find(
    (candidate) =>
      candidate.layerIndex === lowestLayer &&
      candidate.state === "misconception" &&
      hasStatedBelief(learnerMap, candidate.nodeId) &&
      hasCorrectFoundationBelow(realityMap, learnerMap, lowestLayer)
  );
  if (confront !== undefined) {
    return {
      mode: "confront",
      reason: "misconception collides with the learner's own correct foundation",
      candidates,
      target: confront,
    };
  }
  // Prediction move (principle 2): within the lowest affected layer, a node
  // with a stated belief and no observed outcome ranks up into a predict
  // turn - the tutor asks the learner to commit to what would happen.
  const stated = candidates.find(
    (candidate) =>
      candidate.layerIndex === lowestLayer && hasStatedBelief(learnerMap, candidate.nodeId)
  );
  if (stated !== undefined) {
    return {
      mode: "predict",
      reason: "prediction-testable belief",
      candidates,
      target: stated,
    };
  }
  return { mode: "gap", reason: "gap-first", candidates, target: candidates[0] };
}
