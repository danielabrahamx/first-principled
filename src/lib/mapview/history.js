/**
 * Map-first history viewmodels (tickets 10, 11, 12): pure functions that
 * turn the session store's ledger into the node panel, the hover rotation
 * trails, the layer stories, and the timeline scrubber's snapshot model.
 *
 * The data source is the turn ledger (ticket 08): one deep-copied learner
 * map per turn, plus the diff, reply and probe of that turn. Everything
 * here is derived, so the UI never mutates the store and the store never
 * grows beyond the ledger.
 *
 * No-leak: these views render mid-session, where the learner grid may only
 * show engaged nodes. Node panels may show the reality description (Danny's
 * 2026-08-10 decision: the no-leak rule now binds chat, not the map - the
 * Reality tab and node panels show ground truth at any time). Layer stories
 * read reality layer names and the learner's engagement per node - they
 * describe what the learner did with each node, never the node's reality
 * description.
 *
 * Pure and DOM-free so node:test covers the shapes directly.
 */

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */
/** @typedef {import("../mmg/types.js").LearnerMentalModel} LearnerMentalModel */
/** @typedef {import("../mmg/types.js").NodeState} NodeState */

import { nodeHistory } from "../../state/session.js";
import { observationOf } from "./observation.js";

/** @typedef {import("./observation.js").ObservationView} ObservationView */

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
 * The node panel's full content model (ticket 10): the reality card, the
 * learner's current state, the evidence with turn numbers, the rotation
 * trail, and the linked neighbors with their states.
 *
 * @param {HistoryState} state
 * @param {string} nodeId
 * @returns {{
 *   nodeId: string;
 *   label: string;
 *   description: string;
 *   observation: ObservationView;
 *   state: NodeState;
 *   confidence: number;
 *   engaged: boolean;
 *   evidence: Array<{ quote: string; turn: number }>;
 *   trail: NodeHistoryEntry[];
 *   neighbors: Array<{ nodeId: string; label: string; state: NodeState; relation: "in" | "out" }>;
 * }}
 */
export function nodePanelView(state, nodeId) {
  const reality = state.realityMap;
  const node =
    reality && Array.isArray(reality.nodes) ? reality.nodes.find((n) => n.id === nodeId) : undefined;
  const learner = state.learnerMap.nodes.find((n) => n.id === nodeId);
  const label = node ? node.label : nodeId;

  // Evidence quotes with the turn they arrived on: the last ledger snapshot
  // holding the quote is the turn it was first recorded (rotations replace
  // the list; a quote's first appearance turn is what matters for the story).
  /** @type {Array<{ quote: string; turn: number }>} */
  const evidence = [];
  if (learner) {
    const seen = new Set();
    for (let i = 0; i < state.ledger.length; i++) {
      const entry = state.ledger[i];
      const snap = entry.learnerMap.nodes.find((n) => n.id === nodeId);
      if (!snap) continue;
      for (const quote of snap.evidence) {
        if (!seen.has(quote)) {
          seen.add(quote);
          evidence.push({ quote, turn: entry.turn });
        }
      }
    }
  }

  // The rotation trail comes from the store's own nodeHistory (ticket 08) -
  // one implementation, reused by the panel, the popover and the layer
  // stories so they can never drift apart.
  const trail = nodeHistory(state, nodeId);

  // Neighbors: learner edges touching the node, with the other endpoint's
  // label and state. Reality labels only for engaged endpoints (the grid's
  // no-leak rule); unengaged endpoints show their id.
  /** @type {Array<{ nodeId: string; label: string; state: NodeState; relation: "in" | "out" }>} */
  const neighbors = [];
  const learnerById = new Map(state.learnerMap.nodes.map((n) => [n.id, n]));
  const labelOf = (/** @type {string} */ id) => {
    const realityNode =
      reality && Array.isArray(reality.nodes) ? reality.nodes.find((n) => n.id === id) : undefined;
    const engaged = learnerById.has(id);
    if (engaged && realityNode) return realityNode.label;
    return id;
  };
  for (const edge of state.learnerMap.edges) {
    if (edge.source === nodeId) {
      neighbors.push({
        nodeId: edge.target,
        label: labelOf(edge.target),
        state: edge.state,
        relation: "out",
      });
    } else if (edge.target === nodeId) {
      neighbors.push({
        nodeId: edge.source,
        label: labelOf(edge.source),
        state: edge.state,
        relation: "in",
      });
    }
  }

  return {
    nodeId,
    label,
    description: node ? node.description : "",
    observation: observationOf(node),
    state: learner ? learner.state : "untested",
    confidence: learner ? learner.confidence : 0,
    engaged: learner !== undefined,
    evidence,
    trail,
    neighbors,
  };
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
    const panel = nodePanelView(state, id);
    if (!panel.engaged) {
      unengaged.push(id);
      continue;
    }
    const realityNode =
      reality && Array.isArray(reality.nodes) ? reality.nodes.find((n) => n.id === id) : undefined;
    engaged.push({
      nodeId: id,
      label: realityNode ? realityNode.label : id,
      firstTurn: panel.trail.length > 0 ? panel.trail[0].turn : 0,
      current: panel.state,
      rotations: panel.trail,
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

