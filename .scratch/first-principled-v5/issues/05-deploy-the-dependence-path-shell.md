# 05 - Deploy the dependence-path shell

**Type:** task

**Status:** resolved

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

- [x] Production deploy of this effort
- [x] Live smoke: dependence-path Tree at scroll 0, one chrome, Tutor closed
      until toggled, foundations reachable with sheet open
- [x] Production URL and deploy id recorded on this ticket and in the map
      Decisions so far

## Docs rule

`CONTEXT.md` frontier becomes "v5 Destination shipped." `AGENTS.md` Resume
matches. Same commit if docs need a line; otherwise the resolution comment
on this ticket is enough.

## Resolution

Prod deploy via `& "$env:APPDATA\npm\netlify.cmd" deploy --prod`. Unique
deploy id: `6a7e012e95f23a8700288a8b`. Live:
https://first-principled.netlify.app. Unique URL:
https://6a7e012e95f23a8700288a8b--first-principled.netlify.app.

Live CDP smoke (375px, 13/13) against the unique URL:
`.scratch/first-principled-v5/research/05-live-smoke.mjs`. One chrome
(Build + Tutor). Dependence-path Tree at scroll 0 (8 cards, 1 cx).
Electricity below silicon below transistor. Tutor closed until toggled;
open sheet is 240px at the bottom, does not steal Tree width; electricity
stays reachable above it. No horizontal page overflow. Screenshots:
`05-375-empty.png`, `05-375-tree.png`, `05-375-sheet.png`.
