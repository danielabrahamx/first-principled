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
- One stateless serverless function, POST /api/agent, on Netlify. It receives the full session state with every call, calls the live LLM, returns the reply plus the updated learner map and diffs. It stores nothing.
- No database, no auth, no agent framework.
- Client holds session state in memory (`src/state/session.js`: word, reality map, learner map, history, failedAttempts, phase, gap closures, transfer result, metrics) and sends it with every request. Home is the Tree (`#` / `#map`); `#how` is the How it works page on the same chrome; `#chat` lands on home. Navigation keeps the session. Nothing is written to disk, localStorage, or any server.
- OpenAI-compatible LLM via `LLM_PROVIDER=openrouter|deepseek`. Unset or `openrouter` uses `LLM_*`. `deepseek` uses `DEEPSEEK_*`. Default OpenRouter model: nvidia/nemotron-3-ultra-550b-a55b at https://openrouter.ai/api/v1. Prod stays OpenRouter.
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

- Init: the learner types a word; `src/lib/agent/realityMap.js` runs exactly
  three JSON-mode Stages in one background job: Chronology identifies
  target-specific capability regimes, Epiphanies identifies warranted joints,
  and Arrange builds the Dependence Tree. Each Stage runs once with no LLM
  retry, repair, fallback, or fourth semantic call. A mechanical gate checks
  the final map, roles, trunk, edge reasons, provenance, and complete
  use-or-drop accounting. Only the checked map reaches the learner;
  intermediate Stage outputs and provenance remain server-side.
- Active: Socratic turns (engine: `src/lib/agent/socratic.js`). Opening rule: empty learner map means observation-first (what have you seen, used, or noticed about this thing); a populated map means gap-first (probe the biggest gaps in dependency order, lower layers before abstractions). Each turn: ask a question, update the learner map, choose the next gap. Explanation fallback: when the learner asks, or after two failed attempts on the same point. A failed attempt is an answer that leaves the point non-correct; asking a question is not a failure, and after the fallback the count restarts. If the learner has no model of a concept, the agent teaches observationally before questioning it. Briefing (ticket 16): when the learner asks for direct information to model a decision, the tutor delivers a direct, accurate, plain-language briefing built from the reality map instead of a question.
- End: the orchestrator triggers it when every reality node is known, or the turn cap (24 learner messages) is reached. The agent asks a transfer question, a novel problem that requires the corrected model. The learner answers; the agent records pass or fail against the reality map. The comparison view unlocks.

Turn contract:

```
POST /api/agent
request:  {word?, realityMap?, learnerMap?, failedAttempts?, history, phase}
response: {reply, learnerMap, diff, phase, failedAttempts, sessionEnded?, transferResult?, realityMap?}
```

The orchestrator (`src/lib/agent/orchestrator.js`) dispatches by phase; the
Netlify function (`netlify/functions/agent/agent.mjs`) is a thin HTTP wrapper.
All session state travels in the request and the response; the function stores
nothing.

- init: word required, no realityMap. The function runs Chronology,
  Epiphanies, and Arrange serially in one background job, then returns phase
  "active" with only the checked reality map in the response. The client holds
  it from here on and sends it back with every request. The browser polls for
  up to 14 minutes; each model call retains the 240 second abort.
- active: the client sends the held reality map, learner map, failedAttempts
  and history; the function runs one Socratic turn and returns the updated
  learner map, the deterministic diff and the carried failedAttempts. When
  every reality node is known - or the session passes the turn cap (24 learner
  messages) - the function asks the transfer question instead and returns
  phase "end".
- end: history ends with the learner's answer to the transfer question (the
  assistant message before it is the question). The function grades the answer
  against the reality map and returns sessionEnded: true with transferResult
  {passed, assessment}; the reply is the assessment.

Errors use a stable envelope - `{"error": {"code", "message"}}` - with status
400 bad_request (malformed request), 413 too_large (body over 64KB),
429 rate_limited (per-IP hourly cap hit), 403 captcha_required or
captcha_failed (Turnstile token missing or rejected, only enforced when
TURNSTILE_SECRET_KEY is set), 500 config_error (missing live provider key) or
internal, 502 upstream_error (provider failure) or invalid_model_output (the
model could not produce valid output for a Stage or the mechanical gate). Raw
provider errors and the key never reach the client. Every request passes the
wrapper's gates in order - body cap, rate limit, Turnstile - before any LLM
call (ticket 18).

