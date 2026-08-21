/**
 * Ticket 11: deterministic Arrange over a shuffled inventory.
 *
 * Stage 3 (Arrange) no longer emits a map. The model receives a shuffled
 * inventory of the Chronology regimes and Epiphany joints and returns an
 * EDGE-SET ONLY: which item rests on which other item, with a one-line
 * reason and the epiphany records that justify the edge. The code then
 * arranges deterministically: it validates the edge-set, breaks directed
 * cycles by dropping the weakest edge, computes layers by longest-path
 * depth, synthesizes the crown (the requested target), and declares the
 * trunk. The model never emits nodes, layers, trunk, or crown, so it
 * cannot copy Chronology into a timeline map.
 *
 * Listness is the defense-in-depth gate on the final map: a map that is a
 * flat list, a single unbranching path, or a strictly layer-stratified
 * copy is a timeline, not a Dependence Tree.
 */

const EDGE_TYPE = "depends-on";
const CROWN_ID = "target";

import { dropUnknownValues } from "../mmg/observation.js";

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */

/**
 * JSON Schema for the constrained Stage 3 decode. References are restricted
 * to the ids returned by the accepted Chronology and Epiphanies calls. The
 * shape is the OpenRouter strict subset: no `const`, `pattern`, or
 * `allOf`/`if`/`then`. Certainty and semantic rules stay in code.
 *
 * @param {string} concept
 * @param {Set<string>} inventoryIds
 * @param {Set<string>} epiphanyIds
 * @returns {{ name: string; strict: true; schema: Record<string, any> }}
 */
export function buildArrangeJsonSchema(concept, inventoryIds, epiphanyIds) {
  const itemRef = { type: "string", enum: [...inventoryIds] };
  const evidenceRef = { type: "string", enum: [...epiphanyIds] };
  return {
    name: "arrange",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concept: { type: "string", enum: [concept] },
        edges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              from: itemRef,
              to: itemRef,
              because: { type: "string" },
              evidence_ids: { type: "array", items: evidenceRef },
            },
            required: ["from", "to", "because", "evidence_ids"],
          },
        },
      },
      required: ["concept", "edges"],
    },
  };
}

/**
 * Normalize a raw Stage 3 reply to the connect contract. The strict schema
 * already enforces the shape on the OpenRouter path; this defends the
 * DeepSeek and stub paths.
 *
 * @param {unknown} value
 * @returns {{ concept: unknown; edges: any[] }}
 */
export function normalizeConnect(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { concept: undefined, edges: [] };
  }
  const record = /** @type {any} */ (value);
  const edges = Array.isArray(record.edges) ? record.edges : [];
  return {
    concept: record.concept,
    edges: edges
      .filter((/** @type {any} */ edge) => typeof edge === "object" && edge !== null)
      .map((/** @type {any} */ edge) => ({
        from: typeof edge.from === "string" ? edge.from : "",
        to: typeof edge.to === "string" ? edge.to : "",
        because: typeof edge.because === "string" ? edge.because : "",
        evidence_ids: Array.isArray(edge.evidence_ids)
          ? edge.evidence_ids.filter((/** @type {any} */ id) => typeof id === "string")
          : [],
      })),
  };
}

/**
 * Validate the Stage 3 contract: an edge-set over the inventory.
 *
 * @param {{ concept: unknown; edges: any[] }} value
 * @param {string} concept
 * @param {Set<string>} inventoryIds
 * @param {Set<string>} epiphanyIds
 * @returns {string[]}
 */
export function edgeSetProblems(value, concept, inventoryIds, epiphanyIds) {
  const errors = [];
  if (value.concept !== concept) errors.push("arrange concept must match the request");
  if (!Array.isArray(value.edges)) {
    return [...errors, "arrange reply must contain an edges array"];
  }
  if (value.edges.length === 0) errors.push("arrange edges must not be empty");
  const seen = new Set();
  value.edges.forEach((edge, index) => {
    const where = `edge ${index + 1}`;
    if (!nonEmptyString(edge.from) || !nonEmptyString(edge.to)) {
      errors.push(`${where} must name from and to inventory ids`);
      return;
    }
    if (!inventoryIds.has(edge.from)) errors.push(`${where} from "${edge.from}" is not an inventory id`);
    if (!inventoryIds.has(edge.to)) errors.push(`${where} to "${edge.to}" is not an inventory id`);
    if (edge.from === edge.to) errors.push(`${where} is a self-loop (${edge.from})`);
    if (!nonEmptyString(edge.because)) errors.push(`${where} needs a non-empty because`);
    const key = `${edge.from}\u0000${edge.to}`;
    if (seen.has(key)) errors.push(`${where} duplicates edge ${edge.from} to ${edge.to}`);
    seen.add(key);
    for (const id of edge.evidence_ids) {
      if (!epiphanyIds.has(id)) errors.push(`${where} evidence "${id}" is not an epiphany id`);
    }
  });
  return errors;
}

