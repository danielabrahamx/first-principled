# 04 - Prototype the three stage prompts

**Type:** prototype

**Status:** ready-for-agent

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
   - Chronology: sequential time chain of what came before.
   - Epiphanies: the shifts that made each next period possible, with
     the observation records that belong on those nodes.
   - Arrange: a dependence Reality Map (layers, nodes, edges). `basis`
     only on epiphany nodes.
3. One worked example (pick one gold word) showing dummy JSON through
   the three shapes, then the Tree the learner would see.
4. Artifact lives in
   `.scratch/first-principled-v7/research/04-stage-prompts/`.
5. Grill until Danny locks the copy. Ticket 05 uses that lock as-is.

**Out of this ticket.** `src/` generator rewrite. Live LLM calls.
Provider switch. Deploy.

## Acceptance criteria

- [ ] Artifact exists: three prompts, three JSON shapes, one worked
      example
- [ ] Danny locked the copy (HITL). The agent did not stand in for him.
- [ ] Mission sentence, layer-count, and STE are absent from the prompts
- [ ] No secrets

## Docs rule

Pointer from this ticket and the map's Decisions so far. Locked prompts
are the ticket 05 input; no spec change until they ship.
