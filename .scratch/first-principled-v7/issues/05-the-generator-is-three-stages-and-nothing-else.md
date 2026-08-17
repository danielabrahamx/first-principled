# 05 - The generator is three stages and nothing else

**Type:** task

**Status:** resolved

**Blocked by:** [Can one background agent finish three serial LLM calls](01-can-one-background-agent-finish-three-serial-llm-calls.md), [LLM_PROVIDER is a one-var switch](03-llm-provider-is-a-one-var-switch.md), [Prototype the three stage prompts](04-prototype-the-three-stage-prompts.md)

**Related:** [Deploy the three-stage Tree](06-deploy-the-three-stage-tree.md), [Vendor anti-slop](02-vendor-anti-slop.md)

## Question

What code change makes init build a Reality Map by chronology, then
epiphanies, then arrange, deletes one-shot and serial, and lets the
mechanical gate match epiphany-only history?

## What

Do not re-research. Use ticket 01's orchestration recommendation and
ticket 04's locked prompts. Stay on the ticket 03 provider switch.

Settled by
[Can one background agent finish three serial LLM calls](01-can-one-background-agent-finish-three-serial-llm-calls.md):
one `POST /api/agent`; three serial `callChatCompletion` in that job;
per-call abort stays 240000 ms; raise `src/api/agent.js` `deadlineMs` to
840000; never throw after 202; no in-job LLM retries; do not
client-chain.

1. `generateRealityMap` runs three `callChatCompletion` stages in order.
   Learner-facing init remains one `POST /api/agent`. Raise the client
   poll deadline as above.
2. Wire the prompts and contracts from
   [Prototype the three stage prompts](04-prototype-the-three-stage-prompts.md)
   without rewriting their copy:
   - Chronology emits target-specific capability regimes.
   - Epiphanies emit warranted joints and honest history.
   - Arrange may reorder, drop, collapse, and promote. It emits
     `{ map, provenance }`.
3. Extend the Reality Map contract with explicit node roles:
   `DOMAIN`, `EPIPHANY`, and `STRUCTURAL`. `basis` and any observation in
   `combines` are legal only on `EPIPHANY`; every `EPIPHANY` has `basis`.
   Preserve the existing learner-facing `basis` shape by normalizing
   retained Stage 2 history without inventing new facts.
4. Extend the mechanical gate to require one crown, a connected acyclic
   map, a declared contiguous Foundation-to-crown trunk, non-empty edge
   explanations, valid provenance references, and an explicit use-or-drop
   accounting for every Stage 1 and Stage 2 ID. Extra parents remain legal
   for convergent support.
5. Keep Chronology, raw Epiphanies, prompts, provenance, and discarded IDs
   server-side. Only the checked `map` crosses the learner-facing API
   boundary. Keep diagnostics available to tests and the four-topic
   benchmark.
6. Delete one-shot, serial-per-layer, fallback, and LLM repair paths
   (`buildOneShotSystemPrompt`, per-layer loop, `fastPath`, and repair
   calls). There is one three-call path and no fourth semantic job.
7. Tests cover each Stage contract, role-gated history, provenance,
   use-or-drop accounting, learner-payload stripping, and removal of the
   old paths (no live key). Run `npm test` and `npx tsc --noEmit`.

**Out of this ticket.** Prod deploy
([Deploy the three-stage Tree](06-deploy-the-three-stage-tree.md)).
Danny scoring. Paid slug. Rewriting `docs/MISSION.md`. Uncommitted v2
files. anti-slop (that is
[Vendor anti-slop](02-vendor-anti-slop.md)).

## Acceptance criteria

- [x] Init builds maps via three stages; one-shot and serial are gone
- [x] No LLM retry, repair, fallback, or fourth semantic call remains
- [x] Mechanical gate matches explicit epiphany-only history
- [x] Arrange output has checked trunk, edge reasons, and provenance
- [x] Every Stage input ID is used or carries a discard reason
- [x] Learner payload contains the checked map only
- [x] Invitation card omits observation when there is no basis
- [x] Prompts match the ticket 04 lock (no mission sentence, no layer
      count, no STE)
- [x] `npm test` and `npx tsc --noEmit` pass
- [x] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. Spec generation
section and CONTEXT.md architecture name the three stages in the same
commit.

## Resolution

`src/lib/agent/realityMap.js` now runs the locked Chronology, Epiphanies,
and Arrange prompts exactly once. `arrangeCheck` gates explicit roles,
Epiphany-only history, one crown, connected acyclic structure, the
Foundation-to-crown trunk, edge reasons, provenance, and complete
use-or-drop accounting. The orchestrator returns only `map`; diagnostics
remain on the server-side generation result for tests and the four-topic
benchmark. The old one-shot, per-layer, retry, repair, fallback, and
`fastPath` paths are deleted.

The learner poll deadline is 840000 ms. Invitation cards omit the
observation section when a node has no `basis`. The generation section in
the spec and the architecture block in `CONTEXT.md` name the same three
Stages.
