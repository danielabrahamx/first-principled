# 11 - Deploy a followable tree

**Type:** task

**Status:** resolved

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

- [x] Prod https://first-principled.netlify.app is running one-shot
      default init (new deploy id)
- [x] A gold word produces a multi-layer tree via OpenRouter (or the
      ticket records the exact prod blocker)
- [x] Chrome still matches ticket 08 (How it works, no Tutor toggle)
- [x] Key-leak grep clean

## Answer

Prod deploy via `& "$env:APPDATA\npm\netlify.cmd" deploy --prod`. Unique
deploy id: `6a822d59151f1ef9bb8cd0e3`. Live:
https://first-principled.netlify.app. Unique URL:
https://6a822d59151f1ef9bb8cd0e3--first-principled.netlify.app.

Netlify `LLM_*` reused from ticket 08. Chrome CDP smoke 12/12 against
the unique URL (`11-live-smoke.mjs`): How it works and the foundations
word box are live; Tutor toggle and sheet are absent.

Exact prod blocker for a followable live tree: OpenRouter Nemotron
`:free` HTTP 429 `free-models-per-day`. `photosynthesis` and `recursion`
both returned `upstream_error` in 4.6s and 3.9s. Local status probe the
same day confirmed HTTP 429. One-shot default is on this deploy; the
gold-word tree did not land because the daily cap rejected the provider
call. No prompt rewrite. Stay on `:free`. Record:
[11-prod-smoke.md](../research/11-prod-smoke.md).

Key-leak grep clean (`08-leak-check.mjs`): 0 hits in `src/`, `netlify/`,
and tracked files.

## Docs rule

AGENTS.md Resume and CONTEXT.md Frontier point at this deploy in the
same commit as the smoke note on the map.
