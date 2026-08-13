/**
 * Tree motion (ticket 12): the ticket 07 motion prototype shipped into the
 * live vertical-path tree (ticket 10 geometry, src/lib/mapview/tree.js).
 *
 * Three effects ride the cladogram centerlines of the vertical path - root
 * concept card top, trunk descending, each layer a band of cards centered on
 * the trunk:
 *
 * 1. Flowing sap pulses via SMIL animateMotion - one pulse train on the trunk
 *    (deepest foundation up to the crown) and one per branch (its cards up to
 *    the trunk; a two-up layer rides each of its column elbows). Pure SMIL,
 *    zero JS animation loop.
 * 2. Scroll-driven growth - the trunk draws down over the first half of the
 *    scroll (pathLength-normalised dashoffset), then each layer buds in,
 *    deepest foundation first. One passive rAF-throttled scroll listener
 *    hooked to the natural page scroller (ticket 10 scroll model - no nested
 *    scroll box).
 * 3. Node lifecycle stagger - a deterministic --mt-delay per element that the
 *    caller (map.js) applies as the CSS tree-bud animation.
 *
 * Reduced motion (the 07 contract): the JS gate skips the sap pulses (SMIL
 * cannot be reliably killed by CSS) and the scroll wiring entirely, and the
 * CSS media query kills every animation and transition. The static tree is
 * identical with and without motion.
 *
 * The pure geometry and growth math are exported for node:test; the DOM
 * wiring (wireTreeMotion) stays thin and is verified by the headless CDP
 * probe (research/12-*).
 */

import { TREE_CARD_HEIGHT } from "./mapview/tree.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SAP_COLOR = "#2f9e63";

/** Fraction of scroll growth spent drawing the trunk (0..1 progress). */
export const GROW_TRUNK_END = 0.5;

/**
 * Deterministic hash for stagger values (the same hash the portfoolio tree
 * and the 07 prototype use), so the motion feels grown, not gridded.
 *
 * @param {string} s
 * @returns {number}
 */
export function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * True when the OS asks for reduced motion. Checked once at build time; the
 * caller skips the sap pulses and the scroll wiring entirely when it is.
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The lifecycle stagger delay for one element, as a CSS time string - the
 * root buds first, then branch labels, then cards, each offset by a
 * deterministic hash of its id (the 07 prototype contract).
 *
 * @param {string} id - the element's stable id (branch id or card id).
 * @param {"root" | "label" | "card"} role
 * @returns {string}
 */
export function budDelay(id, role) {
  if (role === "root") return "0.1s";
  if (role === "label") return `${0.2 + (hash(id + ":bd") % 8) / 10}s`;
  return `${0.35 + (hash(id + ":cd") % 7) / 10}s`;
}

/**
 * The trunk's draw progress for a scroll progress: 0 (hidden) at the top,
 * fully drawn once GROW_TRUNK_END is reached.
 *
 * @param {number} progress - page scroll progress 0..1.
 * @returns {number}
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
 * @returns {number}
 */
