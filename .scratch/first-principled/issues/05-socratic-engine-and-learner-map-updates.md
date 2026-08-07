# 05 - Socratic engine and learner map updates

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 01, 02, 03
**Related:** spec sections 3, 8; `docs/MISSION.md`; `src/lib/agent/socratic.ts`

## Question

How does the agent question, infer, and update the learner's Mental Model
without leaking the reality map?

## What

1. The Socratic prompt in `src/lib/agent/socratic.ts`, grounded in the
   immutable mission and principles:
   - Observation-first opening when the learner map is empty: ask what the
     learner has seen, used, or noticed, before any theory (principle 1 and 11).
   - Gap-first probing when the map is populated: pick the biggest gap in
     dependency order, lower layers before abstractions (principle 5).
   - Each turn updates the learner map: node states (untested, missing,
     misconception, correct), confidence, and evidence quoted from the learner.
   - Misconception detection: when the learner's answer conflicts with the
     reality map, mark it and work it, without ever quoting the reality map
     verbatim.
   - Explanation fallback only when the learner asks, or after two failed
     attempts on the same point (principle 8). If the learner has no model of a
     concept, teach observationally before questioning it (principle 7).
   - Never transmit understanding directly; always construct it through
     questions (principle 6).
2. The update logic: parse the model's response into {reply, learnerMap, diff}.
   Validate against the schema; reject malformed updates.
3. Unit tests on simulated conversations: state flips fire, explanation
   triggers fire at the right counts, learner map stays schema-valid.

## Acceptance criteria

- Simulated sessions produce valid learner maps with real flips.
- Explanation fires on request and after two failed attempts, and not before.
- No test response quotes reality map content verbatim.
- The model's reply reads Socratic, not lecture.

## Docs rule

Commit and push before done. Update spec section 8 if the policy changes.
