# 09 - Map page UI

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 07
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
