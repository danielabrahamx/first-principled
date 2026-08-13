# 01 - Prototype the branching cladogram and one-shot grow

**Type:** prototype

**Status:** resolved

**Blocked by:** none

**Related:** [One chrome, one route](02-one-chrome-one-route.md), [Ship the cladogram and one-shot grow into the live Tree](03-ship-cladogram-and-one-shot-grow.md)

## Question

The live Tree is a vertical stack of layer bands, and scroll-driven growth
sets every layer to opacity 0 at the top of the page. What does the locked
shape look like as a cheap artifact we can react to before rewriting
`map.js`: v1 ticket 17 left/right cladogram, plus a one-shot grow that ends
on a fully visible Tree?

## What

Build a standalone prototype under
`.scratch/first-principled-v4/research/01-cladogram-prototype/` (plain ES
modules + SVG + CSS, same pattern as v3 `research/07-motion-prototype`). Use
the laptop fixture. Do not ship into `src/` in this ticket.

1. **Cladogram geometry.** Restore v1 ticket 17: crown at the top, central
   trunk, layers hanging left and right (even right, odd left, deepest
   nearest the trunk per side), foundations at the bottom. Keep v3
   chronology (oldest at the foundation, dates inside a layer, never across
   layer boundaries). Observation dots and a "combines N fields" chip may
   be stubbed.
2. **One-shot grow.** On load, play trunk-draw then deepest-first layer bud
   over a short elapsed-time timeline (~1s). When the timeline ends, freeze
   at full visibility. Do not bind opacity to `window.scrollY`.
3. **After grow.** Sap pulses may run on the finished cladogram. Reduced
   motion: skip grow and sap, show the full Tree instantly.
4. **Mobile.** 375px must not overflow the viewport (v1 ticket 17 already
   passed this). Horizontal scroll of the stage is allowed only if that
   invariant cannot hold; prefer the v1 fit.

## Acceptance criteria

- [x] Prototype opens via a static server and shows a branching cladogram,
      not a single-column stack
- [x] At time 0 of the grow, the root is visible; at end, every layer and
      card is visible without scrolling
- [x] Scrolling the page after grow does not hide or fade layers
- [x] Reduced-motion path shows the full Tree with no grow and no sap
- [x] 375px: no accidental horizontal page overflow, or a documented
      stage-scroll if the v1 fit cannot hold
- [x] Asset path linked from this ticket; Danny can react before ticket 03

## Docs rule

None in `src/`. A short README in the prototype folder covers how to serve
it. Resolution records whether the geometry and grow are accepted as-is or
need a tweak before [Ship the cladogram and one-shot grow into the live Tree](03-ship-cladogram-and-one-shot-grow.md).

## Resolution

Geometry accepted as-is (v1 ticket 17 cladogram + one-shot elapsed grow, no
scroll-gated hide). Asset path:
`.scratch/first-principled-v4/research/01-cladogram-prototype/`. Ready for
ticket 03 to port into `src/`.

The locked 6-layer laptop tree is ~1840px wide, so 375px uses stage
`overflow-x: auto` while `html, body` keep `overflow-x: hidden` (no document
page overflow). "Visible without scrolling" means opacity-visible after
grow, not that the tree fits in 375px. Serve from the prototype dir with
`npx --yes serve`. Danny (AFK) session auto-accepted the prototype as
matching the locked shape.
