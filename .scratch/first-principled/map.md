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
  API, no DB, no auth, no agent framework (Mastra etc. is v2). Plain ES
  modules, zero npm dependencies, no bundler (ticket 01).
- Two pages: chat and map. The map page NEVER shows reality map content
  mid-session; comparison unlocks only at session end.
- **LLM key:** in `.env` (gitignored) and `~/.local/share/opencode/auth.json`
  (deepseek entry). Both hold the same key; never commit either.
- **Deploy: Netlify** (Danny confirmed 2026-08-07). CLI authed as
  danielftabraham@outlook.com; `"$APPDATA/npm/netlify.cmd"` in git-bash.
- **Setup landed 2026-08-07 (orchestrator):** AGENTS.md (Danny chose AGENTS.md
  over CLAUDE.md), docs/agents/{issue-tracker,domain}.md, CONTEXT.md,
  .gitignore, .env. Ticket 01 must not rewrite these, only extend.
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

- [01 - Project scaffold and docs](issues/01-project-scaffold-and-docs.md) - src/ + netlify/functions/agent stub, netlify.toml with /api/agent rewrite, zero-dep plain ES modules (no bundler), MISSION.md verbatim from spec 1-3, README; npm install and netlify build verified on Windows.
- [03 - DeepSeek API capability research](issues/03-deepseek-api-capability-research.md) - base https://api.deepseek.com/v1 with Bearer auth; model deepseek-v4-flash (deepseek-chat is a legacy alias, .env updated); only response_format json_object exists (json_schema rejected), best-effort so fallback = JSON.parse then {..} extraction then one retry; v4 reasoning_content is not JSON and not passed back; streaming supported but skip in v1; ~$0.004/session at flash prices; findings in research/03-*.md.
- [02 - Mental model graph schema](issues/02-mental-model-graph-schema.md) - shared schema at src/lib/mmg/ as JSDoc-typed ES modules (JSDoc over .ts: no runtime consumer runs .ts without a build step; dev-only tsc --checkJs verifies types, runtime stays zero-dep), validators incl. layer-chain contiguity rejection, closenessScore (correct/known, known = not untested), laptop fixtures; node:test 24/24 green on Windows. Learner edges carry evidence; spec 7 updated.
- [05 - Socratic engine and learner map updates](issues/05-socratic-engine-and-learner-map-updates.md) - src/lib/agent/socratic.js: code owns the hard rules (observe vs gap mode, explanation gate at 2 failed attempts, deterministic diff via computeDiff, turn validation that rejects dropped nodes/edges), the model owns semantics (gap choice, wording, misconception detection). Model reply contract {reply, learnerMap, probe} (kinds observe|probe|explain|converse); function computes diff, never the model. Key finding: a failed attempt is an answer that leaves the point non-correct (counted on nodes changed this turn), not a probe; explanation or correct answer clears the count. Repair retry runs thinking-off (empty-content recovery). Spec 8 updated (failedAttempts in request, model reply shape).
- [04 - Reality map generation](issues/04-reality-map-generation.md) - src/lib/agent/realityMap.js (prompt + generation), llm.js (transport), jsonParse.js (parse). Contiguous layer chain prompt (principle 12), typed edges with a translation table (the model invented types like "produces" otherwise), soft cap 6 layers tunable, model knowledge only; refusal contract for gibberish (isValidConcept false) honored without retry; json_object mode + parse fallback + up to 2 repair attempts (escalating, final one narrows to "fix exactly the flagged problems"), mechanical cleanup drops edges with unknown node ids, validator is the gate and is now total (fixed a crash on malformed live output). Thinking OFF for map gen: ON was 47-54s (over the 30s AC), OFF is 5-14s; thinking must be top-level (extra_body nesting silently ignored). Reliability measured: one-repair design ~80% on photosynthesis, after fixes 30/30 runs plus 2 full live suites 24/24. Spec 8 Init updated.

## Open frontier

1. [Project scaffold and docs](issues/01-project-scaffold-and-docs.md) - `resolved`
2. [Mental model graph schema](issues/02-mental-model-graph-schema.md) - `resolved` - types, fixtures, closeness score
3. [DeepSeek API capability research](issues/03-deepseek-api-capability-research.md) - `resolved` - base URL, model id deepseek-v4-flash, json_object only, fallback, cost; findings in research/03-*.md
4. [Reality map generation](issues/04-reality-map-generation.md) - `resolved` - realityMap.js/llm.js/jsonParse.js, thinking off (ON was 47-54s, OFF 5-14s), 3-attempt loop with escalating repairs + edge cleanup, gibberish refusal, validator crash fixed, 30/30 live reliability
5. [Socratic engine and learner map updates](issues/05-socratic-engine-and-learner-map-updates.md) - `resolved` - socratic.js: code-gated explanation (2 failed attempts, counted on answers not probes), code-computed diff, model reply {reply, learnerMap, probe}, thinking-off repair retry
6. [Stateless agent orchestrator](issues/06-stateless-agent-orchestrator.md) - blocked by 04, 05
7. [Client session state](issues/07-client-session-state.md) - blocked by 06
8. [Chat page UI](issues/08-chat-page-ui.md) - blocked by 07
9. [Map page UI](issues/09-map-page-ui.md) - blocked by 07
10. [Session end comparison and transfer question](issues/10-session-end-comparison-and-transfer-question.md) - blocked by 08, 09
11. [Deploy to Netlify or Vercel](issues/11-deploy-to-netlify-or-vercel.md) - blocked by 10 - Netlify chosen, CLI authed, key in .env; no human gate
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
