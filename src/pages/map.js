/**
 * The Tree home: one surface. Header is logo, foundations word box, and
 * How it works. No Chat page, no learner-map tab, no Tutor toggle or bottom
 * sheet. Empty state when there is no Reality Map; skeleton while generating;
 * Tree when it lands. `#how` swaps the canvas for the short How it works
 * page without unmounting the word box. Clicking a tree card opens an
 * invitation card. Observation hovers stay on tree cards. The learner grid, comparison block, and
 * closeness chrome stay hidden (engine may still carry learnerMap).
 *
 * Tutor is parked from chrome. The Socratic engine, forceBrief, and dock
 * module stay in the repo, unmounted.
 *
 * Ticket 11: submitting the word input starts generation here. While the
 * generator works a progressive skeleton mirrors the tree and lights its
 * layer bands bottom-up; when the tree arrives this page shows it. A refusal
 * surfaces the model's reply on the page instead.
 *
 * Ticket 12 timeline stays parked hidden.
 *
 * Everything reads the shared session store (state/session.js); the page's
 * only network calls are the generation turns it owns (ticket 11).
 */

import {
  learnerCards,
  learnerEdges,
  nodeDelta,
  stateClass,
} from "../lib/mapview/viewmodel.js";
import { comparisonMetrics } from "../lib/mapview/comparison.js";
import {
  TREE_TWO_UP_MIN_WIDTH,
  convergenceFanPaths,
  spinePaths,
  treeLayout,
} from "../lib/mapview/tree.js";
import {
  columnCount,
  gridMetrics,
  nodePositions,
  edgePaths,
} from "../lib/mapview/layout.js";
import {
  nodePanelView,
  timelineStops,
  snapshotAt,
  snapshotDiff,
} from "../lib/mapview/history.js";
import {
  observationByNodeId,
  observationOf,
  layerObservationStory,
  dependents,
  combinesOf,
} from "../lib/mapview/observation.js";
import { nodeHistory } from "../state/session.js";
import { callAgent as defaultCallAgent } from "../api/agent.js";
import {
  generateTree,
  runAgentTurn,
  errorMessage,
} from "../lib/generation.js";
import { budDelay, wireTreeMotion } from "../lib/motion.js";
import {
  EMPTY_LINE,
  HOW_BACK,
  HOW_TITLE,
  WORD_ARIA,
  WORD_PLACEHOLDER,
  isHowRoute,
  renderHowPage,
} from "./how.js";

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
 * The skeleton's layer shape (ticket 11): the bands of card placeholders
 * that mirror the vertical-path tree (ticket 10) - a root block at the top,
 * then layer bands downward to the foundation. Pure so node:test can check
 * it without a DOM. Band 0 sits nearest the crown; the last band is the
 * foundation, which the generator builds first.
 *
 * @returns {Array<{ cards: number }>}
 */
export function skeletonBands() {
  return [{ cards: 2 }, { cards: 3 }, { cards: 1 }, { cards: 2 }, { cards: 1 }];
}

/**
 * Build the skeleton element: a caption, a root card placeholder, a trunk,
 * and one band per skeletonBands entry - a layer label placeholder plus a
 * column of card placeholders. The skeleton starts hidden; startSkeleton
 * reveals the bands bottom-up while the tree builds.
 *
 * @returns {HTMLElement}
 */
function buildSkeleton() {
  const sk = el("div", "tree-skeleton");
  sk.hidden = true;
  sk.setAttribute("role", "status");
  sk.appendChild(
    el(
      "p",
      "sk-caption",
      "Building the tree. The foundation shows first, then each layer."
    )
  );
  const root = el("div", "sk-root");
  root.append(el("span", "sk-root-line"), el("span", "sk-root-line"));
  sk.append(root, el("div", "sk-trunk"));
  for (const band of skeletonBands()) {
    const layer = el("div", "sk-layer");
    layer.appendChild(el("span", "sk-layer-label"));
    const cards = el("div", "sk-cards");
    for (let j = 0; j < band.cards; j += 1) {
      cards.appendChild(el("i", "sk-card"));
    }
    layer.appendChild(cards);
    sk.appendChild(layer);
  }
  return sk;
}

/**
 * Mount the map page into `root`, driven by the shared session store.
 * Returns a handle with `sync(route)` for route changes; the page also
 * subscribes to the store, so it re-renders live as turns land.
 *
 * @param {HTMLElement} root - the #view-map section.
 * @param {import("../state/session.js").SessionStore} store - the shared
 *   session store singleton.
 * @param {object} [options]
 * @param {boolean} [options.responsive] - listen to window resize (true in
 *   the browser; tests can disable).
 * @param {typeof defaultCallAgent} [options.callAgent] - the transport for
 *   the generation turns this page owns; injected for tests.
 * @returns {{ sync: (route?: string) => void; destroy: () => void }}
 */
