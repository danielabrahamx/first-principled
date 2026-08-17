# 04 - Prototype the three stage prompts

**Type:** prototype

**Status:** resolved

**Blocked by:** none

**Related:** [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)

## Question

What three short prompts and JSON shapes should chronology, epiphanies,
and arrange use, such that ticket 05 can wire them without inventing
copy?

## What

HITL. Raise fidelity with a cheap artifact Danny can react to. Invoke
the prototype skill. Do not ship generator code in this ticket.

1. Three system prompts, each one job. No mission sentence. No
   prescribed layer count. No STE block. No "another model" language.
2. JSON contracts:
   - Chronology: a short chain of target-specific capability regimes.
     Physical ancestry is the default spine; technical and conceptual
     ancestry are legal. It is not discovery history or the future trunk.
   - Epiphanies: results that warrant joints between regimes, with
     honest history including gradual, no-single-joint, and unknown cases.
   - Arrange: a dependence Reality Map that may reorder, drop, collapse,
     and promote. Observation records require an explicit `EPIPHANY` role.
     Hidden provenance makes use and discard visible.
3. One battery example showing dummy JSON through the three shapes, the
   hidden diagnostic payload, and the Tree the learner would see.
4. Artifact lives in
   `.scratch/first-principled-v7/research/04-stage-prompts/`.
5. Grill until Danny locks the copy. Ticket 05 uses that lock as-is.
6. One pass per Stage. No LLM repair loop. If the four-topic comparison
   shows Chronology capture or Chronology disregard, reject the funnel
   rather than adding prompt machinery.

**Out of this ticket.** `src/` generator rewrite. Live LLM calls.
Provider switch. Deploy.

## Answer

Danny locked the copy on 2026-08-17: use
[stage-prompts.md](../research/04-stage-prompts/stage-prompts.md) as-is
for ticket 05. Iterate after the four-topic KEEP/KILL test, not by
prompt retune first. Architecture lock:
[Round 1 lock](../research/04-stage-prompts/round-1-verdict.md).

## Acceptance criteria

- [x] Artifact exists: three prompts, three JSON shapes, one worked
      example
- [x] Danny locked the copy (HITL). The agent did not stand in for him.
- [x] Mission sentence, layer-count, and STE are absent from the prompts
- [x] No secrets

## Docs rule

Pointer from this ticket and the map's Decisions so far. Locked prompts
are the ticket 05 input; no spec change until they ship.
