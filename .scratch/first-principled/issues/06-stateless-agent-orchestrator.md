# 06 - Stateless agent orchestrator

**Type:** task
**Status:** ready-for-agent (unblocked 2026-08-07 by 04, 05)
**Blocked by:** 04, 05
**Related:** spec sections 6, 8; `api/agent.ts` or `functions/agent.ts`

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
