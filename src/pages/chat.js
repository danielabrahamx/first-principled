/**
 * The chat page: the follow-up surface for the generated tree (ticket 11).
 *
 * Per ticket 08 and spec section 9, reworked by ticket 11: the word-to-tree
 * entry lives on the map page now, so this page is follow-up-only - it
 * renders the conversation and forwards what the learner answers to the
 * tree's questions. The turn loop runs through the shared generation module
 * (lib/generation.js); this page adds the rendering and the friendly error
 * wording.
 *
 * Surfaces:
 * - No session yet: a panel that points to the map page (the tree entry
 *   point) and a demo button for reviewing the UI without the API key.
 * - Conversation: a message list of learner and agent turns.
 * - Refusal: when the map's generation did not accept the word, the store
 *   holds the refusal as the last reply; this page shows a hint pointing
 *   back to the map and no composer.
 * - Phase indicator: starting / exploring / refining / session end. The
 *   exploring-vs-refining split mirrors the engine's own opening rule in
 *   spec section 8: an empty learner map means observation-first
 *   (exploring); a populated map means gap-first (refining).
 * - Session end: the transfer question arrives as a normal message, the
 *   learner answers, then a result panel shows pass or fail and the
 *   comparison entry point (a link to the map page).
 * - Errors: one friendly line plus a Retry button, never raw JSON or
 *   provider text. Retry re-sends the exact request that failed, so a failed
 *   turn can be retried without losing or duplicating state.
 *
 * No reality map content ever renders here; the only link to the map is
 * navigation to the separate map page.
 *
 * The module touches the DOM only inside initChatPage, so node:test can
 * import the pure helpers (phaseLabel, errorMessage) without a document.
 */

import { sessionStore } from "../state/session.js";
import { callAgent as defaultCallAgent } from "../api/agent.js";
import { loadDemoSession } from "../demo.js";
import { runAgentTurn, errorMessage } from "../lib/generation.js";

/** @typedef {import("../state/session.js").SessionState} SessionState */
/** @typedef {import("../state/session.js").SessionStore} SessionStore */

export { errorMessage };

/**
 * @typedef {object} ChatOptions
 * @property {SessionStore} [store] - defaults to the shared sessionStore
 *   singleton.
 * @property {typeof defaultCallAgent} [callAgent] - the transport; injected
 *   for tests.
 * @property {(route: string) => void} [navigate] - route to another page
 *   (header segmented control); defaults to setting location.hash.
 * @property {(listener: (route: string) => void) => () => void} [subscribeRoute] -
 *   route change subscription for the header's active tab; injected by
 *   app.js, optional for tests.
 */

/**
 * @typedef {object} PhaseView
 * @property {"starting" | "exploring" | "refining" | "end"} kind - drives
 *   styling.
 * @property {string} label - the text shown in the indicator pill.
 */

/**
 * The phase indicator state for a session state.
 *
 * @param {SessionState} state
 * @returns {PhaseView}
 */
export function phaseLabel(state) {
  if (state.phase === "init") return { kind: "starting", label: "Starting" };
  if (state.phase === "end") return { kind: "end", label: "Session end" };
  return state.learnerMap.nodes.length > 0
    ? { kind: "refining", label: "Testing" }
    : { kind: "exploring", label: "Seeing" };
}

/**
 * Wire up the chat page inside `root`. Must be called once, in the browser,
 * after the DOM for the page exists. All element lookups happen here, so the
 * module stays importable in node:test.
 *
 * @param {HTMLElement} root - the #view-chat section.
 * @param {ChatOptions} [options]
 */
