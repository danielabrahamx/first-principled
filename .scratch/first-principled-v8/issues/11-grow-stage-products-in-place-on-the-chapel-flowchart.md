# 11 - Grow stage products in place on the Chapel flowchart

**Type:** task

**Status:** resolved (agent, 2026-08-24)

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

## Answer

The wait-state runs on the existing ticket 09 poll with an `onPoll`
hook (`src/api/agent.js`, passed through `src/lib/generation.js`). A
cheap placeholder stands in only until the first accepted snapshot.
After accepted Chronology, `growLayout` (`src/lib/mapview/grow.js`)
draws regimes as a temporary spine on the chapel stage: foundations at
the top, crown at the bottom, one column, cards hold `regime` and
`new_capability`. After accepted Epiphanies, each epiphany grows a
labeled arrow (`because` = result) between its from and to regimes -
never an extra epiphany card; missing or inverted regime ids draw
nothing. The status line is exactly `building tree...` while the job
runs (Arrange has no snapshot, so it goes when the terminal record
lands). The morph after checked Arrange is the page swapping to the
real `treeLayout` render - order, edges, and membership come from the
checked map alone, so dropped regimes leave and instant appear holds.
Snapshots never end the poll; a throwing listener cannot either. An
error record clears every stage product (`finishGeneration`), so no
Chronology survives as a fake finished Tree. No SSE, no motion
choreography, no prod deploy.

Windows `npm test`: 366 pass.

## Acceptance criteria

- [x] Status line `building tree...` until Arrange, then gone
- [x] Chronology-on-screen is visibly temporary, then morphs
- [x] Snapshots do not end the poll
- [x] Error after a snapshot shows the error, not a fake finished Tree
- [x] Windows/PowerShell-tested
- [x] Map Decisions so far points at this ticket

## Docs rule

Wait-state copy in spec and Tree/Stage paragraphs if learner-visible
words change. Same commit as the code.
