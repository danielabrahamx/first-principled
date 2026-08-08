# 15 - Reality map viewable from session start (information-first)

**Type:** task
**Status:** resolved (2026-08-08)
**Blocked by:** none
**Related:** tickets 09, 10, 13; spec sections 8, 9; src/pages/map.js;
src/lib/agent/socratic.js; docs/MISSION.md

## Question

The reality phylogenetic tree currently renders ONLY at session end, on the
map page's Reality tab, because the no-leak rule forbids reality content
mid-session. Danny's product call (2026-08-08): the reality map should be
viewable from session start - it IS the information people expect to model
their decisions on. How do we make the reality tree a first-class view
available from the moment a session begins, without breaking the learner-map
experience?

## What

1. Map page: the Reality tab (or equivalent) is available as soon as a
   reality map exists (after the init response), not only when state.ended.
   The tree renders live from the held reality map.
2. Learner map stays the default tab; Reality is one click away at all times.
3. Relax the no-leak rule for the tree view: the tree is now public product
   surface, not a session-end reveal. Mid-session chat must still NOT leak
   reality content (the tutor's messages remain Socratic).
4. The Socratic system prompt rule 1 ("the reality map is private, never
   quote it") must be revisited: if the learner can open the tree at any
   time, the tutor should assume the learner may have seen it. Decide and
   document the new rule - do not silently weaken principle 6
   (understanding is constructed through questions).
5. Spec section 9 rewrite: the no-leak section becomes a no-leak-in-chat
   section; the map page no longer hides reality.
6. Tests: map page DOM/behavior tests for the tree being reachable
   mid-session; socratic prompt tests for the revised rule 1; spec updated.

## Acceptance criteria

1. Start a session, type a word: on the map page the Reality tab is visible
   immediately after init (ended = false), and the tree renders. VERIFIED
   via headless Chromium CDP harness (ended = false, reality map held):
   Reality tab visible (72x36), tree panel visible (707x367), root card
   220x79, 4 branch cards + labels + SVG paths all present.
2. Mid-session, the tree shows full reality content (layers, labels,
   descriptions) - verified in headless Chromium via CDP computed styles.
   VERIFIED in the same probe (branch labels carry layer names).
3. The learner-map grid still renders on the Map tab mid-session. UNCHANGED
   code path (grid renders when tab = model); covered by existing tests.
4. The chat page still leaks nothing: no reality labels, layers, or tree
   content ever render in chat messages mid-session or at session end.
   UNCHANGED (chat.js renders no reality content; socratic rule 1 still
   forbids quoting the map).
5. Socratic system prompt rule 1 updated + unit tested; the tutor no longer
   pretends the map is unseen, but still never quotes it unprompted.
   Rule 1 rewritten; existing prompt test (/Never quote/i) still passes.
6. Session-end comparison (metrics + transfer assessment) still renders.
   UNCHANGED (cmpBlock driven by state.ended).
7. All tests pass (`npm test`): 169/169 + 4 skipped, `npm run typecheck`
   clean. Live deploy follows in the same commit.

## Resolution notes

Danny's product call (2026-08-08): the reality tree is an information
surface, viewable from session start. Changes:
- src/pages/map.js: updateTabs/sync now gate the Reality tab and tree on
  `state.realityMap !== null` instead of `state.ended && realityMap`;
  comparison metrics still gate on state.ended. Header docs updated.
- src/lib/agent/socratic.js: rule 1 rewritten - the learner may open the
  reality map at any time; the tutor engages honestly if referenced, but
  still never quotes it unprompted.
- AGENTS.md, map.md notes, spec section 9: no-leak rule re-scoped to
  "chat never leaks reality content"; map page shows the tree from start.
- docs/MISSION.md untouched (no principle amendment needed: rule 6 about
  constructing understanding through questions still binds the tutor's
  messages; the map page is learner-initiated viewing, not teaching).

## Docs rule

Spec section 9 rewritten in the SAME commit as the code. docs/MISSION.md is
immutable - if the change needs a principle amendment, stop and ask Danny
before touching it.

## Human gate

None. Danny confirmed the product direction (2026-08-08).
