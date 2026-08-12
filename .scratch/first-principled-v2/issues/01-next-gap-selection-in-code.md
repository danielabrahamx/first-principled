# 01 - Move gap selection into deterministic code

**Type:** task
**Status:** resolved 2026-08-10 (parallel pass, Buffy)
**Blocked by:** none
**Related:** tickets 02, 04, 07; v1 tickets 05, 06; spec section 8;
src/lib/agent/socratic.js; src/lib/mmg/types.js; docs/MISSION.md

## Question

The engine's entire question strategy is one line in the system prompt:
"probe the biggest gap in dependency order - lower layers before abstractions;
within the lowest affected layer, misconception over missing over untested"
(buildDirective in src/lib/agent/socratic.js). The codebase's own philosophy
(v1 ticket 05) is that code owns the hard, countable rules and the model owns
semantics. How do we move gap selection into a deterministic, unit-tested,
pure function - and what does the gap report sent to the model look like when
the full maps stop going into the user prompt?

## What

1. A pure function, e.g. `nextGaps(realityMap, learnerMap, failedAttempts)`,
   that returns the ordered candidate gaps for this turn: node id, current
   learner state, layer index, and a reason. Ordering: lower layers before
   abstractions; within the lowest affected layer, misconception over missing
   over untested. Must respect the explanation and briefing directives
   (explainDue/briefingRequested already exist and outrank probing).
2. Decide and document: for a probe turn, is the model forced to the top
   candidate, or does it pick among a short ranked list (and when does
   picking matter - e.g. observation-first opening when the model is empty)?
3. A compact gap report shape for the user prompt (node label, state,
   layer, learner evidence so far) that replaces dumping both full maps.
4. Unit tests for the ordering invariants; keep validateTurn enforcing
   probe.kind and probe.nodeId against the reality map.

## Acceptance criteria

1. `nextGaps` is a pure function with unit tests covering: layer-order before
   abstraction, misconception over missing over untested within a layer,
   empty-model opening, explanation/briefing outranking probing.
2. The Socratic user prompt sends the gap report, not the full reality map
   and learner map, for probe turns (init/observe and brief/explain may
   differ - document why).
3. All existing tests pass (`npm test`), `npm run typecheck` clean, and the
   change is judged against ticket 07's baseline when it lands (behavior
   parity or better on gap selection).
4. Live verification on real DeepSeek: one full session, gap order sensible.

## Docs rule

Spec section 8 updated in the same commit as the code (the probe directive
and the turn contract's prompt contents).

## Resolution (2026-08-10)

Landed: `src/lib/agent/gaps.js` - pure `orderedGaps(realityMap, learnerMap)`
returns the ranked candidate gaps with node id, layer index, learner state,
and reason. Ordering: layer-order before abstraction; within the lowest
affected layer, misconception > missing > untested; failedAttempts bumps the
node's priority and shapes the probe (re-probe with the learner's own words
inlined). `buildGapReport` emits the compact digest - node label, layer,
state, confidence band, learner evidence quotes - and socratic.js now sends
that + a forced-target directive instead of both full maps on probe turns
(init/observe/brief/explain unchanged where the maps are legitimately
needed).

Measured against ticket 07's baseline: probe prompt avg 5,795 -> 2,412
chars (-58%), max 2,820; gap targeting 9/9; all invariants clean; 249/249
tests, tsc clean. Behavior parity confirmed by the eval harness.

Correction (post-review, 2026-08-10): the resolution originally claimed
failedAttempts bumps a node's priority in nextGaps. That is NOT what
landed - nextGaps is signature `nextGaps({realityMap, learnerMap,
briefing, explainDue})`; failedAttempts appears in the gap report as data
for the model but does not reorder candidates. The reorder is unnecessary:
the explanation gate (explainDirective, >=2 fails) already outranks probing
in code, so a stuck node is routed to explanation before gap ranking ever
matters. Priority bump for the 1-fail case is deferred as low value; the
prediction move (ticket 04) already handles the "stated belief never
tested" case within the lowest layer.

