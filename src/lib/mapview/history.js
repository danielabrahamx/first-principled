/**
 * Map-first history viewmodels (tickets 10, 11, 12; v6 ticket 06 retargets
 * the node panel): pure functions that turn the session store into the
 * invitation card, hover trails, layer stories, and timeline snapshots.
 *
 * The data source is the turn ledger (ticket 08): one deep-copied learner
 * map per turn, plus the diff, reply and probe of that turn. Everything
 * here is derived, so the UI never mutates the store and the store never
 * grows beyond the ledger.
 *
 * Node panels show Reality Map ground truth (description, observation,
 * dependence neighbors) plus a rabbit-hole invitation. Learner state stays
 * in the engine. Layer stories still read engagement from the ledger.
 *
 * Pure and DOM-free so node:test covers the shapes directly.
 */

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */
/** @typedef {import("../mmg/types.js").LearnerMentalModel} LearnerMentalModel */
/** @typedef {import("../mmg/types.js").NodeState} NodeState */

import { nodeHistory } from "../../state/session.js";
import { observationOf } from "./observation.js";

/** @typedef {import("./observation.js").ObservationView} ObservationView */
/** @typedef {import("../mmg/types.js").EdgeType} EdgeType */

/** Dependence edges the invitation card lists as neighbors. */
const DEPENDENCE_TYPES = new Set(["built-on", "depends-on", "abstraction-of"]);

/** One line on every node panel: inspect, then go study. Not a chat topic. */
export const RABBIT_HOLE_INVITE =
  "This node is a rabbit hole: a thing to go understand, not a chat topic.";

/**
 * @typedef {object} DependenceNeighbor
 * @property {string} nodeId
 * @property {string} label
 * @property {EdgeType} type
 */

/**
 * The slice of the session store the history views read.
 *
 * @typedef {object} HistoryState
 * @property {RealityMap | null} realityMap
 * @property {LearnerMentalModel} learnerMap
 * @property {import("../../state/session.js").LedgerEntry[]} ledger
 */

/** One entry of a node's rotation trail (from nodeHistory). */
/** @typedef {import("../../state/session.js").NodeHistoryEntry} NodeHistoryEntry */

/**
 * The invitation card (v6 ticket 06): what this node is, its observation,
 * and dependence neighbors. Learner state, confidence, evidence, and the
 * rotation trail stay in the engine; they do not belong on this card.
 *
 * @param {HistoryState} state
 * @param {string} nodeId
 * @returns {{
 *   nodeId: string;
 *   label: string;
 *   description: string;
 *   observation: ObservationView | null;
 *   invitation: string;
 *   restsOn: DependenceNeighbor[];
 *   restsOnIt: DependenceNeighbor[];
 * }}
 */
export function nodePanelView(state, nodeId) {
  const reality = state.realityMap;
  const node =
    reality && Array.isArray(reality.nodes) ? reality.nodes.find((n) => n.id === nodeId) : undefined;
  const label = node ? node.label : nodeId;
  const { restsOn, restsOnIt } = dependenceNeighbors(reality, nodeId);

  return {
    nodeId,
    label,
    description: node ? node.description : "",
    observation: node && node.basis !== undefined ? observationOf(node) : null,
    invitation: RABBIT_HOLE_INVITE,
    restsOn,
    restsOnIt,
  };
}

/**
 * Reality Map dependence neighbors: what this node rests on (outgoing
 * built-on / depends-on / abstraction-of) and what rests on it (incoming).
 * part-of / predicts / contradicts are not dependence and stay off the card.
 *
 * @param {RealityMap | null} reality
 * @param {string} nodeId
 * @returns {{ restsOn: DependenceNeighbor[]; restsOnIt: DependenceNeighbor[] }}
 */