export function layerReveal(progress, count, index) {
  if (count === 0) return 1;
  const chronological = count - 1 - index;
  const start = GROW_TRUNK_END + (chronological * (1 - GROW_TRUNK_END)) / count;
  const end = GROW_TRUNK_END + ((chronological + 1) * (1 - GROW_TRUNK_END)) / count;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

/**
 * The centerlines the sap pulses ride along, in the rising direction: the
 * trunk runs from the deepest card bottom up to the crown, and each branch
 * runs from its last card up to its divergence and into the trunk. A two-up
 * layer rides each of its column elbows (one pulse train per column), so the
 * sap always travels cards -> trunk -> crown, foundations to abstractions.
 *
 * @param {ReturnType<typeof import("./mapview/tree.js").treeLayout>} layout
 * @returns {Array<{ id: string; d: string }>}
 */
export function sapPulsePaths(layout) {
  /** @type {Array<{ id: string; d: string }>} */
  const paths = [];
  if (layout.branches.length === 0) return paths;

  const trunkTop = layout.root.y + layout.root.height;
  const deepest = Math.max(
    ...layout.branches.map((branch) =>
      branch.cards.length === 0
        ? branch.firstCardY
        : Math.max(...branch.cards.map((card) => card.y + TREE_CARD_HEIGHT))
    )
  );
  paths.push({ id: "trunk", d: `M ${layout.root.cx} ${deepest} V ${trunkTop}` });

  layout.branches.forEach((branch) => {
    const cols = [...new Set(branch.cards.map((card) => card.cx))];
    if (cols.length === 0) {
      paths.push({
        id: branch.id,
        d: `M ${branch.cx} ${branch.firstCardY} V ${branch.divergenceY} H ${layout.root.cx}`,
      });
      return;
    }
    // A single column rides the trunk (one pulse train per branch); a two-up
    // layer has two column elbows, so each column gets its own pulse train.
    const single = cols.length === 1;
    cols.forEach((cx, colIndex) => {
      const colCards = branch.cards.filter((card) => card.cx === cx);
      const last = colCards[colCards.length - 1];
      const startY = last ? last.y + TREE_CARD_HEIGHT : branch.firstCardY;
      paths.push({
        id: single ? branch.id : `${branch.id}:c${colIndex}`,
        d: `M ${cx} ${startY} V ${branch.divergenceY} H ${layout.root.cx}`,
      });
    });
  });

  return paths;
}

/**
 * For every cladogram stroke after the trunk (the two-up elbows and the
 * in-column connectors), the layout order of the layer it belongs to. Aligned
 * 1:1 with `cladogramPaths(layout)` minus its first entry, so scroll growth
 * can fade each elbow with its layer. One-up layers sit on the trunk and
 * emit no off-trunk strokes.
 *
 * @param {ReturnType<typeof import("./mapview/tree.js").treeLayout>} layout
 * @returns {number[]}
 */
export function elbowLayerIndexes(layout) {
  /** @type {number[]} */
  const indexes = [];
  layout.branches.forEach((branch, branchIndex) => {
    const cols = [...new Set(branch.cards.map((card) => card.cx))];
    for (const cx of cols) {
      if (Math.abs(cx - layout.root.cx) < 0.5) continue;
      const colCards = branch.cards.filter((card) => card.cx === cx);
      indexes.push(branchIndex);
      for (let j = 1; j < colCards.length; j++) {
        indexes.push(branchIndex);
      }
    }
  });
  return indexes;
}

/**
 * Wire the 07 motion onto the rendered live tree. The caller (map.js) has
 * already laid out the SVG strokes (cladogramPaths) and built one `.tree-layer`
 * wrapper per branch; this tags the trunk, adds the sap pulses, and drives
 * scroll growth on the wrappers and their elbows.
 *
 * Under reduced motion nothing is added and nothing scrolls: the tree renders
 * full, identical to the motion build.
 *
 * @param {{
 *   svg: SVGSVGElement;
 *   layout: ReturnType<typeof import("./mapview/tree.js").treeLayout>;
 *   layers: HTMLElement[];
 *   reduced?: boolean;
 * }} options
 * @returns {{ destroy: () => void }}
 */
export function wireTreeMotion({ svg, layout, layers, reduced = false }) {
  const paths = [...svg.querySelectorAll("path")];
  const trunkPath = paths.length > 0 ? paths[0] : null;
  const elbowPaths = paths.slice(1);

  const elbowLayers = elbowLayerIndexes(layout);
  /** @type {SVGPathElement[][]} */
  const elbowsByLayer = [];
  elbowPaths.forEach((elbow, i) => {
    const layerIndex = elbowLayers[i];
    if (layerIndex === undefined) return;
    if (elbowsByLayer[layerIndex] === undefined) elbowsByLayer[layerIndex] = [];
    elbowsByLayer[layerIndex].push(elbow);
  });

  if (trunkPath) {
    trunkPath.classList.add("tree-trunk");
    trunkPath.setAttribute("pathLength", "1");
  }

  if (reduced) {
    return { destroy() {} };
  }

  /* Sap pulses: nutrient packets rising along the trunk and the branches,
   * SMIL only - no JS animation loop. Skipped entirely under reduced motion,
   * because SMIL cannot be reliably neutralised by CSS. */
  if (trunkPath) {
    const sapGroup = document.createElementNS(SVG_NS, "g");
    sapGroup.setAttribute("class", "tree-sap");
    sapGroup.setAttribute("pointer-events", "none");
    for (const sap of sapPulsePaths(layout)) {
      const dur = 4.5 + (hash(sap.id + ":sd") % 30) / 10;
      const begin = (hash(sap.id + ":sb") % 80) / 10;
      const pulse = document.createElementNS(SVG_NS, "circle");
      pulse.setAttribute("class", "tree-sap-pulse");
      pulse.setAttribute("r", "3.2");
      pulse.setAttribute("fill", SAP_COLOR);
      const motion = document.createElementNS(SVG_NS, "animateMotion");
      motion.setAttribute("dur", `${dur}s`);
      motion.setAttribute("begin", `${begin}s`);
      motion.setAttribute("repeatCount", "indefinite");
      motion.setAttribute("path", sap.d);
      const fade = document.createElementNS(SVG_NS, "animate");
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

  /* Scroll-driven growth: the trunk draws down over the first half of the
   * scroll, then each layer buds in, deepest foundation first. One passive
   * rAF-throttled listener on the natural page scroller. */
  let raf = 0;
  let destroyed = false;

  function growthProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return 1;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  /**
   * @param {number} progress - page scroll progress 0..1.
   */
  function applyGrowth(progress) {
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
      const elbows = elbowsByLayer[i];
      if (elbows !== undefined) {
        for (const elbow of elbows) elbow.style.opacity = String(o);
      }
    }
  }

  applyGrowth(growthProgress());
  const onScroll = () => {
    if (destroyed) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => applyGrowth(growthProgress()));
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    },
  };
}
