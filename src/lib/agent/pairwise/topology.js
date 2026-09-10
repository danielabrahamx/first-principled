/**
 * Ticket v9-01: deterministic topology selection over local judgments.
 *
 * Pure code. Every selected edge traces to one accepted pair judgment;
 * code never synthesizes a semantic edge. Direction follows the existing
 * RealityMap convention: source is the dependent, target is its
 * prerequisite. Cycle-breaking uses confidence then stable pair ids,
 * never prose length, evidence counts, or array position.
 */

import { TARGET_ID } from "./pairs.js";

export const MAX_NODES = 10;
export const MAX_PATH_NODES = 8;
const TRUNK_MIN = 4;
const TRUNK_MAX = 7;
const MAX_FANIN_PER_TRUNK_NODE = 2;

/**
 * @typedef {object} SelectorInput
 * @property {string} concept
 * @property {Array<{ id: string; label: string; gloss: string; kind: string; foundation_fit: string }>} candidates
 * @property {Array<{ pair_id: string; a_id: string; b_id: string; relation: string; confidence: string; jump: string; rationale: string }>} judgments
 */

/**
 * @typedef {object} SelectedEdge
 * @property {string} edge_id
 * @property {string} source
 * @property {string} target
 * @property {string} pair_id
 * @property {string} confidence
 * @property {string} rationale
 */

/**
 * Select one bounded dependence tree and trunk from validated local
 * judgments. Returns ok:false with a diagnostic reason when no
 * target-to-foundation path exists; never fabricates a bridge.
 *
 * @param {SelectorInput} input
 * @returns {{ ok: true; nodes: string[]; edges: SelectedEdge[]; trunk: string[]; ranks: Record<string, number>; provenance: Record<string, string>; droppedCandidates: Array<{ id: string; reason: string }>; droppedJudgments: Array<{ pair_id: string; reason: string }>; } | { ok: false; reason: string; droppedCandidates: Array<{ id: string; reason: string }>; droppedJudgments: Array<{ pair_id: string; reason: string }>; }}
 */
