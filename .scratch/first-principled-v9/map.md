# First-Principled v9 - Pairwise Dependence generator

**Effort:** Replace the Chronology -> Epiphanies -> Connect generator with a
greenfield pairwise Dependence generator behind the existing POST
/api/agent init path. The model judges local prerequisite pairs; code
selects topology; the model realizes copy; code assembles the RealityMap.
**Planning source:** Part A evaluation (ordered funnel falsified; global
graph inference overloaded; code-synthesized edges) plus Part B
implementation prompt (three semantic waves, at most six LLM calls).
**Resume:** v7 funnel falsified by its own rule (Arrange preserved
Chronology as a flat list on 3/4 gold words, disregarded it on the
fourth; all four learner maps empty). Ticket 11 fixed shape but kept one
global edge-set call over a contaminated inventory with no completed live
gold run. v8 Chapel geometry, job/poll envelope, transport, and MMG base
shape are battle-tested and retained.

## Destination

A learner types laptop, battery, photosynthesis, or recursion and receives
a non-empty, mechanically valid, followable Dependence Tree. The typed
concept is the crown at the bottom, one trunk is easy to walk, genuine
side prerequisites fan in, cards hold label, layer caption, and short
gloss, arrows hold the `because` warrant, history appears on arrow hover
only when known. The four gold words are the acceptance set. Danny scores
one predeclared run per word 0/1 on foundations, no invented history,
relationships are the point, would open a rabbit hole.

## Notes

- One session, one ticket (research excepted).
- Do not edit docs/MISSION.md. Mission: reduce the cognitive distance
  between the learner's mental model and reality.
- Drawn relation is Dependence: A rests on B only when A cannot exist or
  be understood without B at adult teaching granularity. No chronology,
  discovery order, invention order, or generic field sequences in
  topology.
- UNKNOWN is first-class. Never invent a discoverer, date, observation,
  or exactness to satisfy a gate.
- Three semantic waves, at most six LLM calls: one inventory call, up to
  four independent pair batches (bounded parallelism, max three
  concurrent), one copy/history call. The model never emits a global
  graph, layout, layers, trunk, crown, or provenance.
- Old runtime generator stays active while the Ticket 01 spike runs
  locally. No prod switch, no fallback chain, no client-chained stages.
- New generator lives in separate modules under
  `src/lib/agent/pairwise/`. Old `realityMap.js` / `arrange.js` runtime
  paths are untouched until the atomic switch ticket.
- Greenfield switch is atomic with no runtime fallback. Transport, job,
  API, MMG, and Chapel seams are the strangulation boundary.
- Style: single dashes, no emojis. Windows/PowerShell-tested. Docs in the
  same commit as the code they describe.
- Never commit secrets. Never log keys or hidden reasoning.

## Decisions so far

- v9 created 2026-09-10 from the Part A verdict: the ordered Chronology
  funnel anchors every later call, Epiphanies duplicates topology as
  evidence, Connect asks one response for a global graph, and code forces
  it drawable via crown synthesis, proxy-scored cycle drops, forced
  retention, and a fixture-specific listness heuristic. Replace the task
  graph; keep job, polling, transport, MMG, and Chapel boundaries.
- Ticket 01 scopes the smallest live falsification spike: inventory plus
  exhaustive local pair judgments plus pure topology selection, with a
  diagnostic CLI. No realization, no Chapel, no prod switch, no repair,
  no history.
- 2026-09-10 Ticket 01 partial: `src/lib/agent/pairwise/` (inventory,
  pairs, judgments, topology) plus 25 unit tests plus
  `scripts/pairwise-spike.mjs` ship; `node --test` 394/394, lint and
  typecheck green. Live: recursion attempt 1 failed honestly at pair
  validation (SMALL on NONE rows), laptop blocked on 402 credits.
  Record: `research/01-spike-evidence.md`. Go/kill undecided.

## Open frontier

- [01 - Pairwise falsification spike](issues/01-pairwise-falsification-spike.md) (unblocked; next)

## Not yet specified

- Ticket 02 (surface realization and honesty) through Ticket 08 (live
  gold acceptance and Danny walk) graduate only if Ticket 01 goes.
- Whether ticket numbering stays 02-08 per the Part B sequence.

## Out of scope

- Chronology, Epiphanies, Connect retunes or repair loops.
- Critic model call, forced branches, longer timeouts, 65k completion
  budgets, reasoning_content parsing.
- Tutor, transfer, Socratic, Learner Mental Model chrome or redesign.
- React, DB, Mastra/LangGraph, SSE, accounts, web grounding.
- Nested Trees, cross-concept linking, discovery timeline surface.

## Ticket sequence (dependency overview)

```
01 pairwise falsification spike (inventory + pairs + topology, local CLI)
01 -> 02 surface realization and honesty
02 -> 03 RealityMap adapter and generated-map gate
03 -> 04 transport hardening
04 -> 05 job integration (atomic init switch)
05 -> 06 Chapel edge-history adapter
06 -> 07 delete the killed runtime
07 -> 08 live gold acceptance and Danny walk
```
