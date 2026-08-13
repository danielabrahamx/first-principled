/**
 * The docked Tutor (ticket 09, retargeted by ticket 02): a compact Q&A pane
 * beside the Tree on desktop, stacked below it on narrow screens. Closed by
 * default; the header Tutor toggle opens it.
 *
 * Ticket 11: the dock is follow-up-only. The word input lives in the Tree
 * header; when there is no tree yet - or the Tree is still building one, or
 * the session has ended - the dock shows a hint pointing at the word input
 * and hides its composer.
 *
 * DOM-free by construction: the module exports pure helpers (dockLabel,
 * dockMessages) for node:test and mounts them in the browser inside
 * renderDock.
 */

import { sessionStore } from "../state/session.js";
import { callAgent as defaultCallAgent } from "../api/agent.js";
import { runAgentTurn, errorMessage } from "../lib/generation.js";

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
  if (state.phase === "end") return "Session end";
  return state.learnerMap.nodes.length > 0 ? "Testing" : "Seeing";
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
  startHint.textContent = "Enter a word to build the tree.";
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
   * @param {string} content
   */
  async function runTurn(content) {
    pendingContent = content;
    setSending(true);
    sync();
    const result = await runAgentTurn(store, { callAgent });
    if (result.ok) {
      pendingContent = null;
      error.hidden = true;
    } else {
      errorText.textContent = errorMessage(result.code ?? "unknown");
      error.hidden = false;
    }
    setSending(false);
    sync();
  }

  async function sendMessage() {
    const state = store.getState();
    if (state.phase !== "active") return;
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
    sendMessage();
  }

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  retryBtn.addEventListener("click", retry);
  input.addEventListener("keydown", onKeydown);

  /** Renders the transcript, the phase, the hint and the composer state. */
  function sync() {
    const state = store.getState();
    phase.textContent = dockLabel(state);
    phase.dataset.phase =
      state.phase === "init" ? "starting" : state.phase === "end" ? "end" : state.learnerMap.nodes.length > 0 ? "refining" : "exploring";

    // Follow-up-only (ticket 11): the composer takes an answer only while a
    // tree exists and the session is live. The map header owns word entry.
    const usable = state.word !== null && state.phase === "active";
    composer.hidden = !usable;
    input.disabled = sending;
    input.placeholder = "Your answer... (Enter to send)";
    start.hidden = usable;
    if (state.ended) {
      startHint.textContent =
        "Session end. Enter a new word to build another tree.";
    } else if (state.word === null) {
      startHint.textContent = "Enter a word to build the tree.";
    } else if (state.lastReply !== null) {
      startHint.textContent =
        "The tree did not build. Enter a different word.";
    } else {
      startHint.textContent = "The tree is building.";
    }

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
