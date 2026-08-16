# 07 - Reality Map quality eval

**Type:** task

**Status:** resolved

**Blocked by:** [Land OpenRouter as the LLM transport](02-land-openrouter-transport.md)

**Related:** [OpenRouter Nemotron can serve the Reality Map contract](01-openrouter-nemotron-map-contract.md), [Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md)

## Question

Structural validators already pass weak chains. The destination says
generation quality is measured. What is a scored, runnable eval of Reality
Map quality (not tutor questions) against the gold maps for laptop,
recursion, photosynthesis, and battery, that Danny can also judge as
"would I follow this"?

## What

Do not extend the parked v2 tutor harness as the product bar. Build a map
quality eval under `.scratch/first-principled-v6/` or a clearly named
`eval/map-quality` path that this effort owns. Leave uncommitted
`eval/concepts.js` / tutor scorers untouched.

1. **Automated gate.** Crown reached, contiguity, deriveCheck, dependence
   edges present (`built-on` / `depends-on` / `abstraction-of`), no
   skipped layer. Score live Nemotron maps against the gold fixtures
   where overlap is checkable.
2. **Rubric.** Written so a later session judges the same way: followable
   foundations, no invented history, relationships between layers are
   the point, would Danny open a rabbit hole from a node.
3. **Baseline.** Run live against the landed OpenRouter model. Record
   scores in `research/07-map-quality-baseline.md`. Mark LLM-dependent
   rows clearly.
4. **CI.** Deterministic parts run without a key. Live path is opt-in
   (`node --env-file=.env ...`).

## Acceptance criteria

- [x] Harness runs locally with a single command
- [x] Rubric is written down
- [x] Baseline against the landed model is recorded (or the exact blocker)
- [x] Tutor-question scorers are not the bar this ticket reports
- [x] No secrets in the baseline file

## Answer

Map quality is `eval/map-quality`, not the parked tutor harness.

- Gate: schema, deriveCheck, crown reached, dependence edges (`built-on` /
  `depends-on` / `abstraction-of`), no skipped layer. Gold overlap is
  label and dependence-pair hit rate when ids differ.
- Rubric: `eval/map-quality/rubric.md` (foundations, invented history,
  relationships, rabbit hole). Danny scores are not in the baseline.
- Commands: `npm run eval:map-quality` (no key). Live:
  `node --env-file=.env eval/map-quality/run.js --live`.
- Live Nemotron `:free` baseline (LLM-dependent): recursion and
  photosynthesis pass the gate with low gold overlap; battery fails
  contiguity; laptop returned no choices. Record:
  [07-map-quality-baseline.md](../research/07-map-quality-baseline.md).

## Docs rule

Pointer from this ticket and the map's Decisions so far. Spec section 10
(metrics) gains a Reality Map quality line in the same commit if the
harness lives in-repo.
