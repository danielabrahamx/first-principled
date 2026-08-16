# 01 - OpenRouter Nemotron Reality Map contract (findings)

Resolved 2026-08-16. Primary sources: OpenRouter docs, the OpenRouter model
pages, NVIDIA Nemotron 3 Ultra NIM / API docs, plus a live probe against
`POST https://openrouter.ai/api/v1/chat/completions` using the gitignored
`.env` key. The key is never printed here. Probe script:
`.scratch/first-principled-v6/research/01-probe-openrouter-nemotron.mjs`.

## Recommendation (ticket 02: do this, do not re-research)

**Usable on `:free`.** One live one-shot Reality Map for `laptop` returned
schema-valid, deriveCheck-clean, crown-reached. Stay on
`nvidia/nemotron-3-ultra-550b-a55b:free`. Do not switch slug unless a later
eval ticket proves the trees unusable, or `:free` stops resolving.

| Decision | Value |
| --- | --- |
| Usable on `:free` | yes |
| Timeout | default `240000` ms (45s would have aborted the live 118s map) |
| Path | one-shot (`fastPath: true`). Do not rely on serial per-layer |
| Thinking | drop DeepSeek `thinking`. It is ignored, not an error |
| Reasoning | send `reasoning: { effort: "none" }` for JSON maps |
| Headers | `HTTP-Referer` + `X-OpenRouter-Title` (optional for auth, required for attribution) |
| Slug | stay on `:free` |

## 1. Auth and route

- Base URL: `https://openrouter.ai/api/v1`. Chat completions:
  `POST /api/v1/chat/completions`. Bearer auth.
  Source: https://openrouter.ai/docs/api/reference/authentication
  and https://openrouter.ai/docs/quickstart.md
- OpenRouter keys in the management API examples are `sk-or-v1-...`.
  Source: https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key
- Live `.env`: key present, **OpenRouter prefix**. `LLM_MODEL` is still
  `deepseek-v4-flash` and `LLM_BASE_URL` is still `https://api.deepseek.com`.
  Probe overrode model and base in-process only. `.env` was not rewritten
  (ticket 02 updates `.env.example`; the human fills local `.env`).
- `:free` slug resolves. `GET /api/v1/models` returned
  `id: nvidia/nemotron-3-ultra-550b-a55b:free`,
  name `NVIDIA: Nemotron 3 Ultra (free)`, context 1,000,000, pricing 0/0.
  Paid slug `nvidia/nemotron-3-ultra-550b-a55b` also resolves (context
  512288). Live probe `models-free` / `models-paid`.
- Model page for the free slug:
  https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free

Optional attribution headers (not required for a 200, required to appear in
OpenRouter app rankings):

- `HTTP-Referer`: app URL
- `X-OpenRouter-Title`: display name (`X-Title` still accepted)

Sources: https://openrouter.ai/docs/api/reference/overview
and https://openrouter.ai/docs/app-attribution

Ticket 02 should send:

```
HTTP-Referer: https://first-principled.netlify.app
X-OpenRouter-Title: first-principled
```

The live probe sent those headers on every call. Auth succeeded without
printing the key.

## 2. JSON mode

OpenRouter documents `response_format` as either `{ type: "json_object" }`
or `{ type: "json_schema", json_schema: { ... } }`.
Source: https://openrouter.ai/docs/api/reference/overview
and https://openrouter.ai/docs/guides/features/structured-outputs.md

NVIDIA NIM documents the same `response_format: {"type": "json_object"}`
for Nemotron 3 Ultra 550B-A55B.
Source: https://docs.nvidia.com/nim/large-language-models/2.0.8/day-0/get-started-nemotron-3-ultra.html
(Structured JSON Output)

Live `GET /api/v1/models` `supported_parameters`:

- `:free` does **not** list `response_format` or `structured_outputs`.
  It lists `include_reasoning`, `max_tokens`, `reasoning`,
  `reasoning_effort`, `seed`, `temperature`, `tool_choice`, `tools`, `top_p`.
- Paid slug **does** list `response_format` and `structured_outputs`.

Sending `response_format: { type: "json_object" }` to `:free` still returned
HTTP 200 (not 4xx). Keep sending it. Do not switch slug just to get the
parameter listed. Callers must still parse defensively
(`src/lib/agent/jsonParse.js`); that matches NVIDIA's "validate the
response with your preferred schema library" guidance on the NIM page above.

