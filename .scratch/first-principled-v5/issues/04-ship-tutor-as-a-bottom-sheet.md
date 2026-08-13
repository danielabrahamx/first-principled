# 04 - Ship Tutor as a bottom sheet

**Type:** task

**Status:** resolved

**Blocked by:** [Tutor is a bottom sheet that does not cover the foundations](02-tutor-is-a-bottom-sheet.md), [Ship the dependence path into the live Tree](03-ship-the-dependence-path-into-the-live-tree.md)

**Related:** [Deploy the dependence-path shell](05-deploy-the-dependence-path-shell.md)

## Question

The 02 prototype locked the sheet. How does the live Tutor leave the 340px
side rail and become that sheet, without changing pull Q&A?

## What

Replace `.map-split.tutor-open` 340px grid rail with the accepted 02
pattern. Keep `forceBrief`, closed-by-default, Tutor toggle, briefing
turns. STE-scan new copy.

1. **Chrome.** No side rail. Opening Tutor does not steal Tree width.
2. **Foundations.** The accepted 02 pattern ships: foundations stay
   reachable while the sheet is open.
3. **Mobile.** 375px and 320px: no horizontal overflow; sheet usable.
4. **Behavior.** Closed on first paint. Pull Q&A unchanged.

## Acceptance criteria

- [x] Tutor closed on first paint; a control opens and closes it
- [x] Open Tutor does not add a side column or steal Tree width
- [x] Foundations remain reachable while open
- [x] Pull Q&A / `forceBrief` unchanged
- [x] 375px and 320px: no horizontal page overflow
- [x] npm test green, tsc clean, netlify build OK, ste-copy green

## Docs rule

Update `AGENTS.md` stack line (Tutor is a bottom sheet, not a dock rail).
Update `CONTEXT.md` architecture bullets to match. Same commit as the code.

## Resolution

Accepted 02 pattern shipped: compact 240px / 42dvh bottom sheet, spine
padding and scroll-margin so electricity stays reachable. No 340px grid
rail. `forceBrief: true` unchanged in the orchestrator. 375/320 CDP 16/16.
npm test 341/341, tsc clean, ste-copy green, netlify build OK.
