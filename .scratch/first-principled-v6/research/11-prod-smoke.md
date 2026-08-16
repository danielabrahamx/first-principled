# 11 - Prod deploy smoke

Deploy id: `6a822d59151f1ef9bb8cd0e3`
Production: https://first-principled.netlify.app
Unique URL: https://6a822d59151f1ef9bb8cd0e3--first-principled.netlify.app

Netlify `LLM_*` reused from
[Deploy the tree-only explorer](../issues/08-deploy-the-tree-only-explorer.md)
(OpenRouter Nemotron `:free`). Key never echoed. No prompt rewrite.

## Chrome (CDP, 375px, 12/12)

Script: `11-live-smoke.mjs`. Screenshots: `11-375-empty.png`,
`11-375-how.png`, `11-375-tree.png`, `11-375-panel.png`. Unique deploy
URL.

- Header is Build + How it works. No Ask / Chat / Map / Reality / Tutor.
- Foundations placeholder and empty-Tree sentence match the grilling lock.
- How it works page shows the four locked paragraphs.
- Demo Tree lands (9 cards). Node panel is the rabbit-hole invitation
  card with no learner-state chrome.

## Live OpenRouter init

Script: `11-api-smoke.mjs`. Unique deploy URL. No secrets in this file.
Status probe: `11-upstream-status.mjs` (prints HTTP status only).

| Word | Result | ms | Notes |
| --- | --- | --- | --- |
| photosynthesis | `upstream_error` | 4626 | Same envelope as ticket 09 429 mapping |
| recursion | `upstream_error` | 3873 | Same |

Exact prod blocker: OpenRouter Nemotron `:free` HTTP 429
`Rate limit exceeded: free-models-per-day`. Local status probe the same
day as ticket 10's 338 ms photosynthesis 429. One-shot default is live
on this deploy; the gold-word tree did not land because the `:free`
daily cap rejected the provider call. No prompt rewrite. Stay on
`:free`.

Key-leak grep clean: `08-leak-check.mjs` (0 hits in `src/`, `netlify/`,
tracked files; `.env` gitignored).
