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
/** Root card bottom to the horizontal branch line. */
export const TREE_ROOT_GAP = 72;
/** Branch line to the first card top (the branch label sits between). */
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
 * Absolute geometry for the tree: the root card, the branch line, and every
 * branch label + card position. Columns are laid out left to right; the root
 * card is centered above them; the trunk drops from the root to the branch
 * line, then vertical drops into each branch.
 *
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string }> }> }} tree
 *   from realityTree.
 * @returns {{
 *   width: number;
 *   height: number;
 *   root: { x: number; y: number; width: number; height: number; cx: number };
 *   branchLineY: number;
 *   branches: Array<{
 *     id: string;
 *     name: string;
 *     cx: number;
 *     labelY: number;
 *     firstCardY: number;
 *     cards: Array<{ id: string; label: string; x: number; y: number; cx: number }>;
 *   }>;
 * }}
 */
export function treeLayout(tree) {
  const count = tree.branches.length;
  const width =
    count === 0
      ? TREE_CARD_WIDTH
      : count * TREE_CARD_WIDTH + (count - 1) * TREE_COLUMN_GAP;
  const rootCx = width / 2;
  const root = {
    x: rootCx - TREE_ROOT_WIDTH / 2,
    y: 0,
    width: TREE_ROOT_WIDTH,
    height: TREE_ROOT_HEIGHT,
    cx: rootCx,
  };
  const branchLineY = TREE_ROOT_HEIGHT + TREE_ROOT_GAP;

  const branches = tree.branches.map((branch, i) => {
    const cx = i * (TREE_CARD_WIDTH + TREE_COLUMN_GAP) + TREE_CARD_WIDTH / 2;
    const firstCardY = branchLineY + TREE_LABEL_GAP;
    return {
      id: branch.id,
      name: branch.name,
      cx,
      labelY: branchLineY + 10,
      firstCardY,
      cards: branch.nodes.map((node, j) => ({
        id: node.id,
        label: node.label,
        x: cx - TREE_CARD_WIDTH / 2,
        y: firstCardY + j * (TREE_CARD_HEIGHT + TREE_CARD_GAP),
        cx,
      })),
    };
  });

  const lastCardBottom =
    branches.length === 0
      ? branchLineY
      : Math.max(...branches.map((branch) => {
          const last = branch.cards[branch.cards.length - 1];
          return last ? last.y + TREE_CARD_HEIGHT : branch.firstCardY;
        }));
  const height = Math.max(lastCardBottom + 16, TREE_ROOT_HEIGHT + 16);

  return { width, height, root, branchLineY, branches };
}

/**
 * The cladogram elbow strokes as SVG path strings: a vertical trunk from the
 * root down to the horizontal branch line, the branch line itself, a vertical
 * drop into each branch, and vertical connectors between stacked cards inside
 * a branch. Fill none, strokeWidth 2, stroke #B9B3E8 per the design spec.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {string[]} SVG `d` strings.
 */
export function cladogramPaths(layout) {
  /** @type {string[]} */
  const d = [];
  if (layout.branches.length === 0) return d;

  d.push(`M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${layout.branchLineY}`);
  const first = layout.branches[0];
  const last = layout.branches[layout.branches.length - 1];
  d.push(`M ${first.cx} ${layout.branchLineY} H ${last.cx}`);

  for (const branch of layout.branches) {
    d.push(`M ${branch.cx} ${layout.branchLineY} V ${branch.firstCardY}`);
    for (let j = 1; j < branch.cards.length; j++) {
      const prev = branch.cards[j - 1];
      const card = branch.cards[j];
      d.push(`M ${branch.cx} ${prev.y + TREE_CARD_HEIGHT} V ${card.y}`);
    }
  }
  return d;
}
