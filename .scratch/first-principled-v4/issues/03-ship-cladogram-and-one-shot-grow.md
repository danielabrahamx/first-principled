# 03 - Ship the cladogram and one-shot grow into the live Tree

**Type:** task

**Status:** ready-for-agent

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

- [ ] Live Tree is a branching cladogram, not a vertical card stack
- [ ] After grow (or immediately under reduced motion) every layer is
      visible at scroll 0
- [ ] Scrolling never sets layer opacity below 1
- [ ] Observation hovers, node panel, and convergence chip still work
- [ ] 375px and 320px: no accidental horizontal page overflow
- [ ] npm test green, tsc clean, netlify build OK
- [ ] Screenshots in `.scratch/first-principled-v4/research/` for Danny

## Docs rule

If spec section 9 still describes the v3 vertical path, update it to the
cladogram + one-shot grow contract. Same commit as the code.
