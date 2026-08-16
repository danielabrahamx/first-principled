# 02 - Land OpenRouter as the LLM transport

**Type:** task

**Status:** resolved

**Blocked by:** [OpenRouter Nemotron can serve the Reality Map contract](01-openrouter-nemotron-map-contract.md)

**Related:** [Reality Map quality eval](07-reality-map-quality-eval.md), [Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md)

## Question

Research has the transport diff. What does a mechanical swap to OpenRouter
`nvidia/nemotron-3-ultra-550b-a55b:free` look like in `llm.js`, defaults,
and docs, without rebuilding the generator?

## What

Apply the ticket 01 recommendation. Do not re-research.

1. **Transport.** `llm.js`: base URL / model defaults, drop DeepSeek-only
   `thinking` if research said to, add OpenRouter headers / `reasoning` /
   timeout only as specified. Keep JSON parse fallback.
2. **Env.** `.env.example` model and base URL. Do not commit `.env`. Do
   not print the key. Local `.env` is the human's to fill.
3. **Docs.** README, AGENTS.md stack line, spec provider sentence. Same
   commit as the code.
4. **Tests.** Existing llm/orchestrator tests still pass. Add coverage
   only for a new header or payload field.
5. **Not this ticket.** Prompt rewrite, generator rebuild, Netlify secret
   rotation (that is
   [Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md)).

## Acceptance criteria

- [x] A local call with `.env` pointed at OpenRouter returns a completion
      (or the ticket records the exact local blocker)
- [x] Defaults and `.env.example` match the chosen slug and
      `https://openrouter.ai/api/v1`
- [x] DeepSeek-specific payload fields that break OpenRouter are gone
- [x] `npm test` and `npx tsc --noEmit` pass
- [x] Key-leak grep clean (no `sk-` values in tracked files)

## Answer

Mechanical swap from ticket 01, no re-research. `llm.js` defaults to
OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free` at
`https://openrouter.ai/api/v1`, timeout 240s, attribution headers,
`reasoning` instead of DeepSeek `thinking`. JSON parse fallback stays.
`realityMap.js` is unchanged.

Live smoke via `callChatCompletion` (key from gitignored `.env`; model and
base overridden in-process because local `.env` still names DeepSeek):
HTTP 200, `{"ok":true,"n":4}`, 3519 ms, no reasoning tokens. Point local
`.env` `LLM_MODEL` / `LLM_BASE_URL` at the `.env.example` values.
Netlify secrets stay for
[Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md).

## Docs rule

README, AGENTS.md stack, spec provider line, and `.env.example` update in
the same commit as `llm.js`.
