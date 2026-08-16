# 05 - Ship how-it-works into the Tree home

**Type:** task

**Status:** resolved

**Blocked by:** [Prototype how-it-works chrome](03-prototype-how-it-works-chrome.md), [Hide Tutor from the chrome](04-hide-tutor-from-the-chrome.md)

**Related:** [Node panel is an invitation card](06-invitation-node-panel.md)

## Question

The how-it-works prototype is accepted. What does that framing look like
on the live Tree home: header How it works, empty-state sentence, and
foundations word box?

## What

Port the accepted 03 artifact into `src/`. Tutor is already gone (ticket
04). Do not invent new copy unless 03's resolution recorded a tweak.

1. **Header.** How it works control. Short page or overlay. Back to the
   Tree.
2. **Empty state.** Locked one-sentence line under or beside the word box.
3. **Word box.** Placeholder `A thing in reality (laptop, photosynthesis)`.
   Aria label matches foundations language.
4. **No Tutor.** Do not reintroduce a toggle.

## Acceptance criteria

- [x] Live empty Tree shows the accepted empty-state sentence and
      placeholder
- [x] How it works is reachable from the header and states: not a reading
      replacement; relationships between layers; rabbit holes; type a
      thing in reality from its foundations
- [x] 375px and 320px: no horizontal page overflow
- [x] `npm test` and `npx tsc --noEmit` pass

## Answer

Variant A is now the live Tree chrome. Copy is the grilling lock, unchanged.

- Header: logo, foundations word box, How it works control.
- `#how` is a short page (not an overlay). Back to the Tree keeps the
  word box. Submitting a word from How it works returns home and builds.
- Empty Tree sentence: `Type the thing you want to understand from its
  foundations.`
- Placeholder: `A thing in reality (laptop, photosynthesis)`.
- No Tutor control.

Header wraps (`flex-wrap`, `min-width: 0`, `overflow-x: hidden` on
html/body) so 320px and 375px do not overflow the page. Spec section 9
updated in this commit.

## Docs rule

Spec section 9 empty-state / nav copy updates in the same commit as the
UI. STE: learner-facing strings stay in the approved subset.