/**
 * Fisher-Yates shuffle. The Connect payload is shuffled so the model cannot
 * lean on list position; the arrange code is order-independent.
 *
 * @template T
 * @param {T[]} items
 * @returns {T[]}
 */
export function shuffleInventory(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * Build the learner-facing map from the validated edge-set. Pure code:
 * validation, cycle-break, longest-path layering, crown synthesis, trunk
 * and provenance declaration. No model call.
 *
 * @param {{
 *   concept: string;
 *   chronologyItems: any[];
 *   epiphanyItems: any[];
 *   edges: Array<{ from: string; to: string; because: string; evidence_ids: string[] }>;
 * }} input
 * @returns {{ map: RealityMap; provenance: any }}
 */
export function deterministicArrange({ concept, chronologyItems, epiphanyItems, edges }) {
  const nodes = [];
  const byId = new Map();
  for (const item of chronologyItems) {
    const node = {
      id: item.id,
      label: item.regime,
      description: item.new_capability,
      role: "DOMAIN",
      layer: "",
    };
    nodes.push(node);
    byId.set(node.id, node);
  }
  for (const item of epiphanyItems) {
    const node = {
      id: item.id,
      label: item.candidate_node || item.result,
      description: item.result,
      role: "EPIPHANY",
      basis: observationFromHistory(item.history),
      layer: "",
    };
    nodes.push(node);
    byId.set(node.id, node);
  }

  let kept = edges
    .filter((edge) => edge.from !== edge.to && byId.has(edge.from) && byId.has(edge.to))
    .map((edge) => ({ ...edge }));

  kept = breakCycles(kept);

  const tops = nodes.filter((node) => !kept.some((edge) => edge.to === node.id));
  const crown = {
    id: CROWN_ID,
    label: concept,
    description: concept,
    role: "DOMAIN",
    layer: "",
  };
  nodes.push(crown);
  byId.set(CROWN_ID, crown);

  const depth = longestPathDepths(kept, nodes);
  const crownEdges = tops.map((top) => ({
    from: CROWN_ID,
    to: top.id,
    because: `The target rests on ${top.label} because the target cannot exist without it.`,
    evidence_ids: [],
  }));
  kept = [...kept, ...crownEdges];
  for (;;) {
    kept = breakUndirectedCycles(kept);
    const orphanTops = nodes.filter(
      (node) => node.id !== CROWN_ID && !kept.some((edge) => edge.to === node.id)
    );
    if (orphanTops.length === 0) break;
    kept.push(
      ...orphanTops.map((top) => ({
        from: CROWN_ID,
        to: top.id,
        because: `The target rests on ${top.label} because the target cannot exist without it.`,
        evidence_ids: [],
      }))
    );
  }

  const fullDepth = longestPathDepths(kept, nodes);
  const maxDepth = Math.max(...nodes.map((node) => fullDepth.get(node.id) ?? 0));
  for (const node of nodes) node.layer = `l${fullDepth.get(node.id) ?? 0}`;

  const layers = [];
  for (let index = 0; index <= maxDepth; index += 1) {
    layers.push({
      id: `l${index}`,
      name: index === 0 ? "Foundation" : `Level ${index}`,
      nodes: nodes.filter((node) => node.layer === `l${index}`).map((node) => node.id),
    });
  }

  const mapEdges = kept.map((edge) => ({
    source: edge.from,
    target: edge.to,
    type: EDGE_TYPE,
    because: edge.because,
  }));

  const trunk = trunkPath(kept, fullDepth, crown);
  const provenance = buildProvenance(nodes, kept);

  return {
    map: /** @type {RealityMap} */ ({
      concept,
      layers,
      nodes,
      edges: mapEdges,
      trunk,
    }),
    provenance,
  };
}

/**
 * Remove directed cycles by dropping the weakest edge on each cycle.
 * Weakest means: fewest evidence ids, then shortest because, then
 * lexicographic from/to. Deterministic.
 *
 * @param {Array<{ from: string; to: string; because: string; evidence_ids: string[] }>} edges
 * @returns {Array<{ from: string; to: string; because: string; evidence_ids: string[] }>}
 */
function breakCycles(edges) {
  const result = edges.map((edge) => ({ ...edge }));
  for (;;) {
    const cycle = findDirectedCycle(result);
    if (!cycle) return result;
    const weakest = cycle.reduce((best, edge) =>
      edgeRank(edge) < edgeRank(best) ||
      (edgeRank(edge) === edgeRank(best) && edge.from + edge.to < best.from + best.to)
        ? edge
        : best
    );
    const index = result.indexOf(weakest);
    result.splice(index, 1);
  }
}

/**
 * Remove undirected cycles by dropping the weakest NON-crown edge on each
 * cycle. Crown edges are protected: the crown must keep every top as a
 * support. This is the convergence fallback: two tops that share an
 * ancestor (a diamond) cannot live in a strict tree, so the weakest
 * model claim on the cycle gives way. Deterministic.
 *
 * @param {Array<{ from: string; to: string; because: string; evidence_ids: string[] }>} edges
 * @returns {Array<{ from: string; to: string; because: string; evidence_ids: string[] }>}
 */
function breakUndirectedCycles(edges) {
  const result = edges.map((edge) => ({ ...edge }));
  for (;;) {
    const cycle = findUndirectedCycle(result);
    if (!cycle) return result;
    const droppable = cycle.filter((edge) => edge.from !== CROWN_ID);
    if (droppable.length === 0) return result;
    const weakest = droppable.reduce((best, edge) =>
      edgeRank(edge) < edgeRank(best) ||
      (edgeRank(edge) === edgeRank(best) && edge.from + edge.to < best.from + best.to)
        ? edge
        : best
    );
    const index = result.indexOf(weakest);
    result.splice(index, 1);
  }
}

/**
 * Find one undirected cycle in the edge graph.
 *
 * @param {Array<{ from: string; to: string }>} edges
 * @returns {Array<{ from: string; to: string; because: string; evidence_ids: string[] }> | null}
 */
function findUndirectedCycle(edges) {
  const adjacency = new Map();
  const edgeByKey = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
    edgeByKey.set(`${edge.from}\u0000${edge.to}`, edge);
    edgeByKey.set(`${edge.to}\u0000${edge.from}`, edge);
  }
  const seen = new Set();
  const path = /** @type {string[]} */ ([]);
  /**
   * @param {string} node
   * @param {string | null} parent
   * @returns {Array<{ from: string; to: string; because: string; evidence_ids: string[] }> | null}
   */
  const visit = (node, parent) => {
    seen.add(node);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (next === parent) continue;
      if (seen.has(next)) {
        const start = path.indexOf(next);
        const cycleNodes = path.slice(start);
        const cycleEdges = [];
        for (let index = 0; index < cycleNodes.length - 1; index += 1) {
          const edge = edgeByKey.get(`${cycleNodes[index]}\u0000${cycleNodes[index + 1]}`);
          if (edge) cycleEdges.push(edge);
        }
        const back = edgeByKey.get(`${node}\u0000${next}`);
        if (back) cycleEdges.push(back);
        return cycleEdges.length > 0 ? cycleEdges : null;
      }
      const found = visit(next, node);
      if (found) return found;
    }
    path.pop();
    return null;
  };
  for (const node of adjacency.keys()) {
    if (!seen.has(node)) {
      const found = visit(node, null);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @param {{ from: string; to: string; because: string; evidence_ids: string[] }} edge
 * @returns {number}
 */
function edgeRank(edge) {
  return (
    edge.evidence_ids.length * 1_000_000 +
    Math.min(edge.because.length, 9999) * 100 +
    edge.from.length * 10 +
    edge.to.length
  );
}

/**
 * Find one directed cycle in the edge graph (from rests on to; edges point
 * down, so a cycle from a -> b -> ... -> a is a contradiction).
 *
 * @param {Array<{ from: string; to: string }>} edges
 * @returns {Array<{ from: string; to: string; because: string; evidence_ids: string[] }> | null}
 */
function findDirectedCycle(edges) {
  const adjacency = new Map();
  const edgeByKey = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
    edgeByKey.set(`${edge.from}\u0000${edge.to}`, edge);
  }
  const state = new Map();
  const stack = /** @type {string[]} */ ([]);
  /** @param {string} node @returns {string[] | null} */
  const visit = (node) => {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const nextState = state.get(next);
      if (nextState === "visiting") {
        const start = stack.indexOf(next);
        const cycle = stack.slice(start);
        cycle.push(next);
        return cycle;
      }
      if (nextState === undefined) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };
  for (const node of adjacency.keys()) {
    if (state.get(node) === undefined) {
      const cycle = visit(node);
      if (cycle) {
        return cycle
          .slice(0, -1)
          .map((id, index) => {
            const next = cycle[index + 1];
            return edgeByKey.get(`${id}\u0000${next}`);
          })
          .filter((edge) => edge !== undefined);
      }
    }
  }
  return null;
}

/**
 * Longest-path depth from the foundations. A node with nothing below it
 * (no prerequisites among the inventory) rests at depth 0; every other
 * node sits one layer above its deepest prerequisite. Edges point down:
 * `from` rests on `to`, so `to` is below `from`.
 *
 * @param {Array<{ from: string; to: string }>} edges
 * @param {Array<{ id: string }>} nodes
 * @returns {Map<string, number>}
 */
function longestPathDepths(edges, nodes) {
  const below = new Map(nodes.map((/** @type {any} */ node) => [node.id, /** @type {string[]} */ ([])]));
  for (const edge of edges) {
    below.get(edge.from)?.push(edge.to);
  }
  const memo = new Map();
  /** @param {string} id @returns {number} */
  const depthOf = (id) => {
    if (memo.has(id)) return memo.get(id);
    const supports = below.get(id) ?? [];
    const depth = supports.length === 0 ? 0 : 1 + Math.max(...supports.map(depthOf));
    memo.set(id, depth);
    return depth;
  };
  for (const node of nodes) depthOf(node.id);
  return memo;
}

/**
 * The Foundation-to-crown walk: at every step take the deepest prerequisite
 * (ties resolve to the smaller id).
 *
 * @param {Array<{ from: string; to: string }>} edges
 * @param {Map<string, number>} depth
 * @param {{ id: string }} crown
 * @returns {string[]}
 */
function trunkPath(edges, depth, crown) {
  const prereqs = new Map();
  for (const edge of edges) {
    if (!prereqs.has(edge.from)) prereqs.set(edge.from, []);
    prereqs.get(edge.from).push(edge.to);
  }
  const path = [crown.id];
  let current = crown.id;
  for (;;) {
    const options = (prereqs.get(current) ?? []).slice();
    if (options.length === 0) break;
    options.sort((/** @type {string} */ a, /** @type {string} */ b) => (depth.get(b) ?? 0) - (depth.get(a) ?? 0) || (a < b ? -1 : 1));
    const next = options[0];
    if (next === undefined) break;
    current = next;
    path.push(current);
    if (depth.get(current) === 0) break;
  }
  return path.reverse();
}

/**
 * Hidden provenance for the deterministic map. Every inventory item is a
 * node and is used; nothing is discarded under the edge-set contract.
 *
 * @param {Array<{ id: string; role: string }>} nodes
 * @param {Array<{ from: string; to: string; because: string; evidence_ids: string[] }>} edges
 * @returns {any}
 */
function buildProvenance(nodes, edges) {
  const nodeProvenance = nodes.map((node) => {
    if (node.id === CROWN_ID) {
      const sinks = edges.filter((edge) => edge.from === CROWN_ID).map((edge) => edge.to);
      return { node_id: CROWN_ID, input_refs: sinks };
    }
    return { node_id: node.id, input_refs: [node.id] };
  });
  const edgeProvenance = edges.map((edge) => ({
    source: edge.from,
    target: edge.to,
    input_refs:
      edge.from === CROWN_ID
        ? [edge.to]
        : [...new Set([...edge.evidence_ids, edge.from, edge.to])],
  }));
  return {
    nodes: nodeProvenance,
    edges: edgeProvenance,
    discarded_input_ids: [],
  };
}

/**
 * Listness gate (defense-in-depth): is the final map a timeline copy
 * rather than a Dependence Tree? Flags:
 *
 * 1. A map with no layers: a flat list.
 * 2. A single unbranching path of 3+ nodes: a chain.
 * 3. A strictly stepwise stack of 4+ layers where every cross-layer edge
 *    originates from the top layer: a storybook table of contents (each
 *    level builds only on the level directly below it; only the crown
 *    may reach across layers).
 *
 * The heuristic is pinned to the ticket 11 acceptance set: the three
 * captured Arrange outputs (no layers), the v6 laptop map (stepwise
 * stack, skips only from its top layer) and the v6 battery map (single
 * path) must all be flagged; the fixture map (3 layers, branching
 * crown) must pass.
 *
 * @param {any} map
 * @returns {string[]}
 */
export function listnessProblems(map) {
  const errors = /** @type {string[]} */ ([]);
  if (typeof map !== "object" || map === null) return ["map is not an object"];
  if (!Array.isArray(map.layers) || map.layers.length === 0) {
    return ["map has no layers: the arrangement is a flat list"];
  }
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const edges = Array.isArray(map.edges) ? map.edges : [];
  if (nodes.length < 3 || edges.length === 0) return errors;

  const incoming = new Map(nodes.map((/** @type {any} */ node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((/** @type {any} */ node) => [node.id, 0]));
  for (const edge of edges) {
    if (incoming.has(edge.source)) outgoing.set(edge.source, outgoing.get(edge.source) + 1);
    if (incoming.has(edge.target)) incoming.set(edge.target, incoming.get(edge.target) + 1);
  }
  const isPath = [...nodes].every(
    (node) => incoming.get(node.id) <= 1 && outgoing.get(node.id) <= 1
  );
  if (isPath) errors.push("map is a single unbranching path: a timeline, not a Tree");

  if (map.layers.length >= 4) {
    const topIndex = map.layers.length - 1;
    const layerIndex = new Map(
      map.layers.map((/** @type {any} */ layer, /** @type {number} */ index) => [layer.id, index])
    );
    const nodeLayer = new Map(nodes.map((/** @type {any} */ node) => [node.id, node.layer]));
    const maxLayerSize = Math.max(...map.layers.map((/** @type {any} */ layer) => layer.nodes.length));
    const stepwise = edges.every((/** @type {any} */ edge) => {
      const sourceLayer = layerIndex.get(nodeLayer.get(edge.source));
      const targetLayer = layerIndex.get(nodeLayer.get(edge.target));
      if (sourceLayer === undefined || targetLayer === undefined) return true;
      if (sourceLayer === topIndex) return true;
      return targetLayer >= sourceLayer - 1;
    });
    if (stepwise && maxLayerSize >= 3) {
      errors.push("map is a strictly stepwise stack: a storybook table of contents, not a Tree");
    }
  }
  return errors;
}

/**
 * Build an observation record from a Stage 2 history record.
 *
 * @param {any} history
 * @returns {any}
 */
function observationFromHistory(history) {
  const certaintyToken = canonicalEnum(history?.certainty, CERTAINTIES);
  const certainty =
    typeof certaintyToken === "string" && CERTAINTIES.has(certaintyToken) ? certaintyToken : "UNKNOWN";
  const mark = certainty;
  const field = (/** @type {unknown} */ value) => ({
    value: typeof value === "string" ? value : "",
    mark:
      certainty === "APPROXIMATE" && (value === null || value === "")
        ? "UNKNOWN"
        : mark,
  });
  return dropUnknownValues({
    discoverer: field(Array.isArray(history?.who) ? history.who.join(", ") : ""),
    date: field(history?.when),
    keyObservation: field(history?.observation),
    confidence: certainty === "EXACT" ? "high" : certainty === "APPROXIMATE" ? "medium" : "low",
    note: typeof history?.uncertainty_note === "string" ? history.uncertainty_note : "",
  });
}

const CERTAINTIES = new Set(["EXACT", "APPROXIMATE", "UNKNOWN"]);

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string} */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {unknown} value @param {Set<string>} allowed @returns {unknown} */
function canonicalEnum(value, allowed) {
  if (typeof value !== "string") return value;
  const token = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return allowed.has(token) ? token : value;
}
