# 06 - Deploy the three-stage Tree

**Type:** task

**Status:** ready-for-agent

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

- [ ] Prod deploy SHA recorded
- [ ] Prod still OpenRouter
- [ ] Init on prod is the three-stage path (or the exact `:free` 429
      blocker is recorded)
- [ ] Learner-facing responses contain no intermediate or provenance data
- [ ] Four-topic diagnostic bundles can be captured without exposing them
      to the learner
- [ ] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. AGENTS.md
Resume and CONTEXT.md Frontier name the deploy in the same commit.
