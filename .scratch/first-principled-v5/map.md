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
`depends-on`, `abstraction-of`) laid out as a vertical spine with short ribs
at convergence. Layers are named bands, not left/right columns. Observation
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

## Not yet specified

- Whether v4 one-shot grow still reads on a spine-and-ribs Tree, or needs a
  retune.
- Layer-band visual: background stripes vs labels on the spine.
- If live maps emit weak dependence edges, whether a prompt tweak (not a
  generator rebuild) is required.
- Bottom-sheet height vs scroll after [Tutor is a bottom sheet that does not cover the foundations](issues/02-tutor-is-a-bottom-sheet.md) has been seen.
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
