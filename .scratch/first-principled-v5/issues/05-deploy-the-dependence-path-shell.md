# 05 - Deploy the dependence-path shell

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Ship the dependence path into the live Tree](03-ship-the-dependence-path-into-the-live-tree.md), [Ship Tutor as a bottom sheet](04-ship-tutor-as-a-bottom-sheet.md)

**Related:** none

## Question

The live Tree is a dependence path and Tutor is a bottom sheet locally. How
does that reach production so a GPU (or laptop) session is the new shell,
not the v4 cladogram?

## What

Deploy with the existing Netlify CLI flow. Smoke the production Tree:
vertical spine, electricity below transistor on a live concept, Tutor
closed until toggled, open Tutor does not steal width, 375-wide viewport
does not overflow horizontally.

## Acceptance criteria

- [ ] Production deploy of this effort
- [ ] Live smoke: dependence-path Tree at scroll 0, one chrome, Tutor closed
      until toggled, foundations reachable with sheet open
- [ ] Production URL and deploy id recorded on this ticket and in the map
      Decisions so far

## Docs rule

`CONTEXT.md` frontier becomes "v5 Destination shipped." `AGENTS.md` Resume
matches. Same commit if docs need a line; otherwise the resolution comment
on this ticket is enough.
