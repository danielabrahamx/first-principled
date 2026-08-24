/**
 * Tree motion (v5 ticket 03): one-shot elapsed-time grow on the dependence-
 * path spine (src/lib/mapview/tree.js).
 *
 * Three effects ride the spine - root concept card top, trunk descending,
 * named layer bands along the path:
 *
 * 1. Flowing sap pulses via SMIL animateMotion - one pulse train on the trunk
 *    (deepest foundation up to the crown) and one per rib. Mounted after
 *    the grow freezes. Pure SMIL, zero JS animation loop.
 * 2. One-shot grow - the trunk draws over the first half of a ~1s elapsed
 *    timeline, then each layer band buds in, deepest foundation first. When
 *    the timeline ends, freeze at full visibility. Opacity is never bound to
 *    window.scrollY.
 * 3. Node lifecycle stagger - a deterministic --mt-delay per element that the
 *    caller (map.js) applies as the CSS tree-bud animation.
 *
 * Reduced motion: skip sap and grow; the static tree is fully visible.
 *
 * The pure geometry and growth math are exported for node:test; the DOM
 * wiring (wireTreeMotion) stays thin and is verified by the headless CDP
 * probe.
 */

import { TREE_CARD_HEIGHT } from "./mapview/tree.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SAP_COLOR = "#2f9e63";

/** Fraction of the elapsed grow spent drawing the trunk (0..1 progress). */
export const GROW_TRUNK_END = 0.5;
/** One-shot grow duration in milliseconds. */
export const GROW_MS = 1000;

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
 * The trunk's draw progress for an elapsed grow progress: 0 at time 0,
 * fully drawn once GROW_TRUNK_END is reached. `progress` is elapsed 0..1,
 * NOT page scroll.
 *
 * @param {number} progress - elapsed grow progress 0..1.
 * @returns {number}
 */
export function trunkReveal(progress) {
  return Math.min(1, Math.max(0, progress / GROW_TRUNK_END));
}

/**
 * A layer's reveal opacity for an elapsed grow progress. Layers reveal
 * deepest foundation first (the last branch in layout order diverges lowest),
 * so `index` 0 (the crown-most layer) appears last. `progress` is elapsed
 * 0..1, NOT page scroll.
 *
 * @param {number} progress - elapsed grow progress 0..1.
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
 * trunk runs from the deepest spine card up to the crown, and each rib
 * runs from its card into the trunk.
 *
 * @param {ReturnType<typeof import("./mapview/tree.js").treeLayout>} layout
 * @returns {Array<{ id: string; d: string }>}
 */
export function sapPulsePaths(layout) {
  /** @type {Array<{ id: string; d: string }>} */
  const paths = [];
  const onSpine = (layout.cards || [])
    .filter((card) => !card.rib)
    .sort((a, b) => a.y - b.y);
  if (onSpine.length === 0) return paths;

  const first = onSpine[0];
  const last = onSpine[onSpine.length - 1];
  if (!first || !last) return paths;
  const trunkX = layout.trunk ?? layout.root.cx;
  paths.push({
    id: "trunk",
    d: `M ${trunkX} ${first.y} V ${last.y + last.height}`,
  });

  for (const card of layout.cards.filter((c) => c.rib)) {
    paths.push({
      id: card.id,
      d: `M ${card.cx} ${card.y + TREE_CARD_HEIGHT} V ${card.y} H ${trunkX}`,
    });
  }

  return paths;
}

/**
 * For every spine stroke after the trunk (one elbow per card), the layout
 * order of that card's layer. Aligned 1:1 with `spinePaths(layout)` minus
 * its first entry.
 *
 * @param {ReturnType<typeof import("./mapview/tree.js").treeLayout>} layout
 * @returns {number[]}
 */
export function elbowLayerIndexes(layout) {
  /** @type {Map<string, number>} */
  const layerOf = new Map();
  layout.branches.forEach((branch, branchIndex) => {
    for (const card of branch.cards) layerOf.set(card.id, branchIndex);
  });
  return (layout.arrows || []).map((arrow) => layerOf.get(arrow.source) ?? 0);
}

/**
 * Wire the 07 motion onto the rendered live tree. The caller (map.js) has
 * already laid out the SVG strokes (spinePaths) and built one `.tree-layer`
 * wrapper per branch; this tags the trunk, plays the one-shot grow, then
 * mounts sap pulses after freeze.
 *
 * Under reduced motion nothing is added: the tree renders full, instantly.
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

  /**
   * @param {number} progress - elapsed grow progress 0..1.
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

  if (reduced) {
    applyGrowth(1);
    return { destroy() {} };
  }

  let raf = 0;
  let destroyed = false;
  let sapMounted = false;

  function mountSap() {
    if (sapMounted || !trunkPath) return;
    sapMounted = true;
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

  function finishGrow() {
    applyGrowth(1);
    mountSap();
  }

  applyGrowth(0);
  const t0 = performance.now();
  /** @param {number} now */
  const tick = (now) => {
    if (destroyed) return;
    const progress = Math.min(1, (now - t0) / GROW_MS);
    applyGrowth(progress);
    if (progress < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      finishGrow();
    }
  };
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
    },
  };
}
