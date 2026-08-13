/**
 * Dependence-path Tree prototype (v5 ticket 01).
 *
 * Locked shape: crown at the top, foundations at the bottom, y from
 * built-on / depends-on / abstraction-of (not observation dates). Vertical
 * spine; short ribs at convergence. Layers are named bands, not left/right
 * columns. Stage width is the viewport so 320/375 never page-overflow.
 */

import { LAYOUT_EDGE_TYPES } from "./sample-map.js";

export const TREE_CARD_WIDTH = 280;
export const TREE_CARD_HEIGHT = 56;
export const TREE_CARD_GAP = 28;
export const TREE_ROOT_WIDTH = 200;
export const TREE_ROOT_HEIGHT = 70;
export const TREE_ROOT_GAP = 36;
export const TREE_BAND_PAD = 10;
export const TREE_RIB_OFFSET = 44;
export const TREE_STAGE_PAD = 16;

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Layout-only edges: source rests on target, so target sits lower.
 *
 * @param {{ edges?: Array<{ source: string; target: string; type: string }> }} map
 * @returns {Array<{ source: string; target: string; type: string }>}
 */
export function layoutEdges(map) {
  const edges = Array.isArray(map && map.edges) ? map.edges : [];
  return edges.filter((edge) => LAYOUT_EDGE_TYPES.includes(edge.type));
}

/**
 * Longest-path rank from foundations. Rank 0 = no layout parents (foundation).
 * Dates are ignored.
 *
 * @param {{ nodes?: Array<{ id: string }>; edges?: Array<{ source: string; target: string; type: string }> }} map
 * @returns {Map<string, number>}
 */
export function dependenceRanks(map) {
  const nodes = Array.isArray(map && map.nodes) ? map.nodes : [];
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
    if (ranks.has(id)) return ranks.get(id);
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
 * Absolute geometry: crown, spine cards, short ribs at extra convergence
 * parents, named layer bands. `options.width` is the stage width (viewport).
 *
 * @param {{
 *   concept?: string;
 *   layers?: Array<{ id: string; name: string; nodes: string[] }>;
 *   nodes?: Array<{ id: string; label: string; layer: string; date?: string; observed?: boolean; combines?: number }>;
 *   edges?: Array<{ source: string; target: string; type: string }>;
 * }} map
 * @param {{ width?: number }} [options]
 */
export function treeLayout(map, options = {}) {
  const width = Math.max(320, Number(options.width) || 375);
  const nodes = Array.isArray(map && map.nodes) ? map.nodes : [];
  const layers = Array.isArray(map && map.layers) ? map.layers : [];
  const edges = layoutEdges(map);
  const ranks = dependenceRanks(map);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  /** @type {Map<string, string[]>} */
  const parentsOf = new Map(nodes.map((node) => [node.id, []]));
  /** @type {Map<string, string[]>} */
  const childrenOf = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    parentsOf.get(edge.source).push(edge.target);
    childrenOf.get(edge.target).push(edge.source);
  }

  const maxRank = nodes.reduce((m, node) => Math.max(m, ranks.get(node.id) || 0), 0);
  const cardWidth = Math.min(TREE_CARD_WIDTH, width - TREE_STAGE_PAD * 2);
  const rootWidth = Math.min(TREE_ROOT_WIDTH, cardWidth);
  const trunk = width / 2;
  const maxRib = Math.max(0, (width - cardWidth) / 2 - 4);
  const rib = Math.min(TREE_RIB_OFFSET, maxRib);

  /** Extra parents of a convergence sit off-spine as short ribs. */
  /** @type {Set<string>} */
  const ribIds = new Set();
  /** @type {Map<string, number>} */
  const ribSign = new Map();
  let ribToggle = 1;
  for (const node of nodes) {
    const parents = parentsOf.get(node.id) || [];
    const combines =
      typeof node.combines === "number" ? node.combines : parents.length;
    if (parents.length < 2 && combines < 2) continue;
    let main = parents[0];
    for (const parent of parents) {
      if ((ranks.get(parent) || 0) > (ranks.get(main) || 0)) main = parent;
    }
    for (const parent of parents) {
      if (parent === main) continue;
      ribIds.add(parent);
      ribSign.set(parent, ribToggle);
      ribToggle *= -1;
    }
  }

  const root = {
    x: trunk - rootWidth / 2,
    y: 0,
    width: rootWidth,
    height: TREE_ROOT_HEIGHT,
    cx: trunk,
  };

  const cards = nodes.map((node) => {
    const rank = ranks.get(node.id) || 0;
    const fromTop = maxRank - rank;
    const cx = ribIds.has(node.id) ? trunk + ribSign.get(node.id) * rib : trunk;
    const y =
      TREE_ROOT_HEIGHT +
      TREE_ROOT_GAP +
      fromTop * (TREE_CARD_HEIGHT + TREE_CARD_GAP);
    return {
      id: node.id,
      label: node.label,
      layer: node.layer,
      date: node.date || "",
      observed: node.observed !== false,
      combines: typeof node.combines === "number" ? node.combines : 0,
      rank,
      rib: ribIds.has(node.id),
      x: cx - cardWidth / 2,
      y,
      cx,
      width: cardWidth,
      height: TREE_CARD_HEIGHT,
    };
  });

  const cardById = new Map(cards.map((card) => [card.id, card]));

  const bands = layers.map((layer, i) => {
    const layerCards = cards.filter((card) => card.layer === layer.id);
    const top =
      layerCards.length === 0
        ? TREE_ROOT_HEIGHT + TREE_ROOT_GAP
        : Math.min(...layerCards.map((card) => card.y)) - TREE_BAND_PAD;
    const bottom =
      layerCards.length === 0
        ? top
        : Math.max(...layerCards.map((card) => card.y + TREE_CARD_HEIGHT)) +
          TREE_BAND_PAD;
    return {
      id: layer.id,
      name: layer.name,
      y: top,
      height: Math.max(bottom - top, TREE_CARD_HEIGHT),
      stripe: i % 2 === 0,
    };
  });

  const lastBottom =
    cards.length === 0
      ? TREE_ROOT_HEIGHT + TREE_ROOT_GAP
      : Math.max(...cards.map((card) => card.y + TREE_CARD_HEIGHT));
  const height = lastBottom + 24;

  return {
    width,
    height,
    trunk,
    cardWidth,
    root,
    cards,
    cardById,
    bands,
    edges,
    parentsOf,
    maxRank,
  };
}

