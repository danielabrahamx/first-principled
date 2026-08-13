/**
 * Motion prototype for ticket 07: which RootTree effects carry into our
 * zero-dep SVG tree?
 *
 * Port of the portfoolio_clone2 RootTree motion, NOT the stack. This module
 * is plain ES modules + SVG + CSS - no React, no framework. It renders the
 * v1 reality-tree shape (root card, central trunk, per-layer branches with
 * stacked cards, geometry ported from src/lib/mapview/tree.js) and layers
 * the portfoolio motion on top:
 *
 * 1. Flowing "sap" pulses along the trunk and branch centerlines via
 *    animateMotion - observations rising from foundations to the crown.
 * 2. Scroll-driven growth: the trunk draws down and each layer buds in as
 *    the user scrolls the tree into view.
 * 3. Node lifecycle animation: cards and branch labels fade in staggered by
 *    depth (generation by generation).
 * 4. Reduced-motion respect: a JS matchMedia gate skips the sap pulses and
 *    scroll wiring entirely (SMIL cannot be killed by CSS alone), and a CSS
 *    media query kills every animation and transition.
 *
 * The demo page (index.html) offers checkboxes to toggle each effect and to
 * simulate reduced motion without touching the OS setting.
 */

const CARD_W = 280;
const CARD_H = 64;
const COL_GAP = 32;
const CARD_GAP = 12;
const ROOT_W = 220;
const ROOT_H = 74;
const ROOT_GAP = 72;
const DIV_STEP = 36;
const LABEL_GAP = 34;

const SVG_NS = "http://www.w3.org/2000/svg";

/* Deterministic per-node stagger so the motion feels grown, not gridded
 * (same hash the portfoolio tree uses). */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ---------------- Geometry (ported from src/lib/mapview/tree.js) ------- */

/**
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string }> }> }} tree
 */
export function layoutTree(tree) {
  const count = tree.branches.length;
  const step = CARD_W + COL_GAP;
  const dist = (rank) => CARD_W / 2 + COL_GAP / 2 + rank * step;
  const extent = (rank) => dist(rank) + CARD_W / 2;
  const divergenceY = (i) => ROOT_H + ROOT_GAP + i * DIV_STEP;

  /** @type {number[]} */
  const cx = new Array(count);
  let trunk;
  let width;
  if (count === 0) {
    trunk = CARD_W / 2;
    width = CARD_W;
  } else if (count === 1) {
    trunk = CARD_W / 2;
    width = CARD_W;
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
    x: trunk - ROOT_W / 2,
    y: 0,
    width: ROOT_W,
    height: ROOT_H,
    cx: trunk,
  };

  const branches = tree.branches.map((branch, i) => {
    const dy = divergenceY(i);
    const firstCardY = dy + LABEL_GAP;
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
        x: cx[i] - CARD_W / 2,
        y: firstCardY + j * (CARD_H + CARD_GAP),
        cx: cx[i],
      })),
    };
  });

  const lastCardBottom =
    branches.length === 0
      ? ROOT_H + ROOT_GAP
      : Math.max(
          ...branches.map((branch) => {
            const last = branch.cards[branch.cards.length - 1];
            return last ? last.y + CARD_H : branch.firstCardY;
          })
        );
  const height = Math.max(lastCardBottom + 16, ROOT_H + 16);

  return { width, height, root, branches, trunk };
}

/* Centerlines the sap pulses ride along. The trunk path runs from the root
 * card bottom down to the deepest divergence; the sap direction is REVERSED
 * so observations rise from the foundations up to the crown. */
export function sapPaths(layout) {
  const paths = [];
  const last = layout.branches[layout.branches.length - 1];
  const trunkTop = layout.root.y + layout.root.height;
  paths.push({
    id: "trunk",
    depth: 0,
    d: `M ${layout.trunk} ${last.divergenceY} V ${trunkTop}`,
  });
  for (const branch of layout.branches) {
    const lastCard = branch.cards[branch.cards.length - 1];
    const startY = lastCard ? lastCard.y + CARD_H : branch.firstCardY;
    paths.push({
      id: branch.id,
      depth: 0.5,
      d: `M ${branch.cx} ${startY} V ${branch.divergenceY} H ${layout.trunk}`,
    });
  }
  return paths;
}

/* The cladogram strokes, drawn as the scroll-growth baseline: a trunk from
 * the root card bottom down to the deepest divergence, one elbow per branch
 * (horizontal run out to the column, then a vertical drop into its cards),
 * and vertical connectors between stacked cards. */
