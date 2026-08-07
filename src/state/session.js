/**
 * The client session store: the single in-memory holder of session state.
 *
 * Per ticket 07 and spec sections 6 and 8, the client owns the whole session
 * - word, reality map, learner map, history, failedAttempts, phase - and the
 * serverless function stores nothing. Every request carries the full state
 * (`toRequest`) and every response merges back into the store
 * (`applyResponse`).
 *
 * Lifecycle:
 * - startSession(word): clears every field, sets phase "init". The chat page
 *   calls this for the first word and again after an init refusal (a new
 *   word is a new session).
 * - appendUserMessage(content): records the learner's message in history.
 *   The chat page calls this before sending, so the request's history ends
 *   with the learner's latest message (the orchestrator reads it as the
 *   learner utterance).
 * - applyResponse(response): merges one 200 turn response - appends the
 *   assistant reply to history, adopts learnerMap, diff, failedAttempts and
 *   phase, and on init adopts realityMap. When the response sets
 *   sessionEnded the store freezes: no further user messages are accepted
 *   and the comparison data (maps, transferResult) is kept until the next
 *   startSession.
 * - toRequest(): serializes to the exact request shape in spec section 8.
 * - subscribe(listener): notifies after every successful startSession and
 *   applyResponse, so views (the map page) can re-render live as turns land.
 *
 * Nothing is written to disk, localStorage, or any server. The store is a
 * module singleton (sessionStore): both pages import the same instance, so
 * navigating between chat and map keeps the session.
 *
 * The file is .js, not .ts: per the ticket 02 decision, the frontend is
 * plain ES modules with JSDoc types, verified by `npm run typecheck`.
 */

import { closenessScore } from "../lib/mmg/closeness.js";
import { gapClosuresInDiff } from "../lib/mmg/metrics.js";

/** @typedef {import("../lib/mmg/types.js").RealityMap} RealityMap */
/** @typedef {import("../lib/mmg/types.js").LearnerMentalModel} LearnerMentalModel */
/** @typedef {import("../lib/mmg/types.js").Diff} Diff */
/** @typedef {import("../lib/agent/llm.js").ChatMessage} ChatMessage */
/** @typedef {import("../lib/agent/socratic.js").FailedAttempts} FailedAttempts */

/**
 * @typedef {object} SessionState
 * @property {string | null} word - the concept being learned; null before
 *   startSession.
 * @property {RealityMap | null} realityMap - null until the init response
 *   returns it (and after a refusal).
 * @property {LearnerMentalModel} learnerMap - empty until the first turn.
 * @property {ChatMessage[]} history - the conversation: assistant replies
 *   appended by applyResponse, learner messages by appendUserMessage.
 * @property {FailedAttempts} failedAttempts - node id to failed-attempt
 *   count, carried by the server every turn.
 * @property {"init" | "active" | "end"} phase
 * @property {boolean} ended - true once sessionEnded arrived; the store is
 *   frozen until startSession.
 * @property {{ passed: boolean; assessment: string } | null} transferResult -
 *   the graded transfer question, kept after the session ends.
 * @property {Diff | null} lastDiff - the diff of the most recent response
 *   (drives the map page's per-turn animation).
 * @property {string | null} lastReply - the reply text of the most recent
 *   response.
 * @property {number | null} closeness - closeness score of the current
 *   learner map, recomputed on every response (0 before the first turn).
 * @property {number} gapClosures - the session metric (spec section 10):
 *   how many nodes have flipped from missing or misconception to correct
 *   so far, accumulated from each turn's diff. Reset by startSession.
 */

/**
 * @typedef {object} SessionStore
 * @property {(word: string) => boolean} startSession
 * @property {() => SessionState} getState
 * @property {(content: string) => boolean} appendUserMessage
 * @property {(response: any) => boolean} applyResponse
 * @property {() => any} toRequest
 * @property {(listener: () => void) => () => void} subscribe
 */

/**
 * The empty learner map every session begins with.
 *
 * @type {LearnerMentalModel}
 */
export const EMPTY_LEARNER_MAP = Object.freeze({
  nodes: [],
  edges: [],
});

/**
 * @returns {SessionState}
 */
