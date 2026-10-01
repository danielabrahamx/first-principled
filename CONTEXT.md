# First-Principled - Context

> **Read `docs/STATUS.md` first.** It is the single source of current
> truth. This file is the domain vocabulary and the long-form
> architecture, and it is deliberately *behind* STATUS.md on anything
> time-sensitive. If the two disagree, STATUS.md and the code win.

An AI tutor. The learner types a thing in reality; the agent builds a
Reality Map from the model's knowledge. The Tree is the product surface: a
first-principles dependence path of that map. This effort is Tree-only:
Tutor is parked from the chrome. A rabbit hole is an invitation to go
study a node, not a nested generated Tree. Learner Mental Model tracking
remains in the engine and is parked from the UI. Mission: reduce the
cognitive distance between the learner's mental model and reality.

## Frontier (resume here)

**v9 is the live effort.** Map:
`.scratch/first-principled-v9/map.md`. Tickets 01 to 04 are resolved. 01
(pairwise falsification spike) and 02 (surface realization and honesty)
are a GO on `deepseek-flash`. 03 (generality and gate provenance,
2026-10-01) was research and changed no code. 04 (apply the derived gate
thresholds, 2026-10-01) applied it.

**The next ticket is 05, the RealityMap adapter, and it is unblocked.**
The gate dispute is closed: all four hand-written gold maps in
`eval/map-quality/gold.js` pass the gate, and `src/claims.test.js`
asserts that on every run.

**The open problem is the model's semantics, not the gate.** Asked
whether the typed target rests on a candidate, the model frequently
answers that the *candidate* rests on the target - part-of read as
dependence - so the crown invariant correctly rejects the map. That is
6 of 20 words in the 2026-10-01 run and the largest single failure mode.
It is a semantics failure at r2, the class v6 and v7 died of. Do not
escalate the pair prompt or the inventory demand for it: both were
measured on 2026-09-29 and reverted the same session, and ticket 03
found the model's refusals do not name the same missing bridges twice.

Evidence, most recent last:
`.scratch/first-principled-v9/research/01-spike-evidence.md`,
`02-realization-evidence.md`, `03-generality-evidence.md`,
`04-derived-threshold-application.md`.

**v7 is dead but still in prod.** The three-stage generator
(Chronology -> Epiphanies -> Arrange) is falsified: Arrange preserved
Chronology as a flat list on 3 of 4 gold words. It is retained only
because the Chapel chrome, job/poll envelope, transport, and MMG base
shape are battle-tested. Its map and issues are history:
`.scratch/first-principled-v7/`. Do not retune its prompts; the task
graph is the problem, and the reasoning is in `docs/FALSIFIED.md`.

**v8 (Chapel display) is shipped**, not planned. The etymology-style
Dependence flowchart, crown-at-bottom, fan-in spine, card/arrow/hover
contracts, and morph wait-state are all live. Its map describes display
work that is done: `.scratch/first-principled-v8/map.md`.

Everything under `.scratch/first-principled-v*/` other than v9 is
closed. Ten `map.md` files exist because the effort ran for ten
versions; only the v9 one is current.

## Language

**Tree**:
The product surface. A first-principles dependence path of one concept,
drawn as a Chapel flowchart. Supporting knowledge sits at the top; the
typed concept (crown) sits at the bottom. The trunk is that downward
spine. Extra parents merge in from the side. Each card is `label`, a
layer caption, and `description`. Downward arrows carry `because` as the
Epiphany warrant, or stay unlabeled. Hover on a labeled arrow shows
known discoverer and date, never the full observation record.
_Avoid_: hanging-card cladogram, Map (as a page or tab name), Reality (as a
tab name), Ask, phylogenetic tree (as the product metaphor)

**Dependence**:
The relation the Tree draws. Node A rests on node B when A cannot exist or
be understood without B. Already present on the Reality Map as `built-on`,
`depends-on`, and `abstraction-of` edges. Not discovery-date order.
_Avoid_: chronology (as layout sort), ancestry (as the Tree relation), sibling branch

**Chronology**:
A generation scaffold: a short, target-relative chain of capability
regimes that made the target possible. Physical ancestry is the default
spine; human discovery is not. Include a regime only if removing it
would break a reasonably direct account of the target. The Tree still
draws Dependence.
_Avoid_: discovery history, invention list, universal ancestry, Tree trunk,
timeline (as the product surface)

**Regime**:
A named period in which a new target-specific capability exists.
Chronology is a chain of these, not of events, people, or calendar dates.
_Avoid_: era, invention, event, historical period

**Epiphany**:
The result that warrants a rest-on. On the Tree it sits on the downward
arrow as `because`, not as its own card. Observation records live only
on Reality Map nodes marked `EPIPHANY` and appear on arrow hover when
discoverer or date is not UNKNOWN. Not a person's private insight, and
not one famous discovery per arrow.
_Avoid_: insight (as a slogan), aha, basis (as a required field on every node),
hero-and-date per transition, epiphany card

**Stage**:
One LLM call with one job while building the Tree. Chronology, then
Epiphanies, then Arrange. Each runs once, with no repair Stage. The
learner never sees Stage machinery, prompts, or inner talk. While the
job runs, the Tree may show accepted stage products from poll
snapshots. The status line is `building tree...` until Arrange
finishes. Then nodes morph into the checked Dependence Tree.
_Avoid_: another model, pipeline step, one-shot, SSE wait-state

**Reality Map**:
The canonical learner-facing data for a concept: layers, role-marked
nodes, Dependence edges, a declared trunk, and Epiphany observation
records. What the Tree renders.
_Avoid_: Reality tab, the map

