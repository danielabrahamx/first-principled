# 06 - Prod deploy smoke

Deploy id: `6a83a3dd6082d925b8c3d127`
Git HEAD at deploy: `34cbb8bab34d35eef5c9fa93455a8cbb002b5735`
Production: https://first-principled.netlify.app
Unique URL: https://6a83a3dd6082d925b8c3d127--first-principled.netlify.app

Prod env: `LLM_PROVIDER` unset (OpenRouter default). `LLM_BASE_URL` host
`openrouter.ai`. `LLM_MODEL` `nvidia/nemotron-3-ultra-550b-a55b:free`.
No `LLM_PROVIDER=deepseek`. Key never echoed. No prompt rewrite. No slug
switch.

## Chrome (CDP, 375px, 12/12)

Reused `.scratch/first-principled-v6/research/11-live-smoke.mjs` against
the unique URL. Screenshots: `06-375-empty.png`, `06-375-how.png`,
`06-375-tree.png`, `06-375-panel.png`.

- Header is Build + How it works. No Ask / Chat / Map / Reality / Tutor.
- Foundations placeholder and empty-Tree sentence match the grilling lock.
- How it works page shows the four locked paragraphs.
- Demo Tree lands (9 cards). Node panel is the rabbit-hole invitation
  card with no learner-state chrome.

## Live OpenRouter init

Script: `06-api-smoke.mjs`. Unique deploy URL. Poll deadline 840000 ms.
No secrets in this file.

| Word | Result | ms | Learner leaks | Notes |
| --- | --- | --- | --- | --- |
| photosynthesis | `invalid_model_output` | 17787 | none | ~one stage, then mechanical gate |
| recursion | `invalid_model_output` | 16793 | none | same envelope |

Exact live blocker: Nemotron `:free` returned output the Chronology /
Arrange mechanical gate rejected. Not HTTP 429 `free-models-per-day`.
The learner envelope stayed the generic `invalid_model_output` string.
No intermediate keys (`provenance`, `chronology`, `epiphanies`,
`discarded_input_ids`, `prompts`, `diagnostics`) appeared in the
learner-facing body. Stay on `:free`. Do not retune prompts in this
ticket.

## Diagnostic capture

Script: `06-capture-diagnostics.mjs`. Fixture run writes a learner map
and a diagnostic bundle as separate files under `06-diagnostics/`.
Learner file leak scan: none. Diagnostic file retains chronology,
epiphanies, provenance, discarded IDs, and prompt presence flags.
`--live` defaults to laptop, battery, photosynthesis, and recursion so
[Danny scores followability on the three-stage Tree](../issues/07-danny-scores-followability-on-the-three-stage-tree.md)
can persist the four-topic bundles without exposing them on `/api/agent`.

Key-leak grep clean: `.scratch/first-principled-v6/research/08-leak-check.mjs`
(0 hits in `src/`, `netlify/`, tracked files; `.env` gitignored).
