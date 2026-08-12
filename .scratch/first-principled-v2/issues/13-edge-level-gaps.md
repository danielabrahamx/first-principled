# 13 - Edge-level gaps: probe learner edges, not just nodes

**Type:** research (AFK)
**Status:** resolved 2026-08-10 (Buffy)
**Blocked by:** 01 (resolved), 08 (resolved)
**Related:** tickets 01, 02; spec section 8; src/lib/agent/gaps.js;
src/lib/mmg/types.js

## Question

The engine probes nodes only - but learner edges carry state and evidence
just like nodes (v1 schema: an edge can hold a misconception, e.g. "an
electron is a small part of a wire" linking two otherwise-correct nodes).
When does an edge misconception actually matter for learning, and how should
the engine probe it? The gap selector (ticket 01) walks nodes; edge gaps are
invisible to it.

## What

1. Survey the MMG schema and v1 fixtures: which edge states/evidence exist in
   practice, and how often an edge misconception is the real blocker vs. its
   endpoint nodes.
2. Decide the rule: when does an edge gap outrank a node gap? (Candidate:
   when both endpoint nodes are at or above a confidence threshold and the
   edge itself is untested or misconceived - the learner has the pieces but
   the connection is wrong.)
3. Specify how a probe targets an edge: does the model phrase a question
   against edge `source->target` with `probe.nodeId` pointing at one
   endpoint plus an edge hint, or does the probe contract grow an edge
   target? Keep validateTurn's enforcement story coherent.
4. Surface the finding for the map-first UI (tickets 10/11): should edge
   history render on the map, and where?

## Acceptance criteria

1. A written recommendation (this ticket's resolution) with the outrank rule,
   probe targeting shape, and UI implication - grounded in the actual
   fixtures, not speculation.
2. If the recommendation touches the schema or probe contract, it lands as a
   follow-up ticket (or waits for 02) rather than editing engine code here.

## Docs rule

None until the recommendation is adopted; then spec section 8 in the same
commit as the adopting ticket.

## Resolution (2026-08-10)

Survey (grounded in src/lib/mmg/types.js, src/lib/mmg/fixtures.js):
learner edges carry full state + confidence + evidence (LearnerEdge mirrors
RealityEdge by endpoints). The laptop fixture contains exactly one
misconceived learner edge - n-app -> n-electricity ("apps just run on the
power, no middleman") - and notably its endpoint n-app is also misconceived:
edge misconceptions usually ride on a node misconception at one endpoint.
The pure edge-gap case (both endpoints correct, edge wrong) is absent from
the fixture but the schema allows it; the reality map's built-on edges
(n-circuit -> n-transistor, n-logic-gate -> n-circuit, n-os -> n-bit) are
the natural candidates for such a gap. A second fixture edge
(n-app -> n-electricity) is not a reality edge at all - the learner inferred
a wrong shortcut between real nodes, which is exactly the failure mode that
matters.

Recommendation:

1. Outrank rule (code-ownable, consistent with "code owns hard rules"): an
   edge gap outranks a node gap ONLY when both endpoint nodes are at or
   above confidence 0.6 (the pieces are held) AND the edge itself is
   untested or misconceived (the connection is wrong). Node gaps always
   dominate below that; dependency order is node-first. An edge gap never
   outranks a foundation-layer node gap.
2. Probe targeting: do NOT grow the probe contract with a required field.
   Keep probe.nodeId pointing at the derived endpoint (the target of a
   built-on relation); add an OPTIONAL probe.edge hint {source, target},
   validated by validateTurn (both ids must exist in the learner map; each
   must exist in the reality map). Absent the hint, node-only semantics are
   unchanged - backward compatible.
3. UI (tickets 10/11): yes, edge history renders. The learner-grid edges
   are already SVG paths with state classes - give them the same hover
   popover as nodes (edge rotation trail from the ledger), and the node
   panel already lists linked neighbors with their state; extend it to the
   edge's own trail. A `edgeHistory` mirror of `nodeHistory` reads the same
   ledger snapshots (edges are stored per turn).

Adoption path: touches the probe contract (optional edge hint) and
validateTurn, so per the AC it lands as a follow-up ticket blocked by 02
(02 owns the contract text) rather than editing engine code here. Created:
issue 14 - Edge gap selection in code + optional probe.edge hint.

