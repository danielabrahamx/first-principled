# 16 - DeepSeek live probe (ticket 11 live leg)

Recorded 2026-08-20. `LLM_PROVIDER=deepseek` (deepseek-v4-flash),
photosynthesis only, 3 calls, via
`06-capture-diagnostics.mjs --live photosynthesis`. Transport change in
the same session: DeepSeek now downgrades `response_format json_schema`
to `json_object` (DeepSeek rejects json_schema, ticket 10); the gates
validate shape defensively.

## Result

- Pipeline ran end to end: chronology OK, epiphanies FAILED the contract
  (12 errors), arrange never ran. Learner file leaked nothing.
- The 12 errors are all reference/enum breaks, exactly what the OpenRouter
  JSON Schema was constraining:
  - `from_regimes`/`to_regimes` name regimes as words ("Light
    absorption") instead of chronology ids (c1, c2, ...),
  - `joint_kind` values not in the contract set,
  - `history.certainty` not a valid token.
- The model ignored the id/kind conventions without schema constraints.
  The UNKNOWN emptiness rule could not be observed because no history
  record survived the reference checks.

## Verdict

DeepSeek json_object mode cannot hold the Epiphanies contract. The
fail-honest gate worked as designed (no fake tree). Three paths forward:

1. Build the DeepSeek strict tool-call path (research/12: beta
   `base_url` + strict tools, thinking and non-thinking modes) - the
   only schema-like constraint DeepSeek offers; unverified, needs a few
   cheap probes.
2. Run the live leg on OpenRouter paid Nemotron as the ticket planned
   (~$0.10-0.50 for the four gold words).
3. Park the live leg.
