# 04 - Ship Tutor as a bottom sheet

**Type:** task

**Status:** ready-for-agent

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

- [ ] Tutor closed on first paint; a control opens and closes it
- [ ] Open Tutor does not add a side column or steal Tree width
- [ ] Foundations remain reachable while open
- [ ] Pull Q&A / `forceBrief` unchanged
- [ ] 375px and 320px: no horizontal page overflow
- [ ] npm test green, tsc clean, netlify build OK, ste-copy green

## Docs rule

Update `AGENTS.md` stack line (Tutor is a bottom sheet, not a dock rail).
Update `CONTEXT.md` architecture bullets to match. Same commit as the code.
