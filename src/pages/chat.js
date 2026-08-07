/**
 * The chat page: the one surface that carries the whole Socratic loop.
 *
 * Per ticket 08 and spec section 9. A thin controller over the session store
 * (state/session.js) and the client transport (api/agent.js): it renders
 * whatever the store holds, forwards what the learner types, and shows a
 * sending state while the API call is in flight.
 *
 * Surfaces:
 * - Starting: a word or phrase input (visible in phase init, including after
 *   a refusal - a new word starts a new session).
 * - Conversation: a message list of learner and agent turns.
 * - Phase indicator: starting / exploring / refining / session end. The
 *   exploring-vs-refining split mirrors the engine's own opening rule in
 *   spec section 8: an empty learner map means observation-first
 *   (exploring); a populated map means gap-first (refining).
 * - Session end: the transfer question arrives as a normal message, the
 *   learner answers, then a result panel shows pass or fail and the
 *   comparison entry point (a link to the map page - the map UI itself is
 *   ticket 09, the comparison view ticket 10).
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

/** @typedef {import("../state/session.js").SessionState} SessionState */
/** @typedef {import("../state/session.js").SessionStore} SessionStore */

/**
 * @typedef {object} ChatOptions
 * @property {SessionStore} [store] - defaults to the shared sessionStore
 *   singleton.
 * @property {typeof defaultCallAgent} [callAgent] - the transport; injected
 *   for tests.
 */

/**
 * The friendly wording per transport code. Every code the transport can
 * produce has a line; unknown codes fall back to the last entry.
 *
 * @type {Record<string, string>}
 */
const ERROR_MESSAGES = {
  bad_request: "The tutor did not accept that. Please try again.",
  config_error: "The tutor is not fully set up yet. Please try again later.",
  internal: "Something went wrong on our side. Please try again.",
  upstream_error: "The tutor had trouble responding. Please try again.",
  invalid_model_output: "The tutor produced an unreadable answer. Please try again.",
  network: "Could not reach the tutor. Check your connection and try again.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * The transport code to the line the learner sees.
 *
 * @param {string} code
 * @returns {string}
 */
export function errorMessage(code) {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}

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
    ? { kind: "refining", label: "Refining" }
    : { kind: "exploring", label: "Exploring" };
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

  /** @type {HTMLTextAreaElement} */
  const wordInput = get(root, "word-input");
  /** @type {HTMLFormElement} */
  const startForm = get(root, "start-form");
  /** @type {HTMLButtonElement} */
  const beginButton = get(root, "begin-button");
  /** @type {HTMLElement} */
  const startHint = get(root, "start-hint");
  /** @type {HTMLElement} */
  const phaseIndicator = get(root, "phase-indicator");
  /** @type {HTMLElement} */
  const messageList = get(root, "message-list");
  /** @type {HTMLFormElement} */
  const composer = get(root, "composer");
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
   * One turn: send the current store request, apply the response, or surface
   * a friendly error with a retry. `content` is the learner message the turn
   * is answering (already appended to the store by the caller); null on init.
   *
   * @param {string | null} content
   */
  async function runTurn(content) {
    pendingContent = content;
    setSending(true);
    render();
    const result = await callAgent(store.toRequest());
    if (result.ok) {
      const applied = store.applyResponse(result.data);
      pendingContent = null;
      if (applied) {
        hideError();
      } else {
        // Unreadable but 200: nothing was applied, retry is safe.
        showError("internal");
      }
    } else {
      showError(result.code);
    }
    setSending(false);
    render();
  }

  /**
   * Start a session from the word input. Called for the first word and again
   * after an init refusal (a new word is a new session).
   */
  async function submitWord() {
    const word = wordInput.value.trim();
    if (word.length === 0 || sending) return;
    if (!store.startSession(word)) return;
    wordInput.value = "";
    hideError();
    await runTurn(null);
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
   * @param {boolean} on
   */
  function setSending(on) {
    sending = on;
    wordInput.disabled = on;
    beginButton.disabled = on;
    beginButton.textContent = on ? "Thinking..." : "Begin";
    messageInput.disabled = on;
    sendButton.disabled = on;
    sendButton.textContent = on ? "Thinking..." : "Send";
    composer.setAttribute("aria-busy", String(on));
  }

  /**
   * Rebuild the whole page from the store: phase indicator, message list,
   * which input surface is visible, and the end panel.
   */
  function render() {
    const state = store.getState();
    const phase = phaseLabel(state);
    phaseIndicator.textContent = phase.label;
    phaseIndicator.dataset.phase = phase.kind;

    renderMessages(state);

    const starting = state.phase === "init" && !state.ended;
    startForm.hidden = !starting;
    startHint.hidden = !(starting && state.history.length > 0);

    const composing = !starting && !state.ended;
    composer.hidden = !composing;
    messageInput.placeholder =
      state.phase === "end"
        ? "Your answer to the transfer question..."
        : "Your answer...";

    endPanel.hidden = !(state.ended && state.transferResult);
    if (state.ended && state.transferResult) {
      endStatus.textContent = state.transferResult.passed
        ? "Transfer question passed"
        : "Transfer question not passed";
    }
  }

  /**
   * @param {SessionState} state
   */
  function renderMessages(state) {
    messageList.replaceChildren();
    for (const message of state.history) {
      const bubble = document.createElement("div");
      bubble.className = `message message-${message.role}`;
      const text = document.createElement("p");
      text.textContent = message.content;
      bubble.appendChild(text);
      messageList.appendChild(bubble);
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

  startForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitWord();
  });
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  retryButton.addEventListener("click", retry);
  wordInput.addEventListener("input", () => autoGrow(wordInput));
  messageInput.addEventListener("input", () => autoGrow(messageInput));
  wordInput.addEventListener("keydown", onKeydown);
  messageInput.addEventListener("keydown", onKeydown);

  render();
}