export function initChatPage(root, options = {}) {
  const store = options.store ?? sessionStore;
  const callAgent = options.callAgent ?? defaultCallAgent;
  const navigate =
    options.navigate ??
    ((route) => {
      /** @type {{ hash: string }} */
      const location = /** @type {any} */ (globalThis.location);
      location.hash = `#${route}`;
    });

  /** @type {HTMLElement} */
  const chatEl = get(root, "chat");
  /** @type {HTMLElement} */
  const startPanel = get(root, "start-panel");
  /** @type {HTMLElement} */
  const refusalHint = get(root, "refusal-hint");
  /** @type {HTMLButtonElement} */
  const demoButton = get(root, "demo-button");
  /** @type {HTMLElement} */
  const phaseIndicator = get(root, "phase-indicator");
  /** @type {HTMLElement} */
  const messageList = get(root, "message-list");
  /** @type {HTMLElement} */
  const hero = get(root, "chat-hero");
  /** @type {HTMLElement} */
  const heroEyebrow = get(root, "hero-eyebrow");
  /** @type {HTMLElement} */
  const heroWord = get(root, "hero-word");
  /** @type {HTMLFormElement} */
  const composer = get(root, "composer");
  /** @type {HTMLElement} */
  const composerWrap = get(root, "composer-wrap");
  /** @type {HTMLElement} */
  const composerStatus = get(root, "composer-status");
  /** @type {HTMLTextAreaElement} */
  const messageInput = get(root, "message-input");
  /** @type {HTMLButtonElement} */
  const sendButton = get(root, "send-button");
  /** @type {HTMLElement} */
  const errorBanner = get(root, "error-banner");
  /** @type {HTMLElement} */
  const errorText = get(root, "error-text");
  /** @type {HTMLButtonElement} */
  const retryButton = get(root, "retry-button");
  /** @type {HTMLElement} */
  const endPanel = get(root, "end-panel");
  /** @type {HTMLElement} */
  const endStatus = get(root, "end-status");

  /* Header segmented control (Chat | Map) - the map page is reachable from
   * chat at any time (ticket 15: the reality tree is an information surface
   * from session start; the mobile header needs the nav). */
  const chatSeg = root.querySelector(".chat-seg");
  if (chatSeg) {
    const segItems = /** @type {NodeListOf<HTMLElement>} */ (
      chatSeg.querySelectorAll(".seg-item")
    );
    for (const item of segItems) {
      item.addEventListener("click", () => {
        const tab = item.dataset.tab;
        if (tab) navigate(tab);
      });
    }
    if (options.subscribeRoute) {
      options.subscribeRoute((route) => {
        for (const item of segItems) {
          item.classList.toggle("active", item.dataset.tab === route);
        }
      });
    }
  }

  /** The user content of the in-flight or failed turn; null when idle. */
  /** @type {string | null} */
  let pendingContent = null;
  /** True while a request is in flight. */
  let sending = false;

  /**
   * @param {HTMLElement} el
   * @param {string} id
   * @returns {any}
   */
  function get(el, id) {
    const found = el.querySelector(`#${id}`);
    if (found === null) throw new Error(`Missing element #${id}`);
    return found;
  }

  /**
   * One turn: send the current store request through the shared generation
   * module, apply the response, or surface a friendly error with a retry.
   * `content` is the learner message the turn is answering (already appended
   * to the store by the caller).
   *
   * @param {string} content
   */
  async function runTurn(content) {
    pendingContent = content;
    setSending(true);
    render();
    const result = await runAgentTurn(store, { callAgent });
    if (result.ok) {
      pendingContent = null;
      hideError();
    } else {
      showError(result.code ?? "unknown");
    }
    setSending(false);
    render();
  }

  /** Send the learner's typed answer for the current turn. */
  async function sendMessage() {
    const content = messageInput.value.trim();
    if (content.length === 0 || sending) return;
    if (!store.appendUserMessage(content)) return;
    messageInput.value = "";
    autoGrow(messageInput);
    hideError();
    await runTurn(content);
  }

  /** Seed a scripted session so the UI is reviewable without the API key. */
  function runDemo() {
    if (sending) return;
    if (!loadDemoSession(store)) return;
    hideError();
    render();
    navigate("map");
  }

  /** Re-send the failed request. The store was untouched by the failure. */
  async function retry() {
    if (sending) return;
    if (pendingContent === null) return;
    hideError();
    await runTurn(pendingContent);
  }

  /**
   * @param {string} code
   */
  function showError(code) {
    errorText.textContent = errorMessage(code);
    errorBanner.hidden = false;
  }

  function hideError() {
    errorBanner.hidden = true;
  }

  /**
   * The hero row's eyebrow text per phase kind. "You're exploring" mirrors
   * the observation-first opening (empty learner map), "You're refining"
   * the gap-first probing (populated learner map), matching the phase pill
   * split from spec section 9.
   *
   * @param {string} kind
   * @returns {string}
   */
  function heroEyebrowText(kind) {
    switch (kind) {
      case "exploring":
        return "You are seeing";
      case "refining":
        return "You are testing";
      case "end":
        return "Session end";
      default:
        return "";
    }
  }

  /**
   * @param {boolean} on
   */
  function setSending(on) {
    sending = on;
    messageInput.disabled = on;
    sendButton.disabled = on;
    composerStatus.hidden = !on;
    composer.setAttribute("aria-busy", String(on));
  }

  /**
   * Rebuild the whole page from the store: phase indicator, hero, message
   * list, which input surface is visible, and the end panel.
   */
  function render() {
    const state = store.getState();
    const phase = phaseLabel(state);
    phaseIndicator.textContent = phase.label;
    phaseIndicator.dataset.phase = phase.kind;

    // No session yet: the tree entry lives on the map page, so chat points
    // there instead of hosting a start form (ticket 11).
    const noSession = state.word === null;
    chatEl.classList.toggle("starting", noSession);
    renderMessages(state);

    startPanel.hidden = !noSession;
    refusalHint.hidden = !(state.word !== null && state.phase === "init");

    const composing = state.word !== null && state.phase === "active";
    composer.hidden = !composing;
    composerWrap.hidden = !composing;
    messageInput.placeholder =
      state.phase === "end"
        ? "Your answer to the last question..."
        : "Your answer... (Enter to send)";

    hero.hidden = state.word === null || state.phase === "init";
    heroWord.textContent = state.word ?? "";
    heroEyebrow.textContent = heroEyebrowText(phase.kind);

    endPanel.hidden = !(state.ended && state.transferResult);
    if (state.ended && state.transferResult) {
      endStatus.textContent = state.transferResult.passed
        ? "Your answer was right."
        : "Your answer was not right.";
    }
  }

  /**
   * @param {SessionState} state
   */
  function renderMessages(state) {
    messageList.replaceChildren();
    for (const message of state.history) {
      const row = document.createElement("div");
      row.className = `message message-${message.role}`;
      const body = document.createElement("div");
      body.className = "message-body";
      const label = document.createElement("span");
      label.className = "message-label";
      label.textContent = message.role === "assistant" ? "TUTOR" : "YOU";
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      const text = document.createElement("p");
      text.textContent = message.content;
      bubble.appendChild(text);
      body.append(label, bubble);
      if (message.role === "assistant") {
        const orb = document.createElement("span");
        orb.className = "orb orb-avatar";
        orb.setAttribute("aria-hidden", "true");
        row.appendChild(orb);
      }
      row.appendChild(body);
      messageList.appendChild(row);
    }
    messageList.scrollTop = messageList.scrollHeight;
  }

  /**
   * Grow a textarea up to a cap as its content wraps.
   *
   * @param {HTMLTextAreaElement} el
   */
  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  /**
   * Enter sends, Shift+Enter inserts a newline.
   *
   * @param {KeyboardEvent} event
   */
  function onKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    /** @type {HTMLFormElement} */
    const form = /** @type {any} */ (event.currentTarget).form;
    form.requestSubmit();
  }

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  retryButton.addEventListener("click", retry);
  demoButton.addEventListener("click", runDemo);
  messageInput.addEventListener("input", () => autoGrow(messageInput));
  messageInput.addEventListener("keydown", onKeydown);

  render();
}
