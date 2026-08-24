# 12 - Deploy the Chapel Tree

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Grow stage products in place on the Chapel flowchart](11-grow-stage-products-in-place-on-the-chapel-flowchart.md)

**Related:** [Ship the Chapel Dependence flowchart](10-ship-the-chapel-dependence-flowchart.md)

## Question

What prod deploy puts Chapel geometry, arrow Epiphanies, hover, and
morph wait-state on the live Tree, with prod still OpenRouter?

## What

AFK. `netlify deploy --prod` after ticket 11. Prod `LLM_*` stay
OpenRouter. Do not set Netlify `LLM_PROVIDER=deepseek`. Do not retune
v7 prompts. Chrome smoke: invitation, poll, `building tree...`,
finished Chapel Tree, hover on a labeled arrow when history is known.
If `:free` 429s on a smoke word, record it; do not switch slug here.

## Acceptance criteria

- [ ] Prod deploy SHA recorded
- [ ] Prod still OpenRouter
- [ ] Learner-facing init still has no provenance / prompts / inner talk
- [ ] Key-leak grep clean
- [ ] Map Decisions so far points at this ticket

## Docs rule

Pointer from this ticket and the map. AGENTS resume points at v7
KEEP/KILL plus this deploy SHA.
