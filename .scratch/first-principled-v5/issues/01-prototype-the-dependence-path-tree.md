# 01 - Prototype the dependence-path Tree

**Type:** prototype

**Status:** ready-for-agent

**Blocked by:** none

**Related:** [Tutor is a bottom sheet that does not cover the foundations](02-tutor-is-a-bottom-sheet.md), [Ship the dependence path into the live Tree](03-ship-the-dependence-path-into-the-live-tree.md)

## Question

The live Tree is a left/right cladogram sorted by observation date, so a
lineage can paint electricity above transistor and the whole map is too
wide for a phone or an open Tutor. What does the locked shape look like as
a cheap artifact we can react to before rewriting `tree.js`: a vertical
spine of existing dependence edges, foundations at the bottom, short ribs
at convergence, layers as named bands?

## What

Build a standalone prototype under
`.scratch/first-principled-v5/research/01-dependence-path-prototype/` (plain
ES modules + SVG + CSS, same pattern as v4
`research/01-cladogram-prototype`). Use the laptop fixture (electricity,
silicon, transistor are already edged). Do not ship into `src/` in this
ticket. No Tutor chrome here - that is
[Tutor is a bottom sheet that does not cover the foundations](02-tutor-is-a-bottom-sheet.md).

1. **Spine.** Crown (concept) at the top. Foundations at the bottom. Y
   position follows `built-on` / `depends-on` / `abstraction-of` edges, not
   observation dates. Within a lineage, earlier is lower.
2. **Ribs.** Parallel independent lineages sit as short side ribs and meet
   at convergence nodes (`combines`). Not one column that pretends every
   node is in a single chain. Not even-right / odd-left layer columns.
3. **Bands.** Layers are named bands (physics, materials, ...) behind or
   beside the spine. They do not become spatial columns.
4. **Dates.** Observation dates may appear as hover stubs. They must not
   drive layout.
5. **Mobile.** 375px must not overflow the page horizontally. The spine is
   the product; horizontal stage-scroll is a failure of this shape, not an
   allowed fallback.

## Acceptance criteria

- [ ] Prototype opens via a static server and shows a vertical dependence
      path, not a left/right cladogram
- [ ] Laptop fixture: electricity sits below transistor (and below silicon)
- [ ] Convergence reads as ribs meeting, not as a wide layer column
- [ ] 375px and 320px: no horizontal page overflow
- [ ] Dates are not the layout sort
- [ ] Asset path linked from this ticket; Danny can react before
      [Ship the dependence path into the live Tree](03-ship-the-dependence-path-into-the-live-tree.md)

## Docs rule

None in `src/`. A short README in the prototype folder covers how to serve
it. Resolution records whether the geometry is accepted as-is or needs a
tweak before the ship ticket.
