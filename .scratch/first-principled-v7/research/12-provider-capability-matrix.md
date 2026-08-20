# 12 - Provider Capability Matrix: Complex Validated Hierarchical JSON from LLM APIs

Research date: 2026-08-20. Question owner: v7 planning (Option B was rejected in
[09-thinking-architecture-council.md](../09-thinking-architecture-council.md) on the
claim that "no provider ships thinking and structured outputs in the same call").
This file verifies that claim against current primary sources and recommends a
zero-dependency, serverless 3-call pipeline.

Raw fetched sources (HTML + extracted text) live in `_sources/` next to this file.

## TL;DR

- **The v7 claim is FALSE as of 2026-08-20.** Every major provider now ships
  reasoning/thinking combined with schema-constrained output in a single call:
  OpenAI gpt-5.6 (response_format json_schema on a reasoning model), Anthropic
  (GA structured outputs: grammar applies to the final output only, Claude
  "thinks freely" first), Gemini 3 (thinking is default; structured outputs +
  function calling supported), and - critically for this repo - **DeepSeek V4**
  (thinking mode + `strict: true` tool calls with JSON Schema, documented as
  "supported by both thinking and non-thinking mode").
- **DeepSeek still rejects `response_format: json_schema`** (JSON Output guide
  documents `json_object` only) - the repo's 400 from ticket 10 still stands for
  the raw-completion path. The schema-constrained path on DeepSeek is now **strict
  tool calls**, which require `base_url=https://api.deepseek.com/beta` and support
  only a flattened schema subset (no const/pattern/allOf) - the same shape the repo
  already had to flatten for Nemotron.
- **Paid Nemotron via OpenRouter does support structured outputs**: OpenRouter's
  own models API lists `structured_outputs` and `response_format` among its
  supported parameters (plus `reasoning`/`reasoning_effort`). The :free variant
  does not, matching the repo's probe. Whether thinking ON + schema both work in
  one Nemotron call is undocumented and needs a probe.
- **Grammar-constrained decoding libraries (Outlines, guidance, llama.cpp GBNF,
  Jsonformer) are NOT viable inside the zero-dep Netlify function**: they require
  control over the sampler (local model or a GPU/hosted server). Provider-native
  structured outputs are the serverless answer.
- **Costs at our scale are trivial** (USD 0.03 - 0.25 per 3-call pipeline at 50k
  output tokens for the cheap options). Cost does not justify staying on a weaker
  constraint surface.

## 1. Comparison matrix (primary-source verified, 2026-08-20)