export function renderMapPage(root, store, options = {}) {
  const responsive = options.responsive !== false;
  const callAgent = options.callAgent ?? defaultCallAgent;

  /** The word the last render saw. */
  let lastWord = /** @type {string | null} */ (null);

  const page = el("div", "map-page");
  const split = el("div", "map-split");
  const main = el("div", "map-main");

  /* Header: logo, foundations word box, How it works. Tutor chrome is parked. */
  const header = el("header", "map-header");
  const logo = el("div", "logo-row");
  logo.append(el("span", "orb logo-dot"), el("span", "wordmark", "first-principled"));

  /* Ticket 11: the word input lives on the Tree home. Submitting starts
     generation here. Ticket 05: foundations placeholder and aria. */
  const entry = el("form", "map-entry");
  /** @type {HTMLInputElement} */
  const entryInput = /** @type {HTMLInputElement} */ (
    document.createElement("input")
  );
  entryInput.className = "map-entry-input";
  entryInput.type = "text";
  entryInput.placeholder = WORD_PLACEHOLDER;
  entryInput.setAttribute("autocomplete", "off");
  entryInput.setAttribute("aria-label", WORD_ARIA);
  const entryButton = /** @type {HTMLButtonElement} */ (
    el("button", "map-entry-button", "Build")
  );
  entryButton.type = "submit";
  entry.append(entryInput, entryButton);

  const howLink = /** @type {HTMLButtonElement} */ (
    el("button", "how-link", HOW_TITLE)
  );
  howLink.type = "button";
  header.append(logo, entry, howLink);

  /* Timeline scrubber (ticket 12). */
  const timeline = el("div", "map-timeline");
  timeline.hidden = true;
  const playBtn = el("button", "tl-btn", "\u25B6");
  playBtn.setAttribute("aria-label", "Replay the session's rotations");
  playBtn.setAttribute("title", "Replay");
  const rail = el("div", "tl-rail");
  const fill = el("i", "tl-fill");
  rail.appendChild(fill);
  const stopsWrap = el("div", "tl-stops");
  rail.appendChild(stopsWrap);
  const counter = el("span", "tl-counter", "0/0");
  timeline.append(playBtn, rail, counter);

  /* Title row / closeness / legend: parked from learner chrome (ticket 02). */
  const titleRow = el("div", "map-title-row");
  titleRow.hidden = true;
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
  legend.hidden = true;
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

  /* Learner model grid: parked from learner chrome (ticket 02). */
  const scroll = el("div", "map-scroll");
  scroll.hidden = true;
  const stage = el("div", "map-stage");
  const svg = svgEl();
  const nodesLayer = el("div", "map-nodes");
  stage.append(svg, nodesLayer);
  scroll.appendChild(stage);

  /* Reality phylogenetic tree panel. */
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

  /* Ticket 11 generation surfaces: the progressive skeleton that stands in
     for the tree while it builds, an error banner with retry on transport
     failure, and a note when the model refuses the word. */
  const skeleton = buildSkeleton();
  const mapError = el("div", "error-banner map-error");
  mapError.hidden = true;
  const mapErrorText = el("p", "error-text");
  const mapRetry = el("button", "retry-button", "Retry");
  mapRetry.setAttribute("aria-label", "Retry building the tree");
  mapRetry.addEventListener("click", retryGeneration);
  mapError.append(mapErrorText, mapRetry);
  const refusalNote = el("p", "note map-empty");
  refusalNote.hidden = true;

  const noSession = el("p", "note map-empty map-empty-invite", EMPTY_LINE);
  const empty = el(
    "p",
    "note map-empty",
    "No mental model yet. Answer a question in chat and watch it take shape here."
  );
  empty.hidden = true;
  const ended = el(
    "p",
    "map-note",
    "Session complete. This is your final mental model."
  );
  ended.hidden = true;

  function goHow() {
    if (typeof location !== "undefined") location.hash = "how";
  }

  function goTree() {
    if (typeof location !== "undefined") location.hash = "";
  }

  function onHowPage() {
    return typeof location !== "undefined" && isHowRoute(location.hash);
  }

  howLink.addEventListener("click", () => {
    if (onHowPage()) goTree();
    else goHow();
  });

  const howPage = renderHowPage(goTree);

  main.append(
    header,
    howPage,
    timeline,
    titleRow,
    legend,
    mapError,
    skeleton,
    scroll,
    treePanel,
    cmpBlock,
    noSession,
    refusalNote,
    empty,
    ended
  );
  split.append(main);
  page.append(split);
  root.append(page);

  /* Ticket 11 generation state: the input + skeleton live for the ~20s the
     generator works, then the Tree shows. */
  const reducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** True while a generation turn is in flight. */
  let generating = false;
  /** The skeleton reveal timer. */
  let skeletonTimer = /** @type {number | null} */ (null);
  /** One layer band lights every SKELETON_STEP_MS, bottom-up. */
  const SKELETON_STEP_MS = 3200;

  /**
   * @param {boolean} on
   */
  function setEntryBusy(on) {
    entryInput.disabled = on;
    entryButton.disabled = on;
    entryButton.textContent = on ? "Building..." : "Build";
  }

  /**
   * Show the skeleton and reveal its layer bands bottom-up: the generator
   * builds the tree bottom-up (foundation first, ticket 08), so the
   * skeleton lights the foundation band first, then each band upward, one
   * every SKELETON_STEP_MS. Under reduced motion every band lights at once.
   */
  function startSkeleton() {
    skeleton.hidden = false;
    const layers = [...skeleton.querySelectorAll(".sk-layer")];
    for (const layer of layers) layer.classList.remove("lit");
    if (reducedMotion) {
      for (const layer of layers) layer.classList.add("lit");
      return;
    }
    let i = layers.length - 1;
    const tick = () => {
      if (i < 0) return;
      layers[i].classList.add("lit");
      i -= 1;
      if (i >= 0) {
        skeletonTimer = /** @type {any} */ (setTimeout(tick, SKELETON_STEP_MS));
      }
    };
    tick();
  }

  function stopSkeleton() {
    if (skeletonTimer !== null) {
      clearTimeout(skeletonTimer);
      skeletonTimer = null;
    }
    skeleton.hidden = true;
  }

  /**
   * @param {string} code
   */
  function showMapError(code) {
    mapErrorText.textContent = errorMessage(code);
    mapError.hidden = false;
  }

  function hideMapError() {
    mapError.hidden = true;
  }

  /** Submit the header word input: begin a session and grow the tree here. */
  async function submitWord() {
    const word = entryInput.value.trim();
    if (word.length === 0 || generating) return;
    if (onHowPage()) goTree();
    entryInput.value = "";
    generating = true;
    setEntryBusy(true);
    hideMapError();
    startSkeleton();
    const result = await generateTree(store, word, { callAgent });
    generating = false;
    setEntryBusy(false);
    stopSkeleton();
    if (result.ok) {
      sync();
    } else {
      showMapError(result.code ?? "unknown");
    }
    sync();
  }

  /** Retry the failed generation: the store was untouched, so the same
   *  init turn re-sends exactly. */
  async function retryGeneration() {
    if (generating) return;
    if (store.getState().word === null) return;
    generating = true;
    setEntryBusy(true);
    hideMapError();
    startSkeleton();
    const result = await runAgentTurn(store, { callAgent });
    generating = false;
    setEntryBusy(false);
    stopSkeleton();
    if (result.ok) {
      sync();
    } else {
      showMapError(result.code ?? "unknown");
    }
    sync();
  }

  entry.addEventListener("submit", (event) => {
    event.preventDefault();
    submitWord();
  });

  /** @type {Map<string, HTMLElement>} node id -> card element */
  const nodeEls = new Map();
  /** @type {Map<string, SVGPathElement>} "source->target" -> path element */
  const pathEls = new Map();
  /** The last diff reference whose animation has been replayed. */
  let renderedDiff = /** @type {import("../lib/mmg/types.js").Diff | null} */ (null);
  /** The reality tree's motion handle (ticket 12): destroyed on rebuild. */
  let treeMotion = /** @type {ReturnType<typeof wireTreeMotion> | null} */ (null);

  /** @typedef {ReturnType<typeof learnerCards>[number]} MapCard */
  /** @typedef {ReturnType<typeof nodeDelta>} NodeDelta */

  /* The node panel (ticket 10): one overlay reused for any clicked node. */
  const panel = el("div", "node-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  const panelBackdrop = el("div", "node-panel-backdrop");
  panelBackdrop.hidden = true;
  const panelClose = el("button", "node-panel-close", "\u00D7");
  panelClose.setAttribute("aria-label", "Close node panel");
  const panelBody = el("div", "node-panel-body");
  panel.append(panelClose, panelBody);
  page.append(panelBackdrop, panel);
  let panelOpen = false;
  /** The card element that opened the panel; focus returns to it on close. */
  let panelSource = /** @type {HTMLElement | null} */ (null);

  /** Close the panel and return focus to the card that opened it (ticket 10).
   * Esc, the X button, and a backdrop click all land here. */
  function closePanel() {
    panel.hidden = true;
    panelBackdrop.hidden = true;
    panelOpen = false;
    const source = panelSource;
    panelSource = null;
    if (source && typeof source.focus === "function") source.focus();
  }

  panelClose.addEventListener("click", closePanel);
  panelBackdrop.addEventListener("click", closePanel);

  /** The hover popover (ticket 11): one element, repositioned per hover. */
  const popover = el("div", "history-popover");
  popover.hidden = true;
  page.appendChild(popover);
  let popoverTimer = /** @type {number | null} */ (null);
  let popoverSource = /** @type {HTMLElement | null} */ (null);

  /** Hover delay (ticket 04): 0 under reduced motion, 350ms otherwise. */
  const hoverDelay = /** @type {number} */ (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 350
  );

  /**
   * @param {MapCard} card
   * @returns {HTMLElement}
   */
  function buildCard(card) {
    const node = el("div", `map-card ${stateClass(card.state)}`);
    node.dataset.nodeId = card.id;
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute(
      "aria-label",
      `${card.label}: ${card.state}, ${pct(card.confidence)} confident. Activate to open its story.`
    );
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
    node.setAttribute(
      "aria-label",
      `${card.label}: ${card.state}, ${pct(card.confidence)} confident. Activate to open its story.`
    );
  }

  /**
   * The title-row closeness number: "known/total" with the progress bar at
   * the closeness percentage.
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
   * Invitation card (v6 ticket 06): what this is, the observation, what it
   * rests on / what rests on it, and one rabbit-hole line. No learner-state
   * chrome and no control that generates a nested Tree.
   *
   * @param {string} nodeId
   * @param {HTMLElement | null} [source] - the card that opened the panel;
   *   focus returns to it on close (ticket 10).
   */
  function openPanel(nodeId, source = null) {
    const state = store.getState();
    const view = nodePanelView(state, nodeId);
    panelSource = source;
    panelBody.replaceChildren();

    const heading = el("div", "node-panel-heading");
    heading.appendChild(el("h2", "node-panel-label", view.label));
    heading.appendChild(el("p", "node-panel-invite", view.invitation));
    panelBody.appendChild(heading);

    // The crux first (ticket 04): the observation that enabled the next
    // stage, or the explicit gap when the record is missing or unknown.
    const obsSection = el("section", "node-panel-section");
    obsSection.appendChild(
      el(
        "h3",
        "node-panel-h",
        view.observation.present ? "The observation" : "Observation unknown"
      )
    );
    obsSection.appendChild(buildObservationCard(view.observation));
    const built = dependents(state.realityMap, nodeId);
    if (built.length > 0) {
      obsSection.appendChild(
        el("p", "obs-made-possible", `Used to build: ${built.join(", ")}.`)
      );
    }
    panelBody.appendChild(obsSection);

    // The convergence stream (ticket 13): a convergence node combines
    // observations from several fields. The panel renders its crux record
    // (above) plus each contributing observation from the other fields.
    const combined = combinesOf(state.realityMap, nodeId);
    if (combined.length > 0) {
      const section = el("section", "node-panel-section");
      section.appendChild(
        el("h3", "node-panel-h", "It combines observations from other fields")
      );
      const list = el("ul", "obs-story-list");
      for (const entry of combined) {
        const item = el("li", "obs-story-item");
        const field = entry.layerName || entry.layer;
        item.appendChild(
          el(
            "p",
            "obs-story-node",
            entry.label.length > 0
              ? field.length > 0
                ? `${entry.label} (${field})`
                : entry.label
              : entry.sourceId
          )
        );
        item.appendChild(buildObservationCard(entry.observation));
        list.appendChild(item);
      }
      section.appendChild(list);
      panelBody.appendChild(section);
    }

    if (view.description.length > 0) {
      const section = el("section", "node-panel-section");
      section.appendChild(el("h3", "node-panel-h", "What it is"));
      section.appendChild(el("p", "node-panel-desc", view.description));
      panelBody.appendChild(section);
    }

    appendDependence("What it rests on", view.restsOn);
    appendDependence("What rests on it", view.restsOnIt);

    panel.hidden = false;
    panelBackdrop.hidden = false;
    panelOpen = true;
    panelClose.focus();
  }

  /**
   * @param {string} heading
   * @param {Array<{ nodeId: string; label: string; type: string }>} items
   */
  function appendDependence(heading, items) {
    if (items.length === 0) return;
    const section = el("section", "node-panel-section");
    section.appendChild(el("h3", "node-panel-h", heading));
    const list = el("ul", "node-panel-neighbors");
    for (const neighbor of items) {
      const item = el("li", "node-panel-neighbor");
      item.append(
        el("span", "node-panel-neighbor-label", neighbor.label),
        el("span", "node-panel-neighbor-type", neighbor.type)
      );
      list.appendChild(item);
    }
    section.appendChild(list);
    panelBody.appendChild(section);
  }

  /**
   * Show the hover popover for a card: the node's rotation trail with turns.
   *
   * @param {HTMLElement} source
   * @param {string} nodeId
   */
  function showPopover(source, nodeId) {
    const state = store.getState();
    const trail = nodeHistory(state, nodeId);
    if (trail.length === 0) return;
    popover.replaceChildren();
    const label = el("p", "history-popover-label", `${source.dataset.nodeId} rotation`);
    popover.appendChild(label);
    const list = el("ul", "history-popover-list");
    for (const entry of trail) {
      const item = el(
        "li",
        "history-popover-item",
        `turn ${entry.turn} - ${entry.state} (${pct(entry.confidence)})`
      );
      if (entry.evidence.length > 0) {
        item.appendChild(el("span", "history-popover-quote", `\u201C${entry.evidence[entry.evidence.length - 1]}\u201D`));
      }
      list.appendChild(item);
    }
    popover.appendChild(list);
    popover.hidden = false;
    const rect = source.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + popRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popRect.width - 8);
    }
    if (top + popRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popRect.height - 8);
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popoverSource = source;
  }

  /**
   * One row of an observation card: the field label, the value, and the
   * honesty mark chip (EXACT / APPROXIMATE) when the record carried one.
   *
   * @param {string} label
   * @param {string} value
   * @param {import("../lib/mapview/observation.js").ObservationMark | null} mark
   * @returns {HTMLElement}
   */
  function obsRow(label, value, mark) {
    const row = el("div", "obs-row");
    row.appendChild(el("span", "obs-label", label));
    row.appendChild(el("span", "obs-value", value));
    if (mark !== null) {
      row.appendChild(
        el("span", `obs-mark obs-mark-${mark.toLowerCase()}`, mark)
      );
    }
    return row;
  }

  /**
   * The observation card (ticket 04): the real-history record per ticket 02
   * and the fail-honest contract (ticket 09 section 2). A present record
   * renders fully - discoverer, date, key observation, confidence, note,
   * with the EXACT / APPROXIMATE marks; a missing or UNKNOWN record renders
   * as the EXPLICIT GAP state - the node exists, the layer chain is unbroken,
   * the observation is unknown. Never blank.
   *
   * @param {import("../lib/mapview/observation.js").ObservationView} view
   * @returns {HTMLElement}
   */
  function buildObservationCard(view) {
    const card = el("div", view.present ? "obs-card" : "obs-card obs-gap");
    if (view.present) {
      if (view.discoverer) {
        card.appendChild(
          obsRow("who", view.discoverer.value ?? "", view.discoverer.mark)
        );
      }
      if (view.date) {
        card.appendChild(obsRow("when", view.date.value ?? "", view.date.mark));
      }
      card.appendChild(
        obsRow("what", view.keyObservation?.value ?? "", view.keyObservation?.mark ?? null)
      );
      const foot = el("div", "obs-foot");
      if (view.confidence) {
        foot.appendChild(
          el("span", "obs-confidence", `confidence: ${view.confidence}`)
        );
      }
      if (view.legacy) {
        foot.appendChild(el("span", "obs-confidence", "unmarked legacy record"));
      }
      card.appendChild(foot);
      if (view.note) {
        card.appendChild(el("p", "obs-note", view.note));
      }
    } else {
      card.appendChild(
        el(
          "p",
          "obs-gap-copy",
          "The observation that made the next stage possible is not in the record. The node exists, and the layer chain is unbroken. The record ends here."
        )
      );
      if (view.note) {
        card.appendChild(el("p", "obs-note", view.note));
      }
    }
    return card;
  }

  /**
   * The node observation popover (ticket 04): hovering a tree node surfaces
   * the observation that enabled the next stage - the crux narrative - plus
   * what the observation built.
   *
   * @param {HTMLElement} source
   * @param {string} label
   * @param {import("../lib/mapview/observation.js").ObservationView} view
   * @param {string[]} built
   */
  function showNodeObservation(source, label, view, built) {
    popover.replaceChildren();
    popover.appendChild(
      el(
        "p",
        "history-popover-label",
        view.present ? `${label}: the observation` : `${label}: observation unknown`
      )
    );
    popover.appendChild(buildObservationCard(view));
    if (built.length > 0) {
      popover.appendChild(
        el("p", "obs-made-possible", `Used to build: ${built.join(", ")}.`)
      );
    }
    popover.hidden = false;
    const rect = source.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + popRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popRect.width - 8);
    }
    if (top + popRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popRect.height - 8);
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popoverSource = source;
  }

  /**
   * The layer observation story popover (ticket 04, extending the v2 11
   * hover): hovering a layer surfaces the observations recorded at that
   * layer - the observations that made the NEXT stage possible - read
   * chronologically, oldest at the foundation. Nodes without a record appear
   * as explicit gap entries; the layer chain stays visibly unbroken.
   *
   * @param {HTMLElement} source
   * @param {string} layerId
   */
  function showLayerObservations(source, layerId) {
    const state = store.getState();
    const story = layerObservationStory(state.realityMap, layerId);
    popover.replaceChildren();
    popover.appendChild(
      el("p", "history-popover-label", `Layer: ${story.layerName} - observations in sequence`)
    );
    const list = el("ul", "obs-story-list");
    for (const entry of story.entries) {
      const item = el("li", "obs-story-item");
      item.appendChild(el("p", "obs-story-node", entry.label));
      item.appendChild(buildObservationCard(entry.observation));
      list.appendChild(item);
    }
    popover.appendChild(list);
    popover.hidden = false;
    const rect = source.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + popRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popRect.width - 8);
    }
    if (top + popRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popRect.height - 8);
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popoverSource = source;
  }

  function hidePopover() {
    if (popoverTimer !== null) {
      clearTimeout(popoverTimer);
      popoverTimer = null;
    }
    popover.hidden = true;
    popoverSource = null;
  }

  /**
   * Wire a card's interactions: click opens the panel, hover shows the
   * rotation popover, keyboard opens on Enter/Space.
   *
   * @param {HTMLElement} node
   */
  function wireCard(node) {
    const nodeId = node.dataset.nodeId;
    if (!nodeId) return;
    node.addEventListener("click", () => {
      hidePopover();
      openPanel(nodeId, node);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        hidePopover();
        openPanel(nodeId, node);
      }
    });
    node.addEventListener("mouseenter", () => {
      if (popoverTimer !== null) clearTimeout(popoverTimer);
      popoverTimer = /** @type {any} */ (setTimeout(() => showPopover(node, nodeId), hoverDelay));
    });
    node.addEventListener("mouseleave", hidePopover);
    node.addEventListener("focus", () => {
      if (popoverTimer !== null) clearTimeout(popoverTimer);
      popoverTimer = /** @type {any} */ (setTimeout(() => showPopover(node, nodeId), hoverDelay));
    });
    node.addEventListener("blur", hidePopover);
  }

  /**
   * The timeline scrubber (ticket 12): one stop per ledger turn. Scrub to a
   * stop renders that snapshot; play replays from the current stop with the
   * diff animation language. Returning to the live stop re-syncs the store.
   */
  const TL_LIVE = -1;
  /** The stop the timeline is parked on: -1 = live. */
  let tlStop = TL_LIVE;
  /** True while the replay animation is running. */
  let tlPlaying = false;
  /** The replay timer. */
  let tlTimer = /** @type {number | null} */ (null);

  /** @type {any[]} */
  let tlStopsCache = /** @type {any[]} */ ([]);

  /**
   * Rebuild the timeline stops from the ledger and mark the active one.
   */
  function renderTimeline() {
    const state = store.getState();
    tlStopsCache = timelineStops(state);
    const count = tlStopsCache.length;
    timeline.hidden = count < 2;
    if (count < 2) return;

    stopsWrap.replaceChildren();
    for (const stop of tlStopsCache) {
      const dot = el("button", "tl-stop");
      dot.dataset.turn = String(stop.turn);
      dot.setAttribute("aria-label", `Turn ${stop.turn}`);
      dot.setAttribute("title", `Turn ${stop.turn}${stop.reply ? `: ${stop.reply}` : ""}`);
      dot.addEventListener("click", () => {
        if (tlPlaying) stopReplay();
        tlStop = stop.turn;
        renderTimeline();
        syncGridFromSnapshot(stop.turn);
      });
      stopsWrap.appendChild(dot);
    }
    const activeIndex = tlStop === TL_LIVE ? count - 1 : tlStop - 1;
    const active = /** @type {HTMLButtonElement | null} */ (
      stopsWrap.querySelector(`[data-turn="${tlStop === TL_LIVE ? count : tlStop}"]`)
    );
    if (active) active.classList.add("active");
    fill.style.width = `${count === 1 ? 100 : Math.round(((activeIndex + 1) / count) * 100)}%`;
    counter.textContent = `${activeIndex + 1}/${count}`;
    playBtn.textContent = tlPlaying ? "\u23F8" : "\u25B6";
  }

  /**
   * Render the learner grid from a ledger snapshot instead of the live map
   * (ticket 12). The snapshot's own diff drives the animation; the reality
   * tree is unchanged.
   *
   * @param {number} turn
   */
  function syncGridFromSnapshot(turn) {
    const state = store.getState();
    const snap = snapshotAt(state, turn);
    if (snap === null) return;
    const snapshotState = /** @type {any} */ ({
      ...state,
      learnerMap: snap,
      lastDiff: snapshotDiff(state, turn),
      lastProbe: null,
      closeness: null,
    });
    renderGrid(snapshotState, true);
  }

  /**
   * One replay step: advance the active stop, render the snapshot, and
   * either continue or stop at the live position.
   */
  function replayStep() {
    const count = tlStopsCache.length;
    if (count === 0) {
      stopReplay();
      return;
    }
    const next = tlStop === TL_LIVE ? 1 : Math.min(tlStop + 1, count);
    tlStop = next;
    renderTimeline();
    syncGridFromSnapshot(next);
    if (tlStop === count) {
      // Arrived at the live snapshot; park on live.
      stopReplay();
      tlStop = TL_LIVE;
      renderTimeline();
      sync();
      return;
    }
    tlTimer = /** @type {any} */ (setTimeout(replayStep, 900));
  }

  function startReplay() {
    if (tlStopsCache.length < 2) return;
    tlPlaying = true;
    renderTimeline();
    replayStep();
  }

  function stopReplay() {
    tlPlaying = false;
    if (tlTimer !== null) {
      clearTimeout(tlTimer);
      tlTimer = null;
    }
    renderTimeline();
  }

  playBtn.addEventListener("click", () => {
    if (tlPlaying) {
      stopReplay();
    } else {
      startReplay();
    }
  });

  /** Close the popover and panel on Esc. */
  const onKeydown = (/** @type {KeyboardEvent} */ event) => {
    if (event.key !== "Escape") return;
    if (root.hidden) return;
    if (panelOpen) {
      closePanel();
    } else {
      hidePopover();
    }
    if (tlPlaying) stopReplay();
  };
  document.addEventListener("keydown", onKeydown);

  /**
   * The dependence-path Tree: crown (the concept) at the top, foundations
   * at the bottom, y from built-on / depends-on / abstraction-of. Named
   * layer bands sit behind the cards. A linear chain stays on one trunk;
   * extra parents of a convergence occupy full columns. Observation hovers,
   * node panels, and convergence chips stay on the cards. One-shot grow
   * rides `.tree-layer` wrappers; reduced motion shows the full Tree instantly.
   *
   * @param {import("../state/session.js").SessionState} state
   */
  function renderTree(state) {
    if (treeMotion !== null) {
      treeMotion.destroy();
      treeMotion = null;
    }
    const width = Math.round(treeScroll.clientWidth || main.clientWidth || 480);
    const layout = treeLayout(state.realityMap, { width });
    const views = observationByNodeId(state.realityMap);

    treeStage.style.width = `${layout.width}px`;
    treeStage.style.height = `${layout.height}px`;
    treeSvg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);

    treeLayer.replaceChildren();
    const root = el("div", "tree-root-card");
    root.style.left = `${layout.root.x}px`;
    root.style.top = `${layout.root.y}px`;
    root.style.width = `${layout.root.width}px`;
    root.style.height = `${layout.root.height}px`;
    root.append(
      el("p", "tree-root-eyebrow", "THE CONCEPT"),
      el("h2", "tree-root-word", (state.realityMap && state.realityMap.concept) || "the concept")
    );
    if (!reducedMotion) root.classList.add("tree-bud");
    root.style.setProperty("--mt-delay", budDelay("root", "root"));
    treeLayer.appendChild(root);

    /** @type {HTMLElement[]} */
    const layers = [];
    layout.branches.forEach((branch) => {
      const layer = el("div", "tree-layer");

      const label = el("p", "tree-branch-label", branch.name);
      label.style.left = `${branch.labelX ?? (branch.cards[0] ? branch.cards[0].x : 8)}px`;
      label.style.top = `${branch.labelY}px`;
      label.style.width = `${branch.labelWidth ?? layout.cardWidth}px`;
      label.tabIndex = 0;
      label.setAttribute("aria-label", `Layer ${branch.name}: ${branch.id}`);
      label.addEventListener("mouseenter", () => {
        if (popoverTimer !== null) clearTimeout(popoverTimer);
        popoverTimer = /** @type {any} */ (setTimeout(() => showLayerObservations(label, branch.id), hoverDelay));
      });
      label.addEventListener("mouseleave", hidePopover);
      label.addEventListener("focus", () => {
        if (popoverTimer !== null) clearTimeout(popoverTimer);
        popoverTimer = /** @type {any} */ (setTimeout(() => showLayerObservations(label, branch.id), hoverDelay));
      });
      label.addEventListener("blur", hidePopover);
      if (!reducedMotion) label.classList.add("tree-bud");
      label.style.setProperty("--mt-delay", budDelay(branch.id, "label"));
      layer.appendChild(label);
      for (const card of branch.cards) {
        const view = views.get(card.id) ?? observationOf(undefined);
        const node = el("div", card.rib ? "tree-branch-card tree-card-rib" : "tree-branch-card");
        node.dataset.nodeId = card.id;
        node.style.left = `${card.x}px`;
        node.style.top = `${card.y}px`;
        node.style.width = `${card.width}px`;
        node.style.height = `${card.height}px`;
        node.tabIndex = 0;
        node.setAttribute("role", "button");
        node.setAttribute(
          "aria-label",
          `${card.label}: ${view.present ? "observation recorded" : "observation unknown"}. Activate to open its panel.`
        );
        const labelSpan = el("span", "tree-branch-card-label", card.label);
        const dot = el(
          "i",
          view.present ? "tree-obs-dot recorded" : "tree-obs-dot gap"
        );
        dot.setAttribute("aria-hidden", "true");
        node.append(labelSpan, dot);
        if (card.combines > 0) {
          const chip = el(
            "span",
            "tree-converge-chip",
            `combines ${card.combines} field${card.combines === 1 ? "" : "s"}`
          );
          chip.setAttribute("aria-hidden", "true");
          node.append(chip);
        }
        node.addEventListener("click", () => {
          hidePopover();
          openPanel(card.id, node);
        });
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            hidePopover();
            openPanel(card.id, node);
          }
        });
        node.addEventListener("mouseenter", () => {
          if (popoverTimer !== null) clearTimeout(popoverTimer);
          popoverTimer = /** @type {any} */ (setTimeout(() => {
            showNodeObservation(
              node,
              card.label,
              view,
              dependents(state.realityMap, card.id)
            );
          }, hoverDelay));
        });
        node.addEventListener("mouseleave", hidePopover);
        node.addEventListener("focus", () => {
          if (popoverTimer !== null) clearTimeout(popoverTimer);
          popoverTimer = /** @type {any} */ (setTimeout(() => {
            showNodeObservation(
              node,
              card.label,
              view,
              dependents(state.realityMap, card.id)
            );
          }, hoverDelay));
        });
        node.addEventListener("blur", hidePopover);
        if (!reducedMotion) node.classList.add("tree-bud");
        node.style.setProperty("--mt-delay", budDelay(card.id, "card"));
        layer.appendChild(node);
      }
      treeLayer.appendChild(layer);
      layers.push(layer);
    });

    treeSvg.replaceChildren();
    for (const d of spinePaths(layout)) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#B9B3E8");
      path.setAttribute("stroke-width", "2");
      treeSvg.appendChild(path);
    }

    treeMotion = wireTreeMotion({ svg: treeSvg, layout, layers, reduced: reducedMotion });

    if (width > TREE_TWO_UP_MIN_WIDTH) {
      const fanGroup = document.createElementNS(SVG_NS, "g");
      fanGroup.setAttribute("class", "tree-converge-fans");
      for (const fan of convergenceFanPaths(layout)) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", fan.d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#B9B3E8");
        path.setAttribute("stroke-width", "1.5");
        path.setAttribute("opacity", "0.55");
        fanGroup.appendChild(path);
      }
      treeSvg.appendChild(fanGroup);
    }
  }

  /**
   * Render the learner grid from a state-like object - either the live store
   * state or a ledger snapshot (ticket 12). The probe highlight pulses the
   * node named by lastProbe (ticket 09).
   *
   * @param {any} state - the live store state or a ledger snapshot.
   * @param {boolean} [fromSnapshot] - when true, the diff animation replays
   *   unconditionally (scrubbing shows each turn's change).
   */
  function renderGrid(state, fromSnapshot = false) {
    const cards = learnerCards(state);
    const edges = learnerEdges(state);
    const diffActive =
      fromSnapshot || (state.lastDiff !== null && state.lastDiff !== renderedDiff);
    const diff = diffActive ? state.lastDiff : null;

    const cols = columnCount(stage.clientWidth || main.clientWidth || 480);
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
        wireCard(node);
      }
      updateCard(node, card, delta);
      const where = pos[card.id];
      node.style.left = `${where.x}px`;
      node.style.top = `${where.y}px`;
      // Probe highlight (ticket 09): pulse the node the tutor is asking about.
      node.classList.toggle("probed", state.lastProbe !== null && state.lastProbe.nodeId === card.id);
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

    if (diffActive && !fromSnapshot) renderedDiff = state.lastDiff;
  }

  /**
   * Sync the page with the store: empty state, skeleton, Tree, refusal, and
   * generation error. Learner-map chrome stays hidden (ticket 02). `#how`
   * shows the How it works page and keeps the header word box (ticket 05).
   *
   * @param {string} [route]
   */
  function sync(route) {
    const onHow =
      !generating &&
      (route === "how" || (route === undefined && onHowPage()));
    howLink.textContent = onHow ? HOW_BACK : HOW_TITLE;
    if (onHow) howLink.setAttribute("aria-current", "page");
    else howLink.removeAttribute("aria-current");
    howPage.hidden = !onHow;
    if (onHow) {
      noSession.hidden = true;
      refusalNote.hidden = true;
      treePanel.hidden = true;
      skeleton.hidden = true;
      mapError.hidden = true;
      empty.hidden = true;
      ended.hidden = true;
      return;
    }

    const state = store.getState();

    if (state.word !== lastWord) {
      lastWord = state.word;
      tlStop = TL_LIVE;
    }

    const hasWord = state.word !== null;
    const hasReality = state.realityMap !== null;

    titleRow.hidden = true;
    legend.hidden = true;
    scroll.hidden = true;
    cmpBlock.hidden = true;
    empty.hidden = true;
    ended.hidden = true;

    if (generating) {
      noSession.hidden = true;
      refusalNote.hidden = true;
      treePanel.hidden = true;
      mapError.hidden = true;
      skeleton.hidden = false;
      return;
    }
    skeleton.hidden = true;

    if (!hasWord) {
      noSession.hidden = false;
      treePanel.hidden = true;
      refusalNote.hidden = true;
      return;
    }
    noSession.hidden = true;

    if (!hasReality) {
      treePanel.hidden = true;
      if (state.lastReply !== null) {
        refusalNote.textContent = state.lastReply;
        refusalNote.hidden = false;
      } else {
        refusalNote.hidden = true;
      }
      return;
    }

    refusalNote.hidden = true;
    treePanel.hidden = false;
    renderTree(state);
  }

  const unsubscribe = store.subscribe(sync);
  const onResize = () => {
    sync();
  };
  if (responsive) {
    window.addEventListener("resize", onResize);
  }

  /* Sticky header (ticket 10): mark the header when the tree has scrolled
     under it, so the hairline reads. Natural page scroll drives it. */
  const onScroll = () => {
    header.classList.toggle("is-stuck", window.scrollY > 0);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  sync();

  return {
    /** Re-sync on demand (route changes, after the view becomes visible). */
    sync,
    /** Tear the page down (not used in v1; keeps the subscription clean). */
    destroy() {
      if (skeletonTimer !== null) {
        clearTimeout(skeletonTimer);
        skeletonTimer = null;
      }
      if (treeMotion !== null) {
        treeMotion.destroy();
        treeMotion = null;
      }
      unsubscribe();
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("scroll", onScroll);
      if (responsive) {
        window.removeEventListener("resize", onResize);
      }
      root.replaceChildren();
    },
  };
}
