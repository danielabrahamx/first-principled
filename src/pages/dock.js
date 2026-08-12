/**
 * The docked chat (ticket 09): a compact chat pane mounted inside the
 * map-first split view, right beside the map on desktop, stacked below it on
 * narrow screens.
 *
 * The full chat page (chat.js) remains reachable via #chat; the dock is the
 * always-visible conversation surface of the map-first layout. It shares the
 * session store singleton and the same transport (api/agent.js) and error
 * wording (errorMessage from chat.js), so starting a session in the dock is
 * exactly the same loop as the full page.
 *
 * DOM-free by construction: the module exports pure helpers (dockLabel,
 * dockMessages) for node:test and mounts them in the browser inside
 * renderDock.
 */

import { sessionStore } from "../state/session.js";
import { callAgent as defaultCallAgent } from "../api/agent.js";
import { getTurnstileToken } from "../turnstile.js";
import { errorMessage } from "./chat.js";

/** @typedef {import("../state/session.js").SessionState} SessionState */
/** @typedef {import("../state/session.js").SessionStore} SessionStore */

/**
 * @typedef {object} DockOptions
 * @property {SessionStore} [store] - defaults to the shared sessionStore.
 * @property {typeof defaultCallAgent} [callAgent] - injected for tests.
 */

/**
 * The dock's header label per phase, mirroring the full page's phase pill.
 *
 * @param {SessionState} state
 * @returns {string}
 */
export function dockLabel(state) {
  if (state.phase === "init") return "Starting";
  if (state.phase === "end") return "Session complete";
  return state.learnerMap.nodes.length > 0 ? "Refining" : "Exploring";
}

/**
 * The transcript model for the dock: the store's history, trimmed to the
 * latest few messages so the dock stays compact.
 *
 * @param {SessionState} state
 * @param {number} [max] - default 12.
 * @returns {import("../lib/agent/llm.js").ChatMessage[]}
 */
export function dockMessages(state, max = 12) {
  return state.history.slice(-max);
}

/**
 * Mount the docked chat into `root`. Must be called once, in the browser.
 *
 * @param {HTMLElement} root - the dock container (.map-dock).
 * @param {DockOptions} [options]
 * @returns {{ sync: () => void; destroy: () => void }}
 */
