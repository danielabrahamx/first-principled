# 11 - Deploy a followable tree

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Init uses one-shot with no serial fallback](10-init-uses-one-shot-with-no-serial-fallback.md)

**Related:** [Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md), [Danny scores followability](12-danny-scores-followability.md)

## Question

Ticket 10 defaulted init to one-shot with no serial fallback. What does
shipping that path to prod look like, such that a real word returns a
followable tree rather than a 1-node serial map or `invalid_model_output`?

## What

1. Prod deploy of the one-shot-default init path. Reuse Netlify `LLM_*`
   already rotated in
   [Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md).
   Do not echo the key.
2. Smoke: empty state and How it works still render; Tutor toggle still
   absent; one gold word (`recursion` or `photosynthesis`) returns more
   than one layer and does not return `invalid_model_output`.
3. Record the deploy id and smoke table. Key-leak grep clean.

Do not retune the prompt in this ticket. If prod still fails, record the
exact blocker; do not start a second prompt rewrite here.

## Acceptance criteria

- [ ] Prod https://first-principled.netlify.app is running one-shot
      default init (new deploy id)
- [ ] A gold word produces a multi-layer tree via OpenRouter (or the
      ticket records the exact prod blocker)
- [ ] Chrome still matches ticket 08 (How it works, no Tutor toggle)
- [ ] Key-leak grep clean

## Docs rule

AGENTS.md Resume and CONTEXT.md Frontier point at this deploy in the
same commit as the smoke note on the map.
