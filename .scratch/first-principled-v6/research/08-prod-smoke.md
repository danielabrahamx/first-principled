# 08 - Prod deploy smoke

Deploy id: `6a821d5637d95139bd35956f`
Production: https://first-principled.netlify.app
Unique URL: https://6a821d5637d95139bd35956f--first-principled.netlify.app

Netlify `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` set from local `.env`
into the all context (OpenRouter Nemotron `:free`). Key never echoed.
`TURNSTILE_SECRET_KEY` is unset in production, so the empty site key does
not block init.

## Chrome (CDP, 375px, 12/12)

Script: `08-live-smoke.mjs`. Screenshots: `08-375-empty.png`,
`08-375-how.png`, `08-375-tree.png`, `08-375-panel.png`.

- Header is Build + How it works. No Ask / Chat / Map / Reality / Tutor.
- Foundations placeholder and empty-Tree sentence match the grilling lock.
- How it works page shows the four locked paragraphs.
- Demo Tree lands (9 cards). Node panel is the rabbit-hole invitation
  card with no learner-state chrome.

## Live OpenRouter init

Script: `08-api-smoke.mjs`. Unique deploy URL. No secrets in this file.

| Word | Result | ms | Notes |
| --- | --- | --- | --- |
| bit | 1 node / 1 layer, phase active | 17475 | Not a followable tree |
| recursion | `invalid_model_output` | 190867 | Same code as a missing/unparseable map |
| photosynthesis | `invalid_model_output` | 116402 | Ticket 07 local live run had passed |

Exact prod blocker: OpenRouter Nemotron `:free` through `POST /api/agent`
does not reliably return a schema-valid followable Reality Map. Transport
and secrets are rotated; the generator was not rewritten (out of this
ticket). Prompt retune stays fog.

Key-leak grep clean: `08-leak-check.mjs` (0 hits in `src/`, `netlify/`,
tracked files; `.env` gitignored).
