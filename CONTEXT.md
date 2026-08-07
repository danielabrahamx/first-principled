# First-Principled - Context

An AI tutor. The learner types a word or phrase; the agent builds a Reality
Map from the model's knowledge, then a Socratic conversation extracts and
refines the learner's Mental Model against it. The gap between the two maps
drives every question. Mission: reduce the cognitive distance between the
learner's mental model and reality.

Current architecture (v1):

- Static frontend, two pages: chat and map.
- One stateless serverless function on Netlify, POST /api/agent. State comes
  in with every request and goes out with the response. It stores nothing.
- The Mental Model Graph has two sides: the Reality Map (canonical, from the
  model's knowledge, contiguous layer chain) and the Learner Mental Model
  (node states, confidence, evidence, updated each turn).
- DeepSeek via OpenAI-compatible API. No DB, no auth, no framework.
- `src/lib/agent/` holds the engine: reality map generation, the Socratic
  turn loop (question, infer, update the learner map, track failed attempts
  for the explanation fallback), and the LLM transport. The model replies
  with `{reply, learnerMap, probe}`; the function computes the diff and
  carries the failed-attempt counts.

Source of truth: `.scratch/first-principled/spec.md` (product) and
`.scratch/first-principled/map.md` (build state). Immutable mission:
`docs/MISSION.md`.
