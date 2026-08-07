# 13 - UI redesign from Paper design

**Type:** task
**Status:** ready-for-agent
**Blocked by:** none (human design in progress; agent works when design file is ready)
**Related:** tickets 08, 09, 10, 11; `src/pages/chat.js`, `src/pages/map.js`, `src/styles.css`, `src/index.html`

## Question

How do the chat and map pages look when built from a real design instead of hand-rolled CSS?

## What

Danny is designing the chat and map pages in Paper Desktop (Windows). The
Paper MCP server (`http://127.0.0.1:29979/mcp`, wired into opencode.jsonc as
`mcp.paper`) exposes the design file as read context. The agent must:

1. Read the current design from Paper via the `paper` MCP tools (list files,
   read the canvas/DOM of the design).
2. Rebuild `src/pages/chat.js`, `src/pages/map.js`, `src/styles.css`,
   `src/index.html` to match the design: layout, spacing, typography, colors,
   states (phase pill, sending, error banner, end panel, node cards + edge
   overlay), responsive breakpoints.
3. Keep every behavior contract intact: the no-leak rule (map page never
   shows reality map content mid-session), stable error codes in
   `src/api/agent.js`, hash routing, store subscribe diff animations,
   session-end comparison link, all node:test suites green, `tsc` clean.
4. Verify in a real browser via `netlify dev` (chat flow, map page, 375px and
   desktop widths) and headless Edge DOM audit for the no-leak rule.

## Acceptance criteria

- UI matches the Paper design (visual diff against the design file).
- All 150+ existing tests still pass; typecheck clean.
- Live browser check: full chat flow + map page, both viewports.
- No-leak audit still passes (no layer names/descriptions/unengaged labels).
- Deploy target unchanged: Netlify (static `src/` + function). Nothing in
  this ticket breaks `netlify build`.
- Everything committed and pushed before done.

## Docs rule

Update spec section 9 and the map Notes if the visual language changes
(palette, type, layout system). Commit and push before done.