export function renderDock(root, options = {}) {
  const store = options.store ?? sessionStore;
  const callAgent = options.callAgent ?? defaultCallAgent;

  root.replaceChildren();
  root.classList.add("dock");

  const header = document.createElement("div");
  header.className = "dock-header";
  const title = document.createElement("p");
  title.className = "dock-title";
  title.textContent = "Tutor";
  const phase = document.createElement("span");
  phase.className = "pill dock-phase";
  header.append(title, phase);

  const list = document.createElement("div");
  list.className = "dock-messages";
  list.setAttribute("aria-live", "polite");

  /** @type {HTMLTextAreaElement} */
  const input = /** @type {HTMLTextAreaElement} */ (document.createElement("textarea"));
  input.className = "dock-input";
  input.placeholder = "Your answer... (Enter to send)";
  input.setAttribute("autocomplete", "off");
  input.rows = 1;

  /** @type {HTMLButtonElement} */
  const send = /** @type {HTMLButtonElement} */ (document.createElement("button"));
  send.type = "button";
  send.className = "orb send-button dock-send";
  send.setAttribute("aria-label", "Send");
  send.textContent = "\u2191";

  const composer = document.createElement("form");
  composer.className = "dock-composer";
  composer.append(input, send);

  const status = document.createElement("p");
  status.className = "composer-status dock-status";
  status.hidden = true;
  status.textContent = "Thinking...";

  const error = document.createElement("div");
  error.className = "error-banner dock-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const errorText = document.createElement("p");
  errorText.className = "error-text";
  /** @type {HTMLButtonElement} */
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "retry-button";
  retryBtn.textContent = "Retry";
  error.append(errorText, retryBtn);

  const start = document.createElement("div");
  start.className = "dock-start";
  const startHint = document.createElement("p");
  startHint.textContent =
    "Type a word or phrase - laptop, recursion - and the tutor will help you map what you know.";
  start.className = "dock-start";
  start.appendChild(startHint);

  root.append(header, list, start, composer, status, error);

  /** @type {string | null} */
  let pendingContent = null;
  let sending = false;

  /**
   * @param {boolean} on
   */
  function setSending(on) {
    sending = on;
    input.disabled = on;
    send.disabled = on;
    status.hidden = !on;
    composer.setAttribute("aria-busy", String(on));
  }

  /**
   * @param {string | null} content
   */
  async function runTurn(content) {
    pendingContent = content;
    setSending(true);
    sync();
    const token = await getTurnstileToken("agent_turn");
    const result = await callAgent(store.toRequest(), {
      turnstileToken: token ?? undefined,
    });
    if (result.ok) {
      const applied = store.applyResponse(result.data);
      pendingContent = null;
      if (applied) {
        error.hidden = true;
      } else {
        errorText.textContent = errorMessage("internal");
        error.hidden = false;
      }
    } else {
      errorText.textContent = errorMessage(result.code);
      error.hidden = false;
    }
    setSending(false);
    sync();
  }

  /** True when the input should be treated as a new word (init or after an
   * ended session, when startSession resets the store). */
  function wantsWord() {
    const state = store.getState();
    return state.phase === "init" || state.ended;
  }

  async function submitWord() {
    const word = input.value.trim();
    if (word.length === 0 || sending) return;
    if (!store.startSession(word)) return;
    input.value = "";
    error.hidden = true;
    await runTurn(null);
  }

  async function sendMessage() {
    const content = input.value.trim();
    if (content.length === 0 || sending) return;
    if (!store.appendUserMessage(content)) return;
    input.value = "";
    error.hidden = true;
    await runTurn(content);
  }

  async function retry() {
    if (sending || pendingContent === null) return;
    error.hidden = true;
    await runTurn(pendingContent);
  }

  /** @param {KeyboardEvent} event */
  function onKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (wantsWord()) submitWord();
    else sendMessage();
  }

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    if (wantsWord()) submitWord();
    else sendMessage();
  });
  retryBtn.addEventListener("click", retry);
  input.addEventListener("keydown", onKeydown);

  /** Renders the transcript, the phase, the start hint and the composer state. */
  function sync() {
    const state = store.getState();
    phase.textContent = dockLabel(state);
    phase.dataset.phase =
      state.phase === "init" ? "starting" : state.phase === "end" ? "end" : state.learnerMap.nodes.length > 0 ? "refining" : "exploring";

    const starting = state.phase === "init" && !state.ended;
    // The composer is ALWAYS the input surface: during init it takes the
    // word or phrase (submitWord), mid-session the answer (sendMessage),
    // and after the session ends a new word starts a fresh session.
    composer.hidden = false;
    input.disabled = sending;
    input.placeholder = starting || state.ended
      ? "Type a word or phrase..."
      : "Your answer... (Enter to send)";
    // The start hint doubles as the post-session prompt.
    startHint.textContent = state.ended
      ? "Session complete. Type a new word or phrase to start another."
      : "Type a word or phrase - laptop, recursion - and the tutor will help you map what you know.";
    start.hidden = !(starting || state.ended);

    list.replaceChildren();
    for (const message of dockMessages(state)) {
      const row = document.createElement("div");
      row.className = `dock-message dock-${message.role}`;
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      const text = document.createElement("p");
      text.textContent = message.content;
      bubble.appendChild(text);
      row.appendChild(bubble);
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  const unsubscribe = store.subscribe(sync);
  sync();

  return {
    sync,
    destroy() {
      unsubscribe();
      root.replaceChildren();
    },
  };
}
