/**
 * Session metrics (spec section 10), computed client-side from the turn
 * diffs the store already holds. Pure and deterministic: same diff, same
 * count.
 *
 * Gap closure: a learner node whose state flips from missing or
 * misconception to correct - the state change the session exists to
 * produce. The per-session total accumulates in the session store (ticket
 * 10) from every turn's diff; untested-to-correct flips do not count (the
 * learner had nothing known to correct there), nor do flips away from
 * correct.
 */

/**
 * @param {import("./types.js").Diff | null | undefined} diff - one turn's
 *   diff, or null (a missing or empty diff closes nothing).
 * @returns {number} how many nodes closed a gap this turn.
 */
export function gapClosuresInDiff(diff) {
  if (diff === null || diff === undefined || typeof diff !== "object") return 0;
  if (!Array.isArray(diff.flipped)) return 0;
  return diff.flipped.filter(
    (flip) =>
      flip !== null &&
      typeof flip === "object" &&
      (flip.from === "missing" || flip.from === "misconception") &&
      flip.to === "correct"
  ).length;
}
