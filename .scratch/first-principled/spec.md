# First-Principled - Product Spec (v1 MVP)

*August 2026 · Internal · MVP*

## 1. Mission (immutable)

Reduce the cognitive distance between the learner's mental model and reality.

Teaching, answering questions, finishing courses, passing exams are side effects, not objectives.

## 2. Theory of learning (immutable)

Learning is the progressive refinement of a learner's internal model of reality. It occurs by making observations, recognizing recurring patterns, constructing predictive models, testing those models, and integrating them into an increasingly coherent network of understanding. The objective is coherent understanding, not knowledge accumulation.

## 3. Core principles (immutable)

1. Reality is observed before it is explained.
2. Models are judged by predictive usefulness, not narrative appeal.
3. Understanding is measured by relationships between ideas, not isolated facts.
4. New concepts emerge naturally from the limitations of previous models.
5. Every abstraction compresses many observations into a simpler predictive framework.
6. Learners construct understanding; the agent cannot transmit it directly.
7. Productive struggle is valuable when it reveals the learner's current model.
8. Explanations minimize unnecessary cognitive load while preserving conceptual accuracy.
9. The agent continually reconnects new knowledge to existing structures.
10. The ultimate goal is independent reasoning, not dependence on the tutor.
11. The agent teaches the same way reality taught humanity: observations before theories, theories before abstractions, abstractions before engineering; engineering creates new observations; the cycle repeats. The learner retraces the path by which understanding was built.
12. No skipped intermediate steps. The path from observation to abstraction is contiguous; gaps in the chain become gaps in understanding.

## 4. Product concept (v1)

A web app. The learner types a word or phrase (laptop, recursion, photosynthesis). The agent builds a Reality Map of that thing from the model's own knowledge. A Socratic conversation on a chat page extracts and refines the learner's Mental Model against it, driven by the gap between the two maps. A separate map page shows the learner's model updating live after every turn. When the session ends, the learner sees both maps compared, the closed gaps, and answers a transfer question.

## 5. Target user and scope

Founders building things, learning as they build, avoiding technical debt. v1: one learner per browser, no accounts, no server-side storage. Sessions are ephemeral: all state lives only for the duration of the chat. Input is a single word or phrase; no goal context in v1.

## 6. Architecture

- Static frontend, minimal web UI, two pages: chat and map.
- One stateless serverless function, POST /api/agent, on Netlify or Vercel. It receives the full session state with every call, calls DeepSeek, returns the reply plus the updated learner map and diffs. It stores nothing.
- No database, no auth, no agent framework.
- Client holds session state in memory (word, reality map, learner map, history, phase).
- DeepSeek via the OpenAI-compatible API. Provider, model, base URL are environment configuration.
- No web grounding in v1. The reality map comes from the model's knowledge only.

## 7. Data model (Mental Model Graph)

The central data structure is the Mental Model Graph, which has two sides.

Reality Map (canonical): typed nodes and edges describing the thing as it actually is, organized in layers. Edge types: part-of, depends-on, built-on, abstraction-of, predicts, contradicts. Layer chain is contiguous: every layer connects to its neighbors, no skipped intermediate steps. The model decides the depth with a soft cap.

Learner Mental Model: mirrors the reality map. Each node carries a state: untested, missing, misconception, correct. Confidence 0..1. Evidence: learner quotes supporting the current state. Edges carry state, confidence and evidence too. The agent updates it after every turn.

Diff: what changed this turn - nodes added, states flipped, edges added or corrected.

Closeness score: fraction of known learner nodes matching reality, per session. Known = state is not untested; a correct node matches reality. 0 when nothing is known yet.

```json
{
  "realityMap": {
    "concept": "laptop",
    "layers": [
      {"id": "l0", "name": "physics", "nodes": ["electricity"]},
      {"id": "l1", "name": "electronics", "nodes": ["transistor", "circuit"]}
    ],
    "nodes": [
      {"id": "n1", "label": "transistor", "layer": "l1", "description": "..."}
    ],
    "edges": [
      {"source": "n1", "target": "n2", "type": "built-on"},
      {"source": "n2", "target": "n3", "type": "abstraction-of"}
    ]
  },
  "learnerMap": {
    "nodes": [
      {"id": "n1", "state": "misconception", "confidence": 0.3, "evidence": ["user said X"]}
    ],
    "edges": [
      {"source": "n1", "target": "n2", "state": "correct", "confidence": 0.8, "evidence": ["user said Y"]}
    ]
  },
  "diff": {"added": [], "flipped": [{"id": "n1", "from": "misconception", "to": "correct"}], "updated": []},
  "closeness": 0.6
}
```

## 8. Core mechanism

Phases:

- Init: the learner types a word; the agent generates the Reality Map (first turn).
- Active: Socratic turns (engine: `src/lib/agent/socratic.js`). Opening rule: empty learner map means observation-first (what have you seen, used, or noticed about this thing); a populated map means gap-first (probe the biggest gaps in dependency order, lower layers before abstractions). Each turn: ask a question, update the learner map, choose the next gap. Explanation fallback: when the learner asks, or after two failed attempts on the same point. A failed attempt is an answer that leaves the point non-correct; asking a question is not a failure, and after the fallback the count restarts. If the learner has no model of a concept, the agent teaches observationally before questioning it.
- End: the agent asks a transfer question, a novel problem that requires the corrected model. The learner answers; the agent records pass or fail against the reality map. The comparison view unlocks.

Turn contract:

```
POST /api/agent
request:  {word?, realityMap?, learnerMap?, failedAttempts?, history, phase}
response: {reply, learnerMap, diff, phase, sessionEnded?, transferResult?}
```

Internals: the model returns `{reply, learnerMap, probe}` per turn, where probe reports what the turn was about (`{nodeId, kind: observe|probe|explain|converse}`). The function computes `diff` deterministically from the previous and updated learner maps (the model is never trusted to compute it) and carries `failedAttempts` forward (node id to count). `failedAttempts` is client-held session state sent with every request.

## 9. UX

- Chat page: word input, conversation, sending state, phase indicator.
- Map page: separate route. Renders the learner's model only: nodes colored by state (untested gray, missing red, misconception orange, correct green), edges, confidence. Animates changes from each turn's diff. Never shows reality map content mid-session.
- Session end: comparison view - reality map vs learner map, closed-gap summary, closeness score, transfer result.

## 10. Metrics

- Gap closure per session: count of flips from missing or misconception to correct.
- Transfer question pass or fail per session.
- Closeness score trend across turns.

## 11. Deployment

Netlify or Vercel: static frontend plus one function. Environment: LLM_API_KEY, LLM_MODEL, LLM_BASE_URL. The key is a platform secret, never client-side. Live URL recorded in README.

## 12. Out of scope (v2)

- Web grounding, RAG, tool use.
- Accounts, auth, server-side persistence, cross-device sync.
- Cross-concept linking (laptop to CPU).
- Server-side memory, multi-agent orchestration, agent frameworks (Mastra, LangGraph).
- Mobile or native clients.

## 13. Glossary

- Reality Map: the canonical typed graph of the thing, from the model's knowledge.
- Learner Mental Model: the learner's current understanding as inferred by the agent.
- Mental Model Graph: the combined two-sided structure.
- Gap: a learner node or edge that differs from the reality map.
- Misconception: a learner node whose content conflicts with reality.
- Confidence: 0..1 estimate that the learner's state is accurate.
- Evidence: learner utterances the state is based on.
- Closeness score: fraction of known learner nodes matching reality.
- Transfer question: a novel problem requiring the corrected model.
- Layer chain: ordered layers of the reality map, contiguous.
- Diff: per-turn changes to the learner map.
- Socratic engine: the agent behavior that questions instead of explains.
- Stateless function: serverless endpoint that stores nothing between calls.
- Phase: init, active, end.
