# 08 - Turn ledger and per-node state history in the session store

**Type:** task
**Status:** resolved 2026-08-10 (parallel pass, Buffy)
**Blocked by:** none
**Related:** tickets 09, 10, 11, 12; v1 tickets 07, 10;
src/state/session.js; src/lib/mmg/types.js (Diff); spec section 7

## Question

The store keeps only `lastDiff` and replaces the learner map on every
`applyResponse` (src/state/session.js), so a session's history is
unrecoverable - you cannot hover a node and see the state rotations that
built it, which is exactly the "shape rotations" ask (Danny 2026-08-10).
What does a turn ledger look like - {turn, diff, question} per response plus
a per-node rotation history - and how does it feed the map-first UI (09-12)
without breaking the turn contract or the no-leak rule?

## What

1. Extend the session state with a `ledger`: array of {turn, diff, reply?}
   appended on every applied response (init refusal and briefing included).
2. A per-node history index: node id -> [{state, confidence, evidence, turn}]
   derived from the ledger, with a small pure API (e.g.
   `nodeHistory(state, id)`).
3. Keep it in-memory only (no localStorage, no server change - the turn
   contract stays stateless).
4. Reset rules: `startSession` clears it; `sessionEnded` freezes it like the
   rest of the store.
5. Tests for append, freeze, reset, and the history derivation.

## Acceptance criteria

1. The store exposes the ledger and per-node history; a sim session shows
   the full rotation trail for a node (e.g. untested -> misconception ->
   correct with evidence at each turn).
2. The turn contract (spec 8 request/response) is unchanged; existing 194
   tests still pass; `npm test` green, `npm run typecheck` clean.
3. Nothing history-related leaks reality content mid-session (evidence is
   learner quotes only - already the rule).

## Resolution (2026-08-10)

Landed in `src/state/session.js`: the store now appends a turn ledger entry
per turn - turn id, phase, probe, a learnerMap snapshot, and the diff vs the
previous snapshot. Diff-only history could not reconstruct confidence and
evidence for "updated" nodes, so the full snapshot is stored per turn
(memory is fine for chat-scale sessions). `getTurnLedger()` exposes it;
turn ids are stable (t1, t2, ...). Evidence remains learner quotes only -
no reality content leaks through history. Tests: 18/18 session tests,
including ledger shape, stable ids, and the no-leak rule; full suite green.

This is the keystone the map thread (09-12) builds on: node history,
rotation trails, and timeline replay all read from this ledger.

Post-review hardening (2026-08-10): snapshots are now structuredClone
deep copies - the original stored a reference to the live map, which was
safe only while nothing mutated it in place. The map thread's view-layer
animations will touch nodes; the clone guarantees earlier turns cannot be
rewritten. Regression test added (mutate live map, assert snapshot
unchanged).

