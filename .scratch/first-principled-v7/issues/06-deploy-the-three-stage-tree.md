# 06 - Deploy the three-stage Tree

**Type:** task

**Status:** resolved

**Blocked by:** [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)

**Related:** [Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md)

## Question

What deploy makes production init the three-stage builder, with prod
still on OpenRouter, so Danny can score live trees?

## What

`netlify deploy --prod` after ticket 05. Prod `LLM_*` stay OpenRouter.
Do not set Netlify `LLM_PROVIDER=deepseek`. Chrome smoke still holds.
If `:free` 429s, record the blocker; do not switch slug in this ticket.
Verify that learner-facing init contains only the checked Arrange `map`.
Chronology, raw Epiphanies, provenance, discarded IDs, and prompts must
remain server-side while the diagnostic bundle remains capturable for
the four-topic falsification test.

**Out of this ticket.** Prompt retune. Danny scoring (that is
[Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md)).
Paid slug. DeepSeek in prod.

## Acceptance criteria

- [x] Prod deploy SHA recorded
- [x] Prod still OpenRouter
- [x] Init on prod is the three-stage path (or the exact `:free` 429
      blocker is recorded)
- [x] Learner-facing responses contain no intermediate or provenance data
- [x] Four-topic diagnostic bundles can be captured without exposing them
      to the learner
- [x] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. AGENTS.md
Resume and CONTEXT.md Frontier name the deploy in the same commit.

## Resolution

Prod deploy id `6a83a3dd6082d925b8c3d127` at
https://first-principled.netlify.app (unique URL
https://6a83a3dd6082d925b8c3d127--first-principled.netlify.app). Prod
`LLM_*` stay OpenRouter Nemotron `:free`. `LLM_PROVIDER` is unset, not
`deepseek`. Chrome smoke 12/12 against the unique URL. Later superseded
by [Ship JSON Schema on Epiphanies](10-ship-json-schema-on-epiphanies.md):
prod `LLM_MODEL` is paid Nemotron.

Live `photosynthesis` and `recursion` init hit the three-stage path and
returned `invalid_model_output` in ~17s after the mechanical gate
rejected the model output. Not HTTP 429. Learner-facing bodies leaked
no chronology, epiphanies, provenance, discarded IDs, or prompts.
`06-capture-diagnostics.mjs` splits a learner map from a diagnostic
bundle so ticket 07 can persist the four gold words without exposing
them on `/api/agent`. Record:
[06-prod-smoke.md](../research/06-prod-smoke.md). No prompt rewrite. No
slug switch.