export function selectTopology({ concept, candidates, judgments }) {
  void concept;
  /** @type {Map<string, { id: string; label: string; foundation_fit: string }>} */
  const nodes = new Map();
  nodes.set(TARGET_ID, { id: TARGET_ID, label: "target", foundation_fit: "ABSTRACT" });
  for (const item of candidates) {
    if (!nodes.has(item.id)) {
      nodes.set(item.id, { id: item.id, label: item.label, foundation_fit: item.foundation_fit });
    }
  }

  /** @type {Array<{ id: string; reason: string }>} */
  const droppedCandidates = [];
  /** @type {Array<{ pair_id: string; reason: string }>} */
  const droppedJudgments = [];

  // 1. Merge only HIGH-confidence duplicates. The target is never merged
  // away: a candidate duplicating it keeps the target id.
  const parent = new Map([...nodes.keys()].map((id) => [id, id]));
  const find = (/** @type {string} */ id) => {
    let root = id;
    while (parent.get(root) !== root) root = /** @type {string} */ (parent.get(root));
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = /** @type {string} */ (parent.get(cursor));
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const byPair = new Map(judgments.map((judgment) => [judgment.pair_id, judgment]));
  for (const judgment of judgments) {
    if (judgment.relation !== "SAME_CONCEPT" || judgment.confidence !== "HIGH") continue;
    const rootA = find(judgment.a_id);
    const rootB = find(judgment.b_id);
    if (rootA === rootB) continue;
    // Canonical root: target wins; otherwise the stable smaller id.
    let keep = rootA < rootB ? rootA : rootB;
    let drop = keep === rootA ? rootB : rootA;
    if (rootA === TARGET_ID || rootB === TARGET_ID) {
      keep = TARGET_ID;
      drop = rootA === TARGET_ID ? rootB : rootA;
    }
    parent.set(drop, keep);
    // Re-root every member of the dropped set onto the canonical root.
    for (const id of [...parent.keys()]) {
      if (find(id) === drop) parent.set(id, keep);
    }
    void byPair;
  }
  const canonical = (/** @type {string} */ id) =>
    nodes.has(id) ? find(id) : id;
  for (const id of [...nodes.keys()]) {
    const root = find(id);
    if (root !== id) {
      droppedCandidates.push({ id, reason: `merged into ${root} as HIGH-confidence duplicate` });
    }
  }

  // 2. Convert accepted directional judgments into candidate edges.
  /** @type {SelectedEdge[]} */
  let edges = [];
  const seenEdges = new Set();
  const sortedJudgments = [...judgments].sort((left, right) =>
    left.pair_id < right.pair_id ? -1 : 1
  );
  for (const judgment of sortedJudgments) {
    const directional =
      judgment.relation === "A_RESTS_ON_B" || judgment.relation === "B_RESTS_ON_A";
    if (!directional) {
      droppedJudgments.push({ pair_id: judgment.pair_id, reason: `not directional (${judgment.relation})` });
      continue;
    }
    if (judgment.jump !== "SMALL") {
      droppedJudgments.push({ pair_id: judgment.pair_id, reason: `jump ${judgment.jump} is not walkable` });
      continue;
    }
    if (judgment.confidence !== "HIGH" && judgment.confidence !== "MEDIUM") {
      droppedJudgments.push({ pair_id: judgment.pair_id, reason: `confidence ${judgment.confidence} too low` });
      continue;
    }
    const dependent = judgment.relation === "A_RESTS_ON_B" ? judgment.a_id : judgment.b_id;
    const prerequisite = judgment.relation === "A_RESTS_ON_B" ? judgment.b_id : judgment.a_id;
    const source = canonical(dependent);
    const target = canonical(prerequisite);
    if (source === target) {
      droppedJudgments.push({ pair_id: judgment.pair_id, reason: "endpoints merged to one node" });
      continue;
    }
    const key = `${source}\u0000${target}`;
    if (seenEdges.has(key)) {
      droppedJudgments.push({ pair_id: judgment.pair_id, reason: "duplicate canonical edge" });
      continue;
    }
    seenEdges.add(key);
    edges.push({
      edge_id: `e-${judgment.pair_id}`,
      source,
      target,
      pair_id: judgment.pair_id,
      confidence: judgment.confidence,
      rationale: judgment.rationale,
    });
  }

  // 3. Break directed cycles: drop MEDIUM before HIGH, then the stable
  // larger pair id. Deterministic; never prose-length ranked.
  edges = breakDirectedCycles(edges, droppedJudgments);

  // 4. Enumerate simple target-to-leaf paths, cap eight nodes.
  /** @type {Map<string, SelectedEdge[]>} */
  const prereqs = new Map();
  for (const edge of edges) {
    if (!prereqs.has(edge.source)) prereqs.set(edge.source, []);
    prereqs.get(edge.source)?.push(edge);
  }
  for (const list of prereqs.values()) {
    list.sort((left, right) => (left.pair_id < right.pair_id ? -1 : 1));
  }
  const paths = enumeratePaths(TARGET_ID, prereqs);
  // A lone target is not a target-to-foundation path: the walk must reach
  // at least one prerequisite leaf, else the failure is honest, not a map.
  const usable = paths.filter((path) => path.length > 1 && isLeaf(path[path.length - 1], prereqs));
  if (usable.length === 0) {
    return {
      ok: false,
      reason: "no target-to-foundation path: judgments do not connect the target to a demonstrable leaf",
      droppedCandidates,
      droppedJudgments,
    };
  }

  // 5. Score trunks: more HIGH first, DEMONSTRABLE foundation preferred,
  // four-to-seven nodes preferred, stable ids final tie-break.
  const scored = usable.map((path) => ({ path, score: scoreTrunk(path, edges, nodes) }));
  scored.sort((left, right) => compareScores(left, right));
  // Internal walk order is target-first; the published trunk runs from
  // foundation to crown (the fixed target).
  const walk = scored[0].path;
  const trunk = [...walk].reverse();
  const trunkSet = new Set(trunk);

  // 6. Add strongest disjoint support paths attaching to trunk nodes:
  // directed chains ending at a trunk node (branch rests on trunk) or
  // starting at a trunk node (trunk rests on branch), up to four new
  // nodes each. At most two direct fan-ins per trunk node, ten nodes
  // total, connected and acyclic throughout.
  const selected = new Set(trunk);
  /** @type {SelectedEdge[]} */
  const selectedEdges = edges.filter(
    (edge) => trunkSet.has(edge.source) && trunkSet.has(edge.target)
  );
  const trunkEdgeKeys = new Set(selectedEdges.map((edge) => `${edge.source}\u0000${edge.target}`));
  // Trunk must be a connected walk: keep only trunk-consecutive edges.
  for (let index = 0; index < walk.length - 1; index += 1) {
    const key = `${walk[index]}\u0000${walk[index + 1]}`;
    if (!trunkEdgeKeys.has(key)) {
      const direct = edges.find((edge) => edge.source === walk[index] && edge.target === walk[index + 1]);
      if (direct) selectedEdges.push(direct);
    }
  }

  const supportPaths = enumerateSupportPaths(edges, trunkSet, selected);
  supportPaths.sort((left, right) => compareSupport(left, right, edges));
  /** @type {Map<string, number>} */
  const fanin = new Map(trunk.map((id) => [id, 0]));
  for (const support of supportPaths) {
    if (selected.size + support.newNodes.length > MAX_NODES) continue;
    const attachment = support.attachment;
    if ((fanin.get(attachment) ?? 0) >= MAX_FANIN_PER_TRUNK_NODE) continue;
    const trialNodes = new Set([...selected, ...support.newNodes]);
    const trialEdges = [...selectedEdges, ...support.edges];
    if (!isAcyclic(trialNodes, trialEdges)) continue;
    if (!isConnected(trialNodes, trialEdges)) continue;
    for (const id of support.newNodes) selected.add(id);
    for (const edge of support.edges) selectedEdges.push(edge);
    fanin.set(attachment, (fanin.get(attachment) ?? 0) + 1);
  }

  // 7. Deterministic ranks from foundation to crown: leaves rank 0,
  // every other node one above its deepest prerequisite.
  const ranks = computeRanks(selected, selectedEdges);
  const orderedNodes = [...selected].sort((a, b) => ranks[a] - ranks[b] || (a < b ? -1 : 1));
  const orderedEdges = [...selectedEdges].sort((a, b) =>
    a.pair_id < b.pair_id ? -1 : 1
  );
  /** @type {Record<string, string>} */
  const provenance = {};
  for (const edge of orderedEdges) provenance[edge.edge_id] = edge.pair_id;

  return {
    ok: true,
    nodes: orderedNodes,
    edges: orderedEdges,
    trunk: [...trunk],
    ranks,
    provenance,
    droppedCandidates,
    droppedJudgments,
  };
}

/**
 * Enumerate simple directed paths from start following dependent to
 * prerequisite edges, capped at MAX_PATH_NODES nodes.
 *
 * @param {string} start
 * @param {Map<string, SelectedEdge[]>} prereqs
 * @returns {string[][]}
 */
function enumeratePaths(start, prereqs) {
  /** @type {string[][]} */
  const out = [];
  /** @param {string[]} path */
  const walk = (path) => {
    const current = path[path.length - 1];
    const nexts = prereqs.get(current) ?? [];
    if (nexts.length === 0 || path.length >= MAX_PATH_NODES) {
      out.push([...path]);
      return;
    }
    let extended = false;
    for (const edge of nexts) {
      if (path.includes(edge.target)) continue;
      extended = true;
      walk([...path, edge.target]);
    }
    if (!extended) out.push([...path]);
  };
  walk([start]);
  return out;
}

/**
 * @param {string} id
 * @param {Map<string, SelectedEdge[]>} prereqs
 * @returns {boolean}
 */
function isLeaf(id, prereqs) {
  return (prereqs.get(id) ?? []).length === 0;
}

/**
 * Score a trunk path. Higher is better; compareScores applies it.
 *
 * @param {string[]} path
 * @param {SelectedEdge[]} edges
 * @param {Map<string, { id: string; label: string; foundation_fit: string }>} nodes
 * @returns {{ high: number; demonstrable: number; lengthBonus: number; tiebreak: string }}
 */
function scoreTrunk(path, edges, nodes) {
  const edgeByKey = new Map(edges.map((edge) => [`${edge.source}\u0000${edge.target}`, edge]));
  let high = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const edge = edgeByKey.get(`${path[index]}\u0000${path[index + 1]}`);
    if (edge && edge.confidence === "HIGH") high += 1;
  }
  const leaf = nodes.get(path[path.length - 1]);
  const demonstrable = leaf && leaf.foundation_fit === "DEMONSTRABLE" ? 1 : 0;
  const inRange = path.length >= TRUNK_MIN && path.length <= TRUNK_MAX ? 1 : 0;
  const lengthBonus = inRange * 100 - Math.abs(path.length - 5) * 5;
  return { high, demonstrable, lengthBonus, tiebreak: path.join(">") };
}

