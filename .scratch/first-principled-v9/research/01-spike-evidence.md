# Ticket v9-01 spike evidence (live runs)

Date: 2026-09-10. Route: OpenRouter `z-ai/glm-5.3-flash` (committed
default; `LLM_MODEL` unset). No secrets recorded.

## Attempt log

### recursion, attempt 1 (2026-09-10): FAILED at pair validation

- Inventory: PASS with JSON Schema. 10 candidates plus fixed target
  gives 55 pairs in 4 batches (14/14/14/13).
- Pair batches: 5 model calls total. Batches 2-4 validated clean.
  Batch 1 returned the right shape but set `jump: SMALL` on three NONE
  rows. The contract requires NOT_APPLICABLE for NONE and
  SAME_CONCEPT. Job ended terminally with `invalid_model_output`.
  No repair prompt, per the ticket.
- Local judgments looked semantically sensible where valid (for
  example infinite recursion resting on function invocation).
- No topology was selected: the validator did its job before code ran.

### laptop, attempt 1 (2026-09-10): BLOCKED on transport

- `LLM API error 402`: request would exceed available credits given
  in-flight requests. Inventory call never completed. Not a model
  failure; top up credits and retry as a new recorded attempt.

### battery, photosynthesis: NOT ATTEMPTED

- Same credit blocker. First attempts remain to be run.

## 2026-09-10 route switch: DeepSeek V4.1 Flash

- Local `.env` (gitignored) switched to `LLM_PROVIDER=deepseek`,
  `DEEPSEEK_MODEL=deepseek-flash` (per DeepSeek API news, V4.1-Flash
  is live under `deepseek-flash`; `deepseek-v4-flash` routes to it).
  Base stays the configured proxy. No code or committed docs changed.
- Probe call 2026-09-10: provider, model, and base resolve; the proxy
  returns 402 credit balance exhausted, not model-not-found, so the
  route and model id are valid. Wallet top-up needed before any live
  attempt on this route. OpenRouter credit was likewise exhausted
  earlier, so both routes are currently blocked on billing, not on
  the spike.

## Findings for the next tickets

1. `json_object` mode drifts shape on this route (bare arrays,
   `concepts` for `candidates`). JSON Schema constrains shape where
   the route enforces it; code validation stays authoritative.
2. Schema cannot express the conditional jump rule (SMALL only for
   directional). The model defaults NONE rows to SMALL. Ticket 02 or
   04 must co-design prompt plus schema for this: either restate the
   jump rule as a per-row instruction in the user payload, or relax
   the validator to coerce NONE/SAME jumps to NOT_APPLICABLE in code
   (documented as mechanical, not semantic). No decision taken here.
3. Unbounded reasoning on the default route burns the 4000-token
   budget into hidden thinking (`finish_reason=length`). Explicit
   `reasoningEffort: low` fixed truncation on every call after it.
4. Cost signal: one recursion attempt cost 5 calls; usage counts were
   not captured before the failure path. The CLI now reports
   prompt/completion tokens on success.

## Verdict on Ticket 01

Spike modules, validators, selector, unit tests (25 green), and CLI
are built. Live evidence is partial: 0 of 4 gold words have a
target-to-foundation path yet, 1 failed honestly at validation, 1
blocked on credits, 2 unattempted. Go/kill undecided. Do not proceed
to Ticket 02 until the remaining first attempts are recorded.
