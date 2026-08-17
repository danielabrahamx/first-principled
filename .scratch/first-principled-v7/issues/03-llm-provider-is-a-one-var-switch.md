# 03 - LLM_PROVIDER is a one-var switch

**Type:** task

**Status:** resolved

**Blocked by:** none

**Related:** [Can one background agent finish three serial LLM calls](01-can-one-background-agent-finish-three-serial-llm-calls.md), [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)

## Question

What mechanical change makes OpenRouter vs DeepSeek a single env var,
so a local eval can flip without copying `DEEPSEEK_*` onto `LLM_*` in
the shell?

## What

`LLM_PROVIDER=openrouter|deepseek`. When `deepseek`, `llm.js` uses
`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`. Otherwise it
uses `LLM_*` (OpenRouter). OpenRouter referer / title / `reasoning`
payload stay OpenRouter-only. DeepSeek must not inherit OpenRouter-only
fields that v6 showed it mishandles (`thinking: false` ignored;
record
[12-deepseek-gate.md](../../first-principled-v6/research/12-deepseek-gate.md)).

1. `src/lib/agent/llm.js` plus tests. Default provider is openrouter.
2. `.env.example` documents `LLM_PROVIDER` and the two triples. Never
   commit `.env`.
3. Prod stays OpenRouter. Do not change Netlify secrets in this ticket.
4. Same live model for every caller; no per-stage override.

**Out of this ticket.** Prompt rewrite. Generator rebuild. Prod deploy.
Pointing prod at DeepSeek.

## Answer

`LLM_PROVIDER` in `src/lib/agent/llm.js`. Unset or `openrouter` uses
`LLM_*`. `deepseek` uses `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`,
`DEEPSEEK_BASE_URL`. OpenRouter referer, title, and `reasoning` payload
are OpenRouter-only. Prod stays OpenRouter; Netlify secrets unchanged.

## Acceptance criteria

- [x] `LLM_PROVIDER=deepseek` makes `callChatCompletion` hit the
      DeepSeek triple; unset or `openrouter` hits `LLM_*`
- [x] OpenRouter headers and reasoning payload are not sent on the
      DeepSeek path
- [x] `.env.example` updated
- [x] `npm test` and `npx tsc --noEmit` pass
- [x] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. CONTEXT.md
architecture line names `LLM_PROVIDER` in the same commit.
