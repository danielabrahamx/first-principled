/**
 * Reality phylogenetic tree (ticket 13, design spec): viewmodel plus pure
 * geometry for the reality view.
 *
 * Why a tree: a reality map IS a lineage. Every concept is built on simpler
 * concepts beneath it (built-on / part-of / depends-on edges), which is
 * exactly the branching structure of a phylogenetic tree. The concept is the
 * crown; its foundations branch down like ancestry.
 *
 * `realityTree` turns the reality map into {rootLabel, branches}: the root is
 * the concept word, and each layer is a branch of stacked node cards. Layers
 * are ordered chronologically - the most recently-observed layer nearest the
 * crown, the oldest foundations lowest - so the tree reads as discovery
 * history, oldest at the bottom. `treeLayout` and `cladogramPaths` turn that
 * into absolute card positions and SVG strokes.
 *
 * The geometry is the v1 ticket 17 cladogram (v4 ticket 03): a central trunk
 * descends from the crown and each layer diverges at its own depth - even
 * branches right, odd left, deepest-nearest the trunk per side. Strict
 * chronology (ticket 10) drives the ordering: within a layer, cards sort by
 * observation date oldest first (unknown dates last, in original order,
 * stable); layers sort by their oldest date, oldest nearest the foundation.
 * The layer chain structure is the invariant - the sort never moves a node
 * across a layer boundary (ticket 08 contract).
 *
 * Reading direction: concept at top, oldest foundations at the bottom; sap
 * rises bottom to top. One-shot grow (ticket 03) rides this geometry.
 *
 * This is a comparison view: it renders full reality content (layer names,
 * node labels), so the map page may mount it ONLY at session end - the
 * no-leak rule binds mid-session only.
 *
 * Pure and DOM-free so node:test covers the shapes and the geometry.
 */

import { realitySections } from "./comparison.js";
import { observationOf, observationDateKey } from "./observation.js";

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */

/** The default card metrics shared by the tree renderer. */
export const TREE_CARD_WIDTH = 280;
export const TREE_CARD_HEIGHT = 64;
/** Horizontal gap between branch columns. */
export const TREE_COLUMN_GAP = 32;
/** Vertical gap between stacked cards inside a branch. */
export const TREE_CARD_GAP = 12;
/** Root card box. */
export const TREE_ROOT_WIDTH = 220;
export const TREE_ROOT_HEIGHT = 74;
/** Root card bottom to the first branch divergence point. */
export const TREE_ROOT_GAP = 72;
/** Vertical step between successive branch divergence points. */
export const TREE_DIVERGENCE_STEP = 36;
/** Branch divergence point to the first card top (the branch label sits
 * between). */
export const TREE_LABEL_GAP = 34;
/** Stage widths above this may draw convergence fans (chips always show). */
export const TREE_TWO_UP_MIN_WIDTH = 480;

/**
 * The first number in a node's observation date, as a sort key - 600 BC ->
 * 600, "1947" -> 1947. Nodes with no usable date sort last (Infinity).
 *
 * @param {any} node
 * @returns {number}
 */
function nodeDateKey(node) {
  const view = observationOf(node);
  return observationDateKey(view.date ? view.date.value : null);
}

/**
 * The tree's visual model: the concept as the root, each reality layer as a
 * branch of node cards, in strict chronological order (ticket 10) - cards
 * oldest first within each layer, layers oldest at the bottom (nearest the
 * foundation), stable. The layer chain structure is never re-sorted across
 * layer boundaries.
 *
 * Ticket 13 convergence: a node that carries a `combines` list is a
 * CONVERGENCE node - a true synthesis of discoveries from several fields.
 * Its card records `combines`: the number of DISTINCT LAYERS its enabling
 * observations come from (the "combines N fields" chip), so the renderer can
 * fan in that many branches and label the count.
 *
 * @param {RealityMap | null | undefined} realityMap
 * @returns {{ rootLabel: string; branches: Array<{ id: string; name: string; oldestDate: number; nodes: Array<{ id: string; label: string; combines: number }> }> }}
 */
