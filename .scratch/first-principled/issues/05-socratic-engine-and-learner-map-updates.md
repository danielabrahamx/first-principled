# 05 - Socratic engine and learner map updates

**Type:** task
**Status:** resolved (opencode, 2026-08-07)
**Blocked by:** 01, 02, 03
**Related:** spec sections 3, 8; `docs/MISSION.md`; `src/lib/agent/socratic.js`

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

## Resolution (2026-08-07, opencode)

Built `src/lib/agent/socratic.js` (ES module, JSDoc-typed - the ticket's
`.ts` path follows the ticket 02 decision that runtime code is plain ES
modules) plus `socratic.test.js`. Reuses the parallel ticket 04 base:
`llm.js` transport and `jsonParse.js` defensive parsing, with the same
injected-transport, one-repair-attempt pattern as `realityMap.js`.

Division of labour:

- **Code decides the hard, countable rules**: opening vs gap-first mode
  (`conversationMode`), the explanation gate at two failed attempts
  (`explanationDue`, `updateFailedAttempts`), the deterministic per-turn
  diff (`computeDiff`), and turn validation (`validateTurn` - schema-valid
  learner map, probe targets a real node, and the update never drops a
  previously known node or edge).
- **The model decides everything semantic**: which gap to probe, the
  wording, misconception detection, what the learner's words imply. The
  prompts (`buildSocraticSystemPrompt`, `buildSocraticUserPrompt`,
  `buildDirective`) carry the immutable mission, the 12 principles, the
  hard no-leak rules, and this turn's directive.

Model reply contract: `{reply, learnerMap, probe}` with
`probe = {nodeId, kind: observe|probe|explain|converse}`. The function
computes `diff` itself - the model is never trusted to compute it.

Key finding (live-verified): a failed attempt is an ANSWER that leaves the
point non-correct - counted against nodes whose map entry changed this
turn - NOT a probe. Asking a question is not a failure; on the first live
run the engine wrongly counted a failure on a node that had only been
asked about. Fixed and regression-tested. An explanation turn or a correct
answer clears the node's count (fresh two attempts). The gate resets only
after the fallback fires, matching "explanation fires on request and after
two failed attempts, and not before".

Empty-content recovery (known DeepSeek JSON-mode failure): the repair
attempt runs with thinking disabled - a genuinely different execution
path - plus the stricter "JSON only" instruction.

Acceptance criteria met:

- Simulated sessions produce schema-valid learner maps with real flips
  (misconception -> correct fires in the diff at the right turn; closeness
  0.5 -> 1.0 in the scripted session).
- Explanation fires on request (prompt rule, model-judged) and exactly at
  two failed attempts (code-gated), never before - asserted on the
  simulated session's kinds and directives.
- No reply in any test or live call quotes reality map content verbatim
  (leak check asserts no description substring; live calls checked too).
- Live DeepSeek calls (observe opening, explanation gate, gap probe) read
  Socratic, stay under 30s, and produce valid, parseable turns; the gate
  fired with kind "explain" on the stuck node.

Spec section 8 updated: request gains `failedAttempts`, model reply shape
and the code-computed diff are documented. Docs in the same commit.

Live verification evidence and the diagnostic scripts are in
`C:\Users\danie\AppData\Local\Temp\opencode\` (not committed).
