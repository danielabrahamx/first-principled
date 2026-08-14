# First-Principled v5 - Build Map (MAIN FRONTIER)

**Effort:** Make the Tree a first-principles dependence path the learner can
actually follow, and stop the Tutor from stealing the canvas.
**Planning source:** wayfinder grilling 2026-08-13 (Cursor). v4 shipped a
tree-first shell whose cladogram is too horizontal, whose within-layer
date-sort puts earlier nodes above later ones, and whose 340px Tutor rail
hides the right-hand branches.

## Destination

A shipped Tree that is a first-principles dependence path: crown at the top,
foundations at the bottom, existing Reality Map edges (`built-on`,
`depends-on`, `abstraction-of`) laid out as a vertical trunk that branches
into full columns at convergence. Layers are named bands. Observation
dates stay on hover, not as the layout sort. Tutor is a bottom sheet, closed
by default, and never steals Tree width. Generator salvaged.

## Notes

- **This map carries execution.** Tickets are the rewrite, not a spec to hand
  off. One session, one ticket.
- Domain: knowledge tree as a first-principles artifact. Read `docs/MISSION.md`
  and `CONTEXT.md` before any ticket. Glossary: Tree, Dependence, Layer,
  Reality Map, Tutor, Learner Mental Model.
- Salvage: `src/lib/agent/` (reality map, observations, briefing kind) and
  `src/lib/mmg/` stay. Do not rebuild the generator. Do not trust list order
  or observation dates as chronology for layout.
- Do not touch uncommitted v2 engine-thread files (`src/lib/agent/gaps.js`,
  `confidence.js`, `eval/`). They are out of this effort.
- Reverse v4 cladogram geometry (even-right / odd-left columns). Keep v4
  one-chrome, pull Q&A (`forceBrief`), observation hovers, node panels,
  convergence chips, word input, skeleton, STE copy, zero-dep ES modules,
  `deepseek-v4-flash`.
- Motion: inherit v4 one-shot grow unless a later ticket retunes it for the
  spine. Reduced motion: instant full Tree.
- Tutor: closed by default. Pull, not push. Every dock utterance stays a
  briefing. Chrome becomes a bottom sheet, not a side rail.
- Skills: grilling + domain-modeling on HITL; prototype skill on tickets 01
  and 02; existing test/tsc/netlify-build discipline.
- Style: single dashes, no emojis. Windows/PowerShell-tested. Docs in the
  same commit as the code they describe.

## Decisions so far

<!-- grilling 2026-08-13, locked before tickets -->

- Destination: Tree is a first-principles dependence path, not a biology
  cladogram. Tutor never steals the canvas.
- Scope: chrome, geometry, ordering source, and metaphor. Generator salvaged.
- Ordering: layout existing `built-on` / `depends-on` / `abstraction-of`
  edges. Dates are hover records, not the y-sort.
- Time direction: foundations at the bottom, crown at the top. Earlier is
  lower. Electricity sits below transistor.
- Shape: vertical spine of time; parallel lineages as short ribs that meet
  at convergence nodes (`combines`).
- Tutor: bottom sheet / inspect panel. Never a side rail.
- This map ships the shell, like v4.
- 01: dependence-path prototype accepted as-is (spine from edges, electricity
  below silicon below transistor, named bands, short ribs at convergence).
  Asset: `.scratch/first-principled-v5/research/01-dependence-path-prototype/`.
- 02: compact bottom sheet (240px / 42dvh) plus spine padding so foundations
  stay reachable. Never a side rail. Asset:
  `.scratch/first-principled-v5/research/02-tutor-bottom-sheet/`.
- 03: live Tree is the dependence-path spine. Date-sort and left/right
  cladogram removed. Spec section 9 updated.
- 04: Tutor is a compact bottom sheet. The 340px side rail is gone.
  `forceBrief` unchanged.
- 05: Destination shipped. Prod
  https://first-principled.netlify.app deploy id `6a7e012e95f23a8700288a8b`.
- Danny (2026-08-13): the 44px-rib spine reads as a labeled list, not a
  tree. Extra parents of a convergence occupy full columns; card height is
  locked so SVG edges stay visible; the stage may scroll horizontally.
- Post-05 fix (2026-08-14): single-column trees shrink their cards so the
  whole tree fits the viewport at 375/320 with no horizontal scroll; trees
  with convergence columns keep the wide stage (Danny's 2026-08-13
  direction unchanged). Shipped with the four post-05 layout commits
  (convergence columns, trunk hang, hover/click, caption placement) in one
  deploy.

## Not yet specified

- Whether v4 one-shot grow still reads on a branching trunk, or needs a
  retune.
- Layer-band visual: background stripes vs labels on the spine.
- If live maps emit weak dependence edges, whether a prompt tweak (not a
  generator rebuild) is required.
- Discovery timeline (still parked).

## Out of scope

- Full generator rebuild, new stack (React, bundler, DB).
- v2 engine thread (gap selection, confidence, eval harness, prediction).
- Learner Mental Model as a tab or page.
- Timeline scrubber / session replay.
- Accounts, auth, persistence, web grounding, agent frameworks.
- Cross-concept linking.
- Reversing pull Q&A / `forceBrief`.

## Ticket sequence (dependency overview)

```
01 prototype the dependence-path Tree
01 -> 02 Tutor is a bottom sheet that does not cover the foundations
01 -> 03 ship the dependence path into the live Tree
02 + 03 -> 04 ship Tutor as a bottom sheet
03 + 04 -> 05 deploy the dependence-path shell
```