function dependenceNeighbors(reality, nodeId) {
  /** @type {DependenceNeighbor[]} */
  const restsOn = [];
  /** @type {DependenceNeighbor[]} */
  const restsOnIt = [];
  if (
    reality === null ||
    typeof reality !== "object" ||
    !Array.isArray(reality.nodes) ||
    !Array.isArray(reality.edges)
  ) {
    return { restsOn, restsOnIt };
  }
  const labelOf = (/** @type {string} */ id) => {
    const found = reality.nodes.find((n) => n.id === id);
    return found ? found.label : id;
  };
  for (const edge of reality.edges) {
    if (edge === null || typeof edge !== "object") continue;
    if (!DEPENDENCE_TYPES.has(edge.type)) continue;
    if (edge.source === nodeId) {
      restsOn.push({
        nodeId: edge.target,
        label: labelOf(edge.target),
        type: edge.type,
      });
    } else if (edge.target === nodeId) {
      restsOnIt.push({
        nodeId: edge.source,
        label: labelOf(edge.source),
        type: edge.type,
      });
    }
  }
  return { restsOn, restsOnIt };
}

/**
 * A layer's story (ticket 11): which of its nodes the learner engaged, in
 * what order (first-engagement turn), and how each node's state rotated -
 * the \"shape rotation\" of that branch across the session.
 *
 * @param {HistoryState} state
 * @param {string} layerId
 * @returns {{
 *   layerId: string;
 *   layerName: string;
 *   engaged: Array<{ nodeId: string; label: string; firstTurn: number; current: NodeState; rotations: NodeHistoryEntry[] }>;
 *   unengaged: string[];
 * }}
 */
export function layerStory(state, layerId) {
  const reality = state.realityMap;
  const layer =
    reality && Array.isArray(reality.layers) ? reality.layers.find((l) => l.id === layerId) : undefined;
  const layerName = layer ? layer.name : layerId;
  const nodeIds = layer && Array.isArray(layer.nodes) ? layer.nodes : [];
  /** @type {Array<{ nodeId: string; label: string; firstTurn: number; current: NodeState; rotations: NodeHistoryEntry[] }>} */
  const engaged = [];
  /** @type {string[]} */
  const unengaged = [];

  for (const id of nodeIds) {
    const learner = state.learnerMap.nodes.find((n) => n.id === id);
    if (!learner) {
      unengaged.push(id);
      continue;
    }
    const trail = nodeHistory(state, id);
    const realityNode =
      reality && Array.isArray(reality.nodes) ? reality.nodes.find((n) => n.id === id) : undefined;
    engaged.push({
      nodeId: id,
      label: realityNode ? realityNode.label : id,
      firstTurn: trail.length > 0 ? trail[0].turn : 0,
      current: learner.state,
      rotations: trail,
    });
  }
  engaged.sort((a, b) => a.firstTurn - b.firstTurn);
  return { layerId, layerName, engaged, unengaged };
}

/**
 * The timeline stops (ticket 12): one per ledger turn, with the reply and
 * probe of that turn for the scrubber's play/replay narration.
 *
 * @param {HistoryState} state
 * @returns {Array<{ turn: number; reply: string | null; probe: import("../../state/session.js").LedgerEntry["probe"] }>}
 */
export function timelineStops(state) {
  return state.ledger.map((entry) => ({
    turn: entry.turn,
    reply: entry.reply,
    probe: entry.probe,
  }));
}

/**
 * The learner map as of turn t: the ledger snapshot at that turn, or the
 * live map when t is at/after the last turn (the live position). Returns
 * null when there is no ledger at all (nothing to scrub).
 *
 * @param {HistoryState} state
 * @param {number} turn - 1-based; clamps to the live position.
 * @returns {LearnerMentalModel | null}
 */
export function snapshotAt(state, turn) {
  if (state.ledger.length === 0) return null;
  const index = Math.min(Math.max(turn, 1), state.ledger.length) - 1;
  return state.ledger[index].learnerMap;
}

/**
 * The diff of the turn that produced snapshot t - the animation source for
 * the scrubber's replay at that step.
 *
 * @param {HistoryState} state
 * @param {number} turn
 * @returns {import("../mmg/types.js").Diff | null}
 */
export function snapshotDiff(state, turn) {
  if (state.ledger.length === 0) return null;
  const index = Math.min(Math.max(turn, 1), state.ledger.length) - 1;
  const entry = state.ledger[index];
  return entry.diff && typeof entry.diff === "object" ? entry.diff : null;
}

