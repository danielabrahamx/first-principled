# 12 - Port the phylogenetic motion into the live tree

**Type:** task

**What:** Ship the ticket 07 motion prototype into the real tree: flowing
sap pulses, scroll-driven growth, node lifecycle stagger - on the new
vertical path geometry, with reduced-motion support, mobile-clean.

**Blocked by:** 10 - Vertical path layout + strict chronology + panel close
fix

**Status:** resolved (opencode, DeepSeek v4 flash, Daniel session, 2026-08-13)

## Answer

Shipped. The ticket 07 motion prototype is ported onto the ticket 10 vertical
path - sap pulses, scroll-driven growth, and the node lifecycle stagger all
ride the real tree geometry (root top, trunk descending, layer bands in a
single column, two-up only when the stage fits).

- New module `src/lib/motion.js` (zero-dep plain ES module, imported by the
  map page): `sapPulsePaths` (SMIL centerlines in the rising direction),
  `trunkReveal` / `layerReveal` (growth math), `budDelay` (deterministic
  stagger), and `wireTreeMotion` (sap group, trunk dashoffset, one passive
  rAF-throttled scroll listener, destroy handle). Pure math is node-tested in
  `src/lib/motion.test.js` (8 tests).
- map.js `renderTree`: each layer's band is wrapped in a `.tree-layer` div
  (absolute, inset 0 - no geometry change), every root/label/card gets a
  `tree-bud` class and a `--mt-delay`, and `wireTreeMotion` is wired with a
  destroy-on-rebuild handle. styles.css adds the band transition, the sap
  glow, and the bud keyframes.
- Sap: 1 pulse train on the trunk (deepest card bottom up to the crown) + one
  per branch (its cards up to the trunk; a two-up layer rides each column
  elbow). Pure SMIL, zero JS animation loop. Verified in the probe: 7 pulses
  for the 6-layer laptop tree (1 trunk + 6 branches).
- Scroll growth: trunk draws over the first half of the scroll
  (pathLength-normalised dashoffset), then layers bud deepest-foundation
  first. Probe-verified: at scroll top dashoffset 1 + crown layer opacity 0;
  at the bottom dashoffset 0 + every layer opacity 1.
- Reduced motion (the 07 contract): `reducedMotion` (matchMedia) skips the
  sap group and the scroll wiring, no `tree-bud` classes; the CSS media query
  kills animations and the sap glow. Emulated via CDP: 0 sap pulses, trunk
  renders full (no dashoffset), every layer visible, no stagger.
- Mobile: 375px/320px clean - no horizontal overflow (docScrollWidth ==
  viewport), cards centered on the trunk, no layout shift (the sap group is
  inside the existing absolutely-positioned SVG; the layer bands add no size).
- Evidence: `research/12-cdp-probe.mjs` 25/25 headless-Edge checks, and
  screenshots in `research/12-tree-*.png` (375, 320, 375 mid-growth, desktop)
  for Danny's approval before deploy.

One note on the shared working tree: the parallel ticket 11 session's final
commit swept the map.js/styles.css motion wiring into its own `v3 11: resolve`
commit (both sessions share one checkout), so those two files already live on
main under ticket 11's commit; this ticket's commit carries the module, the
tests, the probe, and the docs.

## Acceptance criteria

- [x] Sap pulses animate on trunk + branches in the live tree (SMIL
      animateMotion, rising direction)
- [x] Scroll-driven growth: trunk draws on scroll, layers bud in sequence
- [x] Node lifecycle stagger ships
- [x] Reduced-motion: no SMIL, no scroll wiring, CSS animations killed -
      verified in the prototype's simulate-reduced-motion check
- [x] Works on the vertical path layout from ticket 10
- [x] 375px and 320px CDP audits clean; screenshots delivered for Danny
      approval before deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL (npm test 326 green + tsc clean;
      deploy deferred per Danny - all tickets 10-13 deploy together in a new
      session)

## Docs rule

Update the map's Decisions so far with the motion-shipped resolution. The
07 decision line stays as the source of truth for what ships vs. what does
not.

## Question

Ticket 07 resolved with a prototype (`research/07-motion-prototype/`) and a
decision on which effects ship, but zero motion code exists in `src/` - the
live tree is still the static v1 layout. Danny: the tree "was not even
rebuilt for it to look like the one on portfoolio-clone2."

## What

1. **Port the 07 decision into the live tree.** From the ticket 07
   resolution:
   - Flowing sap pulses via animateMotion - one pulse train on the trunk and
     one per branch, riding the cladogram centerlines in the rising
     direction (deepest divergence up to the crown; branch cards up to the
     trunk). Observations rise from foundations to abstractions. Pure SMIL,
     zero JS animation loop.
   - Scroll-driven growth - the trunk draws down as the first half of the
     scroll (pathLength-normalized dashoffset), then each layer buds in.
   - Node lifecycle stagger (ticket 07 decision item 3).
   - Skipped (per 07): parallax, cursor hydrotropism, root hairs, grain
     filter.
2. **Reduced motion.** JS skips SMIL + scroll wiring; CSS media query kills
   animations. Same contract as the prototype.
3. **Vertical path geometry.** The motion rides the ticket 10 vertical
   layout - trunk down the center, branches peeling off, sap rising
   bottom-to-top. Reading direction: concept top, oldest foundations bottom.
4. **Mobile.** Motion must not cause horizontal overflow or layout shift at
   375px/320px. Scroll-driven growth hooks the natural page scroller
   (ticket 10 scroll model). Performance-minded: SMIL on mobile is fine but
   verify no jank at 375px; reduced-motion is the escape hatch.

## Acceptance criteria

- [ ] Sap pulses animate on trunk + branches in the live tree (SMIL
      animateMotion, rising direction)
- [ ] Scroll-driven growth: trunk draws on scroll, layers bud in sequence
- [ ] Node lifecycle stagger ships
- [ ] Reduced-motion: no SMIL, no scroll wiring, CSS animations killed -
      verified in the prototype's simulate-reduced-motion check
- [ ] Works on the vertical path layout from ticket 10
- [ ] 375px and 320px CDP audits clean; screenshots delivered for Danny
      approval before deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the motion-shipped resolution. The
07 decision line stays as the source of truth for what ships vs. what does
not.
