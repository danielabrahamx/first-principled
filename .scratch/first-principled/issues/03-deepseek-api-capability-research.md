# 03 - DeepSeek API capability research

**Type:** research
**Status:** resolved (opencode, 2026-08-07)
**Blocked by:** none (parallel to 02)
**Related:** spec sections 6, 8, 11; the LLM key is at `.env` (gitignored) and
in `~/.local/share/opencode/auth.json` (deepseek entry, updated 2026-08-07).
Both hold the same key; use either.
**Answer:** `.scratch/first-principled/research/03-deepseek-api-capability-research.md`

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

## Answer (2026-08-07)

Full findings with evidence: `.scratch/first-principled/research/03-deepseek-api-capability-research.md`.

- **Base URL / auth:** `https://api.deepseek.com` (OpenAI-compatible, `/v1`
  prefix works), `Authorization: Bearer <key>`. Verified live, HTTP 200.
- **Model id:** `deepseek-v4-flash` (recommended). The account also exposes
  `deepseek-v4-pro` (3.1x price, same JSON support). `deepseek-chat` still
  works but is a legacy alias that silently routes to `deepseek-v4-flash`;
  `.env` updated to `deepseek-v4-flash` (local, gitignored).
- **JSON mode:** `response_format: {"type": "json_object"}` only. `json_schema`
  / strict schemas are rejected ("This response_format type is unavailable
  now"). Best-effort enforcement: prompt must contain the word "json" plus an
  example; `max_tokens` must leave headroom or JSON truncates; the API can
  occasionally return empty content. v4 models are reasoning models by
  default - CoT comes back in `reasoning_content` (never parse or pass it
  back without tool calls); only `content` is JSON.
- **Fallback strategy:** JSON.parse(`content`) in try/catch; on failure
  extract the first balanced `{...}` span; on empty/unparseable, retry once
  with a stricter "JSON only" prompt. Disable thinking per call via
  `extra_body: {"thinking": {"type": "disabled"}}` if cheap/fast structure
  is wanted - evaluate in ticket 04.
- **Streaming:** supported (SSE `chat.completion.chunk`, reasoning deltas
  first). Not needed for v1 - non-streaming calls with a loading state
  suffice at ~21 calls per session.
- **Rate limits:** concurrency-based (flash 2500, pro 500 concurrent per
  account; HTTP 429 above). Irrelevant for single-learner v1.
- **Cost per session:** ~$0.004 at flash prices (map gen ~$0.0006 + 20 turns
  ~$0.0034), under $0.01 even with doubled assumptions; ~$4-10 per 1,000
  sessions. Docs warn of an upcoming significant price increase.
