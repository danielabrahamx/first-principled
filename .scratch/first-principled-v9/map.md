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
  2026-09-10 DeepSeek official platform (`deepseek-flash`): all four
  inventories passed; all four failed on pair-batch envelope shape
  only, with sensible underlying judgments. No kill criterion
  triggered. Record: `research/01-spike-evidence.md`.
- 2026-09-29 **Ticket 01 goes.** All four gold words (laptop, battery,
  photosynthesis, recursion) pass on `deepseek-flash` after the
  envelope coercion, one predeclared attempt each. 5 calls per word,
  8 to 9s, 4 to 8 nodes, one target-to-foundation trunk each. Before
  the coercion, 0 of 4 passed. Open for Ticket 02: trunks are short
  (3 to 4 nodes against `TRUNK_MIN` 4) and two words returned only 4
  nodes, so the map may be too small to be a rabbit hole. Record:
  `research/01-spike-evidence.md`.
- 2026-09-29 the open question from 01 is decided: mechanical envelope
  tolerance, not model incapability. `normalizePairBatch` and
  `parsePairBatchText` coerce the four recorded failure shapes;
  `pairBatchProblems` is unchanged and still authoritative. Offline
  replay passes 4/4 (`research/verify-coercion.mjs`). Suite 409/409,
  lint and typecheck green.
- 2026-09-29 a replacement OpenRouter key was supplied and put in the
  gitignored `.env`. The 401 `User not found` blocker is cleared.
  `openrouter/free`, `stealth/space-bunny-alpha`, `z-ai/glm-5.3-flash`,
  and the Jev Decisions API all return 200, though `/api/v1/credits`
  reports a zero balance.
- 2026-09-29 `deepseek-flash` stays the generator route. On
  `stealth/space-bunny-alpha` the same code passes 2 of 4 gold words,
  and the two that pass produce 2-node and 3-node trees against
  DeepSeek's 4, 8, 4, 5. The free route is the cheap diagnostic, not
  the acceptance route.
- 2026-09-29 **gate bug found for Ticket 02:** `selectTopology` returns
  `ok: true` for a two-node graph. `MAX_NODES` is a cap and `TRUNK_MIN`
  is only a scoring preference, so nothing rejects a degenerate tree.
  The 2-node laptop tree on the free route is the clearest example.
- 2026-09-29 Jev (Decisions API) measured and **rejected**: one of three
  real pairs correct, and it inverts the clamshell NONE call that the
  evidence record calls informative, at 0.64 confidence. Cost was never
  the argument ($0.00006 for three calls). Rationale in the record.
- TriplyDB and RDF considered and deferred. The concept-identity half
  (labels to URIs) is a real gain and worth a spike after Ticket 01
  passes; the graph-store half is out: a 10-node per-session map does
  not want open-world inference, and RDFS reasoning would infer
  relations nobody asserted, which is the inverse of the fail-honest
  contract.
- 2026-09-29 **Ticket 02 resolved, and the honest number is worse.**
  `selectTopology` no longer accepts a degenerate tree: `MIN_TRUNK_NODES`
  (4) is applied before trunk scoring rather than inside it,
  `MIN_NODES` (5) bounds the published tree, and a crown invariant
  rejects any selected edge resting on the target. The gold rate on
  `deepseek-flash` is now 1 to 2 of 4 across four runs, against a
  recorded 4 of 4 that partly measured a 2-node stub. The gate was
  wrong; the fix is to state that, not to move the threshold.
- 2026-09-29 the cause of the short trunks is the **inventory**, read
  from the candidate labels rather than inferred: the 2026-09-29 laptop
  run returned ten parts of a laptop, all at one level, and the Ticket 01
  prompt asked for concepts "directly necessary" to the target. The
  prompt's first paragraph now asks for a set spanning several levels.
  Two escalations of that demand were measured and reverted in the same
  session: a pair-prompt paragraph about the target pushed three of four
  words to zero accepted target prerequisites, and a countable
  inventory demand dropped laptop to 2 accepted edges of 55. Do not
  escalate either. The remaining gap is judgment sparsity.
- 2026-09-29 realization ships (`src/lib/agent/pairwise/realize.js`,
  18 tests) and a human walked a `recursion` tree. A hallucinated id is
  a gate failure, not a dropped row, because silently dropping it would
  hide a model that has crossed back into r2. The walk found two
  defects, both fixed: machine phrasing lifted verbatim onto the crown
  card, and one edge id answered four times with rewordings (collapsed
  only when byte-identical). Record:
  `research/02-realization-evidence.md`.
