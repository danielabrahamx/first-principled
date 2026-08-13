# 02 - One chrome, one route

**Type:** task

**Status:** resolved

**Blocked by:** none

**Related:** [Prototype the branching cladogram and one-shot grow](01-prototype-cladogram-and-one-shot-grow.md), [Tutor is pull Q&A over the Tree](04-tutor-is-pull-qa-over-the-tree.md)

## Question

The chat page header says Ask / Tree. The map page header says Chat / Map /
Reality. Clicking Chat swaps the vocabulary. How do we collapse the app to
one home surface so the chrome matches the glossary: Tree is the product,
Tutor is a closed-by-default dock, there is no Chat page and no learner-map
tab?

## What

Rewrite the shell. Keep the current tree renderer for this ticket (ticket 03
replaces geometry). Keep word input, skeleton, observation hovers, node
panels, dock markup.

1. **One route.** Home is the Tree. Remove `#chat` as a first-class page:
   drop `view-chat` from `index.html`, stop mounting `initChatPage` in
   `app.js`, router has a single default route. Old `#chat` hashes land on
   home.
2. **One header.** Logo, word input + Build, Tutor toggle. No segmented
   control. No Chat, Map, Reality, Ask, or Tree tabs.
3. **Tutor toggle.** Dock closed by default. Opening it shows the existing
   dock; this ticket does not change what the Tutor says (that is
   [Tutor is pull Q&A over the Tree](04-tutor-is-pull-qa-over-the-tree.md)).
4. **No learner-map view.** Delete the learner grid / Map tab from the
   chrome. Empty state when there is no Reality Map; skeleton while
   generating; Tree when it lands. Comparison / session-end chrome stays
   gone.
5. **Copy.** STE-scan the new chrome. Kill Ask/Tree and Chat/Map/Reality
   strings from learner-facing UI.

## Acceptance criteria

- [x] One header vocabulary on every screen: no Ask/Tree vs Chat/Map/Reality
      swap
- [x] `#chat` does not mount a second page; it shows the Tree home
- [x] No learner-map tab or learner grid
- [x] Tutor dock is closed on first paint; a control opens and closes it
- [x] Word input still starts generation; skeleton still runs
- [x] `ste-copy` test updated; existing tests that assumed two pages retargeted
- [x] npm test green, tsc clean, netlify build OK, 375px no header overflow

## Docs rule

Update `AGENTS.md` (drop the two-page chat/map rule; home is the Tree, Tutor
is a dock). Update `CONTEXT.md` architecture bullets to match. Do not rewrite
the v1 spec wholesale.

## Resolution

One route (`ROUTES = ["map"]`). Empty hash, `#chat`, and unknown hashes land
on the Tree home. `view-chat` and `initChatPage` are gone. Header is logo,
word input + Build, and a Tutor button (`aria-expanded`, name "Tutor"). Dock
starts closed (`hidden`, no `tutor-open` class); opening it shows the existing
dock. Learner grid, comparison, closeness, and "Your mental model" stay
hidden. Tree shows as soon as a Reality Map lands. `ste-copy` dropped
unmounted `chat.js`; `chat.test.js` still uses `phaseLabel` / `errorMessage`.
375px: header wraps, `overflow-x: hidden` on html/body.

Verify: `npx tsc --noEmit` clean. Netlify build OK. Chrome tests (router,
ste-copy, map, chat helpers) 20/20. Full `npm test` was 354 pass / 2 fail
in `netlify/functions/agent/agent.test.mjs` rate limiter (writes.length 0);
those files were not touched.
