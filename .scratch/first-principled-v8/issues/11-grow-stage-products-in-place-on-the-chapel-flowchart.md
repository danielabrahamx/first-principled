# 11 - Grow stage products in place on the Chapel flowchart

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Poll forwards running stage snapshots](09-poll-forwards-running-stage-snapshots.md),
[Ship the Chapel Dependence flowchart](10-ship-the-chapel-dependence-flowchart.md)

**Related:** [How stage products grow in place when Arrange reorders](05-how-stage-products-grow-in-place-when-arrange-reorders.md)

## Question

What wait-state draws Chronology then labeled Epiphany arrows on the
Chapel surface, then morphs into the checked Dependence Tree, with
status line `building tree...` until Arrange?

## What

AFK. Execute the ticket 05 morph rule on the ticket 09 poll. After
accepted Chronology, draw regimes as a temporary spine (Chapel
orientation). After accepted Epiphanies, grow labeled arrows
(`because`), not extra epiphany cards. After checked Arrange, morph
order, edges, and membership; dropped regimes leave. Keep a cheap
placeholder only until the first snapshot. No SSE. Instant appear, no
motion choreography. If the job later errors, the existing terminal
error blob wins; do not leave Chronology on screen as a finished Tree.
No prod deploy in this ticket.

## Acceptance criteria

- [ ] Status line `building tree...` until Arrange, then gone
- [ ] Chronology-on-screen is visibly temporary, then morphs
- [ ] Snapshots do not end the poll
- [ ] Error after a snapshot shows the error, not a fake finished Tree
- [ ] Windows/PowerShell-tested
- [ ] Map Decisions so far points at this ticket

## Docs rule

Wait-state copy in spec and Tree/Stage paragraphs if learner-visible
words change. Same commit as the code.
