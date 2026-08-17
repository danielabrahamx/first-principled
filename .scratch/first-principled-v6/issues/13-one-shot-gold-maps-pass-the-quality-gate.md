# 13 - One-shot gold maps pass the quality gate

**Type:** task

**Status:** wontfix

**Blocked by:** [Init uses one-shot with no serial fallback](10-init-uses-one-shot-with-no-serial-fallback.md)

**Related:** [Reality Map quality eval](07-reality-map-quality-eval.md), [Why prod init fails on Nemotron free](09-why-prod-init-fails-on-nemotron-free.md), [Danny scores followability](12-danny-scores-followability.md)

## Question

After init is one-shot with no serial fallback, laptop still failed the
gate on empty OpenRouter choices and battery on layer-chain gaps.
What one-shot prompt or empty-choices change makes live
`eval/map-quality` pass on laptop, recursion, photosynthesis, and
battery?

## What

Ticket 09 left these as one-shot quality gaps, not the prod-init lever.
Do not revert ticket 10's path. Stay on `:free`.

1. **Laptop.** Empty `choices` (`llm.js` throw). A bounded retry is in
   scope if it is the cheapest fix. Prompt tightening is in scope if
   retry is not enough.
2. **Battery.** `validateRealityMap` layer-chain gaps on an otherwise
   parsed one-shot map. Prompt / schema instructions only. No serial
   fallback, no generator rebuild.
3. **Bar.** `node --env-file=.env eval/map-quality/run.js --live` gate
   passes on all four gold concepts. Record a new baseline. LLM-dependent
   rows marked. No secrets.
4. **Tests.** `npm test` and `npx tsc --noEmit` pass.

**Out of this ticket.** Prod deploy. Danny scoring. Paid slug. Serial
path. Uncommitted v2 files.

## Acceptance criteria

- [ ] Live `eval/map-quality` gate passes on laptop, recursion,
      photosynthesis, and battery (or the ticket records the exact
      remaining blocker)
- [ ] New baseline file exists, no secrets
- [ ] Ticket 10's one-shot-default and no-serial-fallback stay in place
- [ ] `npm test` and `npx tsc --noEmit` pass
- [ ] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. Spec section 10
gains a line only if the quality bar itself changed.

## Answer

wontfix 2026-08-17. One-shot gold-gate retune is parked. Generation
rebuild is
[The generator is three stages and nothing else](../../first-principled-v7/issues/05-the-generator-is-three-stages-and-nothing-else.md).
