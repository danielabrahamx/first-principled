# 05 - Deploy the tree-first shell

**Type:** task

**Status:** resolved

**Blocked by:** [Ship the cladogram and one-shot grow into the live Tree](03-ship-cladogram-and-one-shot-grow.md), [Tutor is pull Q&A over the Tree](04-tutor-is-pull-qa-over-the-tree.md)

**Related:** none

## Question

The rewrite is in the working tree. Is the live site the tree-first shell:
one chrome, a visible cladogram at scroll 0, Tutor toggle, briefing Q&A?

## What

Deploy to Netlify prod (`first-principled.netlify.app`) and live-verify.
Windows/PowerShell. Do not ship secrets.

1. `netlify deploy --prod` via the documented CLI path.
2. Live smoke: type a word, wait for the Tree, confirm cladogram (not a
   vertical stack), confirm layers visible without scrolling, confirm no
   Ask/Tree vs Chat/Map/Reality swap, open Tutor, ask one question, get a
   briefing.
3. 375px live check: no header overflow, Tutor toggle usable.

## Acceptance criteria

- [x] Prod deploy succeeded; unique deploy id recorded on this ticket
- [x] Live: one chrome, branching Tree visible at scroll 0, Tutor closed
      until toggled, one briefing turn works
- [x] Key-leak grep clean on tracked files
- [x] README / AGENTS.md deploy notes still accurate

## Docs rule

If the README still says chat-first or two pages, fix it in this commit.

## Resolution

Prod deploy via `& "$env:APPDATA\npm\netlify.cmd" deploy --prod`. Unique
deploy id: `6a7dec58cb069f5f8edc9db9`. Live:
https://first-principled.netlify.app. Unique URL:
https://6a7dec58cb069f5f8edc9db9--first-principled.netlify.app.

Key-leak grep clean: `.env` gitignored and untracked; LLM_API_KEY value in
0 tracked files and 0 files under `src/` and `netlify/`; no `sk-` secrets
in tracked files. README already tree-first (no chat-first / two-page copy).
AGENTS.md deploy notes still match the linked Netlify site.

Live CDP smoke (`bit` at 375px, 11/11):
`.scratch/first-principled-v4/research/05-live-smoke.mjs`. One chrome
(Build + Tutor only). Header right 361 / vw 375 (stage may scroll-x). Tree
is a branching cladogram (7 cards, 6 unique cx), layers opacity 1 at scroll
0. Tutor closed until toggled; no opening probe. One briefing on "What is a
bit?" (does not end with `?`). Screenshots: `05-375-empty.png`,
`05-375-tree.png`, `05-375-brief.png`.

Live API smoke also PASS (init silent, 8 nodes; briefing 381 chars, no
closing probe): `research/05-api-smoke.mjs`. Two earlier UI inits flaked
(`invalid_model_output`, then `internal`) and were retried; not 402.
