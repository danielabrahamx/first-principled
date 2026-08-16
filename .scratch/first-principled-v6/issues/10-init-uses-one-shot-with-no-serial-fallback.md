# 10 - Init uses one-shot with no serial fallback

**Type:** task

**Status:** resolved

**Blocked by:** [Why prod init fails on Nemotron free](09-why-prod-init-fails-on-nemotron-free.md)

**Related:** [Reality Map quality eval](07-reality-map-quality-eval.md), [Deploy a followable tree](11-deploy-a-followable-tree.md), [Danny scores followability](12-danny-scores-followability.md), [One-shot gold maps pass the quality gate](13-one-shot-gold-maps-pass-the-quality-gate.md)

## Question

Research named the lever. What mechanical change makes `POST /api/agent`
init use the one-shot path ticket 01 measured, instead of serial
per-layer generation that exhausts repairs into `invalid_model_output`?

## What

Apply the ticket 09 recommendation. Do not re-research. Do not retune
`buildOneShotSystemPrompt`. Stay on `:free`.

1. `src/lib/generation.js` `generateTree`: always pass `fastPath: true`.
   Stop gating one-shot on `wantsFastPath()` / `?fast=1`.
2. `src/lib/agent/orchestrator.js` `handleInit`: default one-shot when
   the client omits the flag (`fastPath: request.fastPath !== false`).
3. `src/lib/agent/realityMap.js` `generateRealityMap`: when the one-shot
   attempt fails with `kind: "invalid"` or `"error"`, return that result.
   Do not fall through to serial.
4. Tests for those three behaviors (no live key). `npm test` and
   `npx tsc --noEmit`.

**Out of this ticket.** Prompt rewrite. Empty-choices retry. Battery
layer-chain gaps (that is
[One-shot gold maps pass the quality gate](13-one-shot-gold-maps-pass-the-quality-gate.md)).
Paid slug. Prod deploy
([Deploy a followable tree](11-deploy-a-followable-tree.md)). Danny
scoring. Generator rebuild. Uncommitted v2 files.

If a live key is available, a local init without `fastPath` for
`photosynthesis` should return a multi-layer map. If the `:free` daily
cap 429s, record that blocker; do not skip the code change.

## Acceptance criteria

- [x] Init without `?fast=1` / without a client `fastPath` flag uses
      one-shot
- [x] One-shot `invalid` or `error` does not fall through to serial
- [x] No prompt rewrite and no paid-slug switch
- [x] `npm test` and `npx tsc --noEmit` pass
- [x] Key-leak grep clean

## Answer

Init without a client flag uses one-shot: `generateTree` always sends
`fastPath: true`, and `handleInit` defaults `request.fastPath !== false`.
A one-shot `invalid` or `error` returns as-is; serial is not a fallback.
Stay on `:free`. Local photosynthesis init hit OpenRouter HTTP 429
(daily cap) in 338 ms; the code change still landed. Prod deploy is
[Deploy a followable tree](11-deploy-a-followable-tree.md).

## Docs rule

Pointer from this ticket and the map's Decisions so far. AGENTS.md
Resume and CONTEXT.md Frontier name this ticket in the same commit.
