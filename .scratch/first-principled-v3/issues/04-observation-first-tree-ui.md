# 04 - Observation-first tree UI

**Type:** task (AFK, prototype if the look needs deciding)
**What to build:** hovering any part of the tree surfaces the observations that
created the subsequent layer (the crux narrative); clicking a node opens its
panel with basis, observations, neighbors and the layer story; the tree reads
as "what was observed, what became possible". Extends the inherited hover +
node panel work (v2 10, 11). Use the prototype skill if the hover presentation
needs a design decision.

**Blocked by:** 01 - Ship the inherited map-first concept tree,
02 - Observations content model: the crux,
03 - Concept tree generation with observations

**Status:** resolved (opencode, 2026-08-13)

## Answer

Shipped the observation-first tree UI. The tree now reads "what was observed,
what became possible": every node card carries a crux record per ticket 02 and
the fail-honest schema (ticket 09 section 2), and every hover surfaces the
observations that enabled the next stage.

- Node observation cards: a present record renders fully - discoverer, date,
  key observation, each with its EXACT / APPROXIMATE mark chip, plus
  confidence and the hedge note. A missing or UNKNOWN record renders as the
  EXPLICIT GAP state - "the node exists, and the layer chain is unbroken. The
  record ends here." - never blank. Rendered defensively on purpose: the
  generator (ticket 03) was mid-flight during this session, so the viewmodel
  normalizes every possible basis shape - record, wrapped
  `{observation: {...}}`, legacy string, absent, or malformed - to a view.
  A legacy string renders as an unmarked record (never a false gap, never a
  guessed mark); a record whose crux is UNKNOWN renders as the gap, with the
  hedge note surviving into it (the Vulcan case).
- Hover on any node: the observation card plus what it built ("Used to
  build: transistor." - direct dependents in strictly higher layers). Hover
  on any layer: the layer's observations in sequence, oldest at the
  foundation (dates drive the order; undated entries last, stable) - the
  observations that made the NEXT stage possible. This extends the inherited
  v2 11 hover work; the tree surfaces are observation-first now.
- Node panel: the crux is the first section - "The observation" (or
  "Observation unknown") with the same card, then "What it is".
- Accessibility: tree cards are keyboard-focusable (tabIndex 0, role button,
  Enter/Space opens the panel, focus shows the popover like hover), Esc
  closes, popovers are viewport-clamped (max-width min(360px, 100vw - 16px),
  max-height 100dvh - 32px with scroll, and the existing left/top clamp code).
  Reduced motion: hover delay drops to 0 and all transitions/animations are
  killed under prefers-reduced-motion. Zero network calls from the map page
  preserved - all observation data is derived from the held reality map.
- Demo data: the laptop demo carries real-history observation records per
  the 02 model, reviewable without an API key - ticket 03's generator
  landed mid-session and rewrote the fixture's bases as records (logic gates
  <- Boole 1847, bit <- Shannon 1948, and so on), so the demo needs no
  overlay. The explicit gap was verified LIVE by stripping one record from
  the in-page store: the card flips to the gap state and the tree dot turns
  dashed.
- 375px: found and fixed a real overflow - the three-tab segmented control
  overflowed the header by 14px once the Reality tab was visible
  (flex-wrap: wrap on .map-header). Headless CDP verification: vw 375,
  docScrollWidth 375, overflow 0, on both the model tab and the reality
  tree, with the observation popover clamped to the viewport (left 8px).
- Verification: 307/307 tests, tsc clean (npm test + npx tsc --noEmit).

- [x] Hover on any node/layer shows the observations that enabled the next stage
- [x] Node panel shows basis + observations per the 02 model
- [x] Keyboard focusable, viewport-clamped, reduced-motion safe
- [x] Zero network calls from the map page preserved
