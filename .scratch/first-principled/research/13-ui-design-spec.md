# 13 - UI design spec (extracted from Paper, no Paper dependency)

Source: the Paper file "first-principled UI" (file 01KZEX7KY80S6PB7GME7ERMXK1),
authored via the Paper MCP server 2026-08-07. Paper's weekly MCP limit blocks
further reads/writes; this spec captures the design intent with exact values so
the code rebuild needs no Paper access. Where the Paper canvas and this spec
disagree, THIS spec wins (it records the fixes applied via update_styles).

## Mood

"chapel" - slate x amethyst. A contemplative study-room register for a Socratic
tutor: calm light ground, one intense color moment (the amethyst orb), and
stained-glass semantic colors for mental-model states.

## Design tokens (exact)

- ground: `#F3F4F6` (page background)
- surface: `#FFFFFF` (cards, bubbles, input)
- ink: `#1E2228` (primary text; also the learner bubble + reality root card background)
- ink-muted: `#5A6472` (labels, secondary text)
- accent: `#5B4BC4` (amethyst; tutor voice, pill, orb core)
- accent-soft: `#EDEBFA` (pill background)
- untested: `#94A3B8`, missing: `#C25B5B`, misconception: `#C98A3D`, correct: `#4E8A6E`
- border: `#E2E5EA`
- segmented-control track: `#E8EAEF`
- display font: **Fraunces 800** (concept word, headline, closeness number)
- UI font: **Space Grotesk** (everything else; 500/600 weights for labels)
- radii: cards 16px, input 20px, pills 999px, segmented control 12px (track) / 9px (segments)

## The orb (the tutor's body)

The tutor is a glowing amethyst sphere. Reusable CSS recipe:

```css
.orb {
  border-radius: 999px;
  background: radial-gradient(circle at 32% 26%, #C4BAF2, #5B4BC4 52%, #352A85 100%);
  box-shadow:
    0 16px 48px rgba(91, 75, 196, 0.45),
    inset -6px -10px 24px rgba(30, 20, 80, 0.35),
    inset 8px 10px 20px rgba(255, 255, 255, 0.25);
}
```

Sizes by role: hero 180px (start state), 120px (chat header), 36px (tutor
message avatar), 46px (send button), 14px (logo dot).

## Start state

- Top: logo row (14px orb dot + "first-principled" Space Grotesk 14/600 ink).
- Centered column: 180px hero orb; label "The Socratic orb is listening"
  (Space Grotesk 15/500, ink-muted, 0.14em tracking, uppercase); headline
  "What would you like to understand?" (Fraunces 800, 56px, line-height 64px,
  ink, -0.02em); sub "A word or phrase - laptop, recursion, photosynthesis.
  The orb will help you map what you actually know." (Space Grotesk 17/400,
  ink-muted, 26px line-height, width 540px, centered).
- Input row: white card (20px radius, 1px border, soft shadow
  `0 8px 28px rgba(30,34,40,0.06)`), placeholder "Type a word or phrase...",
  and a Begin button that is itself a mini-orb pill (orb gradient,
  padding 12px 24px, radius 14px, white text 14/600).

## Chat page (mid-session)

- Header: logo dot + wordmark left; right side a soft pill
  (accent-soft bg, "Socratic session" Space Grotesk 12/600 accent,
  0.06em tracking, uppercase).
- Hero row (56px below header): 120px orb on the left; right column:
  "You're exploring" (Space Grotesk 13/500 ink-muted 0.1em uppercase) over
  the concept word "laptop" (Fraunces 800, 64px, 70px line-height, ink,
  -0.02em, single line).
- Tutor message: 36px orb avatar; card (surface, 1px border, radius
  4px 16px 16px 16px - square corner points AT the tutor); "TUTOR" label
  (Space Grotesk 11/600 accent 0.08em uppercase); body Space Grotesk 16/400
  ink 26px line-height, max-width 640px.
- Learner message: right-aligned, ink `#1E2228` bubble (radius
  16px 16px 4px 16px - square corner points AT the learner); "YOU" label
  (Space Grotesk 11/600 `#B9C0CC`); body white 16/400 26px line-height,
  max-width 520px.
