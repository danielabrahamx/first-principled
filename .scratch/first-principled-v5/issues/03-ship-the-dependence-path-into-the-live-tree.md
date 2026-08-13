# 03 - Ship the dependence path into the live Tree

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Prototype the dependence-path Tree](01-prototype-the-dependence-path-tree.md)

**Related:** [Ship Tutor as a bottom sheet](04-ship-tutor-as-a-bottom-sheet.md)

## Question

The prototype locked the shape. How does the live Tree (`tree.js`,
`motion.js`, `map.js`) become that dependence path, without bringing back
date-sort or left/right layer columns?

## What

Port the accepted 01 prototype into `src/`. Keep observation hovers, node
panels, convergence chips, skeleton, word input. Keep the current Tutor
rail for this ticket (ticket 04 replaces chrome).

1. **Geometry.** Replace cladogram `treeLayout` / `cladogramPaths` with the
   prototype spine and ribs. Y from dependence edges, not observation
   dates. Layers as named bands. Earlier is lower.
2. **Motion.** Keep v4 one-shot elapsed grow if it still reads; otherwise
   retune to the spine. Scroll never gates opacity. Reduced motion: instant
   full Tree.
3. **Tests.** Update `tree.test.js` (and motion tests if grow changes) so
   electricity-below-transistor is a contract, not an accident. CDP probe
   at 375/320: no horizontal page overflow.

## Acceptance criteria

- [ ] Live Tree is a vertical dependence path, not a left/right cladogram
- [ ] Layout uses `built-on` / `depends-on` / `abstraction-of`, not dates
- [ ] Within a lineage, earlier sits below later
- [ ] Observation hovers, node panel, and convergence chip still work
- [ ] 375px and 320px: no horizontal page overflow
- [ ] npm test green, tsc clean, netlify build OK
- [ ] Screenshots in `.scratch/first-principled-v5/research/` for Danny

## Docs rule

If spec section 9 still describes the v4 cladogram, update it to the
dependence-path contract. Same commit as the code.