| Provider / surface | Strict schema output | Thinking/reasoning | Both in same call | Schema feature limits | Serverless-friendly |
|---|---|---|---|---|---|
| OpenAI - response_format json_schema (gpt-5.6 family) | Yes, guaranteed schema adherence ([docs](https://platform.openai.com/docs/guides/structured-outputs)) | Yes, reasoning models ([docs](https://platform.openai.com/docs/guides/reasoning)) | **Yes** - documented chain-of-thought + json_schema example on gpt-5.6 ([docs](https://platform.openai.com/docs/guides/structured-outputs)) | strict mode restricts schema subset (required + additionalProperties:false enforced) | Yes, HTTP API |
| OpenAI - function calling (strict) | Yes, same guarantee | Yes, reasoning + function calling with reasoning-item passback ([docs](https://platform.openai.com/docs/guides/reasoning)) | Yes | same strict subset | Yes |
| Anthropic - structured outputs (JSON outputs, GA) | Yes, "guarantee schema-compliant responses through constrained decoding" ([docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)) | Yes (adaptive/extended thinking) | **Yes** - "Grammar state resets between sections, allowing Claude to think freely while still producing structured output in the final response" ([docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)) | "standard JSON Schema format with some limitations" ([docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)) | Yes |
| Anthropic - strict tool use (strict: true) | Yes ([docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)) | Yes - interleaved thinking with tool use ([docs](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)) | Yes | tool input_schema | Yes |
| Gemini - responseSchema / response_format schema | Yes - "the model's response always follows your defined schema" ([Vertex docs](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output), [Gemini API docs](https://ai.google.dev/gemini-api/docs/structured-output)) | Yes, thinking is default; thinking_level LOW/MEDIUM/HIGH ([Gemini API docs](https://ai.google.dev/gemini-api/docs/thinking), [Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/thinking-mode)) | Yes (no documented incompatibility; structured outputs + tools incl. function calling on Gemini 3, preview) ([docs](https://ai.google.dev/gemini-api/docs/structured-output)) | supported schema fields list; complex schemas can error ([Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output)) | Yes |
| OpenRouter - response_format json_schema pass-through | Partial by design: "Enforcement varies by provider... some guarantee schema-conforming output, while others translate your schema into their own structured-output format or treat it as a strong hint" ([docs](https://openrouter.ai/docs/features/structured-outputs)) | Yes - unified `reasoning` param, normalized effort/max_tokens ([docs](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)) | Per endpoint/model; not documented as a global combo | provider-dependent | Yes |
| OpenRouter paid nvidia/nemotron-3-ultra-550b-a55b | Yes - `structured_outputs` + `response_format` in supported_parameters ([models API](https://openrouter.ai/api/v1/models), fetched 2026-08-20) | Yes - `reasoning`, `reasoning_effort`; mandatory:false, default_enabled:true, efforts high/medium ([models API](https://openrouter.ai/api/v1/models)) | **Undocumented** - needs a probe. Empirically the flattened strict schema passed the field checklist with thinking OFF (repo probe [10-json-schema-epiphanies.md](../10-json-schema-epiphanies.md)) | repo probe: rich schema (const/pattern/allOf) dropped `history`; flattened subset passed | Yes |
| OpenRouter nemotron-3-ultra-550b-a55b:free | **No** - neither structured_outputs nor response_format listed ([models API](https://openrouter.ai/api/v1/models)) | reasoning only | No | - | Yes (but unusable for stage 2) |
| DeepSeek - response_format | `json_object` only; `json_schema` undocumented and returns 400 (repo ticket 10) ([JSON Output guide](https://api-docs.deepseek.com/guides/json_mode)) | Yes - thinking mode (default on), reasoning_effort low/high/max ([Thinking Mode guide](https://api-docs.deepseek.com/guides/thinking_mode)) | **No** via response_format | n/a | Yes |
| DeepSeek - strict tool calls (beta) | Yes - "the model strictly adheres to the format requirements of the Function's JSON schema... supported by both thinking and non-thinking mode" ([Tool Calls guide](https://api-docs.deepseek.com/guides/tool_calls)) | Yes - thinking mode supports tool calls ([Thinking Mode guide](https://api-docs.deepseek.com/guides/thinking_mode)) | **YES** - this is DeepSeek's thinking + schema combo | subset: object, string, number, integer, boolean, array, enum, anyOf; all properties required; additionalProperties:false; beta base_url ([Tool Calls guide](https://api-docs.deepseek.com/guides/tool_calls)) | Yes |

Model landscape note: DeepSeek V4 GA'd 2026-08-13 (`deepseek-v4-flash` = V4-Flash-0731,
`deepseek-v4-pro` = V4-Pro-0813) with peak/off-peak pricing ([news](https://api-docs.deepseek.com/news/news260813),
[pricing](https://api-docs.deepseek.com/quick_start/pricing)). OpenAI's current
flagship is gpt-5.6 with three tiers (sol/terra/luna) ([pricing](https://platform.openai.com/docs/pricing)).
Anthropic's newest are Claude Opus 5 / Sonnet 5 / Haiku 4.5 ([pricing](https://docs.claude.com/en/docs/about-claude/pricing)).
Gemini's current lineup is Gemini 3.x (3.7 Flash, 3.6 Flash, 3.5 Flash, 3.1 Pro Preview) ([Vertex pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)).

## 2. The v7 claim, verified

Claim: "no provider ships thinking and structured outputs in the same call"
(reason Option B was rejected).

**Status: FALSE as of 2026-08-20.** Primary-source evidence per provider:

- **OpenAI**: Structured Outputs guide ships a full "Structured Outputs for
  chain-of-thought math tutoring" example - `gpt-5.6` + `response_format:
  json_schema` on a reasoning model, parsing `steps[]` + `final_answer`
  ([guide](https://platform.openai.com/docs/guides/structured-outputs)). Reasoning
  tokens are billed but the content channel is schema-enforced (the exact
  "reasoning then constrained emit" pattern the 09 council wanted).
- **Anthropic**: Structured outputs are GA (no beta header; `output_config.format`
  with `type: "json_schema"` + `strict: true` tool use) and the doc states the
  grammar applies only to direct output, "not to tool use calls, tool results, or
  thinking tags... allowing Claude to think freely while still producing structured
  output in the final response" ([docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)).
  Thinking + tool use (interleaved) is separately documented
  ([docs](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)).
- **Gemini**: thinking is the default behavior on Gemini 3 series with
  `thinking_level` control ([docs](https://ai.google.dev/gemini-api/docs/thinking),
  [Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/thinking-mode));
  structured outputs combine with tools including Function Calling on Gemini 3
  (preview) ([docs](https://ai.google.dev/gemini-api/docs/structured-output)). No
  documented incompatibility between thinking and responseSchema.
- **DeepSeek**: thinking mode + tool calls is documented, and strict mode ("the
  model strictly adheres to the format requirements of the Function's JSON
  schema") "is supported by both thinking and non-thinking mode"
  ([Tool Calls guide](https://api-docs.deepseek.com/guides/tool_calls),
  [Thinking Mode guide](https://api-docs.deepseek.com/guides/thinking_mode)).
  This is the direct refutation of the claim on the very provider the repo uses.
  The caveat: it is the tool-call surface, not `response_format`, and it is beta
  (needs `https://api.deepseek.com/beta`).
- **OpenRouter / Nemotron**: no first-party statement one way or the other on
  thinking+schema in one call; supported_parameters lists both capabilities on the
  paid endpoint ([models API](https://openrouter.ai/api/v1/models)). Undocumented
  combination - treat as "needs a probe".

Why the 09 council said what it said: at that time (2026-08-18) the evidence was
DeepSeek's old `deepseek-reasoner` docs ("reasoning models do not support
`response_format`") and the observed 400s. DeepSeek's V4 API (GA'd days later,
2026-08-13 news) changed the surface: thinking is now a toggle on the regular
chat API and strict tool calls provide the schema constraint. The council's own
line 54 ("On OpenAI o-series or Anthropic extended thinking with tool use, this
is the right answer. On DeepSeek, it's aspirational") - the DeepSeek part is now
also shipped, via tools.

## 3. Function calling / tool use vs raw JSON completion

Primary-source guidance (OpenAI):
- "If you are connecting the model to tools, functions, data, etc. in your
  system, then you should use function calling. If you want to structure the
  model's output when it responds to the user, then you should use a structured
  response_format" ([Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs)).
- Both surfaces carry the same schema guarantee on OpenAI ("always generate
  responses that adhere to your supplied JSON Schema").
- JSON mode is strictly weaker: "JSON mode will not guarantee the output matches
  any specific schema, only that it is valid and parses without errors... use
  Structured Outputs to ensure it matches your schema, or... use a validation
  library and potentially retries" ([guide](https://platform.openai.com/docs/guides/structured-outputs)).

Best practices for complex nested objects (drawn from the above + Anthropic +
DeepSeek docs):
- With tool use, the JSON lands in `tool_calls[].function.arguments` (or
  Anthropic `input` block), never in the prose `content` - the parser must read
  the tool-call channel, which is exactly the "two-region output, parse only the
  second region" discipline the 09 council wanted (analogue 2, ReAct
  Thought/Action).
- With raw completion + response_format, schema must be flat enough for the
  provider's strict subset: required on every object, additionalProperties:false.
  Both the repo's Nemotron probe (rich schema silently dropped `history`) and
  DeepSeek's documented strict-mode subset (object/string/number/integer/boolean/
  array/enum/anyOf only; every property required; additionalProperties:false)
  ([Tool Calls guide](https://api-docs.deepseek.com/guides/tool_calls)) force the
  same flattened shape. The repo's flattened Epiphanies schema is already the
  right shape.
- Anthropic: strict tool use "guarantee[s] schema validation on tool names and
  inputs"; structured outputs "guarantee schema-compliant responses through
  constrained decoding... No retries needed for schema violations"
  ([docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)).
- DeepSeek: "If your code does not correctly pass back reasoning_content, the
  API will return a 400 error" when tools are used in thinking mode - a real
  integration cost for a thinking-on tool-call pipeline
  ([Thinking Mode guide](https://api-docs.deepseek.com/guides/thinking_mode)).

Reliability verdict: for emitting a complex validated object, the constrained
surfaces (response_format json_schema / strict tool calls / JSON outputs) beat
prompt-only JSON completion everywhere. Tool use additionally buys a clean
separation between thinking and the parseable payload on providers whose
thinking channel pollutes `content` (the exact failure in the repo's mixed
Epiphanies run).

## 4. Grammar-constrained decoding libraries - serverless reality check

| Library | Mechanism | Where it runs | Verdict for zero-dep Netlify function |
|---|---|---|---|
| Outlines | token-level masking against JSON Schema / regex / CFG; "guarantees structured outputs during generation" ([docs](https://dottxt-ai.github.io/outlines/)) | local model via vLLM/transformers/llama.cpp/Ollama/SGLang/TGI, or hosted OpenAI/Anthropic/Gemini APIs (delegating to their structured-output modes), or commercial Dottxt API | **Not viable in-function.** Needs Python + a model backend or a hosted endpoint. Outlines on hosted APIs cannot mask tokens itself. |
| Guidance | regex/CFG/JSON-schema constrained generation, interleaved control ([readme](https://github.com/guidance-ai/guidance)) | Transformers, llama.cpp, OpenAI backends (Python) | Not viable in-function. |
| llama.cpp GBNF | grammars constrain sampling; JSON schema -> grammar conversion; served via llama-server HTTP `grammar` field ([GBNF guide](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)) | a running llama.cpp server (GPU/CPU worker) | Not viable unless you run a worker; the repo has no worker. |
| Jsonformer | HF transformers wrapper, fills fixed tokens, subset of JSON Schema ([readme](https://github.com/1rgs/jsonformer)) | local GPU | Not viable. |

Honest assessment: token-level constrained decoding requires ownership of the
sampler. Inside a zero-dependency Netlify background function that only makes
HTTP calls, grammar libraries are a non-starter (no Python runtime guarantee, no
GPU, no model weights, cold starts). The serverless equivalent of constrained
decoding is exactly what the providers now ship natively (OpenAI/Anthropic
"constrained decoding", Gemini responseSchema, DeepSeek strict tool calls) -
use those. The only grammar-adjacent option reachable over HTTP is a hosted
service (e.g. Outlines' commercial Dottxt API), which contradicts the
zero-dependency/cost goals and is not recommended.

## 5. Cost per 3-call pipeline (USD, cache miss, 2026-08-20 prices)

Assumptions: ~30k input tokens total across Chronology -> Epiphanies -> Arrange,
and output spanning 15k (light) to 50k (heavy) tokens. Thinking/reasoning tokens
bill as output tokens on OpenAI, Anthropic, Gemini and DeepSeek, so a
thinking-on Epiphanies stage adds to the output line.

| Option | In $/MTok | Out $/MTok | 15k out pipeline | 50k out pipeline |
|---|---|---|---|---|
| DeepSeek v4-flash, off-peak ([pricing](https://api-docs.deepseek.com/quick_start/pricing)) | 0.22 | 0.66 | ~0.016 | ~0.040 |
| DeepSeek v4-flash, peak | 0.44 | 1.32 | ~0.033 | ~0.079 |
| DeepSeek v4-pro, off-peak | 0.66 | 1.98 | ~0.050 | ~0.119 |
| DeepSeek v4-pro, peak | 1.32 | 3.96 | ~0.100 | ~0.238 |
| OpenAI gpt-5.6-luna ([pricing](https://platform.openai.com/docs/pricing)) | 0.20 | 1.20 | ~0.024 | ~0.066 |
| OpenAI gpt-5.6-terra | 2.00 | 12.00 | ~0.240 | ~0.660 |
| OpenAI gpt-5.6-sol | 5.00 | 30.00 | ~0.600 | ~1.650 |
| Gemini 3.7 Flash intro to 2026-12-31 ([pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)) | 0.75 | 3.75 | ~0.079 | ~0.210 |
| Gemini 3.1 Pro Preview | 2.00 | 12.00 | ~0.240 | ~0.660 |
| Anthropic Haiku 4.5 ([pricing](https://docs.claude.com/en/docs/about-claude/pricing)) | 1.00 | 5.00 | ~0.105 | ~0.280 |
| Anthropic Sonnet 5 | 2.00 | 10.00 | ~0.210 | ~0.560 |
| Anthropic Opus 5 | 5.00 | 25.00 | ~0.525 | ~1.400 |
| OpenRouter paid Nemotron ultra ([models API](https://openrouter.ai/api/v1/models)) | 0.60 | 3.60 | ~0.072 | ~0.198 |
| OpenRouter nemotron-3-super-120b-a12b (same family, cheaper) | 0.085 | 0.40 | ~0.015 | ~0.029 |

Bottom line: every viable option costs pennies per pipeline. DeepSeek off-peak
and Nemotron super/ultra are the cheapest; even a paid probe on gpt-5.6-luna or
Gemini 3.7 Flash is a fraction of a cent per pipeline. Cost should not drive the
constraint-surface decision.

## 6. Recommendation for the zero-dep serverless 3-call pipeline

Constraints honored: one stateless Netlify function, no new npm deps, no
per-stage model swap, no retry/fourth call, prod stays OpenRouter, cheap.

1. **Keep current prod as-is (Option A, paid Nemotron, thinking off, flattened
   strict json_schema on Epiphanies).** It is verified working by the repo's own
   probe and costs ~USD 0.07-0.20 per pipeline. Optionally add OpenRouter
   `require_parameters: true` so requests never route to endpoints that cannot
   honor `response_format` ([docs](https://openrouter.ai/docs/features/structured-outputs)).
2. **Probe the two undocumented combos before changing anything** (reuse the
   existing probe pattern from [10-json-schema-epiphanies.mjs](../10-json-schema-epiphanies.mjs)):
   a. OpenRouter paid Nemotron: `reasoning`/`reasoning_effort` + `response_format
      json_schema` in one call. If schema holds with thinking on, Option B is
      implementable with zero provider change.
   b. DeepSeek V4-Pro direct: thinking on + a single `strict: true` tool (e.g.
      `emit_epiphanies`) whose parameters are the flattened schema, via
      `base_url=https://api.deepseek.com/beta`. This is the documented
      thinking+schema path; the function must read `tool_calls[0].function.
      arguments` instead of `content`, and must echo `reasoning_content` back if
      the call loop continues (single-shot here, so not an issue).
3. **If the probes pass, the recommended upgrade is DeepSeek V4-Pro thinking-on
   Epiphanies via strict tool call** (~USD 0.12-0.24 per pipeline off-peak/peak):
   it is the only cheap path that pairs real reasoning with a machine-checkable
   schema on the exact stage that needs it, and it satisfies the 09 council's
   own "Option B in 12 months when DeepSeek ships thinking + structured outputs
   in the same call" - that has now shipped.
4. **Do not adopt grammar libraries** (Section 4) and **do not switch providers
   per stage** (council rule; c1/c2 referential integrity).
5. **Optional paid probe (clearly optional, cost is negligible):** one full
   3-call pipeline on OpenAI gpt-5.6-luna or Gemini 3.7 Flash purely to
   benchmark joint quality (deep reasoning + schema) against the DeepSeek path,
   to inform the followability HITL ticket. Not required for the pipeline
   decision.

Schema-shape rule that survives all options: keep the flattened strict subset
(no const/pattern/allOf; required everywhere; additionalProperties:false) - it
is the only shape both Nemotron's enforcement and DeepSeek's strict mode accept.

## 7. Source list (primary)

- OpenAI Structured Outputs guide: https://platform.openai.com/docs/guides/structured-outputs
- OpenAI Reasoning guide: https://platform.openai.com/docs/guides/reasoning
- OpenAI Pricing: https://platform.openai.com/docs/pricing
- Anthropic Structured Outputs: https://docs.claude.com/en/docs/build-with-claude/structured-outputs
- Anthropic Extended Thinking: https://docs.claude.com/en/docs/build-with-claude/extended-thinking
- Anthropic Tool Use: https://docs.claude.com/en/docs/build-with-claude/tool-use
- Anthropic Pricing: https://docs.claude.com/en/docs/about-claude/pricing
- Gemini API Structured Output (live page login-walled; archived 2026-08-08): https://ai.google.dev/gemini-api/docs/structured-output
- Gemini API Thinking (archived 2026-08-13): https://ai.google.dev/gemini-api/docs/thinking
- Vertex AI Thinking Mode: https://cloud.google.com/vertex-ai/generative-ai/docs/thinking-mode
- Vertex AI Control Generated Output: https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output
- Vertex AI Pricing: https://cloud.google.com/vertex-ai/generative-ai/pricing
- OpenRouter Structured Outputs: https://openrouter.ai/docs/features/structured-outputs
- OpenRouter Reasoning Tokens: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
- OpenRouter Models API (fetched 2026-08-20, includes per-model supported_parameters + pricing): https://openrouter.ai/api/v1/models
- OpenRouter Thinking Variant: https://openrouter.ai/docs/guides/routing/model-variants/thinking
- DeepSeek JSON Output: https://api-docs.deepseek.com/guides/json_mode
- DeepSeek Thinking Mode: https://api-docs.deepseek.com/guides/thinking_mode
- DeepSeek Tool Calls (strict mode): https://api-docs.deepseek.com/guides/tool_calls
- DeepSeek Pricing: https://api-docs.deepseek.com/quick_start/pricing
- DeepSeek V4 GA news (2026-08-13): https://api-docs.deepseek.com/news/news260813
- Outlines: https://dottxt-ai.github.io/outlines/
- Guidance: https://github.com/guidance-ai/guidance
- llama.cpp GBNF guide: https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md
- Jsonformer: https://github.com/1rgs/jsonformer
- Repo-local empirical evidence: [10-json-schema-epiphanies.md](../10-json-schema-epiphanies.md), [09-thinking-architecture-council.md](../09-thinking-architecture-council.md)