function freshState() {
  return {
    word: null,
    realityMap: null,
    learnerMap: { nodes: [], edges: [] },
    history: [],
    failedAttempts: {},
    phase: "init",
    ended: false,
    transferResult: null,
    lastDiff: null,
    lastReply: null,
    closeness: null,
    gapClosures: 0,
  };
}

/**
 * Create one session store. The module singleton below is what the pages
 * share; the factory exists for tests and for future multi-session UIs.
 *
 * @returns {SessionStore}
 */
export function createSessionStore() {
  /** @type {SessionState} */
  let current = freshState();
  /** @type {Set<() => void>} */
  const listeners = new Set();

  /**
   * Notify subscribers that the store changed. Called after every
   * successful startSession and applyResponse.
   */
  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    /**
     * Begin a new session: every field resets, so no state leaks from a
     * previous session. Returns false (and changes nothing) when the word
     * is not a non-empty trimmed string.
     *
     * @param {string} word
     * @returns {boolean}
     */
    startSession(word) {
      if (typeof word !== "string" || word.trim().length === 0) return false;
      current = freshState();
      current.word = word.trim();
      notify();
      return true;
    },

    /**
     * The current session state. Read-only by convention: mutate it only
     * through the store methods.
     *
     * @returns {SessionState}
     */
    getState() {
      return current;
    },

    /**
     * Record the learner's message in history. Refused (returns false) once
     * the session has ended - the frozen store accepts nothing until the
     * next startSession.
     *
     * @param {string} content
     * @returns {boolean}
     */
    appendUserMessage(content) {
      if (current.ended) return false;
      if (typeof content !== "string" || content.length === 0) return false;
      current.history.push({ role: "user", content });
      return true;
    },

    /**
     * Merge a 200 turn response into the store. Returns false (without
     * touching state) when the session is frozen or the response is not an
     * object.
     *
     * @param {any} response - the parsed response body from POST /api/agent.
     * @returns {boolean}
     */
    applyResponse(response) {
      if (current.ended) return false;
      if (typeof response !== "object" || response === null) return false;

      if (typeof response.reply === "string") {
        current.history.push({ role: "assistant", content: response.reply });
        current.lastReply = response.reply;
      }
      if (response.realityMap && typeof response.realityMap === "object") {
        current.realityMap = response.realityMap;
      }
      if (response.learnerMap && typeof response.learnerMap === "object") {
        current.learnerMap = response.learnerMap;
        current.closeness = closenessScore(response.learnerMap);
      }
      if (response.diff && typeof response.diff === "object") {
        current.lastDiff = response.diff;
        current.gapClosures += gapClosuresInDiff(response.diff);
      }
      if (response.failedAttempts && typeof response.failedAttempts === "object") {
        current.failedAttempts = response.failedAttempts;
      }
      if (response.phase === "init" || response.phase === "active" || response.phase === "end") {
        current.phase = response.phase;
      }
      if (response.sessionEnded === true) {
        current.ended = true;
        if (response.transferResult && typeof response.transferResult === "object") {
          current.transferResult = response.transferResult;
        }
      }
      notify();
      return true;
    },

    /**
     * The request body for the next turn, exactly the spec section 8 shape
     * `{word?, realityMap?, learnerMap?, failedAttempts?, history, phase}`:
     * word only on init, the held maps and failedAttempts on active and end.
     *
     * @returns {{ word?: string; realityMap?: RealityMap; learnerMap?: LearnerMentalModel; failedAttempts?: FailedAttempts; history: ChatMessage[]; phase: string }}
     */
    toRequest() {
      const common = {
        history: current.history,
        phase: current.phase,
      };
      if (current.phase === "init") {
        return { word: /** @type {string} */ (current.word), ...common };
      }
      return {
        realityMap: /** @type {RealityMap} */ (current.realityMap),
        learnerMap: current.learnerMap,
        failedAttempts: current.failedAttempts,
        ...common,
      };
    },

    /**
     * Subscribe to store changes. The listener fires with no arguments after
     * every successful startSession and applyResponse; re-read getState() in
     * it. Returns an unsubscribe function.
     *
     * @param {() => void} listener
     * @returns {() => void}
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The one store for this browser tab. Both pages import this same instance,
 * so the session survives navigation between them (the document is never
 * reloaded - see the hash router in router.js).
 *
 * @type {SessionStore}
 */
export const sessionStore = createSessionStore();