/**
 * @param {{ path: string[]; score: ReturnType<typeof scoreTrunk> }} left
 * @param {{ path: string[]; score: ReturnType<typeof scoreTrunk> }} right
 * @returns {number}
 */
function compareScores(left, right) {
  if (right.score.high !== left.score.high) return right.score.high - left.score.high;
  if (right.score.demonstrable !== left.score.demonstrable) {
    return right.score.demonstrable - left.score.demonstrable;
  }
  if (right.score.lengthBonus !== left.score.lengthBonus) {
    return right.score.lengthBonus - left.score.lengthBonus;
  }
  return left.score.tiebreak < right.score.tiebreak ? -1 : 1;
}

/**
 * Enumerate candidate support paths: directed chains of up to four new
 * nodes ending at a trunk node or starting at one.
 *
 * @param {SelectedEdge[]} edges
 * @param {Set<string>} trunkSet
 * @param {Set<string>} selected
 * @returns {Array<{ edges: SelectedEdge[]; newNodes: string[]; attachment: string }>}
 */
function enumerateSupportPaths(edges, trunkSet, selected) {
  /** @type {Array<{ edges: SelectedEdge[]; newNodes: string[]; attachment: string }>} */
  const out = [];
  /** @type {Map<string, SelectedEdge[]>} */
  const bySource = new Map();
  /** @type {Map<string, SelectedEdge[]>} */
  const byTarget = new Map();
  for (const edge of edges) {
    if (!bySource.has(edge.source)) bySource.set(edge.source, []);
    if (!byTarget.has(edge.target)) byTarget.set(edge.target, []);
    bySource.get(edge.source)?.push(edge);
    byTarget.get(edge.target)?.push(edge);
  }
  // Chains ending at a trunk node: branch rests (transitively) on trunk.
  for (const trunkId of trunkSet) {
    /** @param {string} current @param {SelectedEdge[]} chain @param {Set<string>} seen */
    const climb = (current, chain, seen) => {
      if (chain.length > 0) {
        const newNodes = chain.flatMap((edge) => [edge.source]).filter((id) => !selected.has(id) && !trunkSet.has(id));
        const unique = [...new Set(newNodes)];
        if (unique.length > 0 && unique.length <= 4 && chain.every((edge) => !selected.has(edge.source) || trunkSet.has(edge.source))) {
          out.push({ edges: [...chain], newNodes: unique, attachment: trunkId });
        }
      }
      if (chain.length >= 4) return;
      for (const edge of byTarget.get(current) ?? []) {
        if (seen.has(edge.source) || trunkSet.has(edge.source)) continue;
        seen.add(edge.source);
        climb(edge.source, [...chain, edge], seen);
        seen.delete(edge.source);
      }
    };
    climb(trunkId, [], new Set([trunkId]));
  }
  return out;
}

