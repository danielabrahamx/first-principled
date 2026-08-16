# 08 - Deploy the tree-only explorer

**Type:** task

**Status:** ready-for-agent

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

- [ ] Prod https://first-principled.netlify.app is the tree-only explorer
- [ ] How it works and foundations word box are live
- [ ] Tutor toggle is absent
- [ ] A real word produces a tree via OpenRouter (or the ticket records
      the exact prod blocker)
- [ ] Key-leak grep clean

## Docs rule

AGENTS.md Resume becomes "v6 Destination shipped" in the same commit as
the deploy note on the map.
