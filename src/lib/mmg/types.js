/**
 * Mental Model Graph - shared type definitions.
 *
 * The schema is written as JSDoc typedefs over plain ES modules, because both
 * runtime consumers - the static browser frontend and the Node 18+ Netlify
 * function - must import it, and neither runs .ts without a build step. The
 * types are enforced by `npm run typecheck` (tsc --noEmit --checkJs), which
 * costs nothing at runtime. See the ticket 02 resolution for the decision.
 *
 * The shape mirrors spec section 7.
 */

/**
 * State of a learner node or edge in the Learner Mental Model.
 * - untested: not yet probed by the conversation.
 * - missing: probed; the learner has no model of it.
 * - misconception: the learner's model conflicts with reality.
 * - correct: the learner's model matches reality.
 *
 * @typedef {"untested" | "missing" | "misconception" | "correct"} NodeState
 */

/**
 * Type of a reality edge. Semantics: the relation of the source node to the
 * target node (e.g. "transistor built-on silicon").
 *
 * @typedef {"part-of" | "depends-on" | "built-on" | "abstraction-of" | "predicts" | "contradicts"} EdgeType
 */

/** @typedef {string} NodeId */
/** @typedef {string} LayerId */

/**
 * A layer of the reality map. The layer chain is ordered and contiguous: every
 * layer after the first connects to a lower layer by at least one edge (see
 * validateRealityMap).
 *
 * @typedef {object} Layer
 * @property {LayerId} id
 * @property {string} name
 * @property {NodeId[]} nodes - ids of the nodes in this layer, mirroring
 *   each node's own `layer` field.
 */

/**
 * One fact field of an observation record: a value plus the honesty mark
 * (fail-honest contract, ticket 09 section 2). EXACT: a single
 * well-documented value. APPROXIMATE: the record is low resolution or
 * contested. UNKNOWN: no defensible value - the value is then dropped, never
 * invented.
 *
 * @typedef {object} ObservationField
 * @property {string} value - empty when the mark is UNKNOWN (dropped).
 * @property {"EXACT" | "APPROXIMATE" | "UNKNOWN"} mark
 */

/**
 * The real-history observation record (ticket 02, the crux): the discovery,
 * measurement, experiment, or theoretical result a node's abstraction
 * compresses. REAL discovery history, never rational reconstruction; UNKNOWN
 * is a legal, first-class state (the node exists, its observation is missing,
 * the layer chain is unbroken).
 *
 * @typedef {object} ObservationRecord
 * @property {ObservationField} discoverer
 * @property {ObservationField} date
 * @property {ObservationField} keyObservation
 * @property {"high" | "medium" | "low"} confidence - the model's own estimate
 *   for the record as a whole.
 * @property {string} note - hedge context for display on hover (contested
 *   credit, later rejection, shared discovery); empty when there is none.
 */

/**
 * A node of the reality map - a concept in the chain from first principles to
 * the thing itself.
 *
 * `basis` (ticket 06, principle 5) is the observation the abstraction
 * compresses - what a learner can point at. Since ticket 03 it is a
 * real-history OBSERVATION RECORD (ticket 02) on every node, foundation
 * included; the generator's deriveCheck enforces the record, and the schema
 * validator still accepts a legacy plain-string basis for maps that predate
 * ticket 03. The field stays OPTIONAL in the schema so maps without it
 * remain valid.
 *
 * @typedef {object} RealityNode
 * @property {NodeId} id
 * @property {string} label
 * @property {LayerId} layer
 * @property {string} description
 * @property {string | ObservationRecord} [basis] - the observation this node
 *   compresses (ticket 06); an observation record since ticket 03.
 */

/**
 * A typed edge of the reality map.
 *
 * @typedef {object} RealityEdge
 * @property {NodeId} source
 * @property {NodeId} target
 * @property {EdgeType} type
 */

/**
 * The Reality Map (canonical): typed nodes and edges describing the thing as
 * it actually is, organized in contiguous layers, from the model's knowledge.
 *
 * @typedef {object} RealityMap
 * @property {string} concept
 * @property {Layer[]} layers - ordered, contiguous
 * @property {RealityNode[]} nodes
 * @property {RealityEdge[]} edges
 */

/**
 * A node of the learner mental model, mirroring a reality node by id.
 *
 * @typedef {object} LearnerNode
 * @property {NodeId} id - mirrors a RealityMap node id
 * @property {NodeState} state
 * @property {number} confidence - 0..1
 * @property {string[]} evidence - learner quotes the state is based on
 */

/**
 * An edge of the learner mental model. Mirrors a reality edge by its endpoints;
 * carries evidence like a learner node.
 *
 * @typedef {object} LearnerEdge
 * @property {NodeId} source
 * @property {NodeId} target
 * @property {NodeState} state
 * @property {number} confidence - 0..1
 * @property {string[]} evidence - learner quotes the state is based on
 */

/**
 * The Learner Mental Model: mirrors the reality map; every node or edge
 * carries a state, a confidence, and evidence. Can be empty at session start.
 *
 * @typedef {object} LearnerMentalModel
 * @property {LearnerNode[]} nodes
 * @property {LearnerEdge[]} edges
 */

/**
 * One flipped node in a diff.
 *
 * @typedef {object} Flipped
 * @property {NodeId} id
 * @property {NodeState} from
 * @property {NodeState} to
 */

/**
 * The per-turn diff: what changed in the learner map this turn.
 *
 * @typedef {object} Diff
 * @property {NodeId[]} added - node ids added this turn
 * @property {Flipped[]} flipped - node states changed this turn
 * @property {NodeId[]} updated - node ids whose evidence or confidence changed
 */

/** @type {readonly NodeState[]} */
export const NODE_STATES = Object.freeze([
  "untested",
  "missing",
  "misconception",
  "correct",
]);

/** @type {readonly EdgeType[]} */
export const EDGE_TYPES = Object.freeze([
  "part-of",
  "depends-on",
  "built-on",
  "abstraction-of",
  "predicts",
  "contradicts",
]);