Internals: the model returns `{reply, learnerMap, probe}` per turn, where probe reports what the turn was about (`{nodeId, kind: observe|probe|explain|brief|converse}`). The function computes `diff` deterministically from the previous and updated learner maps (the model is never trusted to compute it) and carries `failedAttempts` forward (node id to count). `failedAttempts` is client-held session state sent with every request.

The explanation fallback (principle 8) is a code-level rule, not just a
prompt instruction (ticket 12 acceptance found the model deferring an
explicit request): `explanationRequested(utterance)` matches
explanation-seeking phrasings conservatively, and `explainDirective(state)`
declares the fallback due when a node has two or more failed attempts (gate
takes priority) or the learner asked. When due, the turn is validated so
`probe.kind` must be `explain` and the reply IS the explanation - no new
question at the end. `validateTurn` rejects a non-explain probe while the
explanation is due.

The briefing mode (ticket 16, from Danny's product observation 2026-08-08:
"most people would expect to receive information to model their decisions")
is the learner-initiated exception to Socratic probing. `briefingRequested(utterance)`
matches direct-information phrasings conservatively - explicit tell-me
("just tell me about X"), "brief me on X", whole-path or end-to-end surveys
("just explain the whole power path to me", "walk me through how it works"),
decision questions ("how do I decide between A and B", "what do I need to
know") - while single-concept "what is X" / "why does X" questions stay
explanation requests. A briefing outranks the explanation fallback and the
opening rule: a fresh explicit request beats a derived gate. When due,
`probe.kind` must be `brief` and the reply IS the briefing: direct,
accurate, plain-language, built from the reality map, no new Socratic
question at the end. This is the ONE mode where quoting the reality map is
allowed (the map page already exposes it from session start per ticket 15,
and the learner explicitly asked) - quotes must be accurate and never
embellished. `validateTurn` rejects a `brief` probe when no briefing was
requested, so the model cannot turn itself into a lecturer: the default
stays Socratic. A briefing turn resets all failed-attempt counts (the
learner has been told; struggle restarts fresh), and the learner map is not
left frozen - nodes the learner then demonstrates they know become correct
on the following turns, and gap closures accumulate normally.

## 9. UX

Visual style (ticket 13): the "chapel" design - a light slate ground with one
intense color moment, the amethyst orb. The orb is the tutor's body: a radial
gradient sphere with layered shadows, sized 180px (start), 120px (chat hero),
36px (tutor avatar), 46px (send button), 14px (logo dot). Display type is
Fraunces 800 (concept word, headline, closeness number); everything else is
Space Grotesk. Mental-model states use stained-glass colors: untested gray,
missing red, misconception amber, correct green. Exact tokens and the orb CSS
recipe live in `research/13-ui-design-spec.md`.

- Tree home chrome (v6): one surface. Header is logo, foundations word box,
  and How it works. Placeholder: "A thing in reality (laptop, photosynthesis)".
  Empty Tree sentence: "Type the thing you want to understand from its
  foundations." `#how` is a short page (not an overlay) that states: this is
  not designed to replace reading; it is for relationships between layers;
  it helps the learner open rabbit holes; type a thing in reality from its
  foundations. Back to the Tree keeps whatever is in the word box.
  Submitting the word still builds a tree. Tutor is parked from chrome: no
  toggle, no bottom sheet. `#chat` lands on home. There is no Chat page. The
  Socratic engine, `forceBrief`, and `src/pages/dock.js` remain in the repo,
  unmounted.
- Chat page (`src/pages/chat.js`, ticket 08): unmounted. Helpers remain for
  tests. Was a word-or-phrase start, then a message list (learner and agent
  turns), a composer (Enter sends, Shift+Enter newlines), and a sending state
  that disables the composer and shows "Thinking..." while the call is in
  flight. A phase pill shows: Starting (phase init), Exploring (active with
  an empty learner map - the observation-first opening), Refining (active
  with a populated learner map - gap-first), Session end (phase end). The
  exploring/refining split mirrors the engine's opening rule in section 8.
  Agent messages carry a 36px orb avatar and a TUTOR label; learner messages
  are ink-dark bubbles with a YOU label. Errors render as one friendly line
  plus a Retry button that re-sends the exact failed request; raw JSON and
  provider text never reach the learner. A learner who asks for direct
  information ("just tell me about X", "brief me on Y", "how do I decide
  between A and B") receives a direct briefing instead of a Socratic question
  - the one mode where reality content is delivered in chat, because the
  learner asked for it (ticket 16). Session end: the transfer question
  appears as a normal message. No reality map content ever renders here.
- Map page (`src/pages/map.js`, tickets 09, 13, 15): the Tree home. Renders the
  learner's model: nodes colored by state (untested gray, missing red,
  misconception orange, correct green), edges with their own state, confidence
  shown per node (a status line "state - 0.9" plus a thin bar). A node's
  label comes from the held reality map ONLY when the node is already in the
  learner model - the label join is the sole reality data the mid-session
  learner grid may use,
  so unengaged nodes, layer names and descriptions can never render in the
  grid. Nodes
  flow into a responsive grid (no graph library; an SVG overlay draws the
  edges between cards) in the order the learner engaged with them; no reality
  structure (layers) is used for layout. Learner-grid chrome, closeness, and
  the page tabs stay hidden. Home is the Tree: a first-principles
  dependence path of the held Reality Map. Crown (the concept) at the top,
  foundations at the bottom. Y follows existing `built-on` / `depends-on` /
  `abstraction-of` edges, not observation dates (dates stay on hover). Layers
  are captions on the hang, capped to the card width so they do not cross
  the trunk, not table rows. Cards hang off a continuous
  trunk; extra parents of a convergence occupy the other side or a further
  column. The stage is at least the viewport and may grow wider for branches
  (the Tree scrolls horizontally; html/body do not overflow). On land the tree plays
  a one-shot elapsed grow (~1s: trunk, then deepest-first layer bands) and
  then stays fully visible; scroll never gates opacity. Reduced motion skips
  grow and sap. Clicking a node opens an invitation card: label, reality
  description, observation / crux, dependence neighbors (what it rests on /
  what rests on it), and one line that the node is a rabbit hole - a thing
  to go understand, not a chat topic. No learner-state chrome (confidence,
  evidence, rotation trail, untested copy) and no control that generates a
  nested Tree. A metrics row of closeness
  score, gap closures and the transfer result, plus the transfer assessment,
  stay parked with the learner chrome. The unmounted chat helpers NEVER leak
  reality content (labels, layers, descriptions).
- Session end: comparison view - reality map vs learner map, closed-gap summary, closeness score, transfer result. Parked from chrome this effort.

## 10. Metrics

- Gap closure per session: count of flips from missing or misconception to
  correct.
- Transfer question pass or fail per session.
- Closeness score trend across turns.
- All three are recorded client-side in the session store
  (`src/state/session.js`): gap closures accumulate deterministically from
  each turn's diff (`src/lib/mmg/metrics.js`, untested-to-correct is a first
  discovery, not a closure), the transfer result arrives with the graded end
  response, and closeness is recomputed on every response. They reset on a
  new session, and a future analytics surface can read them from the store.
