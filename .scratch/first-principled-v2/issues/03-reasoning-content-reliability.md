# 03 - Research: reasoning_content reliability on deepseek-v4-flash

**Type:** research
**Status:** resolved (2026-08-10)
**Blocked by:** none
**Related:** tickets 02, 04; v1 ticket 03 (llm.js findings); src/lib/agent/llm.js

## Question

The engine calls DeepSeek v4 with thinking on by default, and llm.js already
captures `reasoning_content` but discards it. For a Socratic tutor the
reasoning IS the pedagogy - it is exactly what should drive the private
learner-map update (which state changed, what evidence) and, later, the
history feature. On deepseek-v4-flash with `response_format: json_object`:
how reliable is `reasoning_content` (presence rate, quality, whether it is
ever absent or empty), what is the token and latency cost of keeping thinking
on, and can it safely drive a map update that is never shown to the learner?

## What

1. DeepSeek docs: thinking mode and reasoning_content semantics, json_object
   interaction, cost model.
2. A small live probe against the API (key in first-principled/.env, one or
   two calls): presence rate, empty-content rate, latency delta with and
   without thinking, usage numbers.
3. A recommendation: use CoT for private updates (how), disable it, or use
   it conditionally (e.g. only for grading and gap choice).

## Research status (2026-08-10)

Docs findings recorded in `research/03-reasoning-content.md` in this effort
 dir, with the recommendation. The live probe (`research/probe-reasoning.mjs`)
 was blocked: the .env LLM_API_KEY returns 402 Insufficient Balance, so the
 presence/latency/token numbers remain to be gathered once the account has
 balance. The docs facts (thinking ON by default, reasoning_content nullable,
 free-form not JSON, reasoning tokens billed, reasoning_effort dial) are
 sufficient to unblock tickets 02 and 04; the live numbers are a refinement.

## Acceptance criteria

1. Findings recorded in `research/03-reasoning-content.md` in this effort
   dir, with a pointer added to this ticket - DONE (2026-08-10).
2. Concrete numbers: presence rate, latency delta, token cost per call -
   PENDING billing top-up (run `research/probe-reasoning.mjs`).
3. A clear recommendation that unblocks tickets 02 and 04 - DONE in the
   research file (use CoT privately, treat it as optional, use
   reasoning_effort as a dial).

## Docs rule

If the turn contract changes (e.g. a private update field in the response),
note it in spec section 8 in the same commit as the change that uses it.

## Resolution (2026-08-10)

Closed. Docs facts recorded in `research/03-reasoning-content.md` are
sufficient to unblock tickets 02 and 04: keep thinking on, treat
reasoning_content as optional/free-form (never JSON), consume it privately
for the learner-map update, never shown to the learner, and dial it with
reasoning_effort if latency needs tightening. The live probe
(`research/probe-reasoning.mjs`) remains pending billing: the .env key
returns 402 Insufficient Balance. Acceptance criteria 1 and 3 are met;
criterion 2 (concrete numbers) is pending the top-up.
