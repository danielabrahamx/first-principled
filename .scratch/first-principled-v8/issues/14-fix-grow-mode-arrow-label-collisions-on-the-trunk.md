# 14 - Fix grow-mode arrow label collisions on the trunk

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Deploy the Chapel Tree](12-deploy-the-chapel-tree.md)

**Related:** [Grow stage products in place on the Chapel flowchart](11-grow-stage-products-in-place-on-the-chapel-flowchart.md)

## Question

Where do colliding epiphany labels go when two from/to ranges overlap
on the temporary spine?

## What

AFK. In `src/lib/mapview/grow.js` every epiphany label sits at
`labelX = trunk`. Two epiphanies whose from/to ranges overlap render
labels at the same x and collide visually. Stagger colliding labels
along their own shafts (offset y within each arrow's vertical span) or
side-step x with a small leader gap; pure geometry, no motion. Keep
`because` text untruncated and inside the stage width on 320px. Add a
regression test with two overlapping ranges.

## Acceptance criteria

- [ ] Overlapping-range labels never share the same x and y
- [ ] Labels stay inside the stage at 320px width
- [ ] Regression test covers two overlapping ranges
- [ ] Windows/PowerShell-tested
- [ ] Map Decisions so far points at this ticket

## Docs rule

No learner-visible copy changes expected. Same commit as the code.
