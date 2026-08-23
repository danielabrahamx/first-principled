# 05 - How stage products grow in place when Arrange reorders

**Type:** grilling

**Status:** ready-for-human

**Blocked by:** [How a Dependence DAG becomes that flowchart](03-how-a-dependence-dag-becomes-that-flowchart.md)

**Related:** [Can the poll carry stage snapshots](01-can-the-poll-carry-stage-snapshots.md)

## Question

Chronology is a linear regime chain. Arrange may reorder, drop, collapse,
and promote into Dependence. Grow-in-place was locked. When the snapshot
after Arrange disagrees with the Chronology chain already on screen, do
we morph, wait to draw until Arrange, or grow Chronology then replace?

## What

HITL. Ticket 01 locked keep-snapshots. This ticket still waits on the
flowchart spine (ticket 03).

Working recommendation: after Chronology, draw regimes as a temporary
spine in the locked orientation, clearly not the finished Tree. After
Epiphanies, attach epiphany cards at the joints (merge-ins). After
checked Arrange, morph edges and membership into the Dependence
flowchart. Do not leave Chronology order on screen as if it were
Dependence. SSE stays out.

## Acceptance criteria

- [ ] One grow rule locked for the three stage boundaries
- [ ] Stated whether Chronology-on-screen is labeled as temporary
- [ ] SSE is not used as a wait-state fallback
- [ ] Map Decisions so far points at this lock

## Docs rule

Pointer from this ticket and the map. Spec wait-state copy waits for
the implementation ticket.