**Provenance**:
The hidden diagnostic trace from final nodes and edges to Chronology and
Epiphany inputs, including explicit discard reasons. It exists to expose
Chronology capture or disregard and never appears as learner copy.
_Avoid_: citation UI, learner evidence, raw Stage output

**Layer**:
A named caption on the Tree (physics, digital logic). Pedagogical grouping,
not a spatial branch.
_Avoid_: cladogram branch, column

**Foundation**:
The deepest observable layer a thing rests on. What the word box asks the
learner to start from.
_Avoid_: atomic facts, atomic principles

**Followability**:
Whether a generated Tree is worth walking. The product default is one
walkable spine for a curious adult who opens rabbit holes. Danny scores
it 0 or 1 on every rubric line and compares three-stage against one-shot
on the four gold concepts. The automated gate is not this.
_Avoid_: quality (as a vague stand-in), tutor-question score, kid-versus-engineer
user types

**Rabbit hole**:
A node as an invitation to go understand that thing. Inspect, then study.
Not a chat topic and not a nested generated Tree.
_Avoid_: nested tree, generate from node, chat about the node

**Tutor**:
Parked from chrome. Toggle and bottom sheet are gone from the Tree home.
The engine remains (`socratic.js`, `forceBrief`, `dock.js`), unmounted.
_Avoid_: Chat page, Ask, Chat (as a nav item), dock (as a side rail)

**Learner Mental Model**:
The learner's believed structure of the concept. The engine still tracks it;
this effort does not show it as a tab, page, or node-panel chrome.
_Avoid_: Map tab, learner map (as a nav label)

Current architecture (v1):

- Static frontend, one home surface: the Tree. Tutor is parked from the
  chrome (toggle and bottom sheet removed). How it works is a header control
  plus `#how`; the empty Tree holds the foundations sentence.
- One stateless serverless function on Netlify, POST /api/agent. State comes
  in with every request and goes out with the response. It stores nothing.
- Init runs Chronology, Epiphanies, and Arrange exactly once each in one
  background job. The mechanical gate checks the role-marked Reality Map,
  declared trunk, Dependence reasons, hidden provenance, and complete
  use-or-drop accounting. Accepted Chronology and Epiphanies records may
  appear on the Tree as poll snapshots while the job is still running.
  Provenance, prompts, and inner talk stay hidden. The finished Tree is
  the checked Arrange map. There is no one-shot, per-layer, retry,
  repair, fallback, or SSE wait-state path.
- The Mental Model Graph has two sides: the Reality Map (canonical, from the
  model's knowledge, contiguous layer chain) and the Learner Mental Model
  (node states, confidence, evidence, updated each turn). Learner Mental
  Model tracking remains in the engine (`src/lib/agent/`, `src/lib/mmg/`)
  and is parked from the UI.
- OpenAI-compatible LLM via `LLM_PROVIDER=openrouter|deepseek` (default
  openrouter uses `LLM_*`; deepseek uses `DEEPSEEK_*`). Default OpenRouter
  model: `z-ai/glm-5.3-flash`, set as `OPENROUTER_DEFAULT_MODEL` in
  `llm.js` and asserted against this file by `src/claims.test.js`. The
  older `stealth/ox-alpha` and `nvidia/nemotron-3-ultra-550b-a55b`
  defaults named in the v6/v7 research notes are historical. Prod stays
  OpenRouter. JSON maps pass `thinking: false`, but the OpenRouter
  default model mandates reasoning and rejects `reasoning: { effort:
  "none" }` with HTTP 400, so on OpenRouter the `reasoning` field is
  omitted and maps run on mandatory provider thinking; DeepSeek still
  sends `thinking: { type: "disabled" }`. A per-stage override exists as
  an unused seam; DeepSeek Epiphanies-on was tried and failed to parse.
  Do not parse `reasoning_content` as the JSON contract. Epiphanies
  sends JSON Schema
  ([Ship JSON Schema on Epiphanies](.scratch/first-principled-v7/issues/10-ship-json-schema-on-epiphanies.md)).
  The `:free` slug cannot constrain that call. No DB, no auth, no framework.
- The **live generator direction is the v9 pairwise generator** under
  `src/lib/agent/pairwise/`: an inventory call, up to four independent
  pair-judgment batches, then pure-code topology selection with no model
  call, then a realization call that writes copy for a shape code has
  already chosen. Mechanical envelope coercion lives in
  `normalizePairBatch`. Nothing in the runtime imports any of it yet; the
  switch is ticket 05 and is atomic with no fallback. Its acceptance
  thresholds in `topology.js` are `MIN_NODES` = 4, `MIN_TRUNK_NODES` = 3,
  `MAX_FANIN_PER_TRUNK_NODE` = 3 and `TRUNK_MAX` = 8, all derived from
  `eval/map-quality/gold.js` and all covered by `src/claims.test.js`.
  `llm.js` and the browser client are the two transports;
  `docs/DESIGN.md` explains why the provider seam is one file.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (kept, not shown), and the LLM transport.

Source of truth for current state: `docs/STATUS.md`. Architecture and
the reasoning behind it: `docs/DESIGN.md`. Killed approaches and the
measurements that killed them: `docs/FALSIFIED.md`. Product spec:
`.scratch/first-principled/spec.md` (v1, mostly still accurate).
Current effort map: `.scratch/first-principled-v9/map.md`. Immutable
mission: `docs/MISSION.md`.
