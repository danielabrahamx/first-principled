# 03 - DeepSeek API capability research

**Type:** research
**Status:** ready-for-agent
**Blocked by:** none (parallel to 02)
**Related:** spec sections 6, 8, 11; the LLM key is at `.env` (gitignored) and
in `~/.local/share/opencode/auth.json` (deepseek entry, updated 2026-08-07).
Both hold the same key; use either.

## Question

What exactly does the DeepSeek API support for structured output, and what
model id should the app call?

## What

1. Confirm the OpenAI-compatible base URL and auth header shape.
2. Confirm the exact model id to use (deepseek-chat, deepseek-reasoner, or a v4
   id such as deepseek-v4-flash if exposed).
3. Confirm JSON-mode / structured output support: response_format mechanics,
   whether the JSON schema is enforced or best-effort, and the fallback
   (parse JSON out of text) if enforcement is weak.
4. Confirm streaming support and whether the v1 UI needs it.
5. Confirm rate limits and rough cost per session (map generation plus ~20
   turns) at the chosen model.
6. Record a working curl-equivalent call (use the key in `.env`) proving the
   exact request shape.

## Acceptance criteria

- Answer records: base URL, model id, JSON-mode mechanics, fallback strategy,
  cost estimate per session.
- One real API call made with the existing key, response captured.
- Findings recorded as the ticket answer; no code changes.

## Docs rule

Record the answer on the ticket and link it from the map. No code in this
ticket.
