/**
 * Cladogram + one-shot grow prototype (ticket 01).
 *
 * Locked geometry: v1 ticket 17 (git 0e72e6e), NOT the v3 vertical-path
 * tree in src/lib/mapview/tree.js. Crown at the top, central trunk, even
 * branches right / odd left, deepest-nearest the trunk per side.
 *
 * Grow is elapsed-time (~1s), not scroll: trunk draws first, then layers
 * bud deepest-first. At progress 1 every layer freezes at opacity 1.
 * Scrolling after grow must not change opacity. Sap pulses may ride the
 * finished cladogram. Reduced motion skips grow and sap.
 */

export const TREE_CARD_WIDTH = 280;
export const TREE_CARD_HEIGHT = 64;
export const TREE_COLUMN_GAP = 32;
export const TREE_CARD_GAP = 12;
export const TREE_ROOT_WIDTH = 220;
export const TREE_ROOT_HEIGHT = 74;
export const TREE_ROOT_GAP = 72;
export const TREE_DIVERGENCE_STEP = 36;
export const TREE_LABEL_GAP = 34;

/** Fraction of the elapsed grow spent drawing the trunk (0..1 progress). */
export const GROW_TRUNK_END = 0.5;
/** One-shot grow duration in milliseconds. */
export const GROW_MS = 1000;

const SVG_NS = "http://www.w3.org/2000/svg";

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Absolute geometry for the tree: root card, central trunk, branch label
 * and card positions. Port of v1 ticket 17 `treeLayout`.
 *
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string; date?: string; observed?: boolean; combines?: number }> }> }} tree
 */
export function treeLayout(tree) {
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
        date: node.date,
        observed: node.observed !== false,
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

  return { width, height, root, branches, trunk };
}

/**
 * Cladogram elbow strokes as SVG path strings: vertical trunk from the root
 * card bottom down to the deepest divergence, one elbow per branch, then
 * vertical connectors between stacked cards. Fill none, strokeWidth 2,
 * stroke #B9B3E8.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 * @returns {string[]}
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
 * Centerlines the sap pulses ride along. Direction is reversed so
 * observations rise from the foundations up to the crown.
 *
 * @param {ReturnType<typeof treeLayout>} layout
 */
export function sapPaths(layout) {
  const paths = [];
  if (layout.branches.length === 0) return paths;
  const last = layout.branches[layout.branches.length - 1];
  const trunkTop = layout.root.y + layout.root.height;
  paths.push({
    id: "trunk",
    d: `M ${layout.trunk} ${last.divergenceY} V ${trunkTop}`,
  });
  for (const branch of layout.branches) {
    const lastCard = branch.cards[branch.cards.length - 1];
    const startY = lastCard ? lastCard.y + TREE_CARD_HEIGHT : branch.firstCardY;
    paths.push({
      id: branch.id,
      d: `M ${branch.cx} ${startY} V ${branch.divergenceY} H ${layout.trunk}`,
    });
  }
  return paths;
}

/**
 * The trunk's draw progress for an elapsed grow progress: 0 at time 0,
 * fully drawn once GROW_TRUNK_END is reached. `progress` is elapsed 0..1,
 * NOT page scroll.
 *
 * @param {number} progress - elapsed grow progress 0..1.
 */
export function trunkReveal(progress) {
  return Math.min(1, Math.max(0, progress / GROW_TRUNK_END));
}

/**
 * A layer's reveal opacity for an elapsed grow progress. Layers reveal
 * deepest foundation first (last branch in layout order), so index 0
 * (crown-most) appears last. `progress` is elapsed 0..1, NOT scroll.
 *
 * @param {number} progress - elapsed grow progress 0..1.
 * @param {number} count - number of layers.
 * @param {number} index - layer index in layout order (0 = crown-most).
 */
