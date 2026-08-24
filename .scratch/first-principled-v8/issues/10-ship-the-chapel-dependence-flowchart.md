# 10 - Ship the Chapel Dependence flowchart

**Type:** task

**Status:** resolved

**Blocked by:** [What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md),
[Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md),
[Hover inventors and inspection on the chapel flowchart](08-hover-inventors-and-inspection-on-the-chapel-flowchart.md)

**Related:** [Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)

## Question

What replaces the hanging-card Tree so a finished checked Reality Map
renders as the locked Chapel flowchart?

## What

AFK. Steal look from variant B Chapel (Fraunces / amethyst, crown at
bottom, spine plus fan-in). Do not copy the throwaway folder into
`src/` as-is. Cards: `label`, layer name, `description`. Arrows:
`because` or unlabeled. Hover on the labeled arrow per ticket 08.
Instant appear; no arrow-draw animation. Fold a workable mobile layout
into this ticket. Do not retune v7 prompts. Do not wire poll snapshots
(that is
[Grow stage products in place on the Chapel flowchart](11-grow-stage-products-in-place-on-the-chapel-flowchart.md)).
Smoke locally on a gold or captured map. No prod deploy in this ticket.

## Answer

The finished Tree home is Chapel geometry in `src/lib/mapview/tree.js`
and `src/pages/map.js`, not a copy of the throwaway prototype folder.

Crown (highest Dependence rank) sits at the bottom; foundations sit
above. Spine cards sit on the trunk. Extra parents merge in from the
side on a wide stage and stack in one column below 480px. Cards are
DOMAIN and STRUCTURAL: `label`, layer name, `description`. EPIPHANY
nodes are not cards. `because` labels the downward shaft; a missing
`because` leaves it unlabeled. Hover is on the labeled shaft and shows
discoverer and/or date when that mark is not UNKNOWN, plus note when
nonempty. UNKNOWN discoverer and date: no hover. Instant appear (no
grow / sap / arrow-draw). How-it-works stays in the header. Wait-state
snapshots stay ticket 11. No prod deploy.

AFK 2026-08-24 (Cursor). Windows `npm test`: 355 pass.

## Acceptance criteria

- [x] Finished Tree home is Chapel geometry, not hanging cards
- [x] Card and arrow contracts from 06-08 hold on a real map
- [x] Hover matches ticket 08 (including UNKNOWN: no hover)
- [x] How-it-works still in the header; no Chat page
- [x] Windows/PowerShell-tested
- [x] Map Decisions so far points at this ticket

## Docs rule

Tree paragraph already updated with 06-08. Implementation notes stay
in this ticket. Spec chrome section updates if this ticket changes
learner-visible copy.