export function realityTree(realityMap) {
  const sections = realitySections(realityMap);
  const byId = new Map(
    realityMap && Array.isArray(realityMap.nodes)
      ? realityMap.nodes.map((node) => [node.id, node])
      : []
  );

  /** The distinct layers a node's combines list reaches into: a convergence
   * node combines enabling observations from 2+ distinct lower layers.
   * @param {any} node */
  function combineLayerCount(node) {
    if (!node || !Array.isArray(node.combines)) return 0;
    const layers = new Set();
    for (const entry of node.combines) {
      if (!entry || typeof entry.id !== "string") continue;
      const source = byId.get(entry.id);
      if (source && typeof source.layer === "string") layers.add(source.layer);
    }
    return layers.size;
  }

  // Cards sorted by date within each layer: oldest first, unknown dates last
  // in original order (stable). Each layer keeps its own oldest date for the
  // layer ordering below.
  const layers = sections.map((section) => {
    const indexed = section.nodes.map((node, index) => {
      const date = nodeDateKey(byId.get(node.id));
      const combines = combineLayerCount(byId.get(node.id));
      return { id: node.id, label: node.label, date, index, combines };
    });
    indexed.sort((a, b) => a.date - b.date || a.index - b.index);
    return {
      id: section.id,
      name: section.name,
      oldestDate: indexed.length > 0 ? indexed[0].date : Infinity,
      nodes: indexed.map((node) => ({
        id: node.id,
        label: node.label,
        combines: node.combines,
      })),
    };
  });

  // Layers ordered by their oldest date, oldest at the bottom (the foundation
  // sits lowest): branch 0 renders nearest the crown, so sort newest-oldest-
  // date first. Stable so equal-date layers keep their chain order.
  const indexedLayers = layers.map((layer, index) => ({ layer, index }));
  indexedLayers.sort(
    (a, b) => b.layer.oldestDate - a.layer.oldestDate || a.index - b.index
  );

  return {
    rootLabel:
      realityMap && typeof realityMap.concept === "string" ? realityMap.concept : "",
    branches: indexedLayers.map(({ layer }) => ({
      id: layer.id,
      name: layer.name,
      oldestDate: layer.oldestDate,
      nodes: layer.nodes,
    })),
  };
}

/**
 * Absolute geometry for the tree as a phylogenetic cladogram (v1 ticket 17,
 * v4 ticket 03): root card at the top, a central trunk, layers hanging left
 * and right (even right, odd left, deepest-nearest the trunk per side).
 * `options.width` is ignored; the stage width is intrinsic so wide maps
 * scroll the stage horizontally (the v1 375px fit). A convergence node's
 * card carries its `combines` count (distinct combined layers, ticket 13).
 *
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; oldestDate: number; nodes: Array<{ id: string; label: string; combines?: number }> }> }} tree
 *   from realityTree.
 * @param {object} [_options] - kept for call-site compatibility; unused.
 * @returns {{
 *   width: number;
 *   height: number;
 *   trunk: number;
 *   root: { x: number; y: number; width: number; height: number; cx: number };
 *   branches: Array<{
 *     id: string;
 *     name: string;
 *     cx: number;
 *     divergenceY: number;
 *     labelY: number;
 *     firstCardY: number;
 *     cards: Array<{ id: string; label: string; combines: number; x: number; y: number; cx: number }>;
 *   }>;
 * }}
 */
