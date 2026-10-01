# 04 - Apply the derived gate thresholds

**Type:** task
**Status:** resolved (2026-10-01)
**Blocked by:** 03 (resolved 2026-10-01)
**Related:** `../research/04-derived-threshold-application.md`,
`../research/03-generality-evidence.md`, `eval/map-quality/gold.js`,
`../../docs/STATUS.md` finding 3

## Question

Ticket 03 derived the acceptance floors from the hand-written gold maps
and did not apply them, because the number depends on a product question
the evidence cannot answer: **is a 4-node map a rabbit hole?**

Answered 2026-10-01: yes, it is. The hand-written maps are the
definition, and the floors take their derived values.

## What this ticket does

Applies a derivation. It invents no number.

| Constant | Before | After |
| --- | --- | --- |
| `MIN_NODES` | 5 | 4 |
| `MIN_TRUNK_NODES` | 4 | 3 |
| `MAX_FANIN_PER_TRUNK_NODE` | 2 | 3, and exported |
| `TRUNK_MAX` | 7 | 8, and exported |

`MAX_NODES`, `MAX_PATH_NODES` and the crown invariant are unchanged and
confirmed derived.

## Acceptance criteria

- [x] The four constants match the derivation in
      `../research/03-generality-evidence.md` section 3.
- [x] All four hand-written gold maps pass the gate, verified by running
      `../research/03-runs/derive-thresholds.mjs`.
- [x] `src/claims.test.js` asserts that the hand-written gold maps pass
      the gate, and it **measures** them by walking the imported maps
      rather than transcribing sizes into a comment.
- [x] That assertion was mutation-checked: setting `MIN_NODES` back to 5
      makes it fail and name `recursion`.
- [x] `MAX_FANIN_PER_TRUNK_NODE` and `TRUNK_MAX` are exported, and
      `claims.test.js` asserts that **no** numeric constant in
      `topology.js` is unexported.
- [x] `topology.test.js` keeps a guard that a 2-node stub is rejected at
      any threshold, and its trunk-floor fixture clears the node floor so
      the trunk check is still reachable.
- [x] No threshold's justification is a failing acceptance run.
- [x] No prompt, coercion or validator changed.
- [x] Gold set and the 20-word generality set re-measured, before and
      after, both recorded in
      `../research/04-derived-threshold-application.md`.
- [x] `npm test`, `npm run typecheck`, `npm run lint` green.

## Result, and the one thing it exposed

The gold set is 0 of 4 before and 0 of 4 after. The 20-word set is 1 of
20 before and 2 of 20 after, which is **inside the recorded variance** and
is not claimed as an improvement.

What did move is the failure mix: degenerate trunk 7 to 3, crown invariant
2 to 6. **The floors were never the binding constraint.** Most words that
stopped failing the trunk floor started failing the crown invariant,
which is the inversion ticket 03 measured: the model judges candidates as
resting on the whole target. That is a semantics failure at r2 and it is
now the largest single failure mode at 6 of 20.

## Two proposals left, deliberately unapplied

1. **A max fan-in floor.** Lowering `MIN_NODES` retired a test named "a
   chain with no fan-in is rejected on the node minimum", and with it the
   node floor's second duty. Measured against the hand-written maps, the
   property that separates `battery` from a bare four-node chain is max
   fan-in (2 to 3 against 1), not node count. **Not applied.** It is a new
   acceptance rule and this ticket's authority was a derivation, not an
   invention.
2. **The inversion itself**, 6 of 20 words. Ticket 03 already recorded
   that no targeted second pass should be built, because the model's
   refusals do not recur. Whatever addresses this has to come from the
   pair prompt or the inventory, and both were escalated and reverted on
   2026-09-29. Do not retry either without new evidence.

## Kill criteria

- If any hand-written gold map still fails the gate after the
  derivation is applied, stop. That means the derivation is wrong, not
  that the floors need another notch. **Not triggered: all four pass.**
- If the score collapses, that is the floors accepting degenerate trees
  and not a reason to put the old numbers back. Check the crown
  invariant and the node count distribution before touching a value.
  **Not triggered: 2 of 20, with node counts 6 and 6.**
- If applying the derivation requires touching a prompt or a coercion,
  stop. That is a different ticket wearing this one's name. **Not
  triggered.**