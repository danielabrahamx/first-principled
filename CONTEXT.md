# First-Principled - Context

An AI tutor. The learner types a word or phrase; the agent builds a Reality
Map from the model's knowledge. The Tree is the product surface: a
chronological phylogenetic cladogram of that map. A docked Tutor is optional
Q&A. Learner Mental Model tracking remains in the engine and is parked from
the UI. Mission: reduce the cognitive distance between the learner's mental
model and reality.

## Language

**Tree**:
The product surface. A chronological phylogenetic cladogram of one concept:
crown at the top, foundations at the bottom, layers hanging left and right
of a central trunk.
_Avoid_: Map (as a page or tab name), Reality (as a tab name), Ask

**Reality Map**:
The canonical data for a concept: layers, nodes, edges, and observation
records. What the Tree renders.
_Avoid_: Reality tab, the map

**Tutor**:
Optional docked Q&A beside the Tree.
_Avoid_: Chat page, Ask, Chat (as a nav item)

**Learner Mental Model**:
The learner's believed structure of the concept. The engine still tracks it;
this effort does not show it as a tab or page.
_Avoid_: Map tab, learner map (as a nav label)

Current architecture (v1):

- Static frontend, one home surface: the Tree. Tutor is an optional dock,
  closed by default.
- One stateless serverless function on Netlify, POST /api/agent. State comes
  in with every request and goes out with the response. It stores nothing.
- The Mental Model Graph has two sides: the Reality Map (canonical, from the
  model's knowledge, contiguous layer chain) and the Learner Mental Model
  (node states, confidence, evidence, updated each turn). Learner Mental
  Model tracking remains in the engine (`src/lib/agent/`, `src/lib/mmg/`)
  and is parked from the UI.
- DeepSeek via OpenAI-compatible API. No DB, no auth, no framework.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (question, infer, update the learner map, track failed attempts
  for the explanation fallback), and the LLM transport. The model replies
  with `{reply, learnerMap, probe}`; the function computes the diff and
  carries the failed-attempt counts.

Source of truth: `.scratch/first-principled/spec.md` (v1 product),
`.scratch/first-principled-v4/map.md` (current effort). Immutable mission:
`docs/MISSION.md`.
