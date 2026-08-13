# 03 - Ship the cladogram and one-shot grow into the live Tree

**Type:** task

**Status:** resolved

**Blocked by:** [Prototype the branching cladogram and one-shot grow](01-prototype-cladogram-and-one-shot-grow.md), [One chrome, one route](02-one-chrome-one-route.md)

**Related:** [Tutor is pull Q&A over the Tree](04-tutor-is-pull-qa-over-the-tree.md)

## Question

The prototype locked the shape. How does the live Tree (`tree.js`,
`motion.js`, `map.js`) become that cladogram with a one-shot grow, without
bringing back scroll-gated hide?

## What

Port the accepted prototype into `src/`. Keep observation hovers, node
panels, convergence fan-in/chip, chronology, skeleton.

1. **Geometry.** Replace the v3 vertical-path `treeLayout` / `cladogramPaths`
   with the prototype (v1 ticket 17) branching layout. Layers alternate left
   and right of the trunk. Chronology from v3 ticket 10 stays.
2. **Motion.** Replace scroll-driven `layerReveal` opacity with a one-shot
   elapsed-time grow on land, then freeze at full visibility. Remove the
   window-scroll opacity gate. Sap pulses may run after grow. Reduced
   motion: no grow, no sap, full Tree instantly.
3. **Tests.** Update `tree.test.js` and `motion.test.js` to the new geometry
   and grow contract. A CDP probe at 375/320: cards exist at grow end
   without scrolling; scroll does not fade layers; no page overflow (or the
   documented stage-scroll from the prototype).

## Acceptance criteria

- [x] Live Tree is a branching cladogram, not a vertical card stack
- [x] After grow (or immediately under reduced motion) every layer is
      visible at scroll 0
- [x] Scrolling never sets layer opacity below 1
- [x] Observation hovers, node panel, and convergence chip still work
- [x] 375px and 320px: no accidental horizontal page overflow
- [x] npm test green, tsc clean, netlify build OK
- [x] Screenshots in `.scratch/first-principled-v4/research/` for Danny

## Docs rule

If spec section 9 still describes the v3 vertical path, update it to the
cladogram + one-shot grow contract. Same commit as the code.

## Resolution

Ported the accepted ticket 01 prototype into `src/lib/mapview/tree.js` and
`src/lib/motion.js`. Live Tree is the v1 ticket 17 cladogram (even right,
odd left, deepest-nearest). Chronology, observation hovers, node panel, and
convergence chips stay. Grow is a one-shot ~1s elapsed timeline; scroll
never gates opacity. Reduced motion skips grow and sap. Stage
`overflow-x: auto`; page does not overflow at 375/320.

CDP probe (15/15): `.scratch/first-principled-v4/research/03-cdp-probe.mjs`.
Screenshots: `03-375.png`, `03-320.png`, `03-reduced-375.png`. tsc clean.
Netlify build OK. Tracked tests 316 pass; 2 pre-existing rate-limiter
failures in `netlify/functions/agent/agent.test.mjs` (untouched).
