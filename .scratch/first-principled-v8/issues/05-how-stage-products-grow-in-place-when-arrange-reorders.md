# 05 - How stage products grow in place when Arrange reorders

**Type:** grilling

**Status:** resolved

**Blocked by:** none (04 resolved; 01 and 03 already resolved)

**Related:** [Can the poll carry stage snapshots](01-can-the-poll-carry-stage-snapshots.md)

## Question

Chronology is a linear regime chain. Arrange may reorder, drop, collapse,
and promote into Dependence. Grow-in-place was locked. When the snapshot
after Arrange disagrees with the Chronology chain already on screen, do
we morph, wait to draw until Arrange, or grow Chronology then replace?

## What

HITL. Ticket 01 locked keep-snapshots. Ticket 04 kept Chapel geometry
(crown at bottom, fan-in, not hanging cards). Grow-in-place is on that
surface. Ticket 07 may later put Epiphanies on arrows; this ticket still
locks the three-stage morph rule.

Working recommendation: after Chronology, draw regimes as a temporary
spine in the locked orientation, clearly not the finished Tree. After
Epiphanies, attach epiphany cards at the joints (merge-ins). After
checked Arrange, morph edges and membership into the Dependence
flowchart. Do not leave Chronology order on screen as if it were
Dependence. SSE stays out.

## Answer

**Morph**, with a status line, over the existing poll. No SSE.

After accepted Chronology, draw regimes as a temporary spine in the
locked Chapel orientation (crown at the bottom). After accepted
Epiphanies, grow the joints on that spine. Where a joint sits on the
card versus the arrow stays
[Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md).
After checked Arrange, morph order, edges, and membership into the
Dependence flowchart. Dropped regimes leave. Collapsed regimes merge.
Promoted parents appear as fan-in. Chronology order must not remain on
screen as if it were Dependence.

The spine uses the same Chapel look as the finished Tree. Until Arrange
finishes, the status line is `building tree...`. That line then goes
away. Exact card fields stay on
[What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md).

Wait-state transport stays the background poll plus learner-safe
snapshots. The long job has no response stream. Inner talk stays off.
Do not add an open wire as a fallback.

HITL 2026-08-24 (Cursor).

## Acceptance criteria

- [x] One grow rule locked for the three stage boundaries
- [x] Stated whether Chronology-on-screen is labeled as temporary
- [x] SSE is not used as a wait-state fallback
- [x] Map Decisions so far points at this lock

## Docs rule

Pointer from this ticket and the map. Spec wait-state copy waits for
the implementation ticket.