### Live tiny JSON calls (`max_tokens: 64`)

All four against `nvidia/nemotron-3-ultra-550b-a55b:free`.

| Label | Status | Latency | JSON parsed | Reasoning tokens | Finish |
| --- | --- | --- | --- | --- | --- |
| json-only (no extra) | 200 | 3372 ms | yes (extracted from preamble) | 51 | length |
| `thinking: { type: "disabled" }` | 200 | 2253 ms | yes, clean `{"ok":true,"n":4}` | 37 | stop |
| `reasoning: { effort: "none" }` | 200 | 870 ms | yes, clean `{"ok":true,"n":4}` | 0 | stop |
| `reasoning: { enabled: true }` | 200 | 18378 ms | no (truncated) | 37 | length |

OpenRouter reasoning tokens land in `message.reasoning` /
`reasoning_details`, not DeepSeek `reasoning_content`.
Source: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
Live: `hasReasoningContent` false on every call; `hasReasoning` true unless
effort is `none`.

## 3. Thinking vs reasoning

Current `llm.js` sends DeepSeek `thinking: { type: "disabled" }` when
`options.thinking === false` (`src/lib/agent/llm.js`). Reality Map generation
passes `thinking: false` by default (`src/lib/agent/realityMap.js`).

That payload is **accepted and ignored** on this OpenRouter model: HTTP 200,
but 37 reasoning tokens still appeared. It does not disable Nemotron
reasoning.

The OpenRouter control is `reasoning`:

```
"reasoning": {
  "effort": "high" | "medium" | "low" | "minimal" | "none" | ...,
  "enabled": true,
  "exclude": false
}
```

`effort: "none"` disables reasoning entirely.
Source: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
The `:free` model page lists `reasoning` as a request parameter:
https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free

NVIDIA's own NIM client disables thinking with
`chat_template_kwargs.enable_thinking: False`, and documents reasoning as
configurable on/off.
Source: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b

Ticket 02 mapping (keep the `thinking` option so `realityMap.js` does not
change):

- `thinking === false` -> `payload.reasoning = { effort: "none" }`
- `thinking === true` -> `payload.reasoning = { enabled: true }`
- never send `payload.thinking`

JSON maps must use effort `none`. With reasoning on and `max_tokens: 64`,
the tiny call truncated (`finish_reason: length`) and `parseModelJson`
failed. Maps use 8192 output tokens, but reasoning still burns latency
(18s vs 0.87s on the tiny pair) and output budget.

## 4. Latency and timeout

Published `:free` NVIDIA provider stats (OpenRouter model page, fetched
2026-08-16):

- Provider table latency P50: 17.64s, throughput 10 tps, uptime 99.22%
- Latency P50 / P90 / P95: 3.49s / 35.21s / 55.41s
- **E2E latency P50 / P90 / P95: 23.42s / 127.25s / 196.61s**

Source: https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free

Live:

- Tiny JSON with reasoning off: 870 ms (well under 45s)
- Tiny JSON with reasoning on: 18378 ms (matches the published ~18s P50)
- One-shot laptop Reality Map, reasoning off, `max_tokens` 8192: **118120 ms**

