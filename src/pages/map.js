/**
 * The map page (ticket 09): the learner watches their mental model
 * converge without ever seeing the answers.
 *
 * What renders is exactly the learner's model - the learner map nodes
 * joined with reality labels ONLY for nodes already in the model (see
 * lib/mapview/viewmodel.js, which owns that no-leak rule), colored by
 * state, confidence per node, edges drawn between cards with their own
 * state. Reality layers, descriptions and unengaged nodes are never
 * consulted for rendering, so they cannot appear. The page makes no
 * network requests at all: every update comes from the session store.
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
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  GAP,
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
 * @returns {{ sync: () => void; destroy: () => void }}
 */
export function renderMapPage(root, store, options = {}) {
  const responsive = options.responsive !== false;

  const heading = el("h2", "map-heading", "Your mental model");
  const word = el("p", "map-word");
  const scroll = el("div", "map-scroll");
  const stage = el("div", "map-stage");
  const svg = svgEl();
  const nodesLayer = el("div", "map-nodes");
  stage.append(svg, nodesLayer);
  scroll.appendChild(stage);
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
  const ended = el("p", "map-ended", "Session complete. This is your final mental model.");

  root.append(heading, word, scroll, noSession, empty, ended);

  /** @type {Map<string, HTMLElement>} node id -> card element */
  const nodeEls = new Map();
  /** @type {Map<string, SVGPathElement>} "source->target" -> path element */
  const pathEls = new Map();
  /** The last diff reference whose animation has been replayed. */
  let renderedDiff = /** @type {import("../lib/mmg/types.js").Diff | null} */ (null);

/** @typedef {ReturnType<typeof learnerCards>[number]} MapCard */
/** @typedef {ReturnType<typeof nodeDelta>} NodeDelta */

/**
 * @param {number} confidence
 * @returns {string}
 */
function pct(confidence) {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * @param {MapCard} card
 * @returns {string}
 */
function tooltip(card) {
  const lines = [`${card.label}: ${card.state}, ${pct(card.confidence)} confident`];
  for (const quote of card.evidence) lines.push(`evidence: ${quote}`);
  return lines.join("\n");
}

/**
 * @param {MapCard} card
 * @returns {HTMLElement}
 */
function buildCard(card) {
  const node = el("div", `map-card ${stateClass(card.state)}`);
  node.dataset.nodeId = card.id;
  const top = el("div", "map-card-top");
  top.appendChild(el("span", "map-card-label", card.label));
  top.appendChild(el("span", "map-state-name", card.state));
  const conf = el("div", "map-conf");
  const bar = el("div", "map-conf-bar");
  const fill = el("i", "map-conf-fill");
  fill.style.width = pct(card.confidence);
  bar.appendChild(fill);
  conf.append(bar, el("span", "map-conf-text", pct(card.confidence)));
  node.append(top, conf);
  return node;
}

/**
 * @param {HTMLElement} node
 * @param {MapCard} card
 * @param {NodeDelta} delta
 */
function updateCard(node, card, delta) {
    const label = asEl(node.querySelector(".map-card-label"));
    const name = asEl(node.querySelector(".map-state-name"));
    const fill = asEl(node.querySelector(".map-conf-fill"));
    const text = asEl(node.querySelector(".map-conf-text"));
    if (label && label.textContent !== card.label) label.textContent = card.label;
    if (name && name.textContent !== card.state) name.textContent = card.state;
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
    if (text && text.textContent !== pct(card.confidence)) text.textContent = pct(card.confidence);
    node.title = tooltip(card);
    node.setAttribute(
      "aria-label",
      `${card.label}: ${card.state}, ${pct(card.confidence)} confident`
    );
  }

  /**
   * Sync the page with the store: stage geometry, keyed node cards, keyed
   * SVG edges, diff animation, empty and ended states.
   */
  function sync() {
    const state = store.getState();
    const cards = learnerCards(state);
    const edges = learnerEdges(state);
    const diffActive = state.lastDiff !== null && state.lastDiff !== renderedDiff;
    const diff = diffActive ? state.lastDiff : null;

    word.textContent = state.word ? `concept: ${state.word}` : "";

    if (!state.word) {
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
    scroll.hidden = false;

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
    ended.hidden = state.ended ? false : true;
  }

  const unsubscribe = store.subscribe(sync);
  if (responsive) {
    window.addEventListener("resize", sync);
  }

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
