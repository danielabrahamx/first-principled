# 10 - Session end comparison and transfer question

**Type:** task
**Status:** resolved (2026-08-07)
**Blocked by:** 08 (resolved), 09 (resolved)
**Related:** spec sections 8, 9, 10; `src/lib/agent/` and `src/pages/map.tsx`

## Question

How does a session close, prove the learning, and make the mission visible?

## What

1. Transfer question: at the end phase the agent asks a novel problem that
   requires the corrected model (not a restatement of anything practiced).
   The learner answers; the agent records pass or fail against the reality
   map; the result is stored in the session state.
2. Comparison view (session end only): reality map vs learner map side by
   side, closed-gap summary (count of flips from missing or misconception to
   correct), closeness score, transfer result. This is the mission made
   visible: here is reality, here is what your model had, here is what we
   closed.
3. Metrics captured per session: gap closure count, transfer pass or fail,
   closeness score. Recorded client-side in the session store; a future
   analytics surface can read them.
4. Session end state: chat page shows the entry point to the comparison;
   map page renders it.

## Acceptance criteria

- Transfer question fires only at session end and is novel, not practiced.
- Pass or fail is recorded deterministically from the learner's answer.
- Comparison renders both maps, the closed-gap summary, and both metrics.
- No session leaks into the next one.

## Docs rule

Commit and push before done. Update spec sections 8-10 if the flow changes.

## Resolution

- Transfer question and grading were already live from ticket 06: the
  orchestrator asks the question when sessionEndDue (all reality nodes known
  or the 24-turn cap) and grades the answer against the reality map,
  returning sessionEnded + transferResult {passed, assessment}; the store
  keeps it after the freeze. Nothing server-side changed here.
- Metrics live in the session store (`src/state/session.js`): the new
  `gapClosures` counter accumulates deterministically from each turn's diff
  via `src/lib/mmg/metrics.js` `gapClosuresInDiff` - a flip from missing or
  misconception to correct closes a gap; untested-to-correct is a first
  discovery, not a closure (spec section 10 wording honored exactly).
  `closeness` was already recomputed per response and `transferResult`
  arrives with the graded end response. All three reset in `freshState`, so
  a new word can never leak the previous session's numbers (tested).
- Comparison viewmodel: `src/lib/mapview/comparison.js` (pure, unit-tested)
  - `realitySections` (layers from foundations up, each node with label and
    description), `realityEdgeList` (sourceLabel type targetLabel), and
    `comparisonMetrics` (closeness, gapClosures, transfer pass + assessment
    read from the store's own recorded numbers - the view never recomputes
    them from history).
- The map page renders the comparison at session end only
  (`state.ended && realityMap`): the reality panel sits side by side with
  the learner's final grid, topped by a metrics row (Closeness, Gaps
  closed, Transfer) and closed by the transfer assessment. The comparison
  is the one place the page may show full reality content - the no-leak
  rule binds mid-session only. The render is hoisted above the empty-grid
  early return, so a session that ends via the turn cap with nothing
  engaged still shows reality + zeroed metrics. Layout: flex row that
  wraps to stacked columns on a narrow viewport; the learner grid keeps its
  ticket-09 horizontal-scroll behavior. CSS in `src/styles.css`.
- Spec updated: section 6 (client state list now names gap closures),
  section 9 map-page bullet (comparison view described, "ticket 10" marker
  removed), section 10 (all three metrics recorded client-side, where and
  how).
- Verification: 163 node:test cases pass (14 new: 6 metrics, 6 comparison,
  1 store accumulation, 1 store-field assertions on fresh/reset), `tsc
  --noEmit` clean. DOM audit with headless Edge against a scripted full
  session (init + 2 turns with closures + transfer + graded end) via netlify
  dev: mid-session dump shows the comparison hidden and zero reality
  content (no layer names, no descriptions; engaged-only labels); end dump
  shows the visible comparison with Closeness 80%, Gaps closed 2, Transfer
  passed, all six layers with labels and descriptions, the typed edge list,
  the transfer assessment, the ended note, and the learner grid intact
  beside it. Geometry check at narrow viewport: no document overflow, the
  reality panel wraps below the grid; at desktop width the two columns sit
  side by side (reality 284px beside grid 316px) with the grid scrolling
  within its column per ticket 09's design. Harness files were deleted after
  the audit.
