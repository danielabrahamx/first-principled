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
 * The geometry is the vertical path (ticket 10): a central trunk descends
 * from the crown and every layer hangs off it as a band - the layer's cards
 * stack in a single column centered on the trunk. On desktop (width above
 * TREE_TWO_UP_MIN_WIDTH) a layer with 4+ nodes fans two-up around the trunk,
 * which stays centered. Strict chronology (ticket 10) drives the ordering:
 * within a layer, cards sort by observation date oldest first (unknown dates
 * last, in original order, stable); layers sort by their oldest date, oldest
 * nearest the foundation. The layer chain structure is the invariant - the
 * sort never moves a node across a layer boundary (ticket 08 contract).
 *
 * Reading direction: concept at top, oldest foundations at the bottom; sap
 * rises bottom to top. The motion port (ticket 12) rides this geometry.
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
/** Horizontal gap between two-up columns. */
export const TREE_COLUMN_GAP = 32;
/** Vertical gap between stacked cards inside a branch. */
export const TREE_CARD_GAP = 12;
/** Root card box. */
export const TREE_ROOT_WIDTH = 220;
export const TREE_ROOT_HEIGHT = 74;
/** Root card bottom to the first branch divergence point. */
export const TREE_ROOT_GAP = 72;
/** Vertical gap between the last card of one layer and the next divergence. */
export const TREE_BRANCH_GAP = 48;
/** Branch divergence point to the first card top (the branch label sits
 * between; tall enough for a 44px touch target, ticket 10). */
export const TREE_LABEL_GAP = 58;
/** Stage widths above this may fan 2-up; at or below it, always 1-up (the
 * mobile bar: 375px and 320px phones stay single-column). */
export const TREE_TWO_UP_MIN_WIDTH = 480;
/** A layer with this many cards or more fans two-up on desktop. */
export const TREE_TWO_UP_MIN_NODES = 4;

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
 * @param {RealityMap | null | undefined} realityMap
 * @returns {{ rootLabel: string; branches: Array<{ id: string; name: string; oldestDate: number; nodes: Array<{ id: string; label: string }> }> }}
 */
