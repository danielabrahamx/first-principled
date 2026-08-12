/**
 * The map page - the home surface of the map-first v2 (tickets 09-12).
 *
 * Ticket 09: the map is the primary pane, chat is docked beside it (right
 * rail on desktop, stacked below on narrow screens). The tutor's probe
 * highlight: when a response carries probe.nodeId, that node pulses while
 * the question is live. The router makes # (empty) land here; #chat keeps
 * the full chat page.
 *
 * Ticket 10: every learner-grid card is clickable and opens the node panel -
 * reality description (allowed: the no-leak rule now binds chat, not the
 * map - Danny 2026-08-10), current state/confidence, the evidence ledger
 * with turn numbers, the state rotation trail, and linked neighbors with
 * their states. Esc closes; the panel is keyboard-accessible.
 *
 * Ticket 11: hovering a learner card shows its rotation popover (turn by
 * turn: state, confidence, evidence); hovering a reality-tree layer branch
 * shows the layer story - which of its nodes the learner engaged, in what
 * order, and how their states rotated.
 *
 * Ticket 12: a timeline scrubber under the header - one stop per ledger
 * turn, drag to any stop to render that snapshot, and a play button that
 * replays the shape rotations using the existing diff animation language.
 * Scrubbing renders snapshots from the ledger; it never mutates the store.
 *
 * Everything reads the shared session store (state/session.js); the page
 * makes no network requests.
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
import {
  nodePanelView,
  layerStory,
  timelineStops,
  snapshotAt,
  snapshotDiff,
} from "../lib/mapview/history.js";
import { nodeHistory } from "../state/session.js";
import { renderDock } from "./dock.js";

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
  const split = el("div", "map-split");
  const main = el("div", "map-main");
  const dock = el("aside", "map-dock-wrap");
  dock.setAttribute("aria-label", "Tutor conversation");

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

  /* Reality phylogenetic tree panel (Reality tab). */
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

  main.append(header, timeline, titleRow, legend, scroll, treePanel, cmpBlock, noSession, empty, ended);
  split.append(main, dock);
  page.appendChild(split);
  root.append(page);

  const dockHandle = renderDock(dock);

  /** @type {Map<string, HTMLElement>} node id -> card element */
  const nodeEls = new Map();
  /** @type {Map<string, SVGPathElement>} "source->target" -> path element */
  const pathEls = new Map();
  /** The last diff reference whose animation has been replayed. */
  let renderedDiff = /** @type {import("../lib/mmg/types.js").Diff | null} */ (null);

  /** @typedef {ReturnType<typeof learnerCards>[number]} MapCard */
  /** @typedef {ReturnType<typeof nodeDelta>} NodeDelta */

  /* The node panel (ticket 10): one overlay reused for any clicked node. */
  const panel = el("div", "node-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  const panelClose = el("button", "node-panel-close", "\u00D7");
  panelClose.setAttribute("aria-label", "Close node panel");
  const panelBody = el("div", "node-panel-body");
  panel.append(panelClose, panelBody);
  page.appendChild(panel);
  let panelOpen = false;

  /** The hover popover (ticket 11): one element, repositioned per hover. */
  const popover = el("div", "history-popover");
  popover.hidden = true;
  page.appendChild(popover);
  let popoverTimer = /** @type {number | null} */ (null);
  let popoverSource = /** @type {HTMLElement | null} */ (null);

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
   * The node panel content (ticket 10): reality description (allowed), the
   * learner's current state, evidence with turn numbers, the rotation trail,
   * and linked neighbors.
   *
   * @param {string} nodeId
   */
  function openPanel(nodeId) {
    const state = store.getState();
    const view = nodePanelView(state, nodeId);
    panelBody.replaceChildren();

    const heading = el("div", "node-panel-heading");
    heading.appendChild(el("h2", "node-panel-label", view.label));
    const status = el(
      "span",
      "map-status",
      `${view.engaged ? view.state : "untested"} - ${view.confidence.toFixed(1)}`
    );
    heading.appendChild(status);
    panelBody.appendChild(heading);

    if (view.description.length > 0) {
      const section = el("section", "node-panel-section");
      section.appendChild(el("h3", "node-panel-h", "What it is"));
      section.appendChild(el("p", "node-panel-desc", view.description));
      panelBody.appendChild(section);
    }

    if (view.trail.length > 0) {
      const section = el("section", "node-panel-section");
      section.appendChild(el("h3", "node-panel-h", "How your model changed"));
      const list = el("ul", "node-panel-trail");
      for (const entry of view.trail) {
        const item = el("li", "node-panel-trail-item");
        const head = el(
          "span",
          "node-panel-trail-head",
          `turn ${entry.turn} - ${entry.state} (${pct(entry.confidence)})`
        );
        item.appendChild(head);
        for (const quote of entry.evidence) {
          item.appendChild(el("span", "node-panel-quote", `\u201C${quote}\u201D`));
        }
        list.appendChild(item);
      }
      section.appendChild(list);
      panelBody.appendChild(section);
    }

    if (view.evidence.length > 0) {
      const section = el("section", "node-panel-section");
      section.appendChild(el("h3", "node-panel-h", "Your words"));
      const list = el("ul", "node-panel-evidence");
      for (const entry of view.evidence) {
        const item = el("li", "node-panel-evidence-item");
        item.append(
          el("span", "node-panel-turn", `t${entry.turn}`),
          document.createTextNode(`\u201C${entry.quote}\u201D`)
        );
        list.appendChild(item);
      }
      section.appendChild(list);
      panelBody.appendChild(section);
    }

    if (view.neighbors.length > 0) {
      const section = el("section", "node-panel-section");
      section.appendChild(el("h3", "node-panel-h", "Connected to"));
      const list = el("ul", "node-panel-neighbors");
      for (const neighbor of view.neighbors) {
        const item = el(
          "li",
          "node-panel-neighbor",
          `${neighbor.label} (${neighbor.relation})`
        );
        item.append(
          document.createTextNode(`${neighbor.label} ${neighbor.relation === "out" ? "\u2192" : "\u2190"}`),
          el("span", `legend-swatch ${stateClass(neighbor.state)}`),
          document.createTextNode(` ${neighbor.state}`)
        );
        list.appendChild(item);
      }
      section.appendChild(list);
      panelBody.appendChild(section);
    }

    if (!view.engaged) {
      const section = el("section", "node-panel-section");
      section.appendChild(
        el("p", "node-panel-empty", "You haven't engaged this node yet - it will appear when you do.")
      );
      panelBody.appendChild(section);
    }

    panel.hidden = false;
    panelOpen = true;
    panelClose.focus();
  }

  function closePanel() {
    panel.hidden = true;
    panelOpen = false;
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
   * The layer-story popover for a reality-tree branch (ticket 11).
   *
   * @param {HTMLElement} source
   * @param {string} layerId
   */
  function showLayerStory(source, layerId) {
    const state = store.getState();
    const story = layerStory(state, layerId);
    popover.replaceChildren();
    const label = el("p", "history-popover-label", `Layer: ${story.layerName}`);
    popover.appendChild(label);
    if (story.engaged.length === 0) {
      popover.appendChild(
        el("p", "history-popover-none", "None of this layer's nodes engaged yet.")
      );
    } else {
      const list = el("ul", "history-popover-list");
      for (const entry of story.engaged) {
        const item = el(
          "li",
          "history-popover-item",
          `${entry.label}: first at turn ${entry.firstTurn}, now ${entry.current} (${entry.rotations.length} rotation${entry.rotations.length === 1 ? "" : "s"})`
        );
        list.appendChild(item);
      }
      popover.appendChild(list);
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
      openPanel(nodeId);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        hidePopover();
        openPanel(nodeId);
      }
    });
    node.addEventListener("mouseenter", () => {
      if (popoverTimer !== null) clearTimeout(popoverTimer);
      popoverTimer = /** @type {any} */ (setTimeout(() => showPopover(node, nodeId), 350));
    });
    node.addEventListener("mouseleave", hidePopover);
    node.addEventListener("focus", () => {
      if (popoverTimer !== null) clearTimeout(popoverTimer);
      popoverTimer = /** @type {any} */ (setTimeout(() => showPopover(node, nodeId), 350));
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

  /** Close the popover and panel on Esc - only while the map view is the
   * visible route (the page stays mounted when #chat is shown). */
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
   * The reality phylogenetic tree: root card (the concept) and the layer
   * branches below it, with cladogram elbow connectors. Branches carry their
   * layer stories on hover (ticket 11).
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
      label.tabIndex = 0;
      label.setAttribute("aria-label", `Layer ${branch.name}: ${branch.id}`);
      label.addEventListener("mouseenter", () => {
        if (popoverTimer !== null) clearTimeout(popoverTimer);
        popoverTimer = /** @type {any} */ (setTimeout(() => showLayerStory(label, branch.id), 350));
      });
      label.addEventListener("mouseleave", hidePopover);
      label.addEventListener("focus", () => {
        if (popoverTimer !== null) clearTimeout(popoverTimer);
        popoverTimer = /** @type {any} */ (setTimeout(() => showLayerStory(label, branch.id), 350));
      });
      label.addEventListener("blur", hidePopover);
      treeLayer.appendChild(label);
      for (const card of branch.cards) {
        const node = el("div", "tree-branch-card", card.label);
        node.style.left = `${card.x}px`;
        node.style.top = `${card.y}px`;
        node.style.width = `${TREE_CARD_WIDTH}px`;
        node.addEventListener("click", () => {
          hidePopover();
          openPanel(card.id);
        });
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
   * Sync the page with the store: segmented control, title row, legend,
   * learner grid or reality tree, comparison block, empty and ended states,
   * and the timeline.
   */
  function sync() {
    const state = store.getState();
    const cards = learnerCards(state);

    if (state.word !== lastWord) {
      lastWord = state.word;
      tab = "model";
      tlStop = TL_LIVE;
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

    renderTimeline();

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

    renderGrid(state);
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
      dockHandle.destroy();
      document.removeEventListener("keydown", onKeydown);
      if (responsive) {
        window.removeEventListener("resize", sync);
      }
      root.replaceChildren();
    },
  };
}
