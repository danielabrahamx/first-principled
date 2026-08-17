# 05 - The generator is three stages and nothing else

**Type:** task

**Status:** ready-for-agent

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
2. Wire the locked prompts and JSON shapes. Mechanical gate:
   `validateRealityMap` / `deriveCheck` require `basis` on epiphany
   nodes only. Invitation card omits observation when `basis` is absent.
3. Delete one-shot and serial paths (`buildOneShotSystemPrompt`,
   per-layer loop, `fastPath` fallback). One path.
4. Tests for the new path and for the deletions (no live key). `npm test`
   and `npx tsc --noEmit`.

**Out of this ticket.** Prod deploy
([Deploy the three-stage Tree](06-deploy-the-three-stage-tree.md)).
Danny scoring. Paid slug. Rewriting `docs/MISSION.md`. Uncommitted v2
files. anti-slop (that is
[Vendor anti-slop](02-vendor-anti-slop.md)).

## Acceptance criteria

- [ ] Init builds maps via three stages; one-shot and serial are gone
- [ ] Mechanical gate matches epiphany-only history
- [ ] Invitation card omits observation when there is no basis
- [ ] Prompts match the ticket 04 lock (no mission sentence, no layer
      count, no STE)
- [ ] `npm test` and `npx tsc --noEmit` pass
- [ ] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. Spec generation
section and CONTEXT.md architecture name the three stages in the same
commit.