/**
 * SVG strokes: vertical spine through on-spine cards, elbows for rib
 * parents, and layout-edge connectors into each child.
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
  if (onSpine.length === 0) {
    d.push(
      `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${layout.root.y + layout.root.height + TREE_ROOT_GAP}`
    );
    return d;
  }

  const first = onSpine[0];
  const last = onSpine[onSpine.length - 1];
  d.push(
    `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${first.y}`
  );
  d.push(`M ${layout.trunk} ${first.y} V ${last.y}`);

  for (const edge of layout.edges) {
    const child = layout.cardById.get(edge.source);
    const parent = layout.cardById.get(edge.target);
    if (!child || !parent) continue;
    const x1 = parent.cx;
    const y1 = parent.y;
    const x2 = child.cx;
    const y2 = child.y + child.height;
    if (Math.abs(x1 - x2) < 1) {
      d.push(`M ${x1} ${y1} V ${y2}`);
    } else {
      const midY = (y1 + y2) / 2;
      d.push(`M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`);
    }
  }
  return d;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}

/**
 * Build the dependence-path Tree into `mount`.
 *
 * @param {HTMLElement} mount
 * @param {Parameters<typeof treeLayout>[0]} map
 * @param {{ width?: number }} [opts]
 * @returns {{ destroy: () => void; layout: ReturnType<typeof treeLayout> }}
 */
export function buildTree(mount, map, opts = {}) {
  const stageWidth =
    opts.width ||
    Math.max(320, Math.floor(mount.clientWidth || mount.parentElement?.clientWidth || 375));
  const layout = treeLayout(map, { width: stageWidth });

  const stage = el("div", "mt-stage");
  stage.style.width = `${layout.width}px`;
  stage.style.height = `${layout.height}px`;

  const bandsLayer = el("div", "mt-bands");
  for (const band of layout.bands) {
    const stripe = el("div", band.stripe ? "mt-band mt-band-even" : "mt-band mt-band-odd");
    stripe.style.top = `${band.y}px`;
    stripe.style.height = `${band.height}px`;
    const label = el("span", "mt-band-name", band.name);
    stripe.appendChild(label);
    bandsLayer.appendChild(stripe);
  }
  stage.appendChild(bandsLayer);

  const svg = svgEl("svg");
  svg.setAttribute("class", "mt-svg");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("aria-hidden", "true");
  const strokes = svgEl("g");
  strokes.setAttribute("class", "mt-strokes");
  for (const d of spinePaths(layout)) {
    const path = svgEl("path");
    path.setAttribute("d", d);
    strokes.appendChild(path);
  }
  svg.appendChild(strokes);
  stage.appendChild(svg);

  const nodesLayer = el("div", "mt-nodes");
  const root = el("div", "mt-root");
  root.style.left = `${layout.root.x}px`;
  root.style.top = `${layout.root.y}px`;
  root.style.width = `${layout.root.width}px`;
  root.style.height = `${layout.root.height}px`;
  root.append(
    el("p", "mt-root-eyebrow", "THE CONCEPT"),
    el("h2", "mt-root-word", map.concept || "")
  );
  nodesLayer.appendChild(root);

  for (const card of layout.cards) {
    const node = el("div", card.rib ? "mt-card mt-card-rib" : "mt-card");
    node.dataset.nodeId = card.id;
    node.style.left = `${card.x}px`;
    node.style.top = `${card.y}px`;
    node.style.width = `${card.width}px`;
    node.style.height = `${card.height}px`;
    const copy = el("span", "mt-card-copy");
    copy.appendChild(el("span", "mt-card-label", card.label));
    const dot = el(
      "i",
      card.observed ? "mt-obs-dot recorded" : "mt-obs-dot gap"
    );
    dot.setAttribute("aria-hidden", "true");
    node.append(copy, dot);
    if (card.combines > 1) {
      const chip = el(
        "span",
        "mt-converge-chip",
        `combines ${card.combines} fields`
      );
      node.appendChild(chip);
    }
    if (card.date) {
      const hover = el("span", "mt-hover", card.date);
      hover.setAttribute("role", "tooltip");
      node.appendChild(hover);
    }
    nodesLayer.appendChild(node);
  }
  stage.appendChild(nodesLayer);
  mount.appendChild(stage);

  return {
    layout,
    destroy() {
      if (stage.parentNode === mount) mount.removeChild(stage);
    },
  };
}
