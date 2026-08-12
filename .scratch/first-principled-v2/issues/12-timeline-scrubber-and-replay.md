# 12 - Timeline scrubber and shape-rotation replay

**Type:** prototype
**Status:** ready-for-agent
**Blocked by:** 08
**Related:** tickets 09, 11; v1 tickets 09, 13;
src/pages/map.js; src/lib/mapview/layout.js; spec section 9

## Question

The map should let the learner scrub through the session and watch the shape
rotations happen (Danny 2026-08-10). The diff-driven animations already
exist (pop-in for added, color transition for flips, flash for updated) but
only fire on the live turn. What does a timeline look like - a scrubber over
the session's turns that shows the map at any snapshot, plus a play button
that replays the rotations using the ledger (08)?

## What

1. A timeline control on the map page: one stop per turn (from 08's ledger),
   drag to any stop to show that snapshot of the learner model, current stop
   marked.
2. A play control that replays the shape rotations from the current stop,
   reusing the existing diff animations and the new history data.
3. Snapshot rendering: pure function that renders the learner map as of turn
   t (and the reality tree unchanged); no live-store mutation while
   scrubbing.
4. Pause/resume, scrub-during-play behavior, and keyboard control.

## Acceptance criteria

1. Scrubbing to any turn renders that snapshot; the timeline marks the live
   position and the current turn.
2. Play replays rotations with the existing animation language; pause and
   resume work.
3. No store corruption: after scrubbing, returning to the live position
   re-syncs with the real store.
4. `npm test` green, `npm run typecheck` clean.

## Docs rule

Spec section 9 updated in the same commit.

## Human gate

Prototype review with Danny.

## Resolution (2026-08-10)

The timeline scrubber is in the map header: one stop per ledger turn (the
ledger is the source of truth), a progress fill, a turn counter (e.g.
10/10), and a play/pause button. Clicking a stop renders that snapshot;
the current stop is marked. Play replays from the current stop, advancing
~900ms per turn and rendering each turn's snapshot with its own diff driving
the existing animation language (pop-in for added, flash for updated); on
reaching the live stop it parks back on live and re-syncs the real store.

Snapshot rendering is pure (snapshotAt/snapshotDiff in history.js) and
never mutates the store - the grid renders from the ledger's deep-copied
snapshots while scrubbing, and returning to live calls sync() against the
real state. Esc stops playback. Unit-tested (snapshotAt clamping, snapshot
never aliasing the live map, snapshotDiff per turn). Verified in the
browser: play replays through all 10 demo turns; zero console errors.