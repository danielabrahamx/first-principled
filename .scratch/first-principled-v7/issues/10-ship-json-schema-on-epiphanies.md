# 10 - Ship JSON Schema on Epiphanies

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Lock the thinking architecture from the council](09-lock-the-thinking-architecture-from-the-council.md)

**Related:** [Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md), [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)

## Question

Does a thinking-off Epiphanies call with JSON Schema constrained
decoding return joints that pass the existing field checklist, so
Arrange can run?

## What

Do not re-research. Locked by
[Lock the thinking architecture from the council](09-lock-the-thinking-architecture-from-the-council.md):
Option A. Thinking off everywhere. JSON Schema on Epiphanies only.
Council essay:
[09-thinking-architecture-council.md](../research/09-thinking-architecture-council.md).

The schema follows the locked Stage 2 contract in `realityMap.js`, not
the council's shorthand field names. `joint_kind` enum is `JOINT_KINDS`.
`from_regimes` and `to_regimes` items are Chronology ids (`c1`, `c2`,
...). `history.certainty` enum is `{EXACT, APPROXIMATE, UNKNOWN}`.
`history.observation` stays a text field. After Chronology returns,
the Epiphanies schema may enum those live ids. Chronology and Arrange
keep today's `json_object` path.

1. Send `response_format` JSON Schema on the Epiphanies call. Keep
   `thinking: false`. Leave `thinkingByStage` as the unused seam for
   Option B.
2. Mechanical gate still rejects. Do not retry. Do not parse
   `reasoning_content` as the contract. If a provider ignores
   `json_schema`, keep `json_object` and fail closed.
3. No prompt rewrite. No exemplars. No fourth LLM call. No per-stage
   model. Do not raise host timeouts or the 240 s abort.
4. Unit tests cover the schema shape and thinking-off default. Live
   DeepSeek probe on `battery`: Epiphanies passes `epiphaniesProblems`,
   Arrange runs. Record timings. No secrets.
5. Deploy to prod. Prod stays OpenRouter. Do not set Netlify
   `LLM_PROVIDER=deepseek`.

**Out of this ticket.** Followability KEEP/KILL (that is
[Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md)).
Exemplars. Thinking on. Option B. Pointing prod at DeepSeek.

## Acceptance criteria

- [ ] Epiphanies call sends JSON Schema for the locked Stage 2 contract
- [ ] Thinking stays off on every stage by default
- [ ] Invalid joints fail the mechanical gate with no retry
- [ ] Chronology and Arrange calls are unchanged aside from shared transport
- [ ] Unit tests lock the schema and the thinking-off default
- [ ] Live DeepSeek `battery` probe recorded (Epiphanies field-checks, Arrange runs)
- [ ] Prod deploy SHA recorded; prod still OpenRouter
- [ ] `npm test` and `npx tsc --noEmit` pass
- [ ] Key-leak grep clean
- [ ] Ticket 07 is not claimed or scored in this session

## Docs rule

Pointer from this ticket and the map. Schema lives in code next to
`JOINT_KINDS` and `epiphaniesProblems`. Do not restate the council essay.
Leave a seam for Option B; do not build it.
