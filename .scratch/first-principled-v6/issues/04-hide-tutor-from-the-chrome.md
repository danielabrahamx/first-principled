# 04 - Hide Tutor from the chrome

**Type:** task

**Status:** resolved

**Blocked by:** none

**Related:** [Prototype how-it-works chrome](03-prototype-how-it-works-chrome.md), [Ship how-it-works into the Tree home](05-ship-how-it-works.md)

## Question

v5 left a Tutor toggle and a closed-by-default bottom sheet on the Tree
home. The destination is Tree-only. What does removing Tutor from the
chrome look like without deleting the engine?

## What

1. **Chrome.** Remove the Tutor toggle, the bottom sheet mount, and
   `tutor-open` layout from `src/pages/map.js` / `src/pages/dock.js` /
   CSS. Home is logo, word box, Tree.
2. **Engine.** Leave `socratic.js`, `forceBrief`, orchestrator briefing,
   and dock module in the repo if tests still import them. Do not rebuild
   or delete the Socratic path.
3. **Copy.** Drop dock-only learner strings from the live header. Word-box
   copy waits for
   [Ship how-it-works into the Tree home](05-ship-how-it-works.md) if that
   ticket has not landed; a temporary placeholder is fine.
4. **Routes.** `#chat` still lands on home. No Chat page.

## Acceptance criteria

- [x] Live Tree home has no Tutor toggle and no bottom sheet
- [x] Word box still builds a tree
- [x] `src/lib/agent/` Socratic / briefing code is not deleted
- [x] `npm test` and `npx tsc --noEmit` pass
- [x] Spec UX section records: Tutor is parked from chrome

## Docs rule

Spec section 9 (UX) and CONTEXT.md Tutor entry update in the same commit
as the chrome removal.

## Answer

Home is logo, word box, Tree. The Tutor toggle, `#tutor-sheet` mount, and
`tutor-open` layout are gone from `src/pages/map.js` and live CSS
(`--tutor-sheet`, `.tutor-toggle`, sheet positioning). Header copy is no
longer a Tutor control; the word-box placeholder stays temporary until
[Ship how-it-works into the Tree home](05-ship-how-it-works.md). `#chat`
still lands on home.

Engine stays: `socratic.js`, `forceBrief` in the orchestrator, and
`src/pages/dock.js` (unmounted, with parked `.dock` CSS).
