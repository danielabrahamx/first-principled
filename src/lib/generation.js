/**
 * The shared client-side generation module (ticket 11): the one place the
 * word-to-tree call and the follow-up turns run against the shared session
 * store.
 *
 * Both surfaces drive every network turn through here. The map page owns the
 * entry - generateTree starts a session for a word and runs the init turn
 * that grows the reality map. Chat and the dock own the follow-ups -
 * runAgentTurn sends one turn (the learner's answer) and applies the
 * response. The transport (api/agent.js) never changes: every request
 * carries the full session state (store.toRequest), a 200 response merges
 * back into the store (store.applyResponse), and every failure collapses to
 * a stable code the page words politely. On failure the store is untouched,
 * so retry re-sends the exact same request.
 *
 * The module is DOM-free: node:test can drive generateTree and runAgentTurn
 * with a real store and an injected callAgent.
 */

import { callAgent as defaultCallAgent } from "../api/agent.js";
import { getTurnstileToken } from "../turnstile.js";

/** @typedef {import("../state/session.js").SessionStore} SessionStore */

/**
 * @typedef {object} TurnResult
 * @property {boolean} ok
 * @property {string} [code] - the transport code, present when ok is false.
 */

/**
 * The friendly wording per transport code. Every code the transport can
 * produce has a line; unknown codes fall back to the last entry. Shared by
 * the map page (entry errors) and the chat surfaces (turn errors), so one
 * set of lines words both.
 *
 * @type {Record<string, string>}
 */
const ERROR_MESSAGES = {
  bad_request: "The tutor did not accept the input. Please try again.",
  config_error: "The tutor is not ready yet. Please try again later.",
  internal: "A fault happened on our side. Please try again.",
  upstream_error: "The tutor could not answer. Please try again.",
  invalid_model_output: "The tutor produced an unreadable answer. Please try again.",
  network: "We could not reach the tutor. Check your connection, then try again.",
  too_large: "Your message was too large. Please use a short message.",
  rate_limited: "Too many requests. Please wait a moment, then try again.",
  captcha_required: "One quick human check, then we continue.",
  captcha_failed: "The human check did not pass. Please try again.",
  unknown: "A fault happened. Please try again.",
};

/**
 * @param {string} code
 * @returns {string}
 */
export function errorMessage(code) {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}

/**
 * Run one turn against the shared store: send the store's request, apply a
 * 200 response, or return a stable failure code. On failure the store is
 * untouched, so retry re-sends the same request.
 *
 * @param {SessionStore} store
 * @param {object} [options]
 * @param {typeof defaultCallAgent} [options.callAgent] - injected for tests.
 * @param {(data: any) => void} [options.onPoll] - called with each running
 *   poll record while the background init job works (ticket 11); passed
 *   straight through to the transport.
 * @returns {Promise<TurnResult>}
 */
export async function runAgentTurn(store, options = {}) {
  const callAgent = options.callAgent ?? defaultCallAgent;
  const token = await getTurnstileToken("agent_turn");
  const request = store.toRequest();
  const result = await callAgent(request, {
    turnstileToken: token ?? undefined,
    onPoll: options.onPoll,
  });
  if (result.ok) {
    const applied = store.applyResponse(result.data);
    return applied ? { ok: true } : { ok: false, code: "internal" };
  }
  return { ok: false, code: result.code };
}

/**
 * Start tree generation for a word: begin the session and run the init turn
 * that grows the reality map - the word-to-tree call. Returns ok true when
 * a tree (or a refusal) landed, or ok false with a transport code.
 *
 * @param {SessionStore} store
 * @param {string} word
 * @param {object} [options]
 * @param {typeof defaultCallAgent} [options.callAgent] - injected for tests.
 * @param {(data: any) => void} [options.onPoll] - see runAgentTurn.
 * @returns {Promise<TurnResult>}
 */
export async function generateTree(store, word, options = {}) {
  if (!store.startSession(word)) return { ok: false, code: "bad_request" };
  return runAgentTurn(store, options);
}
