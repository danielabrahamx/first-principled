/**
 * Chapel Dependence flowchart (v8 ticket 10): viewmodel plus pure geometry.
 *
 * The Tree is a first-principles dependence path of one Reality Map. Crown
 * (the typed concept) at the bottom, supporting knowledge above. Y follows
 * `built-on` / `depends-on` / `abstraction-of` edges, not observation dates.
 * Cards sit on the spine (not a hanging cladogram). Extra parents merge in
 * from the side. DOMAIN and STRUCTURAL nodes are cards (`label`, layer name,
 * `description`). EPIPHANY nodes are not cards; their `because` sits on the
 * downward shaft, and hover carries discoverer/date/note when not UNKNOWN.
 *
 * `treeLayout` takes the Reality Map and a viewport width so 320/375 never
 * page-overflow. `spinePaths` is the SVG stroke list (downward arrows).
 *
 * Pure and DOM-free so node:test covers ranks, y-order, and fit.
 */

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */

export const LAYOUT_EDGE_TYPES = ["built-on", "depends-on", "abstraction-of"];

export const TREE_CARD_WIDTH = 250;
export const TREE_CARD_HEIGHT = 148;
export const TREE_CARD_GAP = 72;
export const TREE_ROOT_WIDTH = 250;
export const TREE_ROOT_HEIGHT = 148;
export const TREE_ROOT_GAP = 72;
export const TREE_BAND_PAD = 10;
export const TREE_COL_GAP = 36;
export const TREE_HANG = 0;
export const TREE_STAGE_PAD = 16;
/** Kept for callers; Chapel puts the layer name on the card, not a hang caption. */
export const TREE_LABEL_SLOT = 0;
/** Below this width, extra parents stack in one column instead of fanning out. */
export const TREE_TWO_UP_MIN_WIDTH = 480;
export const TREE_ARROW_GAP = 56;

/**
 * Layout-only edges: source rests on target, so target sits above (smaller Y).
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
 * @param {any} node
 */
export function isCardNode(node) {
  if (!node || typeof node !== "object") return false;
  return node.role !== "EPIPHANY";
}

/**
 * Hover copy for a labeled arrow. Discoverer and/or date when that field's
 * mark is not UNKNOWN, plus note when nonempty. No hover when both
 * discoverer and date are UNKNOWN. Never invent a name or year.
 *
 * @param {any} basis
 * @returns {{ discoverer: string; date: string; note: string } | null}
 */
export function arrowHoverFromBasis(basis) {
  if (!basis || typeof basis !== "object") return null;
  const show = (/** @type {any} */ field) => {
    if (!field || typeof field !== "object") return "";
    if (field.mark === "UNKNOWN") return "";
    return typeof field.value === "string" ? field.value.trim() : "";
  };
  const discoverer = show(basis.discoverer);
  const date = show(basis.date);
  const note = typeof basis.note === "string" ? basis.note.trim() : "";
  if (!discoverer && !date) return null;
  return { discoverer, date, note };
}

/**
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
 * @param {Map<string, string[]>} parentsOf
 * @param {string[]} ids
 */
function ranksFromParents(parentsOf, ids) {
  /** @type {Map<string, number>} */
  const ranks = new Map();
  const visiting = new Set();
  /** @param {string} id */
  function rankOf(id) {
    if (ranks.has(id)) return /** @type {number} */ (ranks.get(id));
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const deps = parentsOf.get(id) || [];
    let rank = 0;
    for (const dep of deps) rank = Math.max(rank, rankOf(dep) + 1);
    visiting.delete(id);
    ranks.set(id, rank);
    return rank;
  }
  for (const id of ids) rankOf(id);
  return ranks;
}

/**
 * @param {string} id
 * @param {Map<string, any>} byId
 * @param {Array<{ source: string; target: string; because: string }>} edges
 * @param {string} because
 * @param {{ discoverer: string; date: string; note: string } | null} hover
 * @param {number} depth
 */
function expandCardSupports(id, byId, edges, because, hover, depth) {
  if (depth > 8) return [];
  const node = byId.get(id);
  if (!node) return [];
  if (isCardNode(node)) {
    return [{ target: id, because, hover }];
  }
  const nextHover = arrowHoverFromBasis(node.basis) || hover;
  /** @type {Array<{ target: string; because: string; hover: { discoverer: string; date: string; note: string } | null }>} */
  const out = [];
  for (const edge of edges) {
    if (edge.source !== id) continue;
    const because2 = because || edge.because;
    out.push(
      ...expandCardSupports(edge.target, byId, edges, because2, nextHover, depth + 1)
    );
  }
  return out;
}

