# 01 - Pairwise falsification spike

**Type:** task
**Status:** in-progress (spike modules, 25 unit tests, and CLI done 2026-09-10; live runs partial - recursion failed honestly at pair validation, laptop blocked on 402 credits, battery/photosynthesis unattempted)
**Blocked by:** none
**Related:** v7 map (funnel falsified), v7 ticket 11 (shape fix kept global call), Part B implementation prompt Ticket 1

## Question

Can unordered inventory plus exhaustive local pair judgments produce a
walkable target-to-foundation topology before touching Chapel or the
production init path?

## What

Build the spike in separate modules under `src/lib/agent/pairwise/`.
Keep the old runtime generator active. No prod switch.

1. Inventory contract and prompt (`inventory.js`): one LLM call input is
   the typed concept plus curious-adult baseline; output fields only
   `concept` and `candidates[{id,label,gloss,kind,foundation_fit}]`.
   Rules: 8-10 candidates, unordered, no target duplicate, opaque unique
   ids, concrete labels, one-sentence glosses, kind is copy metadata,
   foundation_fit is DEMONSTRABLE or ABSTRACT, no edges/ranks/layers/
   history/dates/discoverers/chronology. Validator rejects malformed,
   duplicate-heavy, or too-small output with `invalid_model_output`.
   No repair prompt.
2. Pair enumeration (`pairs.js`): code adds a fixed target candidate
   with reserved id, enumerates every unordered pair exactly once (max
   55 for 11 concepts), partitions into batches of 12-15. Pure and
   deterministic.
3. Pairwise judgment prompt and validator (`judgments.js`): each batch
   call receives only concept, pair_id, both endpoints (id, label,
   gloss), and the Dependence definition. Output fields only
   `judgments[{pair_id,relation,confidence,jump,rationale}]`. Enums:
   relation A_RESTS_ON_B, B_RESTS_ON_A, NONE, SAME_CONCEPT; confidence
   HIGH, MEDIUM, LOW; jump SMALL, TOO_LARGE, NOT_APPLICABLE. SMALL only
   for directional; NONE and SAME_CONCEPT use NOT_APPLICABLE. Rationale
   is one short machine-facing reason with no position or chronology
   mention. Validator demands exactly one judgment per requested
   pair_id, no unknown or duplicate ids, no added candidate ids. A
   malformed batch ends the job. No semantic repair.
4. Topology selection (`topology.js`): pure functions with unit tests.
   Merge only HIGH SAME_CONCEPT (never merge the target away; a
   candidate duplicating the target keeps the target id). Convert HIGH
   or MEDIUM directional judgments with jump SMALL into candidate
   edges (source is dependent, target is prerequisite). Ignore LOW,
   NONE, TOO_LARGE. Break directed cycles by confidence (drop MEDIUM
   before HIGH) then stable pair_id tie-break; never by prose length,
   evidence count, or array position. Enumerate simple target-to-leaf
   paths capped at eight nodes. Score trunks deterministically: all
   SMALL jumps, more HIGH first, DEMONSTRABLE foundation preferred,
   four-to-seven nodes preferred, stable ids final tie-break. Add
   strongest disjoint support paths attaching to trunk nodes: at most
   two direct fan-ins per trunk node, every branch terminates at a
   retained leaf or joins a selected path, ten total nodes max,
   connected and acyclic. No branch required: a genuine chain is legal.
   Never synthesize crown, bridge, generic, or branch edges. No valid
   target-to-foundation path means honest failure with a diagnostic.
   Output: selected node ids, directed edges, trunk foundation to
   target, deterministic ranks, internal pair provenance, dropped
   candidate and judgment diagnostics.
5. Diagnostic CLI (`scripts/pairwise-spike.mjs`): loads `.env` locally
   without printing secrets, runs inventory plus pair batches (max
   three concurrent) plus topology for one concept, prints selected
   nodes, edges, trunk, dropped candidates, call count, latency, and
   token usage. Budgets: inventory and each pair batch target at most
   4000 output tokens, 240s per-call timeout, reasoning off or lowest
   bounded effort. No repair, no realization, no history.
6. Unit tests: direction, duplicates, cycles, missing bridges, true
   chains, branching, and no synthetic edges.

Do not implement: surface realization, Chapel integration, production
endpoint switch, prompt repair, history.

## Acceptance criteria

- [x] Inventory validator accepts 8-10 unordered candidates and rejects duplicates, target duplicates, wrong counts, and malformed fields.
- [x] Pair enumeration covers every unordered pair exactly once; batching keeps 12-15 per batch; 11 concepts yield at most 55 pairs.
- [x] Pair batch validator accepts exact coverage and rejects missing, unknown, duplicate, or added ids and illegal jump combinations.
- [x] Topology selector merges only HIGH duplicates, keeps the target, drops LOW/NONE/TOO_LARGE, breaks cycles without prose-length ranking, accepts a truthful chain, keeps branching only when judged, never synthesizes an edge, and fails honestly with no path.
- [x] `node --test` green (394/394, including 25 new pairwise tests).
- [x] `npm run lint` and `npm run typecheck` green on Windows/PowerShell.
- [ ] Live CLI run on laptop, battery, photosynthesis, and recursion recorded (or blocked with evidence such as missing key or credit refusal; no secrets in the record). Go wants: all four first live runs return a target-to-foundation path, no synthesized edge, genuine fan-in where judged (recursion may be a path), all SMALL trunk jumps, at most 55 pairs, under 10 minutes, under USD 0.40 per concept.
  - 2026-09-10 OpenRouter: recursion attempt 1 failed honestly (batch 1 set SMALL on NONE rows; terminal, no repair). Laptop attempt 1 blocked on 402 credits.
  - 2026-09-10 DeepSeek official platform (`deepseek-flash`): all four inventories passed (55 pairs each); all four failed at pair-batch validation on envelope shape only (JSONL bare objects, `type` echo, keyed-object envelope, one chronology rationale). Underlying judgments sensible. Record: `research/01-spike-evidence.md`. Go/kill undecided; no kill criterion triggered.
- [ ] Kill honored if two or more gold words have no path from omitted bridges, results reproduce field order or chronology, Dependence is too inconsistent to select without invention, or the job exceeds budget. Then stop; no critic, forced branch, or longer timeout.

## Docs rule

This ticket, the v9 map line, and the spike modules land in the same
commit. No secrets in commits, logs, diagnostics, tickets, or chat.
Old runtime paths untouched.