- Composer (pinned bottom): white card (20px radius, 1px border, soft
  shadow), padding 10px 10px 10px 22px; placeholder "Your answer... (Enter
  to send)" Space Grotesk 16/400 `#8A94A3`; 46px orb send button with white
  "up arrow" (Space Grotesk 20/600).

## Map page - learner model (grid)

- Header: logo row; segmented control (track `#E8EAEF`, 4px padding, 12px
  radius; segments: "Chat", "Map" - active segment = white surface + soft
  shadow + ink 13/600, inactive = ink-muted 13/500).
- Title row: left "Your mental model" (13/500 ink-muted 0.1em uppercase)
  over "laptop" (Fraunces 800 64px); right: "Closeness" label + "4/11"
  (Fraunces 700 32px) + 180x6px progress bar (`#E2E5EA` track, `#4E8A6E`
  fill 38%, 999px radius).
- Legend row: "Legend" label + 4 items (10px state-color square, radius 3px,
  label Space Grotesk 12/500 ink-muted): correct / misconception / missing /
  untested.
- Layer rows: "LAYER N - NAME" (11/600 ink-muted 0.1em uppercase); row of
  node cards: 280px wide, surface, 16px radius, 18px padding, column gap 8px.
  Card title Space Grotesk 14/600 ink; status line Space Grotesk 12/500 in
  the state color, format "state - 0.9" (state-colored border: misconception
  `#C98A3D`, missing `#C25B5B`, correct `#4E8A6E`, default `#E2E5EA`).

## Map page - reality version (phylogenetic tree)

Why a tree: a reality map IS a lineage. Every concept in the map is built on
simpler concepts beneath it (`built-on` / `part-of` / `depends-on` edges),
which is exactly the branching structure of a phylogenetic tree. The concept
is the crown; its foundations branch down like ancestry. The reality view
must render the learner model's target (the full reality map) as this tree.

- Header: logo row; three-segment control: Chat / Learner map / Reality
  (Reality = active).
- Root node: centered dark card (ink `#1E2228`, 16px radius, 10px shadow
  `0 10px 32px rgba(30,34,40,0.18)`, padding 14px 36px): "ROOT - THE
  CONCEPT" (Space Grotesk 12/600 `#8B94A3` 0.1em uppercase) over "laptop"
  (Fraunces 700 28px white).
- Cladogram connectors: SVG elbow paths, stroke `#B9B3E8`, strokeWidth 2,
  fill none. Vertical trunk from the root down; each layer diverges from the
  trunk at its own depth (a `TREE_DIVERGENCE_STEP` of 36px per layer - the
  top layer highest, nearest the crown, the deepest foundation lowest, so
  the tree reads chronologically), a horizontal elbow from the trunk to each
  branch column at its divergence, then a vertical drop into the branch's
  cards (phylogenetic elbow style). Branch columns alternate left and right
  of the trunk, deepest nearest the trunk, so elbows never cross cards
  (ticket 17).
- Three branches side by side, each: branch label "BRANCH - COMPUTATION" /
  "BRANCH - ENERGY" / "BRANCH - PHYSICAL" (Space Grotesk 11/600 accent 0.1em
  uppercase) over stacked node cards (280px, surface, 14px radius, 14/600
  ink title):
  - Computation: processor, memory, motherboard
  - Energy: battery, power supply, charge controller
  - Physical: screen, keyboard, chassis

## Paper authoring pitfalls (do not repeat in code)

- Paper's write_html parser DROPS: borderRadius, backgroundColor,
  fontFamily, fontSize, fontWeight, lineHeight from inline styles. Fixes had
  to be re-applied with update_styles (the camelCase API). The code rebuild
  is plain HTML/CSS, so this does not apply - the spec above is the intent.
- Paper text nodes do not inherit fontFamily from parent frames.
- Paper text nodes need explicit widths or `white-space: nowrap` to avoid
  per-letter wrapping (a 64px display word squeezed to a 46px column).

## Acceptance criteria (unchanged from ticket 13)

- UI matches this spec: orb recipe, fonts (Fraunces/Space Grotesk), palette,
  three map states (learner grid + reality phylogenetic tree), both viewports.
- All existing tests still pass; typecheck clean; live browser check;
  no-leak audit (map page never shows reality content mid-session; the
  reality tree is the session-end comparison view).
- Netlify deploy target unchanged.
