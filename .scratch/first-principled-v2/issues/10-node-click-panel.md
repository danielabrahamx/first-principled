# 10 - Clickable node panel

**Type:** task
**Status:** resolved 2026-08-10 (Buffy)
**Blocked by:** 08
**Related:** tickets 09, 11; v1 tickets 09, 15;
src/pages/map.js; src/lib/mapview/viewmodel.js; spec section 9

## Question

Clicking any part of the map should open its story (Danny 2026-08-10). The
no-leak rule stays relaxed (Danny 2026-08-10), so a node panel may show the
reality description mid-session. What does the node panel contain and how is
it wired: reality description, the learner's evidence quotes, the state
rotation history (from 08), confidence trajectory, and neighbors?

## What

1. Clicking a learner-grid node (and a reality-tree node) opens a side panel
   with: label, reality description (ground truth, allowed), current
   state/confidence, the evidence ledger (learner quotes, with turn numbers),
   the state history trail (e.g. untested -> misconception -> correct), and
   linked neighbors (edges to/from, with their state).
2. Wiring: panel reads the store (ledger from 08) - no network calls.
3. Keyboard (Esc closes), ARIA, and a focused state on the clicked node.
4. Empty and edge cases: node never engaged (no history yet), session not
   started.

## Acceptance criteria

1. Clicking a node opens its panel with all five content areas populated
   correctly from the store.
2. The panel is keyboard-accessible and closes cleanly.
3. No regression on the map page; `npm test` green, `npm run typecheck`
   clean.
4. DOM-audited: mid-session the panel may show reality descriptions (no-leak
   relaxed), but chat still never leaks reality content.

## Docs rule

Spec section 9 updated in the same commit.

## Resolution (2026-08-10)

Clicking any learner-grid card (and any reality-tree branch card) opens the
node panel - a fixed right-side overlay (full-width on narrow screens) with
role=dialog, a close button, and Esc handling. Content built by a new pure
viewmodel (src/lib/mapview/history.js, nodePanelView): the reality
description (allowed - no-leak relaxed, Danny 2026-08-10), current
state/confidence, the evidence ledger with the turn each quote first
appeared (tN chips), the state rotation trail (untested/misconception ->
correct with per-turn confidence), and linked neighbors with relation
(in/out), label and state. Unengaged nodes show the description plus a
"you haven't engaged this node" note.

Keyboard: cards are focusable (tabIndex 0, role button, aria-label), Enter
or Space opens the panel, Esc closes it, focus moves to the close button.
No network calls - everything derives from the store and ledger. Verified
in the browser: clicking the transistor card shows the description, the
rotation trail, evidence and neighbors; zero console errors. Unit tests
cover nodePanelView's shapes (evidence turns, trail, neighbors, unengaged)
in history.test.js (12 tests).