# 02 - Tutor is a bottom sheet that does not cover the foundations

**Type:** prototype

**Status:** resolved

**Blocked by:** [Prototype the dependence-path Tree](01-prototype-the-dependence-path-tree.md)

**Related:** [Ship Tutor as a bottom sheet](04-ship-tutor-as-a-bottom-sheet.md)

## Question

Tutor is a bottom sheet so it never steals Tree width. Foundations sit at
the bottom of the Tree. How does the sheet sit so the learner can still see
electricity, and so a phone is usable?

## What

Extend the accepted 01 prototype (or a copy beside it) with closed-by-default
Tutor chrome. Do not ship into `src/` in this ticket. Do not change what the
Tutor says (pull Q&A / `forceBrief` stays a later ship concern only as
chrome).

1. **No side rail.** Opening Tutor must not add a 340px column or overlay
   the Tree's horizontal space.
2. **Foundations stay findable.** A closed sheet leaves the full spine
   visible. An open sheet must not permanently hide the foundation end.
   Compact sheet with spine padding, scroll-to-reveal, or a node inspector
   are in play - pick by reacting to the artifact, not on paper.
3. **Mobile.** 375px and 320px: Tree still has a readable spine; sheet does
   not cause horizontal overflow.
4. **Toggle.** Closed on first paint. A control opens and closes it.

## Acceptance criteria

- [x] Prototype shows the 01 spine with a Tutor control, closed by default
- [x] Open Tutor does not steal Tree width
- [x] Foundations remain reachable while the sheet is open
- [x] 375px and 320px: no horizontal page overflow
- [x] Asset path linked; Danny can react before
      [Ship Tutor as a bottom sheet](04-ship-tutor-as-a-bottom-sheet.md)

## Docs rule

None in `src/`. Resolution records the accepted sheet pattern (compact
bottom sheet, inspector, or a documented hybrid) for the ship ticket.

## Resolution

Accepted pattern: compact bottom sheet (240px / max 42dvh) plus spine
`padding-bottom` and `scroll-margin-bottom` equal to the sheet height.
Asset path: `.scratch/first-principled-v5/research/02-tutor-bottom-sheet/`.
Ready for ticket 04 to port into `src/`.

Closed on first paint. Open sheet spans the viewport width (not a 340px
rail); Tree stage stays full width. Electricity scrolls into the gap above
the sheet (375px CDP: cardBottom 426.5, sheetTop 427). 375px and 320px:
document scrollWidth equals viewport. Danny (AFK) session auto-accepted
compact-sheet-with-spine-padding (not full-screen swap, not overlay rail).