export function treeLayout(tree, _options = {}) {
  const count = tree.branches.length;
  const step = TREE_CARD_WIDTH + TREE_COLUMN_GAP;
  /** @param {number} rank */
  const dist = (rank) => TREE_CARD_WIDTH / 2 + TREE_COLUMN_GAP / 2 + rank * step;
  /** @param {number} rank */
  const extent = (rank) => dist(rank) + TREE_CARD_WIDTH / 2;
  /** @param {number} i */
  const divergenceY = (i) =>
    TREE_ROOT_HEIGHT + TREE_ROOT_GAP + i * TREE_DIVERGENCE_STEP;

  /** @type {number[]} */
  const cx = new Array(count);
  let trunk;
  let width;
  if (count === 0) {
    trunk = TREE_CARD_WIDTH / 2;
    width = TREE_CARD_WIDTH;
  } else if (count === 1) {
    trunk = TREE_CARD_WIDTH / 2;
    width = TREE_CARD_WIDTH;
    cx[0] = trunk;
  } else {
    const leftCount = Math.floor(count / 2);
    const rightCount = Math.ceil(count / 2);
    const maxOdd = 2 * leftCount - 1;
    const maxEven = 2 * rightCount - 2;
    trunk = extent(leftCount - 1);
    width = extent(leftCount - 1) + extent(rightCount - 1);
    for (let i = 0; i < count; i++) {
      const rank = i % 2 === 0 ? (maxEven - i) / 2 : (maxOdd - i) / 2;
      cx[i] = i % 2 === 0 ? trunk + dist(rank) : trunk - dist(rank);
    }
  }

  const root = {
    x: trunk - TREE_ROOT_WIDTH / 2,
    y: 0,
    width: TREE_ROOT_WIDTH,
    height: TREE_ROOT_HEIGHT,
    cx: trunk,
  };

  const branches = tree.branches.map((branch, i) => {
    const dy = divergenceY(i);
    const firstCardY = dy + TREE_LABEL_GAP;
    return {
      id: branch.id,
      name: branch.name,
      cx: cx[i],
      divergenceY: dy,
      labelY: dy + 10,
      firstCardY,
      cards: branch.nodes.map((node, j) => ({
        id: node.id,
        label: node.label,
        combines: node.combines ?? 0,
        x: cx[i] - TREE_CARD_WIDTH / 2,
        y: firstCardY + j * (TREE_CARD_HEIGHT + TREE_CARD_GAP),
        cx: cx[i],
      })),
    };
  });

  const lastCardBottom =
    branches.length === 0
      ? TREE_ROOT_HEIGHT + TREE_ROOT_GAP
      : Math.max(
          ...branches.map((branch) => {
            const last = branch.cards[branch.cards.length - 1];
            return last ? last.y + TREE_CARD_HEIGHT : branch.firstCardY;
          })
        );
  const height = Math.max(lastCardBottom + 16, TREE_ROOT_HEIGHT + 16);

  return { width, height, trunk, root, branches };
}

/**
 * Cladogram elbow strokes: a vertical trunk from the root card bottom down
 * to the deepest divergence, one elbow per branch (horizontal run from the
 * trunk to the column, then a vertical drop into its cards), and vertical
 * connectors between stacked cards. Fill none, strokeWidth 2, stroke
 * #B9B3E8.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {string[]} SVG `d` strings.
 */
export function cladogramPaths(layout) {
  /** @type {string[]} */
  const d = [];
  if (layout.branches.length === 0) return d;

  const last = layout.branches[layout.branches.length - 1];
  d.push(
    `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${last.divergenceY}`
  );

  for (const branch of layout.branches) {
    d.push(
      `M ${layout.root.cx} ${branch.divergenceY} H ${branch.cx} V ${branch.firstCardY}`
    );
    for (let j = 1; j < branch.cards.length; j++) {
      const prev = branch.cards[j - 1];
      const card = branch.cards[j];
      d.push(`M ${branch.cx} ${prev.y + TREE_CARD_HEIGHT} V ${card.y}`);
    }
  }
  return d;
}

/**
 * The convergence fan-in strokes (ticket 13): for every convergence node
 * card (a card whose `combines` is 2+), a small fan of branch lines rising
 * from below the card up into its bottom edge - one line per combined field
 * (distinct layer). These mark the node as the meeting point of several
 * streams on desktop, where there is room to draw them; on the vertical path
 * they hang just under the card, one stroke per combined field, converging
 * into the node. Each stroke is a short diagonal from a point below the card
 * up into the card bottom, fanned across the card width.
 *
 * Pure geometry, DOM-free for node:test.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {Array<{ id: string; d: string }>} one path per convergence card,
 *   a multi-segment `d` string with one fan stroke per combined field.
 */
export function convergenceFanPaths(layout) {
  /** @type {Array<{ id: string; d: string }>} */
  const paths = [];
  for (const branch of layout.branches) {
    for (const card of branch.cards) {
      const fields = card.combines;
      if (typeof fields !== "number" || fields < 2) continue;
      const cx = card.cx;
      const bottom = card.y + TREE_CARD_HEIGHT;
      // Fan the strokes across the card bottom: the middle stroke rises
      // straight up into the node, the outer strokes angle in from the sides.
      const fanHalf = TREE_CARD_WIDTH / 2 - 18;
      const segments = [];
      for (let i = 0; i < fields; i++) {
        const t = fields === 1 ? 0.5 : i / (fields - 1);
        const x = cx - fanHalf + t * 2 * fanHalf;
        const startY = bottom + 20 + (Math.abs(x - cx) / fanHalf) * 8;
        segments.push(`M ${x} ${startY} L ${cx} ${bottom}`);
      }
      paths.push({ id: card.id, d: segments.join(" ") });
    }
  }
  return paths;
}
