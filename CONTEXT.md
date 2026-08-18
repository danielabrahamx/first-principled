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
Open frontier:
[Danny scores followability on the three-stage Tree](.scratch/first-principled-v7/issues/07-danny-scores-followability-on-the-three-stage-tree.md).

## Language

**Tree**:
The product surface. A first-principles dependence path of one concept:
crown at the top, foundations at the bottom, a continuous trunk with
cards hanging off it. Extra parents branch to the other side. Layers are
captions on the hang, capped to the card width, not table rows.
_Avoid_: Map (as a page or tab name), Reality (as a tab name), Ask, cladogram,
phylogenetic tree (as the product metaphor)

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
The result that warrants a transition between two regimes. Observation
records live only on Reality Map nodes explicitly marked `EPIPHANY`.
Not a person's private insight, and not one famous discovery per arrow.
_Avoid_: insight (as a slogan), aha, basis (as a required field on every node),
hero-and-date per transition

**Stage**:
One LLM call with one job while building the Tree. Chronology, then
Epiphanies, then Arrange. Each runs once, with no repair Stage. The
learner never sees a Stage, only the checked Tree.
_Avoid_: another model, pipeline step, one-shot

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
  use-or-drop accounting. Only the checked map crosses the learner-facing
  boundary. There is no one-shot, per-layer, retry, repair, or fallback path.
- The Mental Model Graph has two sides: the Reality Map (canonical, from the
  model's knowledge, contiguous layer chain) and the Learner Mental Model
  (node states, confidence, evidence, updated each turn). Learner Mental
  Model tracking remains in the engine (`src/lib/agent/`, `src/lib/mmg/`)
  and is parked from the UI.
- OpenAI-compatible LLM via `LLM_PROVIDER=openrouter|deepseek` (default
  openrouter uses `LLM_*`; deepseek uses `DEEPSEEK_*`). Default OpenRouter
  model: `nvidia/nemotron-3-ultra-550b-a55b:free`. Prod stays OpenRouter.
  JSON maps send `thinking: false`: OpenRouter
  `reasoning: { effort: "none" }`, DeepSeek
  `thinking: { type: "disabled" }`. A per-stage override exists;
  DeepSeek Epiphanies-on was tried and failed to parse. No DB, no auth,
  no framework.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (kept, not shown), and the LLM transport.

Source of truth: `.scratch/first-principled/spec.md` (v1 product),
`.scratch/first-principled-v7/map.md` (current effort). Immutable mission:
`docs/MISSION.md`.