- 2026-09-29 **the ticket 02 gate rejects two of the four hand-written
  gold maps.** Measured against `eval/map-quality/gold.js`: `recursion`
  (4 nodes) fails `MIN_NODES` = 5 and `battery` (4 nodes, depth-2 trunk)
  fails `MIN_TRUNK_NODES` = 4. `MIN_TRUNK_NODES` has lineage, it was
  ticket 01's `TRUNK_MIN`. `MIN_NODES` = 5 and the crown invariant are
  ticket 02 additions and the only recorded justification for the node
  floor was that the gold runs were failing. That is the gate fitted to
  the fixture, which is the documented v7 failure mode, committed one
  session after it was written down. `docs/STATUS.md` claimed the
  thresholds came from the product; for `MIN_NODES` that was false and
  the file is corrected by ticket 03.
- 2026-09-29 **the pipeline is not fitted to the gold words, checked by
  execution rather than by reading.** Every occurrence of a gold word in
  `src/lib/agent/pairwise/` is in a comment; prompts, schemas, and
  payload builders were run against a non-gold word and diffed, and only
  the concept string differs. The v9 generator is reachable only from
  `scripts/`, never from `eval/` or `src/api/`. Four unseen words run
  live: `sourdough` produced a 6-node trunk and 13 coherent warrants;
  `monarchy`, `supply chain`, and `memory allocation` failed, and
  `monarchy` and `memory allocation` both at `tgtOK` 0. Whether those
  failures cluster by category is ticket 03's first question, because
  the ticket four is four physical and computational mechanisms.
- 2026-09-29 the 18.5 MB of scraped vendor HTML under
  `.scratch/first-principled-v7/research/_sources/` is deleted. It was
  untracked, so the deletion is not in git history and `docs/ARCHIVE.md`
  is the record. Working tree 113.9 MB to 95.4 MB.
- 2026-10-01 **Ticket 03 answered both questions and opened no
  architecture.** Question 1, generality: 20 words across 5 categories, 4
  each, one attempt each on `deepseek-flash`, **1 of 20 passed**, and the
  failures **do not cluster by category**. Every category produced at
  least two distinct failure modes, and the physical-mechanism category,
  which is what the gold four are made of, held 2 of the 6
  `no target-to-foundation path` failures and zero passes. The one pass,
  `supply chain`, is institutional. So there is no unwritten domain
  boundary, no human product decision is owed on that question, and the
  gold four were an unlucky draw. Question 2, judgment sparsity: the
  recorded signature was wrong. `tgtBig` was **0** on 15 of the 20 words
  and 0 on every word that failed at `tgtOK` 0, across 14 attempts on 5
  words. The cause is **inversion**: the model judges each candidate as
  resting **on** the whole target, part-of read as dependence, or returns
  `NONE` with "inflation as a whole does not rest on money supply alone".
  The `TOO_LARGE` rationales name different intermediates every run
  because the inventory is redrawn per run, so they cannot recur. Kill
  criterion honoured: no targeted second pass built, negative recorded.
  Record: `research/03-generality-evidence.md`.
- 2026-10-01 **the two gate floors are wrong by one and neither has
  product lineage.** Derived offline from `eval/map-quality/gold.js` by
  `research/03-runs/derive-thresholds.mjs`, which is pure and reproduces
  the numbers without a model call. `MIN_NODES` 5 to **4** and
  `MIN_TRUNK_NODES` 4 to **3**; `MAX_FANIN_PER_TRUNK_NODE` 2 to **3**
  because it clips the canonical `laptop` fixture, and it is **not
  exported** so no test can assert on it. `MAX_NODES` 10, `MAX_PATH_NODES`
  8 and the crown invariant are unchanged and confirmed derived: all four
  hand-written maps have zero edges resting on the crown. **Proposed, not
  applied.** The product question stays open for a human: two of the four
  hand-written maps are 4 nodes with a 3-node trunk, and whether that is a
  rabbit hole is a judgement about the learner, not about the code.
  Ticket 04 stays blocked until it is answered.
- 2026-10-01 two `src/claims.test.js` defects were part of the ticket 03
  defect. The dispute test measured node count only and discarded the
  trunk floor with a `void`, which is exactly why `battery`'s
  `MIN_TRUNK_NODES` rejection shipped unmeasured for a session; it now
  measures both floors and requires the derivation and the proposal to be
  on record. A new test asserts that every non-exported constant in
  `topology.js` is named as such in the evidence file. And the honest gold
  rate is now **0 to 2 of 4 across six runs**: two identical gold runs on
  2026-10-01, minutes apart, both returned 0 of 4 with different failure
  modes, so run-to-run variance is the finding, not a defect in the
  measurement.
