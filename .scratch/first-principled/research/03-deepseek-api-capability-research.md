# 03 - DeepSeek API capability research (findings)

Resolved 2026-08-07 by opencode. All claims verified against the live API
(real calls with the key from `.env`) and the official docs at
https://api-docs.deepseek.com/. The key is never printed here; it lives in
`.env` and `~/.local/share/opencode/auth.json`.

## 1. Base URL and auth

- OpenAI-compatible base URL: `https://api.deepseek.com` (works with the
  `/v1` prefix, e.g. `https://api.deepseek.com/v1/chat/completions`).
- Auth header: `Authorization: Bearer <key>` (standard OpenAI shape).
- Verified live: `GET https://api.deepseek.com/v1/models` returned HTTP 200
  with the account's model list.
- Source: https://api-docs.deepseek.com/quick_start/pricing (BASE URL row).

## 2. Model id

- The account exposes exactly two models: `deepseek-v4-flash` and
  `deepseek-v4-pro` (verified via `GET /v1/models`).
- `deepseek-chat` (current value in `.env`) is a legacy alias: it still
  accepts requests but the response `model` field shows `deepseek-v4-flash`,
  i.e. it silently routes to flash. `deepseek-reasoner` is not exposed.
- Recommended: `LLM_MODEL=deepseek-v4-flash`. Flash is the cost and latency
  pick for a single-learner tutor; `deepseek-v4-pro` costs 3.1x on input and
  output with the same JSON capabilities. `.env` was updated to
  `deepseek-v4-flash` on resolution (local file, gitignored).

## 3. JSON mode / structured output

- Supported: `response_format: {"type": "json_object"}` - OpenAI-compatible
  JSON mode. Verified live with a real call returning valid JSON.
- NOT supported: `json_schema` / strict schemas. A request with
  `response_format: {"type": "json_schema", ...}` was rejected with
  `"This response_format type is unavailable now"` (invalid_request_error).
  So no server-side schema enforcement exists; the contract is prompt-driven.
- Docs requirements for JSON mode (source:
  https://api-docs.deepseek.com/guides/json_mode):
  1. Set `response_format` to `{"type": "json_object"}`.
  2. Include the word "json" in the system or user prompt, and provide an
     example of the desired JSON shape.
  3. Set `max_tokens` reasonably - a low cap truncates the JSON mid-string.
  4. The API may occasionally return empty `content`; the docs say to
     mitigate by adjusting the prompt.
- Enforcement is best-effort, so the client MUST treat the reply as
  candidate JSON. Fallback strategy for the app:
  1. Parse `message.content` with JSON.parse in a try/catch.
  2. On failure, extract the first balanced `{...}` span from `content`
     (strip markdown fences if the model wrapped them) and parse that.
  3. On empty `content` or an unparseable reply, retry once with a stricter
     prompt ("Reply with JSON only, no markdown, no commentary").
- Reasoning-model caveat: v4 models default to thinking mode
  (see section 5). The CoT arrives in `message.reasoning_content` and is
  NOT JSON - never concatenate it into the parse target, and never pass it
  back to the API in later turns unless tool calls are in play (we use
  none; the API ignores stale reasoning_content then).

## 4. Streaming

- Supported: `stream: true` returns SSE `data:` lines of type
  `chat.completion.chunk` (verified live). Chunks first stream
  `reasoning_content` deltas, then `content` deltas. Keep-alive comments
  (`: keep-alive`) may appear and must be ignored; non-streaming requests
  keep the connection alive with empty lines.
- v1 recommendation: skip streaming. The reply for a Socratic turn is short
  and the map generation call is a single awaited call; a simple loading
  state is enough. Streaming adds chunk handling plus reasoning/content
  separation for little perceived gain at ~21 calls per session. Revisit in
  v2 if latency complaints appear.
- Source: https://api-docs.deepseek.com/guides/thinking_mode,
  https://api-docs.deepseek.com/quick_start/rate_limit.

## 5. Thinking mode (relevant to cost and JSON reliability)

- Thinking mode is ON by default (effort high). It can be disabled per
  request with `extra_body: {"thinking": {"type": "disabled"}}`
  (OpenAI-format parameter).
- In thinking mode, `temperature`, `top_p` and the penalty params are
  accepted but have no effect.
- Reasoning tokens are billed as output tokens and show up in
  `usage.completion_tokens_details.reasoning_tokens` (verified: a 225-token
  completion contained 202 reasoning tokens).
- Open question for ticket 04/05: whether map generation and gap probing
  are better with thinking on (better structure, more tokens) or off
  (cheaper, faster, possibly weaker structure). Default to thinking ON for
  the reality map call, evaluate in ticket 04.
- Source: https://api-docs.deepseek.com/guides/thinking_mode.

## 6. Rate limits

- Limits are concurrency-based, not RPM/TPM: `deepseek-v4-flash` allows
  2500 concurrent requests per account, `deepseek-v4-pro` 500. Exceeding
  returns HTTP 429. Irrelevant for a single-learner v1 app.
- Optional `user_id` param (regex `[a-zA-Z0-9\-_]+`, max 512) for content
  safety / KV cache / scheduling isolation. Not needed in v1 (no accounts).
- Server closes the connection if inference has not started within
  10 minutes.
- Source: https://api-docs.deepseek.com/quick_start/rate_limit.

## 7. Pricing and cost per session (at deepseek-v4-flash)

Per 1M tokens (source: https://api-docs.deepseek.com/quick_start/pricing):

- Input, cache hit: $0.0028 (context caching is automatic - the app resends
  the growing history every turn, so repeated prefixes hit the cache).
- Input, cache miss: $0.14.
- Output: $0.28.

Assumed session: 1 reality map call (~500 in, ~2,000 out including
reasoning) + 20 Socratic turns (growing history, avg 2,500 in per turn of
which ~90% cache hits, ~450 out per turn including reasoning).

- Map gen: 500 x $0.14/M + 2,000 x $0.28/M = $0.00007 + $0.00056 = $0.00063
- 20 turns in: 50,000 tokens, 45,000 cached
  (45,000 x $0.0028/M + 5,000 x $0.14/M = $0.00013 + $0.00070) = $0.00083
- 20 turns out: 9,000 x $0.28/M = $0.00252
- Total: roughly $0.004 per session (under half a US cent). Even doubling
  every assumption, a session stays below $0.01; 1,000 sessions land in the
  $4-10 range.

Caveat: the official pricing page states a significant price increase is
planned. Budget as if flash input/output may roughly double; still cheap.

## 8. Verified call evidence

- `GET /v1/models` with `Authorization: Bearer <redacted>`: HTTP 200,
  model list as in section 2.
- `POST /v1/chat/completions` with `deepseek-v4-flash`,
  `response_format: {"type": "json_object"}`: HTTP 200, valid JSON in
  `message.content`, `reasoning_content` present, finish_reason "stop",
  usage 132 prompt / 225 completion tokens (202 reasoning).
- `POST /v1/chat/completions` with `deepseek-chat`: HTTP 200, response
  model field `deepseek-v4-flash` (alias confirmed).
- `POST /v1/chat/completions` with `json_schema` format: HTTP 400,
  "This response_format type is unavailable now".
- `POST /v1/chat/completions` with `stream: true`: HTTP 200, SSE
  `chat.completion.chunk` deltas (reasoning_content first, content second).

## Sources

- https://api-docs.deepseek.com/quick_start/pricing
- https://api-docs.deepseek.com/quick_start/rate_limit
- https://api-docs.deepseek.com/guides/json_mode
- https://api-docs.deepseek.com/guides/thinking_mode
