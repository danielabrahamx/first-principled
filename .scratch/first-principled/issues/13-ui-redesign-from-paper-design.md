# 13 - UI redesign (orb design, from design spec)

**Type:** task
**Status:** resolved (2026-08-07)
**Blocked by:** none (design spec extracted; no Paper dependency)
**Related:** tickets 08, 09, 10, 11; `src/pages/chat.js`, `src/pages/map.js`, `src/styles.css`, `src/index.html`

## Question

How do the chat and map pages look when rebuilt from the orb design instead
of hand-rolled CSS?

## What

The design was authored in Paper (file "first-principled UI") and extracted to
`research/13-ui-design-spec.md`. The spec is the source of truth - it has the
exact palette, fonts, the orb CSS recipe, all four states (start, chat,
learner map grid, reality phylogenetic tree), and acceptance criteria. The
agent must:

1. Read `research/13-ui-design-spec.md` (the design spec - no Paper access
   needed; Paper's weekly MCP limit is irrelevant to this ticket).
2. Rebuild `src/pages/chat.js`, `src/pages/map.js`, `src/styles.css`,
   `src/index.html` to match the spec: the orb recipe (radial gradient +
   layered shadows, sizes 180/120/36/46/14px), Fraunces 800 display +
   Space Grotesk UI fonts, chapel palette, the phylogenetic tree for the
   reality view, the segmented control, composer, phase pill, error banner,
   end panel, node cards + edge overlay, responsive breakpoints.
3. Keep every behavior contract intact: the no-leak rule (map page never
   shows reality map content mid-session; the reality phylogenetic tree is
   the session-end comparison view), stable error codes in
   `src/api/agent.js`, hash routing, store subscribe diff animations,
   session-end comparison link, all node:test suites green, `tsc` clean.
4. Verify in a real browser via `netlify dev` (start state, chat flow, map
   learner grid, reality tree at session end, 375px and desktop widths) and
   headless Edge DOM audit for the no-leak rule.

## Acceptance criteria

- UI matches the design spec (orb recipe, fonts, palette, tree, states).
- All existing tests still pass; typecheck clean.
- Live browser check: full chat flow + all map states, both viewports.
- No-leak audit still passes (no layer names/descriptions/unengaged labels).
- Deploy target unchanged: Netlify (static `src/` + function). Nothing in
  this ticket breaks `netlify build`.
- Everything committed and pushed before done.

## Resolution

- Rebuilt the UI from `research/13-ui-design-spec.md` (the "chapel" design,
  exact values taken from the spec - no Paper access):
  - `src/styles.css` - full rewrite on the design tokens: ground #F3F4F6,
    surface #FFFFFF, ink #1E2228, ink-muted #5A6472, accent #5B4BC4, the four
    stained-glass state colors, border #E2E5EA, segmented track #E8EAEF. The
    orb recipe (radial-gradient at 32% 26% from #C4BAF2 through #5B4BC4 to
    #352A85 + the three-layer box-shadow) applied at all five sizes
    (180/120/36/46/14px). Fraunces 800 display + Space Grotesk UI fonts,
    loaded from Google Fonts with system fallbacks.
  - `src/index.html` - chat page rebuilt: logo row, phase pill, mid-session
    hero (120px orb + "You're exploring/refining" eyebrow + Fraunces concept
    word), message list, start panel (180px orb + headline + sub + white
    input card + orb-pill Begin), error banner, pinned composer (white 20px
    card, 46px orb up-arrow send, "Thinking..." status line), end panel.
  - `src/pages/chat.js` - hero wiring (eyebrow per phase kind mirrors the
    engine's opening rule), TUTOR/YOU labels + 36px orb avatar on agent
    messages, ink learner bubbles with the square-corner radii, send button
    keeps its glyph while the composer-status line carries "Thinking...".
    `phaseLabel`/`errorMessage` exports unchanged (chat tests untouched).
  - `src/pages/map.js` - rebuilt as the map page shell: logo row + segmented
    control (Chat / Map; at session end Map becomes "Learner map" and a
    Reality segment appears), title row (eyebrow + Fraunces word + Closeness
    "known/total" + progress bar), legend, the learner grid with the 280px
    surface cards (14/600 title, "state - 0.9" status line in the state
    color, state-colored border, thin confidence bar), and the reality
    phylogenetic tree on the Reality tab at session end. Store subscribe,
    diff animations (pop/flash/flip), no-leak rule and zero network requests
    all preserved. Navigation wired via a `navigate` option (app.js passes
    the router).
  - `src/lib/mapview/tree.js` + tests - `realityTree` (concept as root,
    each layer a branch, top layer nearest the crown), `treeLayout` (card
    geometry) and `cladogramPaths` (trunk + branch line + per-branch drops +
    in-branch connectors, stroke #B9B3E8 width 2) - the reality view renders
    the full map as a lineage, replacing ticket 10's flat layer/edge panels.
  - `src/lib/mapview/layout.js` - card constants to 280x88 (tests are
    constant-relative, so the grid math stays green).
- Spec section 9 updated (visual style + the map page's tabbed Learner
  map/Reality comparison with the tree).
- Verification: 168 node:test cases pass (164 pass, 4 pre-existing live-gated
  skips; 5 new tree tests), `tsc --noEmit` clean, `netlify build` completes.
  Scripted-session DOM audits in headless Edge via netlify dev, on the map
  and chat harnesses (deleted after the audit):
  - Mid-session map: zero leaked layer names, descriptions or unengaged
    labels; no tree, no comparison, no Reality tab; all engaged labels
    render. The no-leak rule holds.
  - Session end Reality tab: tree visible with the "ROOT - THE CONCEPT" root,
    all 6 branch labels, all 8 node cards, 10 cladogram paths (1 trunk + 1
    branch line + 6 drops + 2 connectors), grid hidden, Closeness/Gaps
    closed/Transfer metrics + assessment shown.
  - Session end Learner map tab: grid + all cards visible, tree hidden,
    metrics shown.
  - Chat flow (stubbed transport): start state (180px orb, headline, Begin),
    init (hero "You're exploring", pill Exploring, 1 orb-avatar tutor
    message), turn (YOU ink bubble, "You're refining"), end (transfer answer,
    "Transfer question passed" panel, compare link, composer hidden, pill
    Session end).
  - Computed-style audit confirms the design tokens landed exactly: orb
    radial-gradient + three-layer shadow, Fraunces/Space Grotesk, #EDEBFA
    pill, ink user bubbles, 4px/16px bubble radii, 20px composer, 280px
    16px-radius surface cards, correct/misconception borders and status
    colors, #4E8A6E progress fill, ink 16px-radius tree root, #B9B3E8 2px
    tree strokes.
- Docs updated in the same commit (spec section 9, ticket status, map).
