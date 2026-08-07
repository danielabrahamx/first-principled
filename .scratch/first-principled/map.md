# First-Principled - Build Map (MAIN FRONTIER)

**Effort:** Build the v1 MVP of first-principled - an AI tutor whose mission is
to reduce the cognitive distance between the learner's mental model and reality.
**Spec:** `.scratch/first-principled/spec.md`
**Planning source:** grilling session 2026-08-07 (chat). Decisions below are
inherited from that session; do not re-litigate, build against them.

## Destination

A deployed web app (Netlify or Vercel, static + one stateless serverless
function, DeepSeek-backed, no database) where a learner types a word or phrase;
the agent builds a Reality Map from the model's knowledge; a Socratic
conversation on a chat page extracts and refines the learner's Mental Model
against it, driven by the gap between the two maps; a separate map page shows
the learner's model updating live; at session end the learner sees the
comparison and answers a transfer question. v1 is one learner per browser,
ephemeral sessions, no accounts.

## Notes

- **Spec:** `.scratch/first-principled/spec.md` - mission, principles, data
  model, turn contract. Read it before any ticket.
- Mission, theory, 12 core principles are immutable: written to
  `docs/MISSION.md` in ticket 01; the agent prompts follow them.
- Work the **frontier**: lowest-numbered open ticket with blockers resolved.
- One session resolves at most one ticket (research excepted).
- Style: single dashes only, no emojis. Windows/PowerShell-tested before
  shipping. Commit and push before done (AGENTS.md rule).
- Stack: static frontend + one stateless serverless function
  (`POST /api/agent`), client-held session state, DeepSeek via OpenAI-compatible
  API, no DB, no auth, no agent framework (Mastra etc. is v2).
- Two pages: chat and map. The map page NEVER shows reality map content
  mid-session; comparison unlocks only at session end.
- LLM key: Danny supplies it as a platform env secret (ticket 11). A DeepSeek
  key already exists on this machine at `~/.local/share/opencode/auth.json`
  (ticket 03 may use it).
- Consult: `spec.md`, `docs/MISSION.md`, the grilling skill for prompt
  discipline, the opencode-wayfinder-tickets skill for the work loop.

## Inherited decisions (grilling 2026-08-07)

- Mission, theory of learning, 12 core principles (spec sections 1-3).
- Target: founders building things, learning as they build. Word or phrase
  input only, no goal context in v1.
- Two maps: Reality Map (canonical, model knowledge only in v1) and learner
  Mental Model. The gap between them drives questioning.
- Completeness over pruning: reality map layer chain is contiguous, no skipped
  intermediate steps. Model decides depth with a soft cap.
- Observation-first opening when the learner map is empty; gap-first probing
  when populated. Explanation fallback: learner asks, or two failed attempts
  on the same point. Model decides when the learner has nothing to build on.
- Metric: gap closure (state flips) plus transfer question pass or fail.
- Separate map page, live updates of the learner model only.
- Client-side ephemeral state per chat; stateless serverless function; no DB,
  no auth; DeepSeek; deploy Netlify or Vercel.

## Decisions so far

<!-- one line per resolved ticket; empty until tickets resolve -->

## Open frontier

1. [Project scaffold and docs](issues/01-project-scaffold-and-docs.md) - `ready-for-agent` - repo skeleton, MISSION.md, tracker config
2. [Mental model graph schema](issues/02-mental-model-graph-schema.md) - `ready-for-agent` - types, fixtures, closeness score
3. [DeepSeek API capability research](issues/03-deepseek-api-capability-research.md) - `ready-for-agent` - research; key available at `~/.local/share/opencode/auth.json`
4. [Reality map generation](issues/04-reality-map-generation.md) - blocked by 01, 02, 03
5. [Socratic engine and learner map updates](issues/05-socratic-engine-and-learner-map-updates.md) - blocked by 01, 02, 03
6. [Stateless agent orchestrator](issues/06-stateless-agent-orchestrator.md) - blocked by 04, 05
7. [Client session state](issues/07-client-session-state.md) - blocked by 06
8. [Chat page UI](issues/08-chat-page-ui.md) - blocked by 07
9. [Map page UI](issues/09-map-page-ui.md) - blocked by 07
10. [Session end comparison and transfer question](issues/10-session-end-comparison-and-transfer-question.md) - blocked by 08, 09
11. [Deploy to Netlify or Vercel](issues/11-deploy-to-netlify-or-vercel.md) - blocked by 10 - human gate: platform login and LLM key
12. [End to end acceptance and demo session](issues/12-end-to-end-acceptance-and-demo-session.md) - blocked by 11

## Ticket sequence (dependency overview)

```
01 scaffold -> 02 schema, 03 research
02 + 03 -> 04 reality map gen, 05 socratic engine
04 + 05 -> 06 orchestrator -> 07 client state -> 08 chat UI, 09 map UI
08 + 09 -> 10 session end -> 11 deploy (human gates) -> 12 acceptance
```

## Not yet specified

- Prompt quality evaluation: how to judge Socratic quality objectively
  (post-acceptance).
- Cross-concept linking (laptop to CPU) - v2.
- Web grounding once product feedback arrives.

## Out of scope

- Accounts, auth, server-side persistence, cross-device sync (v2).
- Web grounding, RAG, tool use in v1.
- Agent frameworks (Mastra, LangGraph) - revisit v2.
- Mobile or native clients.