export function layerReveal(progress, count, index) {
  if (count === 0) return 1;
  const chronological = count - 1 - index;
  const start = GROW_TRUNK_END + (chronological * (1 - GROW_TRUNK_END)) / count;
  const end =
    GROW_TRUNK_END + ((chronological + 1) * (1 - GROW_TRUNK_END)) / count;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
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

function mountSap(svg, layout) {
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
  return sapGroup;
}

/**
 * Build the cladogram into `mount`. One-shot elapsed grow on load; freeze
 * at full visibility. Opacity is never bound to window.scrollY.
 *
 * @param {HTMLElement} mount
 * @param {{ rootLabel: string; branches: Array<{ id: string; name: string; nodes: Array<{ id: string; label: string; date?: string; observed?: boolean; combines?: number }> }> }} tree
 * @param {{ sap?: boolean; reduced?: boolean }} [opts]
 * @returns {{ destroy: () => void }}
 */
export function buildTree(mount, tree, opts = {}) {
  const reduced = opts.reduced === true;
  const wantSap = opts.sap !== false && !reduced;
  const wantGrow = !reduced;

  const layout = treeLayout(tree);
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

  const root = el("div", "mt-root");
  root.style.left = `${layout.root.x}px`;
  root.style.top = `${layout.root.y}px`;
  root.style.width = `${layout.root.width}px`;
  root.style.height = `${layout.root.height}px`;
  root.append(
    el("p", "mt-root-eyebrow", "THE CONCEPT"),
    el("h2", "mt-root-word", tree.rootLabel || "")
  );
  nodesLayer.appendChild(root);

  const strokes = svgEl("g");
  strokes.setAttribute("class", "mt-strokes");
  svg.appendChild(strokes);

  const cladogram = cladogramPaths(layout);
  let trunkPath = null;
  /** @type {SVGElement[]} */
  const layerStrokes = [];
  let pathAt = 0;
  if (cladogram.length > 0) {
    trunkPath = svgEl("path");
    trunkPath.setAttribute("class", "mt-trunk");
    trunkPath.setAttribute("d", cladogram[pathAt]);
    trunkPath.setAttribute("pathLength", "1");
    strokes.appendChild(trunkPath);
    pathAt += 1;
  }
  for (const branch of layout.branches) {
    const group = svgEl("g");
    group.setAttribute("class", "mt-layer-strokes");
    group.setAttribute("data-branch-id", branch.id);
    const elbow = svgEl("path");
    elbow.setAttribute("d", cladogram[pathAt]);
    group.appendChild(elbow);
    pathAt += 1;
    for (let j = 1; j < branch.cards.length; j++) {
      const connector = svgEl("path");
      connector.setAttribute("d", cladogram[pathAt]);
      group.appendChild(connector);
      pathAt += 1;
    }
    strokes.appendChild(group);
    layerStrokes.push(group);
  }

  /** @type {HTMLElement[]} */
  const layers = [];
  for (const branch of layout.branches) {
    const group = el("div", "mt-layer");
    group.dataset.branchId = branch.id;
    const label = el("p", "mt-branch-label", `BRANCH - ${branch.name}`);
    label.style.left = `${branch.cx}px`;
    label.style.top = `${branch.labelY}px`;
    group.appendChild(label);

    for (const card of branch.cards) {
      const node = el("div", "mt-card");
      node.style.left = `${card.x}px`;
      node.style.top = `${card.y}px`;
      node.style.width = `${TREE_CARD_WIDTH}px`;
      node.style.height = `${TREE_CARD_HEIGHT}px`;
      const text = el("span", "mt-card-label", card.label);
      const date = card.date
        ? el("span", "mt-card-date", card.date)
        : null;
      const copy = el("span", "mt-card-copy");
      copy.appendChild(text);
      if (date) copy.appendChild(date);
      const dot = el(
        "i",
        card.observed ? "mt-obs-dot recorded" : "mt-obs-dot gap"
      );
      dot.setAttribute("aria-hidden", "true");
      node.append(copy, dot);
      if (card.combines > 0) {
        const chip = el(
          "span",
          "mt-converge-chip",
          `combines ${card.combines} field${card.combines === 1 ? "" : "s"}`
        );
        chip.setAttribute("aria-hidden", "true");
        node.appendChild(chip);
      }
      group.appendChild(node);
    }
    nodesLayer.appendChild(group);
    layers.push(group);
  }

  mount.appendChild(stage);

  let raf = 0;
  let destroyed = false;
  let sapMounted = false;

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
      const strokeGroup = layerStrokes[i];
      if (strokeGroup) strokeGroup.style.opacity = String(o);
    }
  }

  function finishGrow() {
    applyGrowth(1);
    if (wantSap && !sapMounted) {
      mountSap(svg, layout);
      sapMounted = true;
    }
  }

  if (wantGrow) {
    applyGrowth(0);
    const t0 = performance.now();
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
  } else {
    applyGrowth(1);
  }

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (stage.parentNode === mount) mount.removeChild(stage);
    },
  };
}
