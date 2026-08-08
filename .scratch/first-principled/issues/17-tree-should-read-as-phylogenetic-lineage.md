# 17 - Reality tree should read as a phylogenetic lineage (chronological descent)

**Type:** task
**Status:** claimed (opencode-session-2026-08-08)
**Blocked by:** none
**Related:** tickets 13, 15; spec sections 9; src/lib/mapview/tree.js;
src/lib/mapview/tree.test.js; research/13-ui-design-spec.md

## Question

Danny's product call (2026-08-08): "make sure the tree is actually
phylogenetic, right now it doesn't look very chronological." The current
reality tree renders every layer as a parallel column of stacked cards
hanging from ONE shared horizontal line - a ladder, not a lineage. A
phylogenetic tree reads as descent: a trunk runs down from the crown and
branches diverge from it at successive depths, the most derived layer
nearest the crown and the deepest foundation lowest. How do we change the
geometry so the tree visually reads as chronological lineage?

## What

1. Rework `treeLayout` in src/lib/mapview/tree.js so branches diverge from
   a central trunk at successive depths instead of one shared branch line:
   - Root crown stays centered at the top.
   - A trunk descends from the root card bottom.
   - Each layer branch diverges from the trunk at its own depth: top layer
     (most derived) first/highest, deepest foundation last/lowest - the
     chronological reading.
   - Branch label sits at the divergence point; node cards stack below it.
   - Branch columns keep their horizontal spread (card width 280, column
     gap 32) so wide maps still fit; the divergence depth steps per layer.
2. Update `cladogramPaths` to match: trunk from root down to the deepest
   divergence, a horizontal elbow at each divergence from trunk to branch
   column, vertical drop into the branch's cards. Still elbow style,
   stroke #B9B3E8, strokeWidth 2.
3. The current constants (TREE_ROOT_GAP, TREE_LABEL_GAP) may be reused or
   new ones added for the per-branch divergence step; keep the exported
   card metrics stable (TREE_CARD_WIDTH 280, TREE_CARD_HEIGHT 64,
   TREE_CARD_GAP 12, TREE_ROOT_WIDTH 220, TREE_ROOT_HEIGHT 74).
4. Update tree.test.js: the geometry tests must assert the new divergence
   shape (successive branchLineY / divergence depth, trunk reaches the
   deepest branch, elbows at each divergence). Keep the realityTree
   viewmodel tests unchanged (root label, branch order top layer first).
5. Keep the no-leak-in-chat rule intact: this is pure geometry on the map
   page's Reality tab, no engine or prompt changes.

## Acceptance criteria

1. With the laptop fixture (6 layers), the tree renders with a visible
   central trunk and SIX distinct divergence depths: `apps` diverges
   highest (nearest the crown) and `physics` lowest - verified via
   headless Chromium CDP computed styles (branch label Y strictly
   increasing from branch 0 to branch 5).
2. The trunk path spans from the root card bottom to the deepest branch's
   divergence point; each branch has an elbow connecting trunk to its
   column. Verified by asserting the generated path strings start at the
   root and end at the last branch.
3. All cards still render (no overlap, all labels present), wide maps
   still scroll horizontally, narrow viewport has no document overflow.
4. `npm test` passes (tree/layout tests updated), `npm run typecheck`
   clean, `netlify build` completes, live deploy verified with a CDP
   probe of the Reality tab.
5. The change is geometry-only: no change to socratic prompts, no change
   to the learner-map grid, no change to session-end metrics.

## Docs rule

Spec section 9 tree paragraph updated in the SAME commit as the code to
describe the divergence geometry (trunk + per-layer divergence depths).
research/13-ui-design-spec.md may be annotated with the divergence step.

## Human gate

None. Danny confirmed the direction (2026-08-08): it must read as
chronological lineage.
