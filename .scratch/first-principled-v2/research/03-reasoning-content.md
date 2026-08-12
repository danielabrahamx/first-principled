# Ticket 03 - Research: reasoning_content reliability (deepseek-v4-flash)

*2026-08-10 · Resolved during charting by research subagents (docs) + a live
probe attempt (blocked on billing).*

## Findings from the official DeepSeek API reference

Source: https://api-docs.deepseek.com/api/create-chat-completion (fetched
2026-08-10) and https://api-docs.deepseek.com (model list).

1. **Models:** `deepseek-v4-flash` and `deepseek-v4-pro` are the current
   models. `deepseek-v4-flash` is served as DeepSeek-V4-Flash-0731; the
   calling name is unchanged.

2. **Thinking mode is ON by default.** The `thinking` parameter
   (`{"type": "enabled" | "disabled"}`) defaults to `enabled`. The v1 code
   already reflects this: llm.js sends `thinking: {type: "disabled"}` only
   when thinking is off, and DeepSeek's docs describe "non-thinking model"
   as the disabled state.

3. **`reasoning_effort`:** `low | high | max`, default `high`.
   `deepseek-v4-flash` supports all three levels; `deepseek-v4-pro`
   currently supports only `high` and `max` (low maps to high, xhigh maps to
   max; expected to support all three in early August 2026). This is a new
   dial v1 does not use - relevant to ticket 02 (cost/latency tuning of the
   Socratic turn).

4. **`reasoning_content` field:** present in the response message "For
   thinking mode only. The reasoning contents of the assistant message,
   before the final answer." It is `string | null` - i.e. it is only present
   when thinking mode is active (which is the default), and is nullable, so
   callers must treat absence/empty as a normal case. It is free-form
   reasoning, NOT JSON - the JSON contract lives in `content` only (the
   existing `parseModelJson`/`extractBalancedObject` fallback chain already
   ignores it correctly).

5. **JSON mode + thinking:** the docs state
   `response_format: {type: "json_object"}` "guarantees the message the model
   generates is valid JSON" and require instructing the model to produce JSON
   in the prompt (the engine already does). No documented conflict between
   thinking mode and json_object; the reasoning happens in
   `reasoning_content` before the JSON answer in `content`. The engine's
   existing behavior (think, parse content defensively) matches the docs.

6. **Cost/latency:** reasoning tokens count toward generated output tokens
   and are billed accordingly (docs do not itemize them in usage for the
   non-stream response; the probe script looks for
   `usage.completion_tokens_details.reasoning_tokens` when a live key is
   available). Latency is higher in thinking mode because the model
   generates CoT before the answer. The repo's own measurement (v1 ticket
   04): thinking ON pushed reality-map generation to 47-54s (over the 30s
   budget), thinking OFF 5-14s. For Socratic turns (shorter outputs) the
   delta is smaller but real.

7. **`reasoning_content` as input (Beta):** usable in Chat Prefix Completion
   (base_url /beta, `prefix: true`) as the CoT input for the last assistant
   message. Not needed for v2, but it means reasoning can be echoed back
   into a continuation if we ever want the model to build on its own prior
   reasoning.

## Live probe outcome (blocked)

`probe-reasoning.mjs` (this dir) runs one thinking-on and one thinking-off
call against the configured model. Both returned **402 Insufficient Balance**
- the `.env` LLM_API_KEY has no credit, so live presence/latency/token
numbers could not be gathered on 2026-08-10. The key is present (35 chars)
and correctly read; this is an account billing state, not a config error.

**To finish the live numbers:** top up the DeepSeek account (or set
LLM_API_KEY to an account with balance), then run:
`cd first-principled && set -a && . ./.env && set +a && node .scratch/first-principled-v2/research/probe-reasoning.mjs`

## Recommendation for tickets 02/04

- CoT is available and cheap enough to use privately: keep thinking ON for
  the Socratic turn, and have the server consume `reasoning_content` to
  drive the learner-map update (state/evidence extraction) and to record a
  private "why this question" note for the history feature - never shown to
  the learner.
- Always treat `reasoning_content` as optional (nullable): an absent or
  empty value must not fail the turn (the repair retry path already handles
  empty content).
- Consider `reasoning_effort: "low"` for map generation (ticket 06) and
  probing turns, and `"high"` (default) only where judgment matters
  (misconception detection, transfer grading) - a latency/cost dial tickets
  02 and 06 should test on the eval harness (ticket 07).
