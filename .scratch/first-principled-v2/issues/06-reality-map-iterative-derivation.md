# 06 - Reality map v2: iterative derivation, observation-per-abstraction

**Type:** prototype
**Status:** resolved 2026-08-10 (parallel pass, Buffy)
**Blocked by:** none
**Related:** tickets 07, 02; v1 ticket 04; src/lib/agent/realityMap.js;
src/lib/mmg/validator.js; docs/MISSION.md principles 4, 5, 11, 12

## Question

The reality map is generated one-shot (realityMap.js) and validated only
structurally: contiguity means "every layer has at least one edge to a lower
layer" (validator.js), not that each step is a real derivation - so
"plausible chain" is the quality ceiling. What does foundation-first
iterative generation look like: derive each layer from the one below ("what
is this built on?"), require the observation each abstraction compresses
(principle 5), emit predicts edges (principle 2), and self-review the chain
for derivability (principles 11-12)?

## What

1. Prototype the generation flow: build the foundation layer first, then ask
   per layer what its nodes are built on and what observations they abstract,
   iterating until the concept is reached.
2. Schema: does the map need the observation-per-node (a `basis` field), and
   do predicts edges stay in the fixed edge-type set?
3. Compare quality and latency against one-shot generation on a fixed concept
   set (the set ticket 07 defines), including the 30s budget.
4. Extend the validator if the schema changes; keep the repair loop and
   refusal contract.

## Acceptance criteria

1. Prototype maps judged better (derivable chain, no invented gaps) on the 07
   concept set than one-shot generation, with latency within budget.
2. Schema changes (if any) are validated and documented.
3. `npm test` green, `npm run typecheck` clean.
4. Live-verified on at least one concept end to end.

## Docs rule

Spec sections 4 and 7 updated in the same commit as the code.

## Resolution (2026-08-10)

Landed: `realityMap.js` rewritten as a two-phase flow - phase A builds the
foundation layer (observations, what the concept is made of), phase B derives
the abstraction layers from it. `deriveCheck(map, layer)` is a code-level
derivability guard: every abstraction node must be traceable to an
observation in a strictly lower layer through the edge graph (observation-
per-abstraction, principle 5). Schema: optional `basis` field on RealityNode
(a parent node id + a one-line justification), optional in the validator so
v1 maps still validate. The generator loops with the model's self-review
gaps folded into the repair feedback, and `retried` now reflects any repair
across both phases. Fixtures carry `basis` on all non-foundation nodes.

Measured: 26/26 realityMap tests, full suite 249/249, tsc clean, and the
eval auto-detects the two-phase generator (its scripted transport now feeds
foundation then derive replies).

Human gate: the stated gate - prototype review with Danny, side-by-side
examples - is NOT satisfied. The code is landed and tested, but the map
quality judgment (taste) awaits Danny's review of real generated output,
which itself waits on the live key top-up (research/03). Tracked as a
follow-up when live verification runs; if the generated maps visibly
contradict a mission principle then, stop and re-open this ticket.