/**
 * @param {{ edges: SelectedEdge[]; newNodes: string[]; attachment: string }} left
 * @param {{ edges: SelectedEdge[]; newNodes: string[]; attachment: string }} right
 * @param {SelectedEdge[]} allEdges
 * @returns {number}
 */
function compareSupport(left, right, allEdges) {
  void allEdges;
  const high = (/** @type {{ edges: SelectedEdge[] }} */ entry) =>
    entry.edges.filter((edge) => edge.confidence === "HIGH").length;
  if (high(right) !== high(left)) return high(right) - high(left);
  if (left.newNodes.length !== right.newNodes.length) return left.newNodes.length - right.newNodes.length;
  const leftKey = left.edges.map((edge) => edge.pair_id).join(",");
  const rightKey = right.edges.map((edge) => edge.pair_id).join(",");
  return leftKey < rightKey ? -1 : 1;
}

/**
 * Drop the weakest edge on each directed cycle until acyclic.
 *
 * @param {SelectedEdge[]} edges
 * @param {Array<{ pair_id: string; reason: string }>} dropped
 * @returns {SelectedEdge[]}
 */
function breakDirectedCycles(edges, dropped) {
  const result = edges.map((edge) => ({ ...edge }));
  for (;;) {
    const cycle = findDirectedCycle(result);
    if (!cycle) return result;
    // Weakest: MEDIUM before HIGH, then stable larger pair id drops.
    const weakest = [...cycle].sort((a, b) => {
      const rank = (/** @type {SelectedEdge} */ edge) => (edge.confidence === "MEDIUM" ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return a.pair_id < b.pair_id ? 1 : -1;
    })[0];
    const index = result.indexOf(weakest);
    result.splice(index, 1);
    dropped.push({ pair_id: weakest.pair_id, reason: "dropped to break a directed cycle" });
  }
}

/**
 * @param {SelectedEdge[]} edges
 * @returns {SelectedEdge[] | null}
 */
function findDirectedCycle(edges) {
  /** @type {Map<string, string[]>} */
  const adjacency = new Map();
  /** @type {Map<string, SelectedEdge>} */
  const edgeByKey = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)?.push(edge.target);
    edgeByKey.set(`${edge.source}\u0000${edge.target}`, edge);
  }
  /** @type {Map<string, string>} */
  const state = new Map();
  /** @type {string[]} */
  const stack = [];
  /** @param {string} node @returns {string[] | null} */
  const visit = (node) => {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (state.get(next) === "visiting") {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (state.get(next) === undefined) {
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
        /** @type {SelectedEdge[]} */
        const out = [];
        for (let index = 0; index < cycle.length - 1; index += 1) {
          const edge = edgeByKey.get(`${cycle[index]}\u0000${cycle[index + 1]}`);
          if (edge) out.push(edge);
        }
        return out;
      }
    }
  }
  return null;
}

