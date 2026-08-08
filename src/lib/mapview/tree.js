/**
 * Reality phylogenetic tree (ticket 13, design spec): viewmodel plus pure
 * geometry for the session-end reality view.
 *
 * Why a tree: a reality map IS a lineage. Every concept is built on simpler
 * concepts beneath it (built-on / part-of / depends-on edges), which is
 * exactly the branching structure of a phylogenetic tree. The concept is the
 * crown; its foundations branch down like ancestry.
 *
 * `realityTree` turns the reality map into {rootLabel, branches}: the root is
 * the concept word, and each layer is a branch of stacked node cards. Layers
 * are ordered top layer first so the most-derived layer sits nearest the
 * crown and the deepest foundation hangs lowest - the "foundations branch
 * down" reading. `treeLayout` and `cladogramPaths` turn that into absolute
 * card positions and SVG elbow strokes.
 *
 * The geometry reads as chronological descent (ticket 17): a central trunk
 * descends from the crown and each layer diverges from it at its own depth -
 * the top layer diverges highest (most recent), the deepest foundation
 * lowest. Branch columns alternate left and right around the trunk, each
 * side ordered deepest-nearest, so no elbow ever crosses another branch's
 * cards.
 *
 * This is a comparison view: it renders full reality content (layer names,
 * node labels), so the map page may mount it ONLY at session end - the
 * no-leak rule binds mid-session only.
 *
 * Pure and DOM-free so node:test covers the shapes and the geometry.
 */

import { realitySections } from "./comparison.js";

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
/** Vertical step between successive branch divergence points: one per layer,
 * so the tree reads chronologically - the top layer (most derived) diverges
 * nearest the crown, the deepest foundation lowest. */
export const TREE_DIVERGENCE_STEP = 36;
/** Branch divergence point to the first card top (the branch label sits
 * between). */
export const TREE_LABEL_GAP = 34;

/**
 * The tree's visual model: the concept as the root, each reality layer as a
 * branch of node cards, top layer first (foundations branch down).
 *
 * @param {RealityMap | null | undefined} realityMap
 * @returns {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string }> }> }}
 */
export function realityTree(realityMap) {
  const sections = realitySections(realityMap);
  return {
    rootLabel:
      realityMap && typeof realityMap.concept === "string" ? realityMap.concept : "",
    branches: sections
      .slice()
      .reverse()
      .map((section) => ({
        id: section.id,
        name: section.name,
        nodes: section.nodes.map((node) => ({ id: node.id, label: node.label })),
      })),
  };
}

/**
 * Absolute geometry for the tree: the root card, a central trunk, and every
 * branch label + card position, laid out as a phylogenetic lineage (ticket
 * 17). The trunk descends from the root card bottom; each layer diverges
 * from it at its own depth - branch 0 (top layer, most derived) highest,
 * the deepest foundation lowest - so the tree reads chronologically. Branch
 * columns alternate left and right around the trunk; on each side the
 * deepest branch sits nearest the trunk, so no elbow ever crosses another
 * branch's cards. Columns keep the horizontal spread (280-wide cards, 32px
 * gaps) so wide maps still fit.
 *
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string }> }> }} tree
 *   from realityTree.
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
export function treeLayout(tree) {
  const count = tree.branches.length;
  const step = TREE_CARD_WIDTH + TREE_COLUMN_GAP;
  // Nearest column center sits one card half-width plus half a column gap
  // from the trunk, then one full step per rank outward.
  /** @param {number} rank */
  const dist = (rank) => TREE_CARD_WIDTH / 2 + TREE_COLUMN_GAP / 2 + rank * step;
  // Farthest card edge of the column at a rank, measured from the trunk.
  /** @param {number} rank */
  const extent = (rank) => dist(rank) + TREE_CARD_WIDTH / 2;

  // Divergence depth per branch: successive per layer, so the top layer
  // (most derived, branch 0) diverges highest and the deepest foundation
  // lowest - the chronological reading.
  /** @param {number} i */
  const divergenceY = (i) =>
    TREE_ROOT_HEIGHT + TREE_ROOT_GAP + i * TREE_DIVERGENCE_STEP;

  // Branch columns alternate left and right of the trunk: even branches
  // right, odd left. On each side the deepest branch (largest index) sits
  // nearest the trunk, so an elbow to a far column always passes above the
  // cards of the nearer columns on its own side. A single branch centers on
  // the trunk; an odd count leaves the trunk the gap between the two middle
  // columns and the box stays balanced around it.
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
  return buildLayout(tree, cx, divergenceY, trunk, width);
}

/**
 * Build the layout record from the per-branch column centers.
 *
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string }> }> }} tree
 * @param {number[]} cx - one column center per branch, in branch order.
 * @param {(i: number) => number} divergenceY - divergence depth per branch.
 * @param {number} trunk - the trunk x, where the root card is centered.
 * @param {number} width - the stage width.
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
function buildLayout(tree, cx, divergenceY, trunk, width) {
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
        x: cx[i] - TREE_CARD_WIDTH / 2,
        y: firstCardY + j * (TREE_CARD_HEIGHT + TREE_CARD_GAP),
        cx: cx[i],
      })),
    };
  });

  const lastCardBottom =
    branches.length === 0
      ? TREE_ROOT_HEIGHT + TREE_ROOT_GAP
      : Math.max(...branches.map((branch) => {
          const last = branch.cards[branch.cards.length - 1];
          return last ? last.y + TREE_CARD_HEIGHT : branch.firstCardY;
        }));
  const height = Math.max(lastCardBottom + 16, TREE_ROOT_HEIGHT + 16);

  return { width, height, root, branches };
}

/**
 * The cladogram elbow strokes as SVG path strings: a vertical trunk from the
 * root card bottom down to the deepest branch's divergence point, one elbow
 * per branch - a horizontal run from the trunk to the branch column at that
 * branch's own divergence depth, then a vertical drop into its cards - and
 * vertical connectors between stacked cards inside a branch. Fill none,
 * strokeWidth 2, stroke #B9B3E8 per the design spec.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {string[]} SVG `d` strings.
 */
export function cladogramPaths(layout) {
  /** @type {string[]} */
  const d = [];
  if (layout.branches.length === 0) return d;

  const last = layout.branches[layout.branches.length - 1];
  d.push(`M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${last.divergenceY}`);

  for (const branch of layout.branches) {
    d.push(`M ${layout.root.cx} ${branch.divergenceY} H ${branch.cx} V ${branch.firstCardY}`);
    for (let j = 1; j < branch.cards.length; j++) {
      const prev = branch.cards[j - 1];
      const card = branch.cards[j];
      d.push(`M ${branch.cx} ${prev.y + TREE_CARD_HEIGHT} V ${card.y}`);
    }
  }
  return d;
}