- 2026-10-01 **Ticket 04 applies the ticket 03 derivation and the gate
  dispute is closed.** Daniel answered the product question ticket 03
  reopened the same day: a 4-node map **is** a rabbit hole, so the
  hand-written maps are the definition and the floors take their derived
  values. `MIN_NODES` 5 to **4**, `MIN_TRUNK_NODES` 4 to **3**,
  `MAX_FANIN_PER_TRUNK_NODE` 2 to **3** (which had been clipping the
  canonical `laptop` fixture) and `TRUNK_MAX` 7 to **8**. The last two were
  module-private, so nothing could assert on either; both are exported now
  and a test fails if a future threshold is not. `MAX_NODES`,
  `MAX_PATH_NODES` and the crown invariant unchanged and confirmed derived.
  **All four hand-written gold maps pass the gate**, and
  `src/claims.test.js` asserts it by walking the imported maps rather than
  transcribing sizes, mutation-checked by setting `MIN_NODES` back to 5 and
  watching it name `recursion`. No prompt, coercion or validator changed.
  Record: `research/04-derived-threshold-application.md`.
- 2026-10-01 **the floors were never the binding constraint, and applying
  them proved it.** Gold set 0 of 4 before and 0 of 4 after. The 20-word
  generality set went 1 of 20 to 2 of 20, which is **inside** the recorded
  variance and is not claimed as an improvement. What moved is the failure
  mix: degenerate trunk 7 to 3, **crown invariant 2 to 6**. Words that
  stopped failing the trunk floor started failing the crown invariant,
  which is the inversion ticket 03 measured. The gate got weaker on one
  axis and the real defect got louder on another. **Inversion is now the
  open problem at 6 of 20 words**, and ticket 05 does not fix it. Ticket
  03 already recorded that no targeted second pass should be built, and the
  two prompt escalations from 2026-09-29 were reverted and must not be
  retried without new evidence.
- 2026-10-01 ticket 04 retired the test "a chain with no fan-in is
  rejected on the node minimum" and recorded the consequence rather than
  hiding it: the node floor was carrying a second duty, rejecting maps with
  no side prerequisites. Measured against the hand-written maps the
  property that separates `battery` from a bare four-node chain is **max
  fan-in** (2 to 3 against 1), not node count. **Proposed, not applied** -
  it is a new acceptance rule and ticket 04's authority was a derivation
  Daniel had already answered, not an invention.

## Open frontier

- [05 - RealityMap adapter and generated-map gate](issues/05-realitymap-adapter.md) (to be written). **Next, and no longer blocked.** The gate dispute is closed: all four hand-written gold maps pass it, and `src/claims.test.js` asserts that on every run. It assembles a generated selection into a `RealityMap` through the existing r5 rung; the seam was never the obstacle.
- The open problem is **not** the gate any more. It is the inversion: the model judges candidates as resting on the whole typed target, so 6 of 20 words in the 2026-10-01 run died on the crown invariant. That is a semantics failure at r2 and it is the largest single failure mode. Ticket 05 does not fix it, and the two prompt escalations that were tried and reverted on 2026-09-29 must not be retried without new evidence. See [04](issues/04-apply-derived-gate-thresholds.md) for the two proposals left unapplied.
- [04 - Apply the derived gate thresholds](issues/04-apply-derived-gate-thresholds.md) is resolved (2026-10-01). Do not rewrite it.
- [03 - Generality and gate provenance](issues/03-generality-and-gate-provenance.md) is resolved (2026-10-01, research only, no code changed). Do not rewrite it.
- [02 - Surface realization and honesty](issues/02-surface-realization-and-honesty.md) is resolved (2026-09-29). Do not rewrite it.
- [01 - Pairwise falsification spike](issues/01-pairwise-falsification-spike.md) is resolved (2026-09-29, GO). Do not rewrite it.

## Not yet specified

- Tickets after 05 (transport hardening, job integration, Chapel
  edge-history adapter, delete the killed runtime, live gold acceptance
  and Danny walk). They graduate from a working adapter, so writing any of
  them now is writing against an assembly layer that does not exist.
- Whether 06 renumbers again when the max fan-in rule is decided.

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
02 -> 03 generality and gate provenance        (renumbered 2026-09-29)
03 -> 04 apply the derived gate thresholds    (inserted 2026-10-01)
04 -> 05 RealityMap adapter and generated-map gate
05 -> 06 transport hardening
06 -> 07 job integration (atomic init switch)
07 -> 08 Chapel edge-history adapter
08 -> 09 delete the killed runtime
09 -> 10 live gold acceptance and Danny walk
```

Ticket 03 was inserted on 2026-09-29 and the downstream sequence
shifted. Only the adapter had actually been named before that, so the
renumber touched no written ticket. It went in ahead of the adapter
because the adapter is blocked on a disputed gate, and a ticket that
documents the dispute is cheaper to write than one that argues about it
inside a build.

Ticket 03 was worked on 2026-10-01 and changed no threshold. Daniel
answered the product question it reopened the same day, so the applying
ticket took number **04** and the adapter shifted to **05**. The renumber
touched no written ticket, because the adapter had never been written.
Same pattern as the 03 insert, one level down.