export function cladogramPaths(layout) {
  /** @type {string[]} */
  const d = [];
  if (layout.branches.length === 0) return d;
  const last = layout.branches[layout.branches.length - 1];
  d.push(`M ${layout.trunk} ${layout.root.y + layout.root.height} V ${last.divergenceY}`);
  for (const branch of layout.branches) {
    d.push(`M ${layout.trunk} ${branch.divergenceY} H ${branch.cx} V ${branch.firstCardY}`);
    for (let j = 1; j < branch.cards.length; j++) {
      const prev = branch.cards[j - 1];
      const card = branch.cards[j];
      d.push(`M ${branch.cx} ${prev.y + CARD_H} V ${card.y}`);
    }
  }
  return d;
}

/* ---------------- Growth math (pure, testable) -------------------------- */

/** Fraction of growth spent drawing the trunk (0..1 progress). */
export const GROW_TRUNK_END = 0.5;

/**
 * The trunk's draw progress for a scroll progress: 0 (hidden) at the top,
 * fully drawn once GROW_TRUNK_END is reached.
 *
 * @param {number} progress - page scroll progress 0..1.
 */
export function trunkReveal(progress) {
  return Math.min(1, Math.max(0, progress / GROW_TRUNK_END));
}

/**
 * A layer's reveal opacity for a scroll progress. Layers reveal deepest
 * foundation first (the last branch in layout order diverges lowest), so
 * `index` 0 (the crown-most layer) appears last.
 *
 * @param {number} progress - page scroll progress 0..1.
 * @param {number} count - number of layers.
 * @param {number} index - layer index in layout order (0 = crown-most).
 */
