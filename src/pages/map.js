/**
 * The map page (tickets 09, 10, 13): the learner watches their mental model
 * converge without ever seeing the answers - now in the "chapel" design from
 * the ticket 13 spec (research/13-ui-design-spec.md).
 *
 * What renders mid-session is exactly the learner's model - the learner map
 * nodes joined with reality labels ONLY for nodes already in the model (see
 * lib/mapview/viewmodel.js, which owns that no-leak rule), colored by state,
 * confidence per node, edges drawn between cards with their own state.
 * Reality layers, descriptions and unengaged nodes are never consulted for
 * rendering, so they cannot appear. The page makes no network requests at
 * all: every update comes from the session store.
 *
 * Three states, per the ticket 13 spec and ticket 15 (2026-08-08):
 * - Learner model grid: a segmented header (Chat / Map / Reality), a title
 *   row with the concept word and a Closeness number + progress bar, a
 *   legend, and the responsive card grid with the SVG edge overlay.
 * - Reality tree: the Reality segment is visible from session start (ticket
 *   15) - the reality phylogenetic tree (lib/mapview/tree.js), the concept
 *   as the crown, its layers branching down like ancestry, is an
 *   information surface the learner may open whenever a reality map is
 *   held. The comparison metrics row and transfer assessment render on both
 *   tabs at session end only.
 * - The no-leak rule now binds chat, not the map page: mid-session the
 *   learner grid still shows only engaged nodes, but the Reality tab shows
 *   full ground truth at any time.
 *
 * Updates are diff-driven: the store's lastDiff tells us which nodes
 * appeared (pop-in), flipped state (color transition on the same DOM
 * element) or updated confidence/evidence (flash). Re-renders from
 * navigation or resize re-layout without replaying the animation.
 */

import {
  learnerCards,
  learnerEdges,
  nodeDelta,
  stateClass,
} from "../lib/mapview/viewmodel.js";
import { comparisonMetrics } from "../lib/mapview/comparison.js";
import {
  TREE_CARD_WIDTH,
  cladogramPaths,
  realityTree,
  treeLayout,
} from "../lib/mapview/tree.js";
import {
  columnCount,
  gridMetrics,
  nodePositions,
  edgePaths,
} from "../lib/mapview/layout.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * querySelector returns Element, which has no .style; narrow to HTMLElement.
 *
 * @param {Element | null} found
 * @returns {HTMLElement | null}
 */
function asEl(found) {
  return /** @type {HTMLElement | null} */ (found);
}

/**
 * @returns {SVGSVGElement}
 */
function svgEl() {
  return document.createElementNS(SVG_NS, "svg");
}

/**
 * @param {number} confidence
 * @returns {string}
 */