/**
 * @param {Set<string>} nodes
 * @param {SelectedEdge[]} edges
 * @returns {boolean}
 */
function isAcyclic(nodes, edges) {
  /** @type {Map<string, string[]>} */
  const outgoing = new Map([...nodes].map((id) => [id, []]));
  for (const edge of edges) {
    if (outgoing.has(edge.source)) outgoing.get(edge.source)?.push(edge.target);
  }
  /** @type {Map<string, number>} */
  const indeg = new Map([...nodes].map((id) => [id, 0]));
  for (const edge of edges) {
    if (indeg.has(edge.target)) indeg.set(edge.target, (indeg.get(edge.target) ?? 0) + 1);
  }
  const ready = [...nodes].filter((id) => (indeg.get(id) ?? 0) === 0);
  let count = 0;
  const work = [...ready];
  while (work.length > 0) {
    const current = /** @type {string} */ (work.pop());
    count += 1;
    for (const next of outgoing.get(current) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1);
      if (indeg.get(next) === 0) work.push(next);
    }
  }
  return count === nodes.size;
}

/**
 * Connected as an undirected graph.
 *
 * @param {Set<string>} nodes
 * @param {SelectedEdge[]} edges
 * @returns {boolean}
 */
function isConnected(nodes, edges) {
  if (nodes.size === 0) return true;
  /** @type {Map<string, string[]>} */
  const adjacency = new Map([...nodes].map((id) => [id, []]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  const first = [...nodes][0];
  const seen = new Set([first]);
  const queue = [first];
  while (queue.length > 0) {
    const current = /** @type {string} */ (queue.pop());
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === nodes.size;
}

/**
 * Longest-path ranks: leaves (no prerequisites) rank 0, every other node
 * one above its deepest prerequisite.
 *
 * @param {Set<string>} nodes
 * @param {SelectedEdge[]} edges
 * @returns {Record<string, number>}
 */
function computeRanks(nodes, edges) {
  /** @type {Map<string, string[]>} */
  const prereqs = new Map([...nodes].map((id) => [id, []]));
  for (const edge of edges) {
    if (prereqs.has(edge.source)) prereqs.get(edge.source)?.push(edge.target);
  }
  /** @type {Map<string, number>} */
  const memo = new Map();
  /** @param {string} id @returns {number} */
  const rankOf = (id) => {
    if (memo.has(id)) return /** @type {number} */ (memo.get(id));
    const below = (prereqs.get(id) ?? []).filter((next) => nodes.has(next));
    const rank = below.length === 0 ? 0 : 1 + Math.max(...below.map(rankOf));
    memo.set(id, rank);
    return rank;
  };
  /** @type {Record<string, number>} */
  const ranks = {};
  for (const id of nodes) ranks[id] = rankOf(id);
  return ranks;
}
