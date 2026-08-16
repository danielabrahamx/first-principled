# 10 - Retune the one-shot Reality Map prompt

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Why prod init fails on Nemotron free](09-why-prod-init-fails-on-nemotron-free.md)

**Related:** [Reality Map quality eval](07-reality-map-quality-eval.md), [Deploy a followable tree](11-deploy-a-followable-tree.md), [Danny scores followability](12-danny-scores-followability.md)

## Question

Research named the lever. What change to the one-shot Reality Map path
makes live OpenRouter Nemotron `:free` pass the `eval/map-quality` gate
on laptop, recursion, photosynthesis, and battery?

## What

Apply the ticket 09 recommendation. Do not re-research.

1. **Default lever.** One-shot prompt / schema instructions in the
   existing generator (`buildOneShotSystemPrompt` and neighbours). Stay
   on `:free`.
2. **Transport only if 09 named it.** A parse, timeout, or empty-choices
   tweak is in scope only when the findings file points at a specific
   change. No fishing.
3. **Out of this ticket.** Generator rebuild (serial rewrite, new
   architecture). Paid OpenRouter slug. Prod deploy (that is
   [Deploy a followable tree](11-deploy-a-followable-tree.md)). Danny
   scoring (that is
   [Danny scores followability](12-danny-scores-followability.md)).
   Uncommitted v2 files (`gaps.js`, `confidence.js`, `eval/concepts.js`).
4. **Bar.** `node --env-file=.env eval/map-quality/run.js --live` gate
   passes on all four gold concepts. Record the new baseline next to
   ticket 07's file. LLM-dependent rows marked. No secrets.
5. **Tests.** `npm test` and `npx tsc --noEmit` pass.

If 09 declared `:free` unusable, do not guess a prompt patch. Close this
ticket as blocked/wontfix and graduate the paid-slug fog instead.

## Acceptance criteria

- [ ] Live `eval/map-quality` gate passes on laptop, recursion,
      photosynthesis, and battery (or the ticket records that 09 ruled
      `:free` unusable)
- [ ] New baseline file exists, no secrets
- [ ] No generator rebuild and no paid-slug switch unless 09 required it
- [ ] `npm test` and `npx tsc --noEmit` pass
- [ ] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. Prompt-adjacent
comments in `src/` only if the code change needs them. Spec section 10
gains a line only if the quality bar itself changed.
