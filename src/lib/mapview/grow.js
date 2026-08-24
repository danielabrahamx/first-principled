/**
 * Grow-in-place geometry for the wait-state (v8 tickets 05 and 11).
 *
 * After accepted Chronology, the snapshot's regimes draw as a temporary
 * spine in the locked Chapel orientation: foundations at the top, crown at
 * the bottom. After accepted Epiphanies, each epiphany grows a labeled
 * arrow (`because` = result) between its from and to regimes - never an
 * extra epiphany card (ticket 07). After checked Arrange the page swaps
 * this for the real `treeLayout` render, which is the morph: order, edges,
 * and membership come from the checked map alone.
 *
 * Pure and DOM-free so node:test covers card count, order, and arrows.
 * The returned shape mirrors the fields of `treeLayout` that the chapel
 * painter reads (`cards`, `arrows`, `width`, `height`).
 */

import {
  TREE_ARROW_GAP,
  TREE_CARD_HEIGHT,
  TREE_CARD_WIDTH,
  TREE_STAGE_PAD,
  TREE_TWO_UP_MIN_WIDTH,
} from "./tree.js";

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Chapel wait-state layout from one learner-safe poll snapshot.
 *
 * @param {any} snapshot - `{ concept?, chronology[], epiphanies?[] }` as
 *   published by ticket 09.
 * @param {{ width?: number }} [options]
 * @returns {{
 *   width: number;
 *   height: number;
 *   trunk: number;
 *   cardWidth: number;
 *   cards: Array<{ id: string; label: string; tag: string; gloss: string; crown: boolean; x: number; y: number; width: number; height: number }>;
 *   arrows: Array<{ because: string; hover: null; d: string; labelX: number; labelY: number }>;
 * }}
 */
export function growLayout(snapshot, options = {}) {
  const viewport = Math.max(320, Number(options.width) || 375);
  const mobile = viewport < TREE_TWO_UP_MIN_WIDTH;
  const regimes =
    isRecord(snapshot) && Array.isArray(snapshot.chronology) ? snapshot.chronology : [];
  const epiphanies =
    isRecord(snapshot) && Array.isArray(snapshot.epiphanies) ? snapshot.epiphanies : [];

  const cardWidth = Math.min(
    TREE_CARD_WIDTH,
    Math.max(160, viewport - TREE_STAGE_PAD * 2)
  );

  /** @type {Map<string, number>} regime id -> spine index */
  const indexOf = new Map();
  /** @type {Array<{ id: string; label: string; tag: string; gloss: string; crown: boolean; x: number; y: number; width: number; height: number }>} */
  const cards = [];
  regimes.forEach((regime, index) => {
    if (!isRecord(regime) || typeof regime.id !== "string") return;
    const id = regime.id;
    if (indexOf.has(id)) return;
    indexOf.set(id, cards.length);
    const x = mobile ? TREE_STAGE_PAD : Math.max(TREE_STAGE_PAD, (viewport - cardWidth) / 2);
    cards.push({
      id,
      label: typeof regime.regime === "string" ? regime.regime : "",
      tag: "",
      gloss:
        typeof regime.new_capability === "string" ? regime.new_capability : "",
      crown: false,
      x,
      y: TREE_STAGE_PAD + cards.length * (TREE_CARD_HEIGHT + TREE_ARROW_GAP),
      width: cardWidth,
      height: TREE_CARD_HEIGHT,
    });
  });
  if (cards.length > 0) cards[cards.length - 1].crown = true;

  const trunk = cards.length > 0 ? cards[0].x + cardWidth / 2 : viewport / 2;

  /** @type {Array<{ because: string; hover: null; d: string; labelX: number; labelY: number }>} */
  const arrows = [];
  for (const epiphany of epiphanies) {
    if (!isRecord(epiphany)) continue;
    const fromIds = Array.isArray(epiphany.from_regimes) ? epiphany.from_regimes : [];
    const toIds = Array.isArray(epiphany.to_regimes) ? epiphany.to_regimes : [];
    let fromIndex = -1;
    for (const id of fromIds) {
      const found = typeof id === "string" ? indexOf.get(id) : undefined;
      if (found !== undefined && found > fromIndex) fromIndex = found;
    }
    let toIndex = Number.MAX_SAFE_INTEGER;
    for (const id of toIds) {
      const found = typeof id === "string" ? indexOf.get(id) : undefined;
      if (found !== undefined && found < toIndex) toIndex = found;
    }
    if (fromIndex < 0 || toIndex === Number.MAX_SAFE_INTEGER || toIndex <= fromIndex) {
      continue;
    }
    const parent = cards[fromIndex];
    const child = cards[toIndex];
    const because =
      typeof epiphany.result === "string" ? epiphany.result.trim() : "";
    arrows.push({
      because,
      hover: null,
      d: `M ${trunk} ${parent.y + parent.height} V ${child.y}`,
      labelX: trunk,
      labelY: (parent.y + parent.height + child.y) / 2,
    });
  }

  const lastBottom =
    cards.length === 0
      ? TREE_STAGE_PAD
      : cards[cards.length - 1].y + TREE_CARD_HEIGHT;
  const width = mobile ? Math.max(viewport, cardWidth + TREE_STAGE_PAD * 2) : Math.max(viewport, trunk + cardWidth / 2 + TREE_STAGE_PAD);

  return {
    width,
    height: lastBottom + TREE_STAGE_PAD + 8,
    trunk,
    cardWidth,
    cards,
    arrows,
  };
}
