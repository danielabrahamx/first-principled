# 08 - Deploy the tree-only explorer

**Type:** task

**Status:** resolved

**Blocked by:** [Land OpenRouter as the LLM transport](02-land-openrouter-transport.md), [Hide Tutor from the chrome](04-hide-tutor-from-the-chrome.md), [Ship how-it-works into the Tree home](05-ship-how-it-works.md), [Node panel is an invitation card](06-invitation-node-panel.md), [Reality Map quality eval](07-reality-map-quality-eval.md)

**Related:** v5 ticket 05 (prod https://first-principled.netlify.app)

## Question

The tree-only chrome, OpenRouter transport, invitation panel, and map
quality bar are in. What does shipping this destination to prod look like,
including rotating Netlify LLM secrets to OpenRouter without leaking the
key?

## What

1. Set Netlify env `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` from local
   `.env` via `netlify env:set`. Never echo the key.
2. Prod deploy of the tree-only shell.
3. Smoke: empty state + How it works render; one word builds a tree;
   no Tutor toggle; node panel has no learner-state chrome.
4. Key-leak grep clean.

Do not ship a prompt rewrite from fog in this ticket.

## Acceptance criteria

- [x] Prod https://first-principled.netlify.app is the tree-only explorer
- [x] How it works and foundations word box are live
- [x] Tutor toggle is absent
- [x] A real word produces a tree via OpenRouter (or the ticket records
      the exact prod blocker)
- [x] Key-leak grep clean

## Answer

Prod deploy via `& "$env:APPDATA\npm\netlify.cmd" deploy --prod`. Unique
deploy id: `6a821d5637d95139bd35956f`. Live:
https://first-principled.netlify.app. Unique URL:
https://6a821d5637d95139bd35956f--first-principled.netlify.app.

Netlify `LLM_*` rotated from local `.env` into the all context
(OpenRouter Nemotron `:free` at `https://openrouter.ai/api/v1`). The key
was never echoed. Record: [08-prod-smoke.md](../research/08-prod-smoke.md).

Chrome CDP smoke 12/12 against the unique URL
(`[08-live-smoke.mjs](../research/08-live-smoke.mjs)`): How it works and
the foundations word box are live; Tutor toggle and sheet are absent;
node panel is the invitation card.

Exact prod blocker for a followable live tree: OpenRouter Nemotron `:free`
through `POST /api/agent` is flaky. `bit` returned phase active with 1
node / 1 layer in 17.5s. `recursion` and `photosynthesis` returned
`invalid_model_output` (190.9s and 116.4s). No prompt rewrite in this
ticket.

Key-leak grep clean (`08-leak-check.mjs`): 0 hits in `src/`, `netlify/`,
and tracked files.

## Docs rule

AGENTS.md Resume becomes "v6 Destination shipped" in the same commit as
the deploy note on the map.
