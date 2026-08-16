/**
 * Phase helpers kept for tests after ticket 02 unmounted the Chat page.
 * Tutor chrome is parked (dock.js stays unmounted); errorMessage lives
 * in generation.js and is re-exported here so chat.test.js stays green.
 */

import { errorMessage } from "../lib/generation.js";

/** @typedef {import("../state/session.js").SessionState} SessionState */

export { errorMessage };

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