function pct(confidence) {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * @param {ReturnType<typeof learnerCards>[number]} card
 * @returns {string}
 */
function tooltip(card) {
  const lines = [`${card.label}: ${card.state}, ${pct(card.confidence)} confident`];
  for (const quote of card.evidence) lines.push(`evidence: ${quote}`);
  return lines.join("\n");
}

/**
 * Mount the map page into `root`, driven by the shared session store.
 * Returns a handle with `sync()` for route changes; the page also
 * subscribes to the store, so it re-renders live as turns land.
 *
 * @param {HTMLElement} root - the #view-map section.
 * @param {import("../state/session.js").SessionStore} store - the shared
 *   session store singleton.
 * @param {object} [options]
 * @param {boolean} [options.responsive] - listen to window resize (true in
 *   the browser; tests can disable).
 * @param {(route: string) => void} [options.navigate] - route to another
 *   page (used by the segmented control); defaults to setting location.hash.
 * @returns {{ sync: () => void; destroy: () => void }}
 */
export function renderMapPage(root, store, options = {}) {
  const responsive = options.responsive !== false;
  const navigate =
    options.navigate ??
    ((route) => {
      /** @type {{ hash: string }} */
      const location = /** @type {any} */ (globalThis.location);
      location.hash = `#${route}`;
    });

  /** The active tab within the map page: "model" or "reality". */
  let tab = "model";
  /** The word the last render saw; a new word resets the tab to the model. */
  let lastWord = /** @type {string | null} */ (null);

  const page = el("div", "map-page");

  /* Header: logo row + segmented control. */
  const header = el("header", "map-header");
  const logo = el("div", "logo-row");
  logo.append(el("span", "orb logo-dot"), el("span", "wordmark", "first-principled"));
  const tabs = el("nav", "seg");
  tabs.setAttribute("aria-label", "Pages");
  const chatTab = el("button", "seg-item", "Chat");
  const modelTab = el("button", "seg-item", "Map");
  const realityTab = el("button", "seg-item", "Reality");
  chatTab.dataset.tab = "chat";
  modelTab.dataset.tab = "model";
  realityTab.dataset.tab = "reality";
  realityTab.hidden = true;
  chatTab.addEventListener("click", () => navigate("chat"));
  modelTab.addEventListener("click", () => {
    tab = "model";
    sync();
  });
  realityTab.addEventListener("click", () => {
    tab = "reality";
    sync();
  });
  tabs.append(chatTab, modelTab, realityTab);
  header.append(logo, tabs);

  /* Title row: eyebrow + concept word, closeness on the right. */
  const titleRow = el("div", "map-title-row");
  const titleLeft = el("div", "map-title-left");
  const word = el("h1", "map-word");
  titleLeft.append(el("p", "map-eyebrow", "Your mental model"), word);
  const closeness = el("div", "map-closeness");
  const closenessFrac = el("span", "map-closeness-frac");
  const progress = el("div", "map-progress");
  const closenessFill = el("i", "map-progress-fill");
  progress.appendChild(closenessFill);
  closeness.append(
    el("span", "map-closeness-label", "Closeness"),
    closenessFrac,
    progress
  );
  titleRow.append(titleLeft, closeness);

  /* Legend. */
  const legend = el("div", "map-legend");
  legend.appendChild(el("span", "map-legend-label", "Legend"));
  const LEGEND = [
    ["correct", "correct"],
    ["misconception", "misconception"],
    ["missing", "missing"],
    ["untested", "untested"],
  ];
  for (const [state, label] of LEGEND) {
    const item = el("span", "map-legend-item");
    item.append(el("i", `legend-swatch ${state}`), document.createTextNode(label));
    legend.appendChild(item);
  }

  /* Learner model grid: scrollable stage + SVG edge overlay. */
  const scroll = el("div", "map-scroll");
  const stage = el("div", "map-stage");
  const svg = svgEl();
  const nodesLayer = el("div", "map-nodes");
  stage.append(svg, nodesLayer);
  scroll.appendChild(stage);

  /* Reality phylogenetic tree panel (session end, Reality tab). */
  const treePanel = el("div", "tree-panel");
  treePanel.hidden = true;
  const treeScroll = el("div", "tree");
  const treeStage = el("div", "tree-stage");
  const treeSvg = svgEl();
  treeSvg.setAttribute("class", "tree-svg");
  const treeLayer = el("div", "tree-nodes");
  treeStage.append(treeSvg, treeLayer);
  treeScroll.appendChild(treeStage);
  treePanel.appendChild(treeScroll);

  /* Session-end comparison: metrics row + transfer assessment. */
  const cmpBlock = el("section", "cmp-block");
  cmpBlock.hidden = true;

  const noSession = el(
    "p",
    "note map-empty",
    "Start a session in chat first. Your mental model will take shape here as it builds."
  );
  const empty = el(
    "p",
    "note map-empty",
    "No mental model yet. Answer a question in chat and watch it take shape here."
  );
  const ended = el(
    "p",
    "map-note",
    "Session complete. This is your final mental model."
  );

  page.append(header, titleRow, legend, scroll, treePanel, cmpBlock, noSession, empty, ended);
  root.append(page);

  /** @type {Map<string, HTMLElement>} node id -> card element */
  const nodeEls = new Map();
  /** @type {Map<string, SVGPathElement>} "source->target" -> path element */
  const pathEls = new Map();
  /** The last diff reference whose animation has been replayed. */
  let renderedDiff = /** @type {import("../lib/mmg/types.js").Diff | null} */ (null);

  /** @typedef {ReturnType<typeof learnerCards>[number]} MapCard */
  /** @typedef {ReturnType<typeof nodeDelta>} NodeDelta */

  /**
   * @param {MapCard} card
   * @returns {HTMLElement}
   */
  function buildCard(card) {
    const node = el("div", `map-card ${stateClass(card.state)}`);
    node.dataset.nodeId = card.id;
    const top = el("div", "map-card-top");
    top.appendChild(el("span", "map-card-label", card.label));
    const status = el(
      "span",
      "map-status",
      `${card.state} - ${card.confidence.toFixed(1)}`
    );
    const conf = el("div", "map-conf");
    const bar = el("div", "map-conf-bar");
    const fill = el("i", "map-conf-fill");
    fill.style.width = pct(card.confidence);
    bar.appendChild(fill);
    node.append(top, status, bar);
    return node;
  }

  /**
   * @param {HTMLElement} node
   * @param {MapCard} card
   * @param {NodeDelta} delta
   */
  function updateCard(node, card, delta) {
    const label = asEl(node.querySelector(".map-card-label"));
    const status = asEl(node.querySelector(".map-status"));
    const fill = asEl(node.querySelector(".map-conf-fill"));
    if (label && label.textContent !== card.label) label.textContent = card.label;
    const statusText = `${card.state} - ${card.confidence.toFixed(1)}`;
    if (status && status.textContent !== statusText) status.textContent = statusText;
    node.className = `map-card ${stateClass(card.state)}`;
    if (delta.added) node.classList.add("added");
    if (delta.updated) {
      node.classList.add("flash");
      node.addEventListener(
        "animationend",
        () => node.classList.remove("flash"),
        { once: true }
      );
    }
    if (fill && fill.style.width !== pct(card.confidence)) fill.style.width = pct(card.confidence);
    node.title = tooltip(card);
    node.setAttribute(
      "aria-label",
      `${card.label}: ${card.state}, ${pct(card.confidence)} confident`
    );
  }

  /**
   * The title-row closeness number: "known/total" with the progress bar at
   * the closeness percentage (the ticket 13 spec's 4/11 + 38% example).
   *
   * @param {import("../state/session.js").SessionState} state
   */
  function updateCloseness(state) {
    const total =
      state.realityMap && Array.isArray(state.realityMap.nodes)
        ? state.realityMap.nodes.length
        : 0;
    const closeness = typeof state.closeness === "number" ? state.closeness : 0;
    const known = total > 0 ? Math.round(closeness * total) : 0;
    closenessFrac.textContent = `${known}/${total}`;
    closenessFill.style.width = `${Math.round(closeness * 100)}%`;
  }

  /**
   * The segmented control per session state: mid-session Chat | Map | Reality
   * (the reality tree is an information surface, viewable from session start
   * per Danny's 2026-08-08 product call - ticket 15); at session end the Map
   * segment becomes "Learner map" and the comparison metrics appear on both
   * tabs.
   *
   * @param {import("../state/session.js").SessionState} state
   */
  function updateTabs(state) {
    const hasReality = state.realityMap !== null;
    const compare = state.ended && hasReality;
    modelTab.textContent = compare ? "Learner map" : "Map";
    realityTab.hidden = !hasReality;
    chatTab.classList.remove("active");
    modelTab.classList.toggle("active", !compare || tab === "model");
    realityTab.classList.toggle("active", compare && tab === "reality");
  }

  /**
   * A metrics chip: "Closeness 83%", "Gaps closed 4", "Transfer passed".
   *
   * @param {string} label
   * @param {string} value
   * @returns {HTMLElement}
   */
  function chip(label, value) {
    const c = el("span", "cmp-chip");
    c.append(label, " ", el("strong", "cmp-chip-value", value));
    return c;
  }

  /**
   * The session-end comparison: the metrics row (closeness, gap closures,
   * transfer) and the transfer assessment. Shown on both map tabs, because
   * this is the mission made visible.
   *
   * @param {HTMLElement} block
   * @param {import("../state/session.js").SessionState} state
   */
  function renderComparison(block, state) {
    block.replaceChildren();
    const metrics = comparisonMetrics(state);
    const chips = el("div", "cmp-metrics");
    chips.append(
      chip("Closeness", `${Math.round(metrics.closeness * 100)}%`),
      chip("Gaps closed", String(metrics.gapClosures)),
      chip(
        "Transfer",
        metrics.transferPassed === null ? "-" : metrics.transferPassed ? "passed" : "not passed"
      )
    );
    block.appendChild(chips);
    if (metrics.transferAssessment.length > 0) {
      block.appendChild(el("p", "cmp-transfer", metrics.transferAssessment));
    }
  }

  /**
   * The reality phylogenetic tree: root card (the concept, as the crown) and
   * the layer branches below it, with cladogram elbow connectors. Session end
   * only - this is full ground truth.
   *
   * @param {import("../state/session.js").SessionState} state
   */
  function renderTree(state) {
    const tree = realityTree(state.realityMap);
    const layout = treeLayout(tree);

    treeStage.style.width = `${layout.width}px`;
    treeStage.style.height = `${layout.height}px`;
    treeSvg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);

    treeLayer.replaceChildren();
    const root = el("div", "tree-root-card");
    root.style.left = `${layout.root.x}px`;
    root.style.top = `${layout.root.y}px`;
    root.style.width = `${layout.root.width}px`;
    root.append(
      el("p", "tree-root-eyebrow", "ROOT - THE CONCEPT"),
      el("h2", "tree-root-word", tree.rootLabel || "the concept")
    );
    treeLayer.appendChild(root);

    for (const branch of layout.branches) {
      const label = el("p", "tree-branch-label", `BRANCH - ${branch.name}`);
      label.style.left = `${branch.cx}px`;
      label.style.top = `${branch.labelY}px`;
      treeLayer.appendChild(label);
      for (const card of branch.cards) {
        const node = el("div", "tree-branch-card", card.label);
        node.style.left = `${card.x}px`;
        node.style.top = `${card.y}px`;
        node.style.width = `${TREE_CARD_WIDTH}px`;
        treeLayer.appendChild(node);
      }
    }

    treeSvg.replaceChildren();
    for (const d of cladogramPaths(layout)) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#B9B3E8");
      path.setAttribute("stroke-width", "2");
      treeSvg.appendChild(path);
    }
  }

  /**
   * Sync the page with the store: segmented control, title row, legend,
   * learner grid or reality tree, comparison block, empty and ended states.
   */
  function sync() {
    const state = store.getState();
    const cards = learnerCards(state);
    const edges = learnerEdges(state);
    const diffActive = state.lastDiff !== null && state.lastDiff !== renderedDiff;
    const diff = diffActive ? state.lastDiff : null;

    if (state.word !== lastWord) {
      lastWord = state.word;
      tab = "model";
    }

    const hasWord = state.word !== null;
    const hasReality = state.realityMap !== null;
    const compare = state.ended && hasReality;
    const showTree = hasReality && tab === "reality";

    word.textContent = state.word ?? "";
    titleRow.hidden = !hasWord;
    legend.hidden = !hasWord;
    updateCloseness(state);
    updateTabs(state);

    cmpBlock.hidden = !compare;
    if (compare) renderComparison(cmpBlock, state);

    treePanel.hidden = !showTree;
    if (showTree) renderTree(state);

    if (!hasWord) {
      noSession.hidden = false;
      empty.hidden = true;
      scroll.hidden = true;
      ended.hidden = true;
      return;
    }
    noSession.hidden = true;
    if (cards.length === 0) {
      empty.hidden = false;
      scroll.hidden = true;
      ended.hidden = state.ended ? false : true;
      return;
    }
    empty.hidden = true;
    scroll.hidden = showTree;
    if (showTree) return;
    ended.hidden = state.ended ? false : true;

    const cols = columnCount(stage.clientWidth || root.clientWidth || 480);
    const metrics = gridMetrics(cards.length, cols);
    const pos = nodePositions(cards, metrics.columns);
    stage.style.width = `${metrics.width}px`;
    stage.style.height = `${metrics.height}px`;
    svg.setAttribute("viewBox", `0 0 ${metrics.width} ${metrics.height}`);

    const want = new Set(cards.map((card) => card.id));
    for (const [id, node] of nodeEls) {
      if (!want.has(id)) {
        node.remove();
        nodeEls.delete(id);
      }
    }
    for (const card of cards) {
      const delta = diff ? nodeDelta(diff, card.id) : { added: false, flipped: null, updated: false };
      let node = nodeEls.get(card.id);
      if (node === undefined) {
        node = buildCard(card);
        nodeEls.set(card.id, node);
        nodesLayer.appendChild(node);
      }
      updateCard(node, card, delta);
      const where = pos[card.id];
      node.style.left = `${where.x}px`;
      node.style.top = `${where.y}px`;
    }

    const wantEdges = new Set(edges.map((edge) => `${edge.source}->${edge.target}`));
    for (const [key, path] of pathEls) {
      if (!wantEdges.has(key)) {
        path.remove();
        pathEls.delete(key);
      }
    }
    const paths = edgePaths(edges, pos);
    for (const pathModel of paths) {
      const key = `${pathModel.source}->${pathModel.target}`;
      let path = pathEls.get(key);
      if (path === undefined) {
        path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("fill", "none");
        pathEls.set(key, path);
        svg.appendChild(path);
      }
      const edge = edges.find(
        (candidate) => candidate.source === pathModel.source && candidate.target === pathModel.target
      );
      if (edge === undefined) continue;
      path.setAttribute("d", pathModel.d);
      path.setAttribute("class", `map-edge ${stateClass(edge.state)}`);
      const title = path.getElementsByTagName("title")[0];
      if (title) {
        title.textContent = `${edge.source} -> ${edge.target}: ${edge.state}`;
      } else {
        const child = document.createElementNS(SVG_NS, "title");
        child.textContent = `${edge.source} -> ${edge.target}: ${edge.state}`;
        path.appendChild(child);
      }
    }

    if (diffActive) renderedDiff = state.lastDiff;
  }

  const unsubscribe = store.subscribe(sync);
  if (responsive) {
    window.addEventListener("resize", sync);
  }

  sync();

  return {
    /** Re-sync on demand (route changes, after the view becomes visible). */
    sync,
    /** Tear the page down (not used in v1; keeps the subscription clean). */
    destroy() {
      unsubscribe();
      if (responsive) {
        window.removeEventListener("resize", sync);
      }
      root.replaceChildren();
    },
  };
}
