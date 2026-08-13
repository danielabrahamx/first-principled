# First-Principled v4 - Build Map (MAIN FRONTIER)

**Effort:** Rewrite the UI shell so the Tree is actually a chronological
phylogenetic cladogram, with one navigation language and a Tutor that answers
questions about the Tree. Salvage the generation and observation engine.
**Planning source:** wayfinder grilling 2026-08-13 (Cursor). v3 closed with a
working engine and a broken shell (dual nav, vertical-path tree, scroll-gated
hide).

## Destination

A shipped tree-first shell: the learner types a word; the Tree lands as a
branching cladogram (crown at the top, foundations at the bottom, layers left
and right of a central trunk), fully readable after a one-shot grow. Tutor is
optional docked Q&A over the Reality Map. No Chat page, no learner-map tab.
Generation, observations, and gap-free layer chain stay.

## Notes

- **This map carries execution.** Tickets are the rewrite, not a spec to hand
  off. One session, one ticket.
- Domain: knowledge tree as a first-principles artifact. Read `docs/MISSION.md`
  and `CONTEXT.md` before any ticket. Glossary: Tree, Reality Map, Tutor,
  Learner Mental Model.
- Salvage: `src/lib/agent/` (reality map, observations, briefing kind, background
  polling) and `src/lib/mmg/` stay. Do not rebuild the generator.
- Do not touch uncommitted v2 engine-thread files (`src/lib/agent/gaps.js`,
  `confidence.js`, `eval/`). They are out of this effort.
- Restore v1 ticket 17 cladogram geometry (alternating left/right of a central
  trunk, 375px already passed). Keep v3 chronology, observation hovers, node
  panels, convergence chips, word input, skeleton, STE copy, zero-dep ES
  modules, `deepseek-v4-flash`.
- Motion: one-shot grow on land (trunk draws, layers bud deepest-first), then
  the Tree stays fully visible. Scroll never gates opacity. Sap pulses may
  ride after grow. Reduced motion: instant full Tree.
- Tutor: closed by default (a toggle opens the dock). Pull, not push: no
  opening Socratic probe. Every dock utterance is a briefing from the Reality
  Map.
- Skills: grilling + domain-modeling on HITL; prototype skill on ticket 01;
  existing test/tsc/netlify-build discipline.
- Style: single dashes, no emojis. Windows/PowerShell-tested. Docs in the
  same commit as the code they describe.
- v1 spec is not rewritten wholesale; AGENTS.md two-page rule dies in
  [One chrome, one route](issues/02-one-chrome-one-route.md).

## Decisions so far

<!-- grilling 2026-08-13, locked before tickets -->

- Destination: salvage the engine, rewrite the UI shell (not a full rebuild).
- Tree: branching cladogram, not the v3 vertical path.
- Surfaces: Tree is home; Tutor docked optional Q&A; no Chat page; no
  learner-map tab.
- Motion: one-shot grow on land, then fully visible.
- Tutor: briefing-style Q&A over the Reality Map, learner asks first.
- 01: prototype accepted as-is (v1 ticket 17 cladogram + one-shot elapsed grow, no scroll-gated hide). Asset: research/01-cladogram-prototype/.
- 02: one chrome, one route. Tree is home. Tutor is a closed-by-default dock. No Chat page, no learner-map tab.

## Not yet specified

- Real per-layer skeleton progress (status endpoint could expose which layer
  landed). Inherited from v3; not required to ship the shell.
- Discovery timeline (parked scrubber reframed as the Tree's own emergence).
- Whether to move off `deepseek-v4-flash` once the UI is honest.
- What the Tutor asks next if Q&A later grows back into a Socratic loop.

## Out of scope

- Full engine rebuild, new generator, new stack (React, bundler, DB).
- v2 engine thread (gap selection, confidence, eval harness, prediction).
- Learner Mental Model as a tab or page (parked, engine may still carry it).
- Timeline scrubber / session replay as learner-turn replay.
- Accounts, auth, persistence, web grounding, agent frameworks.
- Cross-concept linking.

## Ticket sequence (dependency overview)

```
01 prototype cladogram + one-shot grow
02 one chrome, one route
01 + 02 -> 03 ship cladogram + grow into the live Tree
02 + 03 -> 04 Tutor is pull Q&A over the Tree
03 + 04 -> 05 deploy the tree-first shell
```
