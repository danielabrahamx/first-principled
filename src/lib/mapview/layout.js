/**
 * Map page layout: pure geometry for the learner model's grid + SVG edge
 * overlay. No DOM, so node:test covers the math.
 *
 * Nodes flow into a responsive grid left-to-right, top-to-bottom in the
 * order the learner engaged with them (the learner map's own order - no
 * reality structure like layers is consulted, so the layout leaks
 * nothing). Edges are drawn as quadratic curves between the card edges.
 */

/**
 * The default card metrics shared by the page (280x88 per the ticket 13
 * design spec: a 280px card with an 18px-padded title and status line).
 */
export const CARD_WIDTH = 280;
export const CARD_HEIGHT = 88;
export const GAP = 24;

/** The most columns the grid uses on a wide screen. */
export const MAX_COLUMNS = 4;

/**
 * How many columns fit a container of the given width - the same math as
 * CSS `repeat(auto-fit, minmax(cardWidth, 1fr))`. At least 1.
 *
 * @param {number} width - the stage container width in px.
 * @param {number} [cardWidth]
 * @param {number} [gap]
 * @returns {number}
 */
export function columnCount(width, cardWidth = CARD_WIDTH, gap = GAP) {
  return Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + gap) / (cardWidth + gap))));
}

/**
 * The grid's size in px for a given node count and column count.
 *
 * @param {number} count
 * @param {number} columns
 * @param {number} [cardWidth]
 * @param {number} [cardHeight]
 * @param {number} [gap]
 * @returns {{ columns: number; rows: number; width: number; height: number }}
 */
export function gridMetrics(
  count,
  columns,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT,
  gap = GAP
) {
  if (count <= 0) {
    return { columns: 0, rows: 0, width: 0, height: 0 };
  }
  const cols = Math.max(1, columns);
  const rows = Math.ceil(count / cols);
  return {
    columns: cols,
    rows,
    width: cols * cardWidth + (cols - 1) * gap,
    height: rows * cardHeight + (rows - 1) * gap,
  };
}

/**
 * Node positions in grid order. Each position carries the card corner (x,
 * y) and the card center (cx, cy) the edge overlay anchors to.
 *
 * @param {Array<{ id: string }>} nodes - the learner cards, in learner
 *   order.
 * @param {number} columns
 * @param {number} [cardWidth]
 * @param {number} [cardHeight]
 * @param {number} [gap]
 * @returns {Record<string, { x: number; y: number; cx: number; cy: number }>}
 */
export function nodePositions(
  nodes,
  columns,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT,
  gap = GAP
) {
  const cols = Math.max(1, columns);
  /** @type {Record<string, { x: number; y: number; cx: number; cy: number }>} */
  const out = {};
  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * (cardWidth + gap);
    const y = row * (cardHeight + gap);
    out[node.id] = { x, y, cx: x + cardWidth / 2, cy: y + cardHeight / 2 };
  });
  return out;
}

/**
 * The direction from the center of card `a` toward card `b`, normalized.
 * Used to anchor edge endpoints on the card edges instead of under the
 * card faces.
 *
 * @param {{ cx: number; cy: number }} a
 * @param {{ cx: number; cy: number }} b
 * @returns {{ dx: number; dy: number }}
 */
function direction(a, b) {
  let dx = b.cx - a.cx;
  let dy = b.cy - a.cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len;
  dy /= len;
  return { dx, dy };
}

/**
 * SVG path strings for the learner's edges. An edge whose endpoints are
 * not both positioned is skipped (the validator should prevent it; the
 * renderer must not crash on it). The curve bows toward the right so
 * stacked cards stay readable.
 *
 * @param {Array<{ source: string; target: string }>} edges - the learner
 *   edges.
 * @param {Record<string, { x: number; y: number; cx: number; cy: number }>} pos - from nodePositions.
 * @param {number} [cardWidth]
 * @param {number} [cardHeight]
 * @returns {Array<{ source: string; target: string; d: string }>}
 */
export function edgePaths(
  edges,
  pos,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT
) {
  /** @type {Array<{ source: string; target: string; d: string }>} */
  const paths = [];
  for (const edge of edges) {
    const a = pos[edge.source];
    const b = pos[edge.target];
    if (!a || !b || a === b) continue;

    const dir = direction(a, b);
    const start = { x: a.cx + (dir.dx * cardWidth) / 2, y: a.cy + (dir.dy * cardHeight) / 2 };
    const end = { x: b.cx - (dir.dx * cardWidth) / 2, y: b.cy - (dir.dy * cardHeight) / 2 };

    // Quadratic control point: the midpoint, bowed perpendicular (to the
    // right) so vertical edges between stacked cards are visible.
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const ctrlX = midX + (dir.dy === 0 ? 1 : dir.dy) * 16;
    const ctrlY = midY + -dir.dx * 16;

    paths.push({
      source: edge.source,
      target: edge.target,
      d: `M ${round(start.x)} ${round(start.y)} Q ${round(ctrlX)} ${round(ctrlY)} ${round(end.x)} ${round(end.y)}`,
    });
  }
  return paths;
}

/** @param {number} n */
function round(n) {
  return Math.round(n * 100) / 100;
}
