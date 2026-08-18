# 10 - JSON Schema on Epiphanies

Live probe: `10-json-schema-epiphanies.mjs`. Concept `battery`.
2026-08-18. Thinking off on every stage. No secrets.

## DeepSeek

`LLM_PROVIDER=deepseek`. Chronology `json_object` parsed. Epiphanies
`json_schema` returned HTTP 400: `This response_format type is
unavailable now`. Arrange did not run.

## OpenRouter `:free`

`nvidia/nemotron-3-ultra-550b-a55b:free` accepted `json_schema` with the
rich schema (`const`, `pattern`, `allOf`/`if`/`then`) and omitted
`history` on every joint. Flattened schema then returned no choices.
`:free` cannot constrain Stage 2.

## OpenRouter paid Nemotron

`nvidia/nemotron-3-ultra-550b-a55b` lists `structured_outputs`. The rich
schema still omitted `history`. The flattened strict subset (no `const`,
`pattern`, or `allOf`/`if`/`then`; certainty rules remain in
`epiphaniesProblems`) passed the field checklist:

- Chronology, thinking off, `json_object`: 5222 ms.
- Epiphanies, thinking off, `json_schema`: 30672 ms. Four joints, each
  with `history` keys `certainty,who,when,observation,uncertainty_note`.
  `EPIPHANIES_ERRORS` empty.
- Arrange, thinking off, `json_object`: 20234 ms. Arrange ran.
- Total 56136 ms.

Arrange then failed its own mechanical gate (missing `concept`, `layers`,
edge ids, provenance). That is outside this ticket's question. No retry,
no prompt rewrite, no fourth call.

## Ship

Prod stays OpenRouter. Default slug is paid Nemotron. Do not set Netlify
`LLM_PROVIDER=deepseek`.
