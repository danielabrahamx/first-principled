# 13 - UI redesign (orb design, from design spec)

**Type:** task
**Status:** ready-for-agent
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