export function realityTree(realityMap) {
  const sections = realitySections(realityMap);
  const byId = new Map(
    realityMap && Array.isArray(realityMap.nodes)
      ? realityMap.nodes.map((node) => [node.id, node])
      : []
  );

  // Cards sorted by date within each layer: oldest first, unknown dates last
  // in original order (stable). Each layer keeps its own oldest date for the
  // layer ordering below.
  const layers = sections.map((section) => {
    const indexed = section.nodes.map((node, index) => {
      const date = nodeDateKey(byId.get(node.id));
      return { id: node.id, label: node.label, date, index };
    });
    indexed.sort((a, b) => a.date - b.date || a.index - b.index);
    return {
      id: section.id,
      name: section.name,
      oldestDate: indexed.length > 0 ? indexed[0].date : Infinity,
      nodes: indexed.map((node) => ({ id: node.id, label: node.label })),
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
 * Absolute geometry for the tree, as a vertical path (ticket 10): the root
 * card centered at the top, a central trunk descending, and every layer a
 * band hanging off it - the layer's cards stacked in a single column centered
 * on the trunk. On desktop (width > TREE_TWO_UP_MIN_WIDTH) a layer with 4+
 * cards fans two-up around the trunk, which stays centered. Cards sort
 * oldest-first inside each layer and layers sit oldest at the bottom, so the
 * tree reads top (crown) to bottom (oldest foundation).
 *
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; oldestDate: number; nodes: Array<{ id: string; label: string }> }> }} tree
 *   from realityTree.
 * @param {object} [options]
 * @param {number} [options.width] - the stage width (the container the tree
 *   renders into). Defaults to TREE_CARD_WIDTH (a single-column stage).
 * @returns {{
 *   width: number;
 *   height: number;
 *   root: { x: number; y: number; width: number; height: number; cx: number };
 *   branches: Array<{
 *     id: string;
 *     name: string;
 *     cx: number;
 *     divergenceY: number;
 *     labelY: number;
 *     firstCardY: number;
 *     cards: Array<{ id: string; label: string; x: number; y: number; cx: number }>;
 *   }>;
 * }}
 */
export function treeLayout(tree, options = {}) {
  const width =
    typeof options.width === "number" && options.width > 0
      ? options.width
      : TREE_CARD_WIDTH;
  // Two-up only when the stage is wide enough to actually fit two columns
  // beside the trunk without overflow - the hard no-overflow rule wins.
  const twoUp =
    width > TREE_TWO_UP_MIN_WIDTH &&
    width >= 2 * TREE_CARD_WIDTH + TREE_COLUMN_GAP;
  const trunk = width / 2;

  const root = {
    x: trunk - TREE_ROOT_WIDTH / 2,
    y: 0,
    width: TREE_ROOT_WIDTH,
    height: TREE_ROOT_HEIGHT,
    cx: trunk,
  };

  let y = root.y + root.height + TREE_ROOT_GAP;
  const branches = tree.branches.map((branch) => {
    const divergenceY = y;
    const labelY = divergenceY + 10;
    const firstCardY = divergenceY + TREE_LABEL_GAP;
    const fan = twoUp && branch.nodes.length >= TREE_TWO_UP_MIN_NODES;

    /** @type {Array<{ id: string; label: string; x: number; y: number; cx: number }>} */
    let cards;
    if (fan) {
      // Two-up: split the cards across two columns flanking the trunk, first
      // half left, second half right, so reading left column then right reads
      // chronologically. The trunk stays centered between the columns.
      const half = Math.ceil(branch.nodes.length / 2);
      const offset = TREE_CARD_WIDTH / 2 + TREE_COLUMN_GAP / 2;
      const leftCx = trunk - offset;
      const rightCx = trunk + offset;
      cards = branch.nodes.map((node, j) => {
        const col = j < half ? 0 : 1;
        const row = j < half ? j : j - half;
        const cx = col === 0 ? leftCx : rightCx;
        return {
          id: node.id,
          label: node.label,
          x: cx - TREE_CARD_WIDTH / 2,
          y: firstCardY + row * (TREE_CARD_HEIGHT + TREE_CARD_GAP),
          cx,
        };
      });
    } else {
      // One-up: the layer's cards stack in a single column centered on the
      // trunk.
      cards = branch.nodes.map((node, j) => ({
        id: node.id,
        label: node.label,
        x: trunk - TREE_CARD_WIDTH / 2,
        y: firstCardY + j * (TREE_CARD_HEIGHT + TREE_CARD_GAP),
        cx: trunk,
      }));
    }

    const lastCardBottom =
      cards.length === 0
        ? firstCardY
        : Math.max(...cards.map((card) => card.y + TREE_CARD_HEIGHT));
    y = lastCardBottom + TREE_BRANCH_GAP;

    return {
      id: branch.id,
      name: branch.name,
      cx: trunk,
      divergenceY,
      labelY,
      firstCardY,
      cards,
    };
  });

  const lastCardBottom =
    branches.length === 0
      ? root.y + root.height + TREE_ROOT_GAP
      : Math.max(
          ...branches.map((branch) =>
            branch.cards.length === 0
              ? branch.firstCardY
              : Math.max(...branch.cards.map((card) => card.y + TREE_CARD_HEIGHT))
          )
        );
  const height = Math.max(lastCardBottom + 16, root.y + root.height + 16);

  return { width, height, root, branches };
}

/**
 * The cladogram strokes as SVG path strings: a vertical trunk from the root
 * card bottom down to the deepest cards, plus per-layer connectors - for a
 * two-up layer, elbows from the trunk at the layer's divergence depth out to
 * each column, then vertical connectors between the stacked cards inside a
 * column. One-up layers sit centered on the trunk, so the trunk itself is
 * their connector. Fill none, strokeWidth 2, stroke #B9B3E8 per the design
 * spec.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {string[]} SVG `d` strings.
 */
export function cladogramPaths(layout) {
  /** @type {string[]} */
  const d = [];
  if (layout.branches.length === 0) return d;

  const lastCardBottom = Math.max(
    ...layout.branches.map((branch) =>
      branch.cards.length === 0
        ? branch.firstCardY
        : Math.max(...branch.cards.map((card) => card.y + TREE_CARD_HEIGHT))
    )
  );
  d.push(`M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${lastCardBottom}`);

  for (const branch of layout.branches) {
    const cols = [...new Set(branch.cards.map((card) => card.cx))];
    for (const cx of cols) {
      if (Math.abs(cx - layout.root.cx) < 0.5) continue;
      const colCards = branch.cards.filter((card) => card.cx === cx);
      const first = colCards[0];
      d.push(`M ${layout.root.cx} ${branch.divergenceY} H ${cx} V ${first.y}`);
      for (let j = 1; j < colCards.length; j++) {
        const prev = colCards[j - 1];
        const card = colCards[j];
        d.push(`M ${cx} ${prev.y + TREE_CARD_HEIGHT} V ${card.y}`);
      }
    }
  }
  return d;
}
