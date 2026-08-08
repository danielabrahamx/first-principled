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
- Two pages: chat and map. The map page shows the reality tree from session
  start (ticket 15, Danny 2026-08-08); chat NEVER leaks reality content.
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
- [06 - Stateless agent orchestrator](issues/06-stateless-agent-orchestrator.md) - src/lib/agent/orchestrator.js dispatches POST /api/agent by phase; netlify/functions/agent/agent.mjs is a thin HTTP wrapper. init = map gen + observation-first opening turn, response carries realityMap + phase "active" (client holds it, spec 6); refused words stay on phase "init". active = one Socratic turn with the learner's latest message wired in via SocraticState.learnerUtterance; sessionEndDue (all reality nodes known, or 24-message turn cap) triggers the transfer question with phase "end". end = grade answer vs reality map, sessionEnded true, transferResult {passed, assessment}. Stable error envelope (400 bad_request, 500 config_error/internal, 502 upstream_error/invalid_model_output), never raw upstream text or the key. Contract additions in spec 8: failedAttempts in responses, realityMap on init. Live-verified end to end on real DeepSeek (map 9.9s, turns 8.5-14.3s, question 5.2s, grade 7s, all under the 30s budget) and via netlify dev + curl. Fixed latent ../../ vs ../../../ import path in the function stub.
- [07 - Client session state](issues/07-client-session-state.md) - src/state/session.js: in-memory store + sessionStore singleton, startSession replaces the whole state object (no cross-session leakage), applyResponse merges turns (init refusal stays phase "init", sessionEnded freezes the store and keeps comparison data), toRequest serializes exactly the spec 8 shape (word on init; maps + failedAttempts + history on active/end). src/state/router.js: hash routing (#chat/#map) - static site has no rewrites, and hashes never reload the document, so the store survives navigation. src/app.js toggles the two placeholder views (UI content is 08/09). Spec 6 updated. 119 tests green, tsc clean, netlify dev serves all modules.
- [08 - Chat page UI](issues/08-chat-page-ui.md) - src/pages/chat.js: the whole Socratic loop on one surface - word input (start, and again after an init refusal), message list, composer (Enter sends, Shift+Enter newline), phase pill starting/exploring/refining/session end (exploring vs refining mirrors the engine's opening rule: empty learner map = observation-first, populated = gap-first), sending state (inputs disabled, "Thinking..."), friendly error banner + Retry that re-sends the exact failed request without duplicating the learner message, end panel (passed/not passed) + comparison link to #map, never any reality map content. src/api/agent.js: client transport that collapses every failure to a stable code (network/internal/envelope codes); raw JSON and provider text never reach the learner. Live-verified in a real browser via netlify dev: init + turns + phase transitions on real DeepSeek; a real 500 (lambda-local 30s timeout on a slow turn) surfaced as "Something went wrong on our side" with a working non-duplicating retry; end phase (transfer question, answer, result panel) verified deterministically with a stubbed fetch; 375px viewport clean. Router robustness fix (found in QA): some sandboxed Chrome contexts expose a Location object without addEventListener, which silently killed hash navigation - the router now falls back to window, so the comparison link navigates everywhere. 150 tests green (7 new for 08), tsc clean apart from concurrent 09 mapview files.
- [09 - Map page UI](issues/09-map-page-ui.md) - map.js renders the learner model only: responsive grid + SVG edge overlay, labels joined from the held reality map ONLY for engaged nodes (the no-leak rule, unit-tested), state colors + confidence per node, store subscribe() drives diff animations (pop-in for added, color transition for flips, flash for updated), page makes zero network requests; DOM-audited with headless Edge 20/20 (no layer names, descriptions or unengaged labels). Spec 9 updated.
- [10 - Session end comparison and transfer question](issues/10-session-end-comparison-and-transfer-question.md) - transfer question + grading were live since 06; this ticket added the metrics and the comparison. gapClosures accumulates client-side from each turn's diff (src/lib/mmg/metrics.js; missing/misconception to correct only, untested-to-correct is a first discovery) in the session store alongside closeness and transferResult, all reset by startSession; comparison viewmodel src/lib/mapview/comparison.js (realitySections layers + descriptions, realityEdgeList typed labels, comparisonMetrics reading the store's recorded numbers); map page renders reality vs the final learner grid side by side with a Closeness/Gaps closed/Transfer metrics row and the assessment, ONLY at session end (render hoisted above the empty-grid return so cap-ended sessions still compare); narrow viewport stacks, no document overflow. Spec 6, 9, 10 updated. 163 tests green, tsc clean, headless-Edge audited (mid-session: comparison hidden + zero reality content; end: full comparison renders).
- [11 - Deploy to Netlify or Vercel](issues/11-deploy-to-netlify-or-vercel.md) - Netlify chosen; site first-principled created + linked (id 1a5638ca-2cd1-418a-9110-4f4fbd092480), env secrets LLM_API_KEY/LLM_MODEL/LLM_BASE_URL set via netlify env:set, deployed with netlify deploy --prod; live at https://first-principled.netlify.app; key-leak grep clean (src/, netlify/, tracked files); live smoke test passed (init 12.2s 11-node map, turn 4.6s); README Deploy rewritten, spec 6 + 11 updated.
- [04 - Reality map generation](issues/04-reality-map-generation.md) - src/lib/agent/realityMap.js (prompt + generation), llm.js (transport), jsonParse.js (parse). Contiguous layer chain prompt (principle 12), typed edges with a translation table (the model invented types like "produces" otherwise), soft cap 6 layers tunable, model knowledge only; refusal contract for gibberish (isValidConcept false) honored without retry; json_object mode + parse fallback + up to 2 repair attempts (escalating, final one narrows to "fix exactly the flagged problems"), mechanical cleanup drops edges with unknown node ids, validator is the gate and is now total (fixed a crash on malformed live output). Thinking OFF for map gen: ON was 47-54s (over the 30s AC), OFF is 5-14s; thinking must be top-level (extra_body nesting silently ignored). Reliability measured: one-repair design ~80% on photosynthesis, after fixes 30/30 runs plus 2 full live suites 24/24. Spec 8 Init updated.
- [13 - UI redesign from Paper design](issues/13-ui-redesign-from-paper-design.md) - rebuilt the UI to the "chapel" design spec (research/13-ui-design-spec.md, no Paper dependency): orb recipe (radial gradient + 3-layer shadow) at all 5 sizes, Fraunces 800 + Space Grotesk, exact palette; chat.js (hero eyebrow mirrors exploring/refining, TUTOR/YOU labels + 36px orb avatars, ink learner bubbles, orb 46px send + "Thinking..." status), map.js (segmented control Chat/Map, title row with Closeness known/total + progress bar, legend, 280px state-bordered cards, session-end Reality segment), new src/lib/mapview/tree.js (realityTree + treeLayout + cladogramPaths - the reality view is now a phylogenetic tree: concept crown, layers branching down; replaces ticket 10's flat panels), layout.js cards 280x88. No-leak rule, store subscribe diff animations, zero network calls from the map page, stable error codes all intact. Spec 9 updated. 168 tests green (5 new tree), tsc clean, netlify build OK; headless-Edge DOM audits: mid-session zero reality content, Reality tab tree (8 cards/6 branches/10 paths) + metrics + assessment, chat flow all four states; computed-style audit confirms the tokens land exactly.

## Open frontier

1. [Project scaffold and docs](issues/01-project-scaffold-and-docs.md) - `resolved`
2. [Mental model graph schema](issues/02-mental-model-graph-schema.md) - `resolved` - types, fixtures, closeness score
3. [DeepSeek API capability research](issues/03-deepseek-api-capability-research.md) - `resolved` - base URL, model id deepseek-v4-flash, json_object only, fallback, cost; findings in research/03-*.md
4. [Reality map generation](issues/04-reality-map-generation.md) - `resolved` - realityMap.js/llm.js/jsonParse.js, thinking off (ON was 47-54s, OFF 5-14s), 3-attempt loop with escalating repairs + edge cleanup, gibberish refusal, validator crash fixed, 30/30 live reliability
5. [Socratic engine and learner map updates](issues/05-socratic-engine-and-learner-map-updates.md) - `resolved` - socratic.js: code-gated explanation (2 failed attempts, counted on answers not probes), code-computed diff, model reply {reply, learnerMap, probe}, thinking-off repair retry
6. [Stateless agent orchestrator](issues/06-stateless-agent-orchestrator.md) - `resolved` - orchestrator.js dispatches init/active/end, stable error envelope, transfer question + grading turns, sessionEndDue (all nodes known or 24-turn cap), learnerUtterance wiring; live-verified end to end + netlify dev
7. [Client session state](issues/07-client-session-state.md) - `resolved` - session.js in-memory store + singleton, hash router (#chat/#map), app.js view toggle, session freeze on sessionEnded, spec-8 exact serialization
8. [Chat page UI](issues/08-chat-page-ui.md) - `resolved` - chat.js (word input, message list, composer, phase pill, friendly retry, end panel + comparison link), api/agent.js (stable error codes, no raw JSON), live-verified in browser (real turns, real 500 → retry, stubbed-fetch end phase, 375px OK); router hashchange fallback fix for Location-without-addEventListener contexts
9. [Map page UI](issues/09-map-page-ui.md) - `resolved` - map.js (renderMapPage) grid + SVG edge overlay, viewmodel.js engaged-only label join (no-leak rule), layout.js grid/edge geometry, store subscribe for live diff-driven animation (pop-in, flip transition, flash), zero network calls from the page, spec 9 updated; DOM-audited 20/20 with headless Edge (concurrent 08 work landed in the same commit)
10. [Session end comparison and transfer question](issues/10-session-end-comparison-and-transfer-question.md) - `resolved` - gapClosures metric accumulated in the session store from per-turn diffs (metrics.js, missing/misconception to correct only), comparison viewmodel (comparison.js), map page renders reality vs learner side by side with closeness/gaps/transfer metrics at session end only (no-leak rule binds mid-session), spec 6/9/10 updated; headless-Edge audited both states
11. [Deploy to Netlify or Vercel](issues/11-deploy-to-netlify-or-vercel.md) - `resolved` - site first-principled created + linked, LLM_* env secrets set, netlify deploy --prod live at https://first-principled.netlify.app, key-leak grep clean, live init+turn smoke test passed, README + spec 6/11 updated
12. [End to end acceptance and demo session](issues/12-end-to-end-acceptance-and-demo-session.md) - `resolved` (2026-08-07) - laptop + recursion sessions end to end live; found + fixed explanation-fallback violation (learner asking for an explanation was told to keep observing; now a code-level rule via explanationRequested/explainDirective, validateTurn enforces probe.kind = explain); README demo section present; no-leak audit passed. Frontier closed.
13. [UI redesign (orb design, from spec)](issues/13-ui-redesign-from-paper-design.md) - `resolved` (2026-08-07) - rebuilt chat/map to the chapel orb design spec (research/13-ui-design-spec.md, no Paper dependency): orb recipe, Fraunces/Space Grotesk, palette; chat hero + TUTOR/YOU orb-avatar messages; map segmented control + title row + legend + 280px cards; session-end Reality segment shows the reality map as a phylogenetic tree (new src/lib/mapview/tree.js, concept crown + layer branches); no-leak rule and all behavior contracts intact; spec 9 updated; 168 tests, tsc, netlify build, headless-Edge DOM + computed-style audits all green
14. [Error banner always visible](issues/14-error-banner-always-visible.md) - `resolved` (2026-08-08) - ticket 13 CSS regression: `.error-banner { display: flex }` (and `.composer`, `.composer-wrap`) overrode the UA `[hidden] { display: none }`, so the Retry banner rendered permanently; fixed with a global `[hidden] { display: none !important; }` guard in src/styles.css. Verified in headless Chromium via CDP computed styles: banner none/0px on load, flex/65px + visible Retry on a real failed agent call, hidden again on success; 169 tests + tsc clean.
15. [Reality map viewable from session start](issues/15-reality-map-viewable-from-session-start.md) - `resolved` (2026-08-08) - Danny's product call: the reality tree is viewable from session start, not only at session end. map.js gates the Reality tab/tree on realityMap !== null (comparison metrics still session-end only); socratic rule 1 rewritten (learner may open the map, tutor never quotes it unprompted); spec 9 + AGENTS.md no-leak re-scoped to chat-only. CDP-verified mid-session (ended=false): tab visible, tree renders; 169 tests + tsc clean. Frontier closed.
16. [Briefing mode: tutor delivers information for decisions](issues/16-briefing-mode-tutor-delivers-information.md) - `ready-for-agent` - Danny's product observation (2026-08-08): most people expect to receive information to model their decisions; add a learner-initiated briefing mode (probe kind "brief") alongside Socratic default, learner map still updates. NEXT FRONTIER.

## Ticket sequence (dependency overview)

```
01 scaffold -> 02 schema, 03 research
02 + 03 -> 04 reality map gen, 05 socratic engine
04 + 05 -> 06 orchestrator -> 07 client state -> 08 chat UI, 09 map UI
08 + 09 -> 10 session end -> 11 deploy (human gates) -> 12 acceptance
15 (reality map viewable from start) -> 16 (briefing mode) - both unblocked, frontier
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