/**
 * @param {any} map
 * @param {string} layerId
 */
function layerNameOf(map, layerId) {
  const layers = /** @type {Array<{ id?: unknown; name?: unknown }>} */ (
    map && Array.isArray(map.layers) ? map.layers : []
  );
  const layer = layers.find((item) => item && item.id === layerId);
  if (layer && typeof layer.name === "string") return layer.name;
  return typeof layerId === "string" ? layerId : "";
}

/**
 * Chapel geometry: crown at the bottom, foundations above, cards on the
 * spine, extra parents fanning in. `options.width` is the viewport.
 *
 * @param {RealityMap | null | undefined} realityMap
 * @param {{ width?: number }} [options]
 */
export function treeLayout(realityMap, options = {}) {
  const viewport = Math.max(320, Number(options.width) || 375);
  const mobile = viewport < TREE_TWO_UP_MIN_WIDTH;
  const nodes = realityMap && Array.isArray(realityMap.nodes) ? realityMap.nodes : [];
  const mapEdges = realityMap && Array.isArray(realityMap.edges) ? realityMap.edges : [];
  const rawEdges = layoutEdges(realityMap).map((edge) => {
    const full = mapEdges.find(
      (item) => item && item.source === edge.source && item.target === edge.target
    );
    return {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      because: full && typeof full.because === "string" ? full.because.trim() : "",
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cardNodes = nodes.filter(isCardNode);
  const tree = realityTree(realityMap);

  /** @type {Map<string, Array<{ target: string; because: string; hover: { discoverer: string; date: string; note: string } | null }>>} */
  const supportsOf = new Map(cardNodes.map((node) => [node.id, []]));
  for (const node of cardNodes) {
    const seen = new Set();
    /** @type {Array<{ target: string; because: string; hover: { discoverer: string; date: string; note: string } | null }>} */
    const found = [];
    for (const edge of rawEdges) {
      if (edge.source !== node.id) continue;
      const targetNode = byId.get(edge.target);
      const hover =
        targetNode && !isCardNode(targetNode) ? arrowHoverFromBasis(targetNode.basis) : null;
      for (const support of expandCardSupports(
        edge.target,
        byId,
        rawEdges,
        edge.because,
        hover,
        0
      )) {
        if (seen.has(support.target) || support.target === node.id) continue;
        seen.add(support.target);
        found.push(support);
      }
    }
    supportsOf.set(node.id, found);
  }

  /** @type {Map<string, string[]>} */
  const parentsOf = new Map(
    cardNodes.map((node) => [node.id, (supportsOf.get(node.id) || []).map((item) => item.target)])
  );
  const ranks = ranksFromParents(
    parentsOf,
    cardNodes.map((node) => node.id)
  );
  const maxRank = cardNodes.reduce((m, node) => Math.max(m, ranks.get(node.id) || 0), 0);

  /** @type {Map<number, typeof cardNodes>} */
  const byRank = new Map();
  for (const node of cardNodes) {
    const rank = ranks.get(node.id) || 0;
    const row = byRank.get(rank);
    if (row) row.push(node);
    else byRank.set(rank, [node]);
  }

  /** @type {Map<string, number>} */
  const colOf = new Map();
  const crownIds = (byRank.get(maxRank) || []).map((node) => node.id).sort();
  crownIds.forEach((id, i) => colOf.set(id, i));

  for (let r = maxRank; r >= 0; r--) {
    const row = (byRank.get(r) || [])
      .slice()
      .sort((a, b) => (colOf.get(a.id) || 0) - (colOf.get(b.id) || 0));
    for (const node of row) {
      if (!colOf.has(node.id)) continue;
      const col = /** @type {number} */ (colOf.get(node.id));
      const parents = parentsOf.get(node.id) || [];
      if (parents.length === 0) continue;
      const main = mainParentOf(parents, ranks);
      if (main && !colOf.has(main)) colOf.set(main, col);
      if (mobile) {
        for (const extra of parents.filter((parent) => parent !== main && !colOf.has(parent))) {
          colOf.set(extra, 0);
        }
        continue;
      }
      const extras = parents.filter((parent) => parent !== main && !colOf.has(parent)).sort();
      let sign = -1;
      let slot = 1;
      for (const extra of extras) {
        colOf.set(extra, sign < 0 ? -slot : slot);
        sign *= -1;
        if (sign === -1) slot += 1;
      }
    }
  }

  for (const node of cardNodes) {
    if (!colOf.has(node.id)) colOf.set(node.id, 0);
  }

  const usedColsAtRank = new Map();
  for (let r = maxRank; r >= 0; r--) {
    const row = (byRank.get(r) || [])
      .slice()
      .sort((a, b) => (colOf.get(a.id) || 0) - (colOf.get(b.id) || 0));
    let used = usedColsAtRank.get(r);
    if (used === undefined) {
      used = new Set();
      usedColsAtRank.set(r, used);
    }
    for (const node of row) {
      let col = mobile ? 0 : colOf.get(node.id) || 0;
      if (mobile) {
        colOf.set(node.id, 0);
        used.add(0);
        continue;
      }
      if (used.has(col)) {
        for (let dist = 1; ; dist++) {
          if (!used.has(col - dist)) {
            col = col - dist;
            break;
          }
          if (!used.has(col + dist)) {
            col = col + dist;
            break;
          }
        }
        colOf.set(node.id, col);
      }
      used.add(col);
    }
  }

  const cols = [...colOf.values()];
  const minCol = cols.length === 0 ? 0 : Math.min(...cols);
  const maxColVal = cols.length === 0 ? 0 : Math.max(...cols);
  const leftCols = Math.max(0, -minCol);
  const colCount = maxColVal - minCol + 1;

  let cardWidth = Math.min(TREE_CARD_WIDTH, Math.max(160, viewport - TREE_STAGE_PAD * 2));
  if (!mobile && colCount > 1) {
    cardWidth = Math.min(
      TREE_CARD_WIDTH,
      Math.max(
        160,
        Math.floor((viewport - TREE_STAGE_PAD * 2 - (colCount - 1) * TREE_COL_GAP) / colCount)
      )
    );
  }
  const colPitch = cardWidth + TREE_COL_GAP;
  let trunk = TREE_STAGE_PAD + leftCols * colPitch + cardWidth / 2;
  if (leftCols === 0 && colCount <= 1) trunk = viewport / 2;

  /**
   * @param {number} col
   */
  function xForCol(col) {
    return trunk - cardWidth / 2 + col * colPitch;
  }

  const rightEdge =
    cardNodes.length === 0
      ? trunk + cardWidth / 2
      : Math.max(...[...colOf.values()].map((col) => xForCol(col) + cardWidth));
  const leftEdge =
    cardNodes.length === 0 ? 0 : Math.min(...[...colOf.values()].map((col) => xForCol(col)));
  const shift = leftEdge < TREE_STAGE_PAD ? TREE_STAGE_PAD - leftEdge : 0;
  const width = Math.max(viewport, rightEdge + shift + TREE_STAGE_PAD);

  /** @type {Map<number, number>} */
  const yOfRank = new Map();
  /** @type {Map<string, number>} */
  const stackOf = new Map();
  let cursorY = TREE_STAGE_PAD;
  for (let rank = 0; rank <= maxRank; rank++) {
    const row = (byRank.get(rank) || []).slice().sort((a, b) => a.id.localeCompare(b.id));
    if (rank > 0) cursorY += TREE_ARROW_GAP;
    yOfRank.set(rank, cursorY);
    if (mobile && row.length > 1) {
      row.forEach((node, index) => stackOf.set(node.id, index));
      cursorY += row.length * TREE_CARD_HEIGHT + Math.max(0, row.length - 1) * 16;
    } else {
      row.forEach((node) => stackOf.set(node.id, 0));
      cursorY += TREE_CARD_HEIGHT;
    }
  }

  /** @type {Map<string, any>} */
  const cardById = new Map();
  for (const node of cardNodes) {
    const rank = ranks.get(node.id) || 0;
    const col = colOf.get(node.id) || 0;
    const stack = stackOf.get(node.id) || 0;
    const x = xForCol(col) + shift;
    const y = (yOfRank.get(rank) ?? TREE_STAGE_PAD) + stack * (TREE_CARD_HEIGHT + 16);
    cardById.set(node.id, {
      id: node.id,
      label: node.label,
      tag: layerNameOf(realityMap, node.layer),
      gloss: typeof node.description === "string" ? node.description : "",
      layer: node.layer,
      combines: combineLayerCount(node, byId),
      rank,
      rib: col !== 0,
      crown: rank === maxRank,
      x,
      y,
      cx: x + cardWidth / 2,
      cy: y + TREE_CARD_HEIGHT / 2,
      width: cardWidth,
      height: TREE_CARD_HEIGHT,
    });
  }

  trunk += shift;
  const crownCard = [...cardById.values()].find((card) => card.crown);
  const root = crownCard
    ? {
        x: crownCard.x,
        y: crownCard.y,
        width: crownCard.width,
        height: crownCard.height,
        cx: crownCard.cx,
      }
    : {
        x: trunk - cardWidth / 2,
        y: 0,
        width: cardWidth,
        height: TREE_ROOT_HEIGHT,
        cx: trunk,
      };

  const cards = [...cardById.values()];

  /** @type {Array<any>} */
  const arrows = [];
  for (const node of cardNodes) {
    const child = cardById.get(node.id);
    if (!child) continue;
    const supports = supportsOf.get(node.id) || [];
    const mergeY = child.y - 22;
    for (const support of supports) {
      const parent = cardById.get(support.target);
      if (!parent) continue;
      const d =
        parent.cx === child.cx
          ? `M ${parent.cx} ${parent.y + parent.height} V ${child.y}`
          : `M ${parent.cx} ${parent.y + parent.height} V ${mergeY} H ${child.cx} V ${child.y}`;
      arrows.push({
        source: child.id,
        target: parent.id,
        because: support.because,
        hover: support.hover,
        d,
        labelX: (parent.cx + child.cx) / 2,
        labelY: (parent.y + parent.height + child.y) / 2,
      });
    }
  }

  const branches = tree.branches.map((branch) => {
    const branchCards = branch.nodes
      .flatMap((node) => {
        const card = cardById.get(node.id);
        return card ? [card] : [];
      })
      .sort((a, b) => a.y - b.y);
    const first = branchCards[0];
    const last = branchCards[branchCards.length - 1];
    const top = first ? first.y - TREE_BAND_PAD : TREE_STAGE_PAD;
    const bottom = last ? last.y + TREE_CARD_HEIGHT + TREE_BAND_PAD : top;
    return {
      id: branch.id,
      name: branch.name,
      cx: trunk,
      divergenceY: first ? first.y : top,
      labelX: first ? first.x : trunk,
      labelY: first ? first.y : top,
      labelWidth: cardWidth,
      firstCardY: first ? first.y : top,
      bandY: top,
      bandHeight: Math.max(bottom - top, TREE_CARD_HEIGHT),
      cards: branchCards,
    };
  });

  const lastBottom =
    cards.length === 0
      ? TREE_STAGE_PAD + TREE_ROOT_HEIGHT
      : Math.max(...cards.map((card) => card.y + card.height));

  return {
    width,
    height: lastBottom + 24,
    trunk,
    cardWidth,
    root,
    branches,
    cards,
    cardById,
    edges: cardNodes.flatMap((node) =>
      (parentsOf.get(node.id) || []).map((target) => ({
        source: node.id,
        target,
        type: "depends-on",
      }))
    ),
    arrows,
    parentsOf,
    maxRank,
  };
}

/**
 * SVG strokes: one downward arrow per rest-on, support above dependent.
 * Accepts any chapel-shaped layout (tree or grow); only `arrows` is read.
 *
 * @param {{ arrows?: Array<{ d: string }> }} layout
 * @returns {string[]}
 */
export function spinePaths(layout) {
  if (Array.isArray(layout.arrows) && layout.arrows.length > 0) {
    return layout.arrows.map((arrow) => arrow.d);
  }
  return [];
}

/** @deprecated use spinePaths */
export const cladogramPaths = spinePaths;

/**
 * Chapel draws fan-in as the extra-parent arrows in `spinePaths`.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {Array<{ id: string; d: string }>}
 */
export function convergenceFanPaths(layout) {
  void layout;
  return [];
}
