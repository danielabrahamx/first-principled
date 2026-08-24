# 09 - Poll forwards running stage snapshots

**Type:** task

**Status:** resolved (Cursor, 2026-08-24)

**Blocked by:** none
([Can the poll carry stage snapshots](01-can-the-poll-carry-stage-snapshots.md)
and [How stage products grow in place when Arrange reorders](05-how-stage-products-grow-in-place-when-arrange-reorders.md)
resolved)

**Related:** [Grow stage products in place on the Chapel flowchart](11-grow-stage-products-in-place-on-the-chapel-flowchart.md)

## Question

What is the smallest change so `GET /api/agent-status?job=` forwards
learner-safe Chronology then Epiphanies snapshots while status stays
`running`, without treating a snapshot as success and without throwing
after 202?

## What

AFK. Copy the contract in
[01-stage-snapshots-on-the-poll.md](../research/01-stage-snapshots-on-the-poll.md).
Do not invent a fourth status string. Do not add SSE. Do not ship Chapel
chrome (that is
[Ship the Chapel Dependence flowchart](10-ship-the-chapel-dependence-flowchart.md)).
Client may read `stage` and `snapshot` while looping; it must not stop
the poll on a snapshot. Provenance, prompts, and inner talk stay off
the wire. Windows/PowerShell tests. No prod deploy in this ticket.

## Acceptance criteria

- [x] Running blob and status GET carry `{ status, stage, snapshot }`
      after accepted Chronology and after accepted Epiphanies
- [x] Snapshot writes never throw after 202
- [x] Terminal success and error shapes stay unchanged
- [x] No provenance / prompt / inner talk on the snapshot
- [x] Tests cover the running arm and the "missing blob stays running
      with no snapshot" case
- [x] Map Decisions so far points at this ticket

## Answer

Keep snapshots on the existing `agent-jobs` blob and `GET /api/agent-status?job=`. After accepted Chronology the job record is `{ status: "running", stage: "chronology", snapshot }`. After accepted Epiphanies it is the same with `stage: "epiphanies"` and joints included. Status stays `running` until the existing terminal success or error write. A missing blob stays `{ status: "running" }` with no snapshot. Snapshot `setJSON` uses the same never-throw wrapper as the terminal write. The client already continues the poll on `running` and ignores extra keys. No fourth status string. No SSE. Chapel chrome waits for ticket 10. Hidden fields are stripped in `src/lib/agent/stageSnapshot.js`.

## Docs rule

Pointer from this ticket and the map. Spec wait-state copy waits for
[Grow stage products in place on the Chapel flowchart](11-grow-stage-products-in-place-on-the-chapel-flowchart.md).
