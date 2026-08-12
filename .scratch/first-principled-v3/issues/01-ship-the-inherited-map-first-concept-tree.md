# 01 - Ship the inherited map-first concept tree

**Type:** task (AFK)
**What to build:** the concept tree as the home page, live. Commit the
uncommitted v2 map-thread work sitting in the working tree and ship the
session-independent surfaces: map-first layout with docked Tutor pane,
clickable node panels, hover history + layer stories. Park the session
machinery (turn ledger, scrubber/replay) - moot under the no-session decision
(see map's Out of scope). Run the live verification pass on real DeepSeek
(billing topped up), re-run the pending 375px viewport check, and deploy to
first-principled.netlify.app.

**Blocked by:** None - can start immediately.

**Status:** resolved 2026-08-12 (opencode, Daniel session, DeepSeek v4 flash)

## Answer

Shipped the v2 map-thread inheritance as the concept-tree home page.

- Commits: `2bb18ac` (inherited map-thread: map-first layout + docked Tutor
  pane, node panels, hover history + layer stories, turn ledger, two-phase
  reality maps with basis + deriveCheck, demo loader, v2 docs) and `43401a2`
  (claim + park the timeline scrubber/replay). Pushed.
- Fresh-checkout discipline held: a clean worktree at `43401a2` runs 214/214
  tests and tsc clean. Two adjustments were needed so the committed set is
  self-consistent: orchestrator.test.js carries only the map-thread hunks
  (foundation/derive scripting for the two-phase generator) - the
  engine-thread `Phase: active` assertion stays parked with the socratic
  rebuild; demo.js uses `probe` instead of `confront` (confront only exists
  in the uncommitted socratic ProbeKind union).
- Session machinery parked: `sync()` no longer calls `renderTimeline()`, so
  the scrubber/replay stays hidden in the live UI (verified: `display: none`
  in browser and on prod). The ledger stays as internal data - hover history
  and node panels read it, and those surfaces ship.
- Live word-to-tree on real DeepSeek, from the committed state: "laptop"
  full pass - 200, phase active, 6 layers, 20 nodes, 29 edges, basis on
  every abstraction, opening Socratic turn, 34.2s (within the 30s call
  budget; two-phase generation means two calls). Probe evidence:
  live-probe.mjs run against the same code the function bundles.
- 375px viewport: verified twice - against the committed state locally
  (viewport 375, docScrollWidth 375, overflow 0, timeline hidden, demo
  session renders on #map) and against the live production URL. Desktop
  pass also confirmed: split layout (552px map + 340px dock), node panel
  opens with description/rotation trail/evidence and closes on Esc, hover
  popover shows the rotation trail, probed card pulses, no overflow.
- Deployed: https://first-principled.netlify.app (deploy
  `6a7cf6fee1840bbafcb0417b`). Function and all module paths verified live
  (200s); the deployed realityMap.js is the committed two-phase version.
- Key-leak grep clean: no `sk-` keys and no .env content in any tracked
  file (only the empty placeholder in .env.example).
- Constraint 5 note: src/lib/agent/realityMap.js + realityMap.test.js were
  dirty during deploy (the v3 08 session is mid-rewrite, layer-by-layer
  generation) and the dirty content did NOT build (tsc errors). Per the
  constraint, the working tree was not deployed; the deploy came from the
  committed, verified state instead. Prod does not carry the v3 08 work in
  progress.

Known limitation recorded for the map: two live probes ("photosynthesis",
"keyboard") failed validation after repairs because the model omitted
`layers[].nodes` - the derive prompt's example shows layers as `[...]`
without the per-layer node list shape. This is the v3 08 rewrite's problem
to close (it builds the layer chain structurally, which is exactly this
failure mode); it is noted here so 08 picks it up.

- [x] Map-first layout, node panels, hover layer stories committed and pushed (scoped add, never git add -A)
- [x] Session machinery parked, not shipped as learner-turn replay
- [x] Live word-to-tree verified on real DeepSeek end to end
- [x] 375px viewport verified (the pending re-run from v2 ticket 09)
- [x] Deployed to prod, key-leak grep clean
