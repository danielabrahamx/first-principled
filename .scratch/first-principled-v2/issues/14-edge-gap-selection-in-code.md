# 14 - Edge gap selection in code + optional probe.edge hint

**Type:** task
**Status:** open (unclaimed; unblocked 2026-08-10 - 02 resolved)
**Blocked by:** 02 (contract text, resolved 2026-08-10), 13 (recommendation, resolved)
**Related:** tickets 01, 02, 13; spec section 8; src/lib/agent/gaps.js;
src/lib/agent/socratic.js; src/lib/mmg/types.js

## Question

Ticket 13 resolved the rule: an edge gap outranks a node gap only when both
endpoint nodes are at or above confidence 0.6 and the edge itself is
untested or misconceived. How does this become deterministic code, and what
does a probe of an edge look like on the wire?

## What

1. Extend `orderedGaps` (or add `edgeGaps`) in gaps.js: walk learner edges,
   apply the 13 outrank rule (endpoint confidence >= 0.6, edge state in
   untested/misconception, never above foundation layer), and merge them
   into the ranked candidate list behind same-layer node gaps.
2. Add the optional `probe.edge` hint {source, target} to the probe
   contract; validateTurn checks both ids exist in the learner map and each
   exists in the reality map when the hint is present (absent = node-only,
   unchanged).
3. The gap report and the directive carry the edge target so the model
   phrases a question against the connection, not just one endpoint.
4. The Socratic reply-shape example in the prompt grows the optional hint.

## Acceptance criteria

1. `edgeGaps` pure and unit-tested: outrank rule, foundation-layer
   exclusion, merge order behind node gaps.
2. validateTurn accepts and enforces the optional hint without breaking
   node-only turns (all existing tests stay green).
3. `npm test` green, `npm run typecheck` clean; the eval shows behavior
   parity or better.
4. No-leak preserved: the probe question may reference the connection, never
   quote the reality description.

## Docs rule

Spec section 8 (turn contract) updated in the same commit.

## Human gate

None; if the merged gap order visibly changes sessions in a way that
contradicts a mission principle, stop and ask Danny.
