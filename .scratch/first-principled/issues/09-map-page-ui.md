# 09 - Map page UI

**Type:** task
**Status:** resolved (2026-08-07)
**Blocked by:** 07 (resolved)
**Related:** spec sections 7, 9; `src/pages/map.tsx` or equivalent

## Question

How does the learner watch their mental model converge without seeing the
answers?

## What

1. A separate route rendering the learner's Mental Model only: nodes colored
   by state (untested gray, missing red, misconception orange, correct green),
   edges with their own state, confidence shown per node. Static or simple
   force layout; no graph library needed if a grid works.
2. Live updates: after every turn, apply the diff from the API response and
   animate the changes (color flips, nodes appearing). The learner watches
   their model get closer to reality.
3. The reality map is NEVER rendered, echoed, or derivable from this page
   mid-session (principle: no leaking ground truth). Only node labels the
   learner already engaged with may appear.
4. Session end: this page shows the comparison view - reality map vs learner
   map, closed-gap summary, closeness score - once the session has ended
   (ticket 10 provides the data shape).

## Acceptance criteria

- Map updates after each turn from the diff.
- No reality map content appears anywhere on the page mid-session (audit the
  rendered DOM and network payloads).
- Works on a narrow viewport.

## Docs rule

Commit and push before done. Update spec section 9 if the visualization
decisions change.

## Resolution

- `src/pages/map.js` (`renderMapPage`): the map view - a heading with the
  learner's own word, a responsive card grid of the learner's nodes, and an
  SVG overlay drawing the learner's edges between cards. Four states painted
  per spec (untested gray, missing red, misconception orange, correct green),
  confidence per node as a bar plus percent, evidence in the card tooltip.
  Empty states for no-session and no-model-yet; a session-complete note at
  session end (the comparison view itself is ticket 10).
- No-leak rule lives in `src/lib/mapview/viewmodel.js` and is enforced at
  the data level: `learnerCards` joins node labels from the held reality map
  ONLY for nodes already present in the learner map (learner nodes carry ids,
  labels live in the reality map - the join is the sole reality data the page
  may use). Layer names, node descriptions and unengaged nodes never enter
  the visual model, so they cannot reach the DOM. Covered directly by unit
  tests (reality-only nodes absent from cards).
- Layout: `src/lib/mapview/layout.js` - a deterministic grid (no graph
  library, per the ticket) in the order the learner engaged with the nodes;
  the reality map's layer structure is never consulted for positioning, so
  the layout leaks nothing. SVG edge paths are quadratic curves anchored to
  the card edges; an edge whose endpoint has no card (unengaged node) is
  skipped, not crashed on. Column count adapts to the container (1-4), and
  the stage scrolls horizontally on a narrow viewport.
- Live updates: the session store grew an additive `subscribe(listener)`
  (fires after every successful startSession/applyResponse), so the map page
  re-syncs as turns land, even while it is hidden. Each turn's diff animates:
  new nodes pop in (`added`), state flips transition color on the same keyed
  element, evidence/confidence changes flash, edge strokes transition.
  `renderedDiff` tracking means navigation or resize re-layouts without
  replaying the animation.
- The map page makes zero network requests - every update comes from the
  shared store, so no reality payload can originate from it (the only
  traffic in the app is the chat page's spec-mandated full-state POST).
- Wired in `src/app.js` (mount + sync on route show) and `src/index.html`
  (#view-map is now an empty mount point). Spec section 9 updated.
- Verification: 149 node:test cases pass (13 new: 6 viewmodel, 6 layout, 1
  store subscribe), `tsc --noEmit` clean, `netlify dev` serves all modules.
  DOM audit with headless Edge against a scripted two-turn session (init +
  flip/add/update diff): 20/20 - engaged labels only, no layer names, no
  unengaged labels (silicon, bit), no descriptions, state colors, added and
  flash classes, flip applied, edge to unengaged node skipped, empty states
  hidden. Real app at #map and #chat render both pages correctly; 360px
  narrow viewport renders.
- Note: ticket 08 (chat UI) was being built concurrently in this working
  tree, so this commit includes the in-flight chat files (src/pages/chat.js,
  src/api/agent.js and tests, chat styles, spec 9 chat bullet) to keep the
  tree green and consistent; 08's session still marks its ticket resolved.
