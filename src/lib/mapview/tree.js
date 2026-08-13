/**
 * Dependence-path Tree (v5 ticket 03): viewmodel plus pure geometry.
 *
 * The Tree is a first-principles dependence path of one Reality Map. Crown
 * (the concept) at the top, foundations at the bottom. Y follows existing
 * `built-on` / `depends-on` / `abstraction-of` edges, not observation dates.
 * Dates stay on hover. Layers are named bands. A linear chain stays on one
 * trunk; extra parents of a convergence node occupy full columns so the
 * path reads as a tree.
 *
 * `treeLayout` takes the Reality Map and a viewport width so 320/375 never
 * page-overflow. `spinePaths` is the SVG stroke list (trunk first). One-shot
 * grow in motion.js still rides `.tree-layer` wrappers, deepest band first.
 *
 * Pure and DOM-free so node:test covers ranks, y-order, and fit.
 */

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */

export const LAYOUT_EDGE_TYPES = ["built-on", "depends-on", "abstraction-of"];

export const TREE_CARD_WIDTH = 280;
export const TREE_CARD_HEIGHT = 64;
export const TREE_CARD_GAP = 28;
export const TREE_ROOT_WIDTH = 220;
export const TREE_ROOT_HEIGHT = 74;
export const TREE_ROOT_GAP = 36;
export const TREE_BAND_PAD = 10;
export const TREE_COL_GAP = 32;
export const TREE_STAGE_PAD = 16;
/** Stage widths above this may draw convergence fans (chips always show). */
export const TREE_TWO_UP_MIN_WIDTH = 480;

/**
 * Layout-only edges: source rests on target, so target sits lower.
 *
 * @param {RealityMap | null | undefined} map
 * @returns {Array<{ source: string; target: string; type: string }>}
 */
export function layoutEdges(map) {
  const edges = map && Array.isArray(map.edges) ? map.edges : [];
  return edges.filter(
    (edge) =>
      edge &&
      typeof edge.source === "string" &&
      typeof edge.target === "string" &&
      LAYOUT_EDGE_TYPES.includes(edge.type)
  );
}

/**
 * Longest-path rank from foundations. Rank 0 = no layout parents.
 * Observation dates are ignored.
 *
 * @param {RealityMap | null | undefined} map
 * @returns {Map<string, number>}
 */
export function dependenceRanks(map) {
  const nodes = map && Array.isArray(map.nodes) ? map.nodes : [];
  const edges = layoutEdges(map);
  /** @type {Map<string, string[]>} */
  const parents = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    const list = parents.get(edge.source);
    if (list && parents.has(edge.target)) list.push(edge.target);
  }

  /** @type {Map<string, number>} */
  const ranks = new Map();
  const visiting = new Set();

  /** @param {string} id */
  function rankOf(id) {
    if (ranks.has(id)) return /** @type {number} */ (ranks.get(id));
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const deps = parents.get(id) || [];
    let rank = 0;
    for (const dep of deps) rank = Math.max(rank, rankOf(dep) + 1);
    visiting.delete(id);
    ranks.set(id, rank);
    return rank;
  }

  for (const node of nodes) rankOf(node.id);
  return ranks;
}

/**
 * Distinct lower-layer count of a node's `combines` list.
 *
 * @param {any} node
 * @param {Map<string, any>} byId
 */
function combineLayerCount(node, byId) {
  if (!node || !Array.isArray(node.combines)) return 0;
  const layers = new Set();
  for (const entry of node.combines) {
    if (!entry || typeof entry.id !== "string") continue;
    const source = byId.get(entry.id);
    if (source && typeof source.layer === "string") layers.add(source.layer);
  }
  return layers.size;
}

/**
 * Layer-grouped view of the map (chain order, crown-nearest first). No date
 * sort. Used by tests and as the grow-band grouping for `treeLayout`.
 *
 * @param {RealityMap | null | undefined} realityMap
 * @returns {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string; combines: number }> }> }}
 */
export function realityTree(realityMap) {
  const layers = realityMap && Array.isArray(realityMap.layers) ? realityMap.layers : [];
  const nodes = realityMap && Array.isArray(realityMap.nodes) ? realityMap.nodes : [];
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const branches = layers.map((layer) => {
    const ids = Array.isArray(layer.nodes) ? layer.nodes : [];
    return {
      id: layer.id,
      name: layer.name,
      nodes: ids.flatMap((id) => {
        const node = byId.get(id);
        if (!node) return [];
        return [
          {
            id: node.id,
            label: node.label,
            combines: combineLayerCount(node, byId),
          },
        ];
      }),
    };
  });
  branches.reverse();

  return {
    rootLabel:
      realityMap && typeof realityMap.concept === "string" ? realityMap.concept : "",
    branches,
  };
}

/**
 * Highest-rank layout parent: the main trunk continues through this one.
 *
 * @param {string[]} parents
 * @param {Map<string, number>} ranks
 */
function mainParentOf(parents, ranks) {
  if (parents.length === 0) return null;
  let main = parents[0];
  for (const parent of parents) {
    if ((ranks.get(parent) || 0) > (ranks.get(main) || 0)) main = parent;
  }
  return main;
}

/**
 * Absolute geometry: crown, trunk, full-width columns at convergence,
 * named layer bands. `options.width` is the viewport; the stage may be
 * wider when branches need more than one column.
 *
 * @param {RealityMap | null | undefined} realityMap
 * @param {{ width?: number }} [options]
 */
export function treeLayout(realityMap, options = {}) {
  const viewport = Math.max(320, Number(options.width) || 375);
  const nodes = realityMap && Array.isArray(realityMap.nodes) ? realityMap.nodes : [];
  const edges = layoutEdges(realityMap);
  const ranks = dependenceRanks(realityMap);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const tree = realityTree(realityMap);

  /** @type {Map<string, string[]>} */
  const parentsOf = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const list = parentsOf.get(edge.source);
    if (list) list.push(edge.target);
  }

  const maxRank = nodes.reduce((m, node) => Math.max(m, ranks.get(node.id) || 0), 0);
  const cardWidth = Math.min(TREE_CARD_WIDTH, viewport - TREE_STAGE_PAD * 2);
  const rootWidth = Math.min(TREE_ROOT_WIDTH, cardWidth);
  const colPitch = cardWidth + TREE_COL_GAP;

  /** @type {Map<number, typeof nodes>} */
  const byRank = new Map();
  for (const node of nodes) {
    const rank = ranks.get(node.id) || 0;
    const row = byRank.get(rank);
    if (row) row.push(node);
    else byRank.set(rank, [node]);
  }

  /** @type {Map<string, number>} */
  const cxOf = new Map();

  /**
   * @param {string[]} ids
   * @param {number} centerX
   */
  function packRow(ids, centerX) {
    const pending = ids.filter((id) => !cxOf.has(id));
    if (pending.length === 0) return;
    const total = pending.length * cardWidth + (pending.length - 1) * TREE_COL_GAP;
    let x = centerX - total / 2 + cardWidth / 2;
    for (const id of pending) {
      cxOf.set(id, x);
      x += colPitch;
    }
  }

  const crownIds = (byRank.get(maxRank) || []).map((node) => node.id).sort();
  packRow(crownIds, 0);

  for (let r = maxRank; r >= 0; r--) {
    const row = (byRank.get(r) || [])
      .slice()
      .sort((a, b) => (cxOf.get(a.id) || 0) - (cxOf.get(b.id) || 0));
    for (const node of row) {
      if (!cxOf.has(node.id)) continue;
      const parents = parentsOf.get(node.id) || [];
      if (parents.length === 0) continue;
      const main = mainParentOf(parents, ranks);
      if (main && !cxOf.has(main)) cxOf.set(main, /** @type {number} */ (cxOf.get(node.id)));
      const extras = parents
        .filter((parent) => parent !== main && !cxOf.has(parent))
        .sort();
      let sign = 1;
      let slot = 1;
      for (const extra of extras) {
        cxOf.set(extra, /** @type {number} */ (cxOf.get(node.id)) + sign * slot * colPitch);
        sign *= -1;
        if (sign === 1) slot += 1;
      }
    }
  }

  for (let r = maxRank; r >= 0; r--) {
    packRow(
      (byRank.get(r) || []).map((node) => node.id).sort(),
      0
    );
  }

  for (let r = 0; r <= maxRank; r++) {
    const row = (byRank.get(r) || [])
      .slice()
      .sort((a, b) => (cxOf.get(a.id) || 0) - (cxOf.get(b.id) || 0));
    for (let i = 1; i < row.length; i++) {
      const prev = /** @type {number} */ (cxOf.get(row[i - 1].id));
      const minCx = prev + colPitch;
      if (/** @type {number} */ (cxOf.get(row[i].id)) < minCx) cxOf.set(row[i].id, minCx);
    }
  }

  const cxs = nodes.map((node) => cxOf.get(node.id) || 0);
  const minLeft = cxs.length === 0 ? 0 : Math.min(...cxs) - cardWidth / 2;
  const maxRight = cxs.length === 0 ? cardWidth : Math.max(...cxs) + cardWidth / 2;
  const width = Math.max(viewport, maxRight - minLeft + TREE_STAGE_PAD * 2);
  const shift = width / 2 - (minLeft + maxRight) / 2;
  for (const [id, cx] of cxOf) cxOf.set(id, cx + shift);

  const crownXs = crownIds.map((id) => cxOf.get(id) || 0);
  const trunk =
    crownXs.length === 0 ? width / 2 : crownXs.reduce((sum, x) => sum + x, 0) / crownXs.length;

  const root = {
    x: trunk - rootWidth / 2,
    y: 0,
    width: rootWidth,
    height: TREE_ROOT_HEIGHT,
    cx: trunk,
  };

  /** @type {Map<string, { id: string; label: string; layer: string; combines: number; rank: number; rib: boolean; x: number; y: number; cx: number; width: number; height: number }>} */
  const cardById = new Map();
  for (const node of nodes) {
    const rank = ranks.get(node.id) || 0;
    const fromTop = maxRank - rank;
    const cx = /** @type {number} */ (cxOf.get(node.id));
    const y =
      TREE_ROOT_HEIGHT +
      TREE_ROOT_GAP +
      fromTop * (TREE_CARD_HEIGHT + TREE_CARD_GAP);
    cardById.set(node.id, {
      id: node.id,
      label: node.label,
      layer: node.layer,
      combines: combineLayerCount(node, byId),
      rank,
      rib: Math.abs(cx - trunk) > 1,
      x: cx - cardWidth / 2,
      y,
      cx,
      width: cardWidth,
      height: TREE_CARD_HEIGHT,
    });
  }

  const cards = [...cardById.values()];

  const branches = tree.branches.map((branch) => {
    const branchCards = branch.nodes
      .flatMap((node) => {
        const card = cardById.get(node.id);
        return card ? [card] : [];
      })
      .sort((a, b) => a.y - b.y);
    const first = branchCards[0];
    const last = branchCards[branchCards.length - 1];
    const top = first ? first.y - TREE_BAND_PAD : TREE_ROOT_HEIGHT + TREE_ROOT_GAP;
    const bottom = last ? last.y + TREE_CARD_HEIGHT + TREE_BAND_PAD : top;
    return {
      id: branch.id,
      name: branch.name,
      cx: trunk,
      divergenceY: first ? first.y : top,
      labelY: top + 8,
      firstCardY: first ? first.y : top,
      bandY: top,
      bandHeight: Math.max(bottom - top, TREE_CARD_HEIGHT),
      cards: branchCards,
    };
  });

  const lastBottom =
    cards.length === 0
      ? TREE_ROOT_HEIGHT + TREE_ROOT_GAP
      : Math.max(...cards.map((card) => card.y + TREE_CARD_HEIGHT));

  return {
    width,
    height: lastBottom + 24,
    trunk,
    cardWidth,
    root,
    branches,
    cards,
    cardById,
    edges,
    parentsOf,
    maxRank,
  };
}

/**
 * SVG strokes: trunk from the crown into the first trunk card, then one
 * connector per layout edge (vertical on the trunk, elbow into a column).
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {string[]}
 */
export function spinePaths(layout) {
  /** @type {string[]} */
  const d = [];
  const onSpine = layout.cards
    .filter((card) => !card.rib)
    .sort((a, b) => a.y - b.y);
  if (onSpine.length === 0) return d;
  const first = onSpine[0];
  d.push(`M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${first.y}`);
  for (const edge of layout.edges) {
    const child = layout.cardById.get(edge.source);
    const parent = layout.cardById.get(edge.target);
    if (!child || !parent) continue;
    const x1 = parent.cx;
    const y1 = parent.y;
    const x2 = child.cx;
    const y2 = child.y + child.height;
    if (Math.abs(x1 - x2) < 1) d.push(`M ${x1} ${y1} V ${y2}`);
    else {
      const midY = (y1 + y2) / 2;
      d.push(`M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`);
    }
  }
  return d;
}

/** @deprecated use spinePaths - kept as the motion/render call name during the port */
export const cladogramPaths = spinePaths;

/**
 * Convergence fan-in strokes: one short diagonal per combined field into
 * the card bottom. Chips always show; fans are optional on a wide stage.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {Array<{ id: string; d: string }>}
 */
export function convergenceFanPaths(layout) {
  /** @type {Array<{ id: string; d: string }>} */
  const paths = [];
  for (const card of layout.cards) {
    const fields = card.combines;
    if (typeof fields !== "number" || fields < 2) continue;
    const cx = card.cx;
    const bottom = card.y + TREE_CARD_HEIGHT;
    const fanHalf = card.width / 2 - 18;
    const segments = [];
    for (let i = 0; i < fields; i++) {
      const t = fields === 1 ? 0.5 : i / (fields - 1);
      const x = cx - fanHalf + t * 2 * fanHalf;
      const startY = bottom + 20 + (Math.abs(x - cx) / fanHalf) * 8;
      segments.push(`M ${x} ${startY} L ${cx} ${bottom}`);
    }
    paths.push({ id: card.id, d: segments.join(" ") });
  }
  return paths;
}