- Reality Map quality (v6): automated gate (crown reached, contiguity,
  deriveCheck, dependence edges, no skipped layer) plus gold-label overlap
  on laptop, recursion, photosynthesis, and battery. Harness:
  `eval/map-quality`, command `npm run eval:map-quality` (no key). Live
  path is `node --env-file=.env eval/map-quality/run.js --live` (follows
  `LLM_PROVIDER`).
  Followability is the written rubric in `eval/map-quality/rubric.md`:
  every line is 0 or 1, no skip; a gate fail is four 0s. Live maps for
  that scoring persist with `--maps-dir` and a separate `--baseline`.
  Tutor-question scorers are not this bar.

## 11. Deployment

Netlify: static frontend plus one function. Live:
https://first-principled.netlify.app. Local switch is `LLM_PROVIDER` in
`.env` (`openrouter` uses `LLM_*`, `deepseek` uses `DEEPSEEK_*`). Prod
platform secrets stay OpenRouter `LLM_API_KEY`, `LLM_MODEL`,
`LLM_BASE_URL`, set with `netlify env:set` (from `.env`, gitignored). Do
not set Netlify `LLM_PROVIDER=deepseek`. Current prod `LLM_MODEL` is
`nvidia/nemotron-3-ultra-550b-a55b`. The key is a platform secret, never client-side; the published
`src/` bundle is verified key-free before release. Deploy is
`netlify deploy --prod` (no build step; `netlify.toml` publishes `src/` and
wires `/api/agent` to the function). Live URL recorded in README.

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
- Briefing: a learner-initiated turn (probe kind "brief") where the tutor
  delivers direct, accurate information built from the reality map - the one
  mode where quoting reality is allowed. v4 ticket 04: every dock turn is a
  briefing (orchestrator `forceBrief`); init does not append an opening probe.
- Stateless function: serverless endpoint that stores nothing between calls.
- Phase: init, active, end.
