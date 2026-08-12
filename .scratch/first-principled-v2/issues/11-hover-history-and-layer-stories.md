# 11 - Hover history and layer stories (the shape rotations)

**Type:** prototype
**Status:** ready-for-agent
**Blocked by:** 08
**Related:** tickets 10, 12; v1 tickets 15, 17;
src/pages/map.js; src/lib/mapview/tree.js; spec section 9

## Question

Danny's explicit ask (2026-08-10): the map should have more historical stuff
on it - when you hover over a part of the map that gets generated, you see
the history and the shape rotations that happened to create the next phase.
What does the hover experience look like: per-node rotation popovers on the
learner grid ("turn 3 misconception - 'I thought the transistor stores data'
-> turn 6 correct - 'it switches current'"), and layer-branch stories on the
reality tree?

## What

1. Hover on a learner-grid node shows a popover: the node's state rotation
   trail with turn numbers and the evidence quote at each rotation (data from
   08), plus current state and confidence.
2. Hover on a reality-tree branch (layer) shows the layer's story: which of
   its nodes the learner engaged, in what order, and how their states rotated
   - the "shape rotation" of that branch across the session.
3. Timing and layout: hover delay, popover position, dismiss behavior;
   touch fallback (tap-to-open on narrow screens).
4. Style consistent with the chapel design (ticket 13 tokens).

## Acceptance criteria

1. Hovering a node shows its full rotation trail with evidence and turns.
2. Hovering a layer branch on the reality tree shows the branch's story.
3. Popovers never overlap the hovered element in a way that hides it;
   dismissable, keyboard-accessible.
4. `npm test` green, `npm run typecheck` clean.

## Docs rule

Spec section 9 updated in the same commit.

## Human gate

Prototype review with Danny - this is his headline ask; bring a recorded
session hovered through end to end.

## Resolution (2026-08-10)

Hover history is live - the headline ask. One shared dark popover
(.history-popover) repositions near the hovered element, with a 350ms
delay, dismissal on mouseleave/blur/Esc, and viewport clamping so it never
hides the hovered card.

- Learner-grid card hover shows the node's rotation trail: turn by turn,
  state and confidence, with the latest evidence quote at each rotation
  (data: nodeHistory from the ledger). Also on keyboard focus.
- Reality-tree layer branch hover shows the layer story: which of the
  layer's nodes the learner engaged, first-engagement order, and each
  node's rotation count and current state (data: layerStory in history.js).
  Branch labels are focusable for keyboard access.

Unit-tested in history.test.js (layerStory: engaged order, firstTurn,
rotations, unengaged ids). Verified in the browser: hovering the logic gate
card shows its rotation popover; hovering a Reality-tab layer branch shows
the layer story; zero console errors. A recorded hover-through demo is
available via the demo session (?demo=1 or the chat page's demo button) for
Danny's review.