# 06 - Stateless agent orchestrator

**Type:** task
**Status:** resolved (2026-08-07)
**Blocked by:** 04, 05
**Related:** spec sections 6, 8; `src/lib/agent/orchestrator.js`,
`netlify/functions/agent/agent.mjs`

## Question

What is the single serverless endpoint that wires map generation, Socratic
turns, and session end together, storing nothing?

## What

1. `POST /api/agent` implementing the spec turn contract:
   - request: {word?, realityMap?, learnerMap?, history, phase}
   - response: {reply, learnerMap, diff, phase, sessionEnded?, transferResult?}
2. Phase dispatch:
   - init: word present, no realityMap - run reality map generation (ticket 04),
     then the observation-first opening turn (ticket 05).
   - active: run a Socratic turn, return the updated learner map and diff.
   - end: run the transfer question, record pass or fail against the reality
     map, set sessionEnded.
3. Statelessness: state comes in with the request and goes out with the
   response. No module-level caches, no disk, no DB. Two identical requests
   produce identical responses (for identical upstream results).
4. Error mapping: missing API key, upstream 401/429, malformed model JSON
   (retry once, then structured error). Never leak the key or raw upstream
   errors to the client.
5. Environment config: LLM_API_KEY, LLM_MODEL, LLM_BASE_URL.

## Acceptance criteria

- Contract matches spec section 8 exactly.
- Statelessness demonstrated: same input twice, same output.
- All error paths return stable, structured errors.
- Callable locally (dev server) and as a platform function.

## Docs rule

Commit and push before done. Keep the contract in spec section 8 in sync.

## Resolution

`src/lib/agent/orchestrator.js` is the phase dispatcher; the Netlify function
(`netlify/functions/agent/agent.mjs`) is a thin HTTP wrapper. Turn contract in
spec section 8 was updated to match what the endpoint actually does.

- init: reality map generation (realityMap.js, thinking off, 3 attempts) then
  the observation-first opening turn (socratic.js) on an empty learner map;
  response carries `realityMap` (the client holds it from here, per spec
  section 6) and phase "active". A refused word returns phase "init" with a
  refusal reply and no reality map, so the client can ask again.
- active: validates the held maps, failedAttempts and history (400 on
  garbage), then one Socratic turn; the learner's latest message is wired into
  the Socratic prompt via a new `learnerUtterance` field on SocraticState
  (socratic.js). When `sessionEndDue` - every reality node known, or the
  24-learner-message turn cap (safety valve) - the function asks the transfer
  question instead and returns phase "end" with an untouched learner map.
- end: grades the answer (last user message) against the transfer question
  (last assistant message) and the reality map, returns sessionEnded: true and
  transferResult {passed, assessment}; the reply is the assessment.
- Transfer question and grading are their own two-attempt JSON turns
  (thinking on, repair thinking off), mirroring the engines' repair policy.
- Error envelope: `{"error": {"code", "message"}}` - 400 bad_request,
  500 config_error (missing LLM_API_KEY, checked only when no transport is
  injected, so tests can stub) or internal, 502 upstream_error (provider
  failure) or invalid_model_output (model garbage after internal retries).
  Raw upstream text and the key never reach the client.
- Statelessness: no module-level mutable state; unit test proves two identical
  requests with identical scripted upstream results give identical responses.
- Verified live against real DeepSeek: full laptop session - map gen 9.9s,
  active turns 8.5s/14.3s, transfer question 5.2s, grade 7s (all under the 30s
  budget); the grader correctly failed a plausible-but-wrong transfer answer.
- Verified as a platform function via `netlify dev` + curl through the
  /api/agent rewrite: init 200 with a real 12-node photosynthesis map, and
  400 envelopes for bad JSON body, unknown phase, empty word. Fixed a latent
  path bug in the ticket 01 stub: the function's import of src/lib needs
  `../../../`, not `../../`.
- `.env.example` refreshed to the ticket 03 findings (deepseek-v4-flash,
  base URL with /v1). `deno.lock` (netlify dev artifact) gitignored.