Current `llm.js` default is 45000 ms. That default would have aborted the
successful map. Ticket 02 must change the default to **240000** ms (covers
published e2e P95 196s plus margin). Callers that do not pass `timeoutMs`
(`generateRealityMap`'s injected transport does not) inherit this default.

Serial per-layer is several sequential calls (foundation plus up to ~6
layers plus up to two repairs each: `MAX_FOUNDATION_ATTEMPTS = 3` and
per-layer attempts in `src/lib/agent/realityMap.js`). At ~20s-120s per
call that will not finish inside a learner wait, and it risks the Netlify
background 15-minute budget already documented on
`netlify/functions/agent/agent.mjs`. Do not run serial as the production
path for this model.

The function is already background (`netlify.toml` `[functions.agent]
background = true`). One 118s one-shot fits. Ticket 02 does not need to
change Netlify config.

## 5. Validity (live one-shot, concept `laptop`)

`generateRealityMap({ concept: "laptop" }, { fastPath: true })` with a
probe transport that sent `response_format: json_object` and
`reasoning: { effort: "none" }`, 180s abort, and stopped before the serial
fallback (`PROBE_STOP_SERIAL` on a second LLM call; not hit).

| Check | Result |
| --- | --- |
| `ok` | true |
| `generationPath` | `oneshot` |
| repair count | 0 (`retried: false`; one-shot has no repair loop) |
| `validateRealityMap` | ok, no errors |
| `deriveCheck` | ok, no errors |
| crown reached | yes (`Laptop` is a node) |
| shape | 8 layers, 11 nodes, 12 edges |
| latency | 118117 ms inside `generateRealityMap` |
| LLM calls | 1 |

Node labels (live): Electricity, Silicon Crystal, Copper Wire, Lithium Ion
Cell, Transistor, Printed Circuit Board, Logic Gate, Microprocessor,
Operating System, Applications, Laptop.

This ticket does not score followability. That is
[Reality Map quality eval](../issues/07-reality-map-quality-eval.md).

## 6. Free-tier risk

The `:free` model page warns: do not upload confidential information or
personal data; NVIDIA logs use for security and to improve products;
logged session data for improvement is not linked to identity.
Source: https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free
(banner above the model title), linking NVIDIA Privacy Policy and NVIDIA
API Trial Terms of Service.

OpenRouter itself does not store prompts unless the account opts in.
Source: https://openrouter.ai/docs/guides/privacy/data-collection.md

This app sends a concept word and map JSON, not learner secrets. Logging
is acceptable for v1. Stay on `:free`.

Paid slug page: https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b
(in/out about $0.50 / $2.20 per 1M at fetch time; provider table lists
Baseten, Together, Venice, Crusoe, DeepInfra). Switch slug, not provider,
only if `:free` later fails availability or eval.

## 7. Exact `llm.js` diff for ticket 02

No `src/` changes in this ticket. Apply all of the following in ticket 02.

1. File comment and typedef: OpenRouter, not DeepSeek. JSON mode remains
   best-effort. Reasoning arrives in `message.reasoning` (and possibly
   `reasoning_details`), not `reasoning_content`.
2. `llmBaseUrl()` default: `"https://openrouter.ai/api/v1"`
3. `llmModel()` default: `"nvidia/nemotron-3-ultra-550b-a55b:free"`
4. `timeoutMs` default: `240000` (replace every `45000`)
5. Headers on the `fetch` to `/chat/completions`:

```
"Content-Type": "application/json",
Authorization: `Bearer ${apiKey}`,
"HTTP-Referer": "https://first-principled.netlify.app",
"X-OpenRouter-Title": "first-principled",
```

6. Replace the thinking payload with reasoning:

```
if (options.thinking === false) {
  payload.reasoning = { effort: "none" };
} else if (options.thinking === true) {
  payload.reasoning = { enabled: true };
}
```

Delete `payload.thinking = { type: "disabled" }`.

7. Keep `payload.response_format = { type: "json_object" }` when
   `options.jsonMode` is true.
8. When reading the choice, prefer OpenRouter `message.reasoning` if
   `reasoning_content` is absent:

```
reasoningContent:
  typeof choice.message.reasoning_content === "string"
    ? choice.message.reasoning_content
    : typeof choice.message.reasoning === "string"
      ? choice.message.reasoning
      : null,
```

9. Docs in the same commit: `.env.example` `LLM_MODEL` /
   `LLM_BASE_URL`, README, AGENTS.md stack line. Do not commit `.env`.
10. Do not change `realityMap.js` in ticket 02. Production maps must call
    with `fastPath: true` (already the `?fast=1` path). Serial remains a
    fallback that this model is unlikely to finish.

`.env.example` after ticket 02:

```
LLM_API_KEY=
LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
LLM_BASE_URL=https://openrouter.ai/api/v1
```

Local `.env` still has DeepSeek model/base; the key is already an
OpenRouter prefix. Ticket 02 should not rewrite `.env`. The human points
model and base at OpenRouter locally.

## Probe reproduction

From repo root (PowerShell):

```
node --env-file=.env .scratch/first-principled-v6/research/01-probe-openrouter-nemotron.mjs
```

Prints one JSON object per phase. No secrets.
