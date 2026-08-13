# First-Principled - Context

An AI tutor. The learner types a word or phrase; the agent builds a Reality
Map from the model's knowledge. The Tree is the product surface: a
first-principles dependence path of that map. Tutor is optional Q&A and
must not steal the Tree's canvas. Learner Mental Model tracking remains in
the engine and is parked from the UI. Mission: reduce the cognitive
distance between the learner's mental model and reality.

## Frontier (resume here)

v5 Destination shipped.

## Language

**Tree**:
The product surface. A first-principles dependence path of one concept:
crown at the top, foundations at the bottom, a vertical trunk of
dependence that branches at convergence. Layers are named bands.
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
A named band on the Tree (physics, digital logic). Pedagogical grouping,
not a spatial branch.
_Avoid_: cladogram branch, column

**Tutor**:
Optional Q&A over the Reality Map as a bottom sheet. Closed by default.
Never a side rail; never steals Tree width.
_Avoid_: Chat page, Ask, Chat (as a nav item), dock (as a side rail)

**Learner Mental Model**:
The learner's believed structure of the concept. The engine still tracks it;
this effort does not show it as a tab or page.
_Avoid_: Map tab, learner map (as a nav label)

Current architecture (v1):

- Static frontend, one home surface: the Tree. Tutor is an optional bottom
  sheet, closed by default.
- One stateless serverless function on Netlify, POST /api/agent. State comes
  in with every request and goes out with the response. It stores nothing.
- The Mental Model Graph has two sides: the Reality Map (canonical, from the
  model's knowledge, contiguous layer chain) and the Learner Mental Model
  (node states, confidence, evidence, updated each turn). Learner Mental
  Model tracking remains in the engine (`src/lib/agent/`, `src/lib/mmg/`)
  and is parked from the UI.
- DeepSeek via OpenAI-compatible API. No DB, no auth, no framework.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (kept for later), and the LLM transport. The sheet forces every
  turn to a briefing (`forceBrief`): the Tutor quotes the Reality Map and
  does not open with a Socratic probe. The model still replies with
  `{reply, learnerMap, probe}`; the UI does not show the learner map.

Source of truth: `.scratch/first-principled/spec.md` (v1 product),
`.scratch/first-principled-v5/map.md` (current effort). Immutable mission:
`docs/MISSION.md`.