export function layerReveal(progress, count, index) {
  if (count === 0) return 1;
  const chronological = count - 1 - index;
  const start = GROW_TRUNK_END + (chronological * (1 - GROW_TRUNK_END)) / count;
  const end = GROW_TRUNK_END + ((chronological + 1) * (1 - GROW_TRUNK_END)) / count;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

/* ---------------- DOM helpers ------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}

/* ---------------- The tree builder -------------------------------------- */

/**
 * Build the whole tree into `mount` (an element the caller clears).
 *
 * @param {HTMLElement} mount
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string }> }> }} tree
 * @param {{ sap?: boolean; growth?: boolean; reduced?: boolean; reducedMotion?: boolean }} [opts]
 *   sap: enable sap pulses (default true). growth: enable scroll-driven
 *   growth (default true). reduced: force reduced-motion behavior; when
 *   false, `(prefers-reduced-motion: reduce)` is still respected via
 *   opts.reducedMotion (defaults to the real matchMedia check).
 * @returns {{ destroy: () => void }}
 */
export function buildTree(mount, tree, opts = {}) {
  const reduced =
    opts.reduced ??
    (opts.reducedMotion === undefined
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : opts.reducedMotion);
  const wantSap = opts.sap !== false && !reduced;
  const wantGrowth = opts.growth !== false && !reduced;

  const layout = layoutTree(tree);
  const stage = el("div", "mt-stage");
  stage.style.width = `${layout.width}px`;
  stage.style.height = `${layout.height}px`;

  const svg = svgEl("svg");
  svg.setAttribute("class", "mt-svg");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("aria-hidden", "true");
  stage.appendChild(svg);

  const nodesLayer = el("div", "mt-nodes");
  stage.appendChild(nodesLayer);

  /* Root card: the crown. */
  const root = el("div", "mt-root");
  root.style.left = `${layout.root.x}px`;
  root.style.top = `${layout.root.y}px`;
  root.style.width = `${layout.root.width}px`;
  root.style.height = `${layout.root.height}px`;
  root.append(el("p", "mt-root-eyebrow", "THE CONCEPT"), el("h2", "mt-root-word", tree.rootLabel || ""));
  if (!reduced) root.classList.add("mt-bud");
  root.style.setProperty("--mt-delay", "0.1s");
  nodesLayer.appendChild(root);

  /* Cladogram strokes (trunk + elbows) underneath. The trunk is tagged so
   * scroll growth can draw it progressively (pathLength-normalised
   * dashoffset); the elbows just fade with their layer. */
  const strokes = svgEl("g");
  strokes.setAttribute("class", "mt-strokes");
  svg.appendChild(strokes);
  let trunkPath = null;
  const elbowPaths = [];
  const cladogram = cladogramPaths(layout);
  for (let i = 0; i < cladogram.length; i++) {
    const path = svgEl("path");
    path.setAttribute("d", cladogram[i]);
    if (i === 0) {
      path.setAttribute("class", "mt-trunk");
      path.setAttribute("pathLength", "1");
      strokes.appendChild(path);
      trunkPath = path;
    } else {
      elbowPaths.push(path);
      strokes.appendChild(path);
    }
  }

  /* Sap pulses: nutrient packets rising along the trunk and branches. The
   * trunk carries them from the deepest divergence up to the crown; each
   * branch carries them from its cards up to the trunk. SMIL only - no JS
   * animation loop. Skipped entirely under reduced motion, because SMIL
   * cannot be reliably neutralised by CSS. */
  if (wantSap) {
    const sapGroup = svgEl("g");
    sapGroup.setAttribute("class", "mt-sap");
    sapGroup.setAttribute("pointer-events", "none");
    for (const path of sapPaths(layout)) {
      const dur = 4.5 + (hash(path.id + ":sd") % 30) / 10;
      const begin = (hash(path.id + ":sb") % 80) / 10;
      const pulse = svgEl("circle");
      pulse.setAttribute("class", "mt-sap-pulse");
      pulse.setAttribute("r", "3.2");
      pulse.setAttribute("fill", "#2f9e63");
      const motion = svgEl("animateMotion");
      motion.setAttribute("dur", `${dur}s`);
      motion.setAttribute("begin", `${begin}s`);
      motion.setAttribute("repeatCount", "indefinite");
      motion.setAttribute("path", path.d);
      const fade = svgEl("animate");
      fade.setAttribute("attributeName", "opacity");
      fade.setAttribute("values", "0;0.85;0.85;0");
      fade.setAttribute("keyTimes", "0;0.15;0.85;1");
      fade.setAttribute("dur", `${dur}s`);
      fade.setAttribute("begin", `${begin}s`);
      fade.setAttribute("repeatCount", "indefinite");
      pulse.append(motion, fade);
      sapGroup.appendChild(pulse);
    }
    svg.appendChild(sapGroup);
  }

  /* Branch layers: label + cards, each grouped so growth can reveal them
   * one generation at a time. */
  const layers = [];
  for (const branch of layout.branches) {
    const group = el("div", "mt-layer");
    group.dataset.branchId = branch.id;
    const label = el("p", "mt-branch-label", `BRANCH - ${branch.name}`);
    label.style.left = `${branch.cx}px`;
    label.style.top = `${branch.labelY}px`;
    if (!reduced) label.classList.add("mt-bud");
    label.style.setProperty("--mt-delay", `${branch.cards[0]?.y ? 0 : 0.2 + (hash(branch.id + ":bd") % 8) / 10}s`);
    group.appendChild(label);

    for (const card of branch.cards) {
      const node = el("div", "mt-card", card.label);
      node.style.left = `${card.x}px`;
      node.style.top = `${card.y}px`;
      node.style.width = `${CARD_W}px`;
      if (!reduced) node.classList.add("mt-bud");
      node.style.setProperty("--mt-delay", `${0.35 + hash(card.id + ":cd") % 7 / 10}s`);
      group.appendChild(node);
    }
    nodesLayer.appendChild(group);
    layers.push(group);
  }

  mount.appendChild(stage);

  /* Scroll-driven growth: the trunk draws down and layers bud in as the
   * page scrolls. One rAF-throttled scroll listener; reduced motion skips
   * the wiring entirely and renders the full tree. */
  let raf = 0;
  let destroyed = false;

  function growthProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return 1;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  const GROW_TRUNK_END = 0.5;

  function applyGrowth(progress) {
    /* The trunk draws from the root card down as the first half of the
     * growth; after that each layer buds in, deepest foundation first
     * (the last branch in layout order diverges lowest). */
    const trunkP = trunkReveal(progress);
    if (trunkPath) {
      trunkPath.setAttribute("stroke-dasharray", "1");
      trunkPath.setAttribute("stroke-dashoffset", String(1 - trunkP));
    }

    const count = layers.length;
    for (let i = 0; i < count; i++) {
      const o = layerReveal(progress, count, i);
      layers[i].style.opacity = String(o);
      layers[i].style.transform = o < 1 ? `translateY(${(1 - o) * 22}px)` : "";
      const elbow = elbowPaths[i];
      if (elbow) elbow.style.opacity = String(o);
    }
  }

  if (wantGrowth) {
    applyGrowth(growthProgress());
    const onScroll = () => {
      if (destroyed) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => applyGrowth(growthProgress()));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  } else {
    applyGrowth(1);
  }

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      mount.removeChild(stage);
    },
  };
}
