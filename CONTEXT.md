# First-Principled - Context

An AI tutor. The learner types a thing in reality; the agent builds a
Reality Map from the model's knowledge. The Tree is the product surface: a
first-principles dependence path of that map. This effort is Tree-only:
Tutor is parked from the chrome. A rabbit hole is an invitation to go
study a node, not a nested generated Tree. Learner Mental Model tracking
remains in the engine and is parked from the UI. Mission: reduce the
cognitive distance between the learner's mental model and reality.

## Frontier (resume here)

v6 charted. Tickets 01-04 resolved (OpenRouter is the LLM transport;
how-it-works prototype recommends variant A; Tutor is parked from chrome).
Open frontier: Ship how-it-works into the Tree home, Node panel is an
invitation card, Reality Map quality eval. Map:
`.scratch/first-principled-v6/map.md`.

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
_Avoid_: chronology (as layout sort), ancestry, sibling branch

**Reality Map**:
The canonical data for a concept: layers, nodes, edges, and observation
records. What the Tree renders.
_Avoid_: Reality tab, the map

**Layer**:
A named caption on the Tree (physics, digital logic). Pedagogical grouping,
not a spatial branch.
_Avoid_: cladogram branch, column

**Foundation**:
The deepest observable layer a thing rests on. What the word box asks the
learner to start from.
_Avoid_: atomic facts, atomic principles

**Rabbit hole**:
A node as an invitation to go study that thing. Inspect, then read. Not a
nested generated Tree.
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
  chrome (toggle and bottom sheet removed). How it works and the empty-Tree
  sentence ship in ticket 05.
- One stateless serverless function on Netlify, POST /api/agent. State comes
  in with every request and goes out with the response. It stores nothing.
- The Mental Model Graph has two sides: the Reality Map (canonical, from the
  model's knowledge, contiguous layer chain) and the Learner Mental Model
  (node states, confidence, evidence, updated each turn). Learner Mental
  Model tracking remains in the engine (`src/lib/agent/`, `src/lib/mmg/`)
  and is parked from the UI.
- OpenRouter via the OpenAI-compatible API (`LLM_API_KEY`, `LLM_MODEL`,
  `LLM_BASE_URL`). Default: `nvidia/nemotron-3-ultra-550b-a55b:free`.
  No DB, no auth, no framework.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (kept, not shown), and the LLM transport.

Source of truth: `.scratch/first-principled/spec.md` (v1 product),
`.scratch/first-principled-v6/map.md` (current effort). Immutable mission:
`docs/MISSION.md`.
