# 07 - Port the phylogenetic motion

**Type:** prototype (HITL)
**Question:** which of the portfoolio_clone2 RootTree effects carry into the
zero-dep SVG tree? Candidates: flowing "sap" paths along the trunk and
branches (observations rising from foundations to abstractions), scroll-driven
growth, node lifecycle animation - with reduced-motion support. Prototype in
our stack (plain ES modules + SVG + CSS), never React. Link the prototype as
an asset; the resolution records which effects ship and which do not.

**Blocked by:** 01 - Ship the inherited map-first concept tree,
02 - Observations content model: the crux

**Status:** resolved (opencode, DeepSeek v4 flash, Daniel session, 2026-08-13)

- [x] Prototype shows the candidate effects in our stack
- [x] Decision recorded: which effects ship, which do not
- [x] Reduced-motion behavior respected

## Asset

`research/07-motion-prototype/` - index.html (demo page with per-effect
toggles and a simulate-reduced-motion checkbox), motion-tree.js (geometry
ported from `src/lib/mapview/tree.js`, sap pulses via SMIL animateMotion,
scroll-driven growth, reduced-motion gate), sample-map.js (6-layer laptop
tree), styles.css. Run with any static server (ES modules need http, not
file://): `npx serve` or `python -m http.server` from the directory.

## Decision (2026-08-13)

**Ships:**

1. Flowing sap pulses via animateMotion - one pulse train on the trunk and
   one per branch, riding the cladogram centerlines in the rising direction
   (deepest divergence up to the crown; branch cards up to the trunk).
   Observations rise from foundations to abstractions, which is the v3 crux
   story. Pure SMIL, zero JS animation loop, ~20 lines. Skipped entirely
   under reduced motion.
2. Scroll-driven growth - the trunk draws down as the first half of the
   scroll (pathLength-normalized dashoffset), then each layer buds in,
   deepest foundation first. One passive rAF-throttled scroll listener.
   Skips its wiring under reduced motion and renders the full tree.
3. Node lifecycle animation - cards, labels and the root bud in staggered by
   depth via a CSS `--mt-delay` per element (deterministic hash, as in the
   reference). CSS only; the reduced-motion media query kills it.
4. Cladogram strokes and card layout unchanged - the prototype re-ports the
   exact v1 geometry (280px cards, 74px root, 36px divergence step) so the
   motion lands on the real tree shape, not a fantasy one.

**Does not ship (this ticket):**

- Parallax depth lag - the map page tree is a fixed-viewport artifact, not a
  long landing page; scroll growth already gives the alive feel.
- Cursor-as-water-source hydrotropism - mousemove tracking on a knowledge
  artifact; hover already opens the node panel (ticket 04's turf).
- Root hairs + bark grain filter (feTurbulence displacement) - decorative
  noise that costs rendering and reads as clutter on a card-based tree.
- Tooltip card and hover gold shimmer - interaction, belongs to ticket 04's
  hover/popover work.
- The React/Vite stack itself - motion only, never the stack.

**Reduced-motion contract (how it is respected):**

- JS gate: `matchMedia("(prefers-reduced-motion: reduce)")` checked once at
  build. When reduce: the sap group is NOT created (SMIL cannot be reliably
  killed by CSS), the scroll listener is NOT wired, and the full tree
  renders instantly. The static tree is identical with and without motion.
- CSS backstop: a `prefers-reduced-motion: reduce` media query kills all
  animations and transitions.
- The demo page simulates both paths: a checkbox forces reduced motion and
  the header shows the live OS setting, so both behaviors are reviewable
  without touching the OS.

**Verification:**

- `node --check` clean on both modules.
- Headless-browser DOM check: default combo renders 6 branches, 8 cards,
  7 sap pulses (1 trunk + 6 branches), 15 staggered buds; reduced combo
  renders 0 sap pulses, 0 buds, trunk fully drawn; growth math reveals
  physics (deepest) first and the apps layer (crown-most) last.
- `npm test`: 4 failures pre-exist from the concurrent ticket 03 session's
  uncommitted `src/lib/agent/realityMap.js` edits - identical count with and
  without this prototype dir present; nothing here is imported by src/.
- `npx tsc --noEmit`: clean (new files live under .scratch, outside src/).
