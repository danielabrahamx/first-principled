# First-Principled - Context

An AI tutor. The learner types a thing in reality; the agent builds a
Reality Map from the model's knowledge. The Tree is the product surface: a
first-principles dependence path of that map. This effort is Tree-only:
Tutor is parked from the chrome. A rabbit hole is an invitation to go
study a node, not a nested generated Tree. Learner Mental Model tracking
remains in the engine and is parked from the UI. Mission: reduce the
cognitive distance between the learner's mental model and reality.

## Frontier (resume here)

v6 chrome is live. One-shot scoring is parked. Current effort is v7:
a three-stage Tree builder. Map:
`.scratch/first-principled-v7/map.md`. Three stages stay in one
background init job
([Can one background agent finish three serial LLM calls](.scratch/first-principled-v7/issues/01-can-one-background-agent-finish-three-serial-llm-calls.md)).
The three-stage generator is live on prod
([Deploy the three-stage Tree](.scratch/first-principled-v7/issues/06-deploy-the-three-stage-tree.md)).
JSON Schema on Epiphanies is shipped
([Ship JSON Schema on Epiphanies](.scratch/first-principled-v7/issues/10-ship-json-schema-on-epiphanies.md)).
Prod is OpenRouter paid Nemotron
`nvidia/nemotron-3-ultra-550b-a55b`. Open frontier:
[Danny scores followability on the three-stage Tree](.scratch/first-principled-v7/issues/07-danny-scores-followability-on-the-three-stage-tree.md)
(HITL).
[Lock the thinking architecture from the council](.scratch/first-principled-v7/issues/09-lock-the-thinking-architecture-from-the-council.md)
locked Option A. Sibling display map (does not replace v7 KEEP/KILL):
`.scratch/first-principled-v8/map.md` - etymology-style Dependence
flowchart and stage-product wait-state. Poll snapshots, crown-at-bottom,
fan-in spine, Chapel look, and morph wait-state are locked. Running
stage snapshots are on the poll (2026-08-24). Chapel flowchart is
shipped on the finished Tree (2026-08-24). Next session (display
map only):
[Grow stage products in place on the Chapel flowchart](.scratch/first-principled-v8/issues/11-grow-stage-products-in-place-on-the-chapel-flowchart.md)
(AFK). Card, arrow, and hover contracts are locked.

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
  model: `stealth/ox-alpha`. Prod stays OpenRouter. JSON maps pass
  `thinking: false`, but the OpenRouter default model mandates reasoning
  and rejects `reasoning: { effort: "none" }` with HTTP 400, so on
  OpenRouter the `reasoning` field is omitted and maps run on mandatory
  provider thinking; DeepSeek still sends
  `thinking: { type: "disabled" }`. A per-stage override exists as an
  unused seam; DeepSeek Epiphanies-on was tried and failed to parse.
  Do not parse `reasoning_content` as the JSON contract. Epiphanies
  sends JSON Schema
  ([Ship JSON Schema on Epiphanies](.scratch/first-principled-v7/issues/10-ship-json-schema-on-epiphanies.md)).
  The `:free` slug cannot constrain that call. No DB, no auth, no framework.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (kept, not shown), and the LLM transport.

Source of truth: `.scratch/first-principled/spec.md` (v1 product),
`.scratch/first-principled-v7/map.md` (generator effort),
`.scratch/first-principled-v8/map.md` (display and wait-state). Immutable
mission: `docs/MISSION.md`.
