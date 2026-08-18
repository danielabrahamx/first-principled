# 10 - JSON Schema on Epiphanies

Live probe: `10-json-schema-epiphanies.mjs`. `LLM_PROVIDER=deepseek`.
Concept `battery`. 2026-08-18.

## Result

DeepSeek rejected the Epiphanies JSON Schema request before constrained
decoding could run.

- Chronology, thinking off, `json_object`: 2799 ms. Parsed `concept` and
  `chronology`.
- Epiphanies, thinking off, `json_schema`: HTTP 400 after 302 ms. Provider
  message: `This response_format type is unavailable now`.
- Epiphanies field checks: did not run because there was no model reply.
- Arrange: did not run.
- Total: 3101 ms. `OK=false`, `KIND=error`.

The probe made no fallback call and no retry. The client-side mechanical
gate remains fail-closed. Per
[Ship JSON Schema on Epiphanies](../issues/10-ship-json-schema-on-epiphanies.md),
the ticket remains unresolved and production was not deployed. Prod remains
OpenRouter.

No secrets or model output were recorded.
