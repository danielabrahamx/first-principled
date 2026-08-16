# 01 - OpenRouter Nemotron can serve the Reality Map contract

**Type:** research

**Status:** resolved

**Blocked by:** none

**Related:** [Land OpenRouter as the LLM transport](02-land-openrouter-transport.md), [Reality Map quality eval](07-reality-map-quality-eval.md)

## Question

The destination switches the provider to OpenRouter
`nvidia/nemotron-3-ultra-550b-a55b:free`. The current transport is
DeepSeek-shaped: `response_format: json_object`, a DeepSeek `thinking`
flag, 45s timeout, and a serial per-layer Reality Map generator with a
one-shot fallback. Can this model produce schema-valid Reality Maps under
that contract, and what transport changes are required before
[Land OpenRouter as the LLM transport](02-land-openrouter-transport.md)?

## What

Investigate against primary sources (OpenRouter docs, NVIDIA Nemotron 3
Ultra docs) and a live probe using the gitignored `.env` key. Never print
the key.

1. **Auth and route.** Base URL `https://openrouter.ai/api/v1`, Bearer
   auth, model slug, optional `HTTP-Referer` / `X-Title`. Confirm the
   `:free` slug resolves.
2. **JSON.** Does `response_format: { type: "json_object" }` return
   parseable JSON? What happens with our DeepSeek `thinking` payload?
   What does OpenRouter `reasoning` do on this model?
3. **Latency and timeout.** Time a JSON call and, if JSON works, one
   Reality Map attempt (prefer `?fast=1` / one-shot laptop, with a long
   probe timeout). Compare to the 45s `llm.js` default and the serial
   per-layer path.
4. **Validity.** If a map returns, run `validateRealityMap` and
   `deriveCheck`. Record generationPath, repair count, crown-reached.
5. **Free-tier risk.** Availability, NVIDIA logging of `:free`, and
   whether the paid slug is the fallback. Recommend stay / switch slug.
6. **Transport diff.** Exact changes `llm.js` needs (headers, timeout,
   drop `thinking`, optional `reasoning`) so ticket 02 is mechanical.

Findings go in
`.scratch/first-principled-v6/research/01-openrouter-nemotron-map-contract.md`
on branch `research/openrouter-nemotron-map-contract`. A probe script may
live beside it. No `src/` changes in this ticket.

## Acceptance criteria

- [x] Findings file exists, every claim cited to a primary source or a
      live probe
- [x] Live probe ran (or recorded the exact blocker: missing key, 4xx)
- [x] Recommendation covers: usable or not, timeout, one-shot vs serial,
      reasoning vs thinking, stay on `:free` or switch slug
- [x] Transport diff is specific enough that ticket 02 does not re-research
- [x] No secrets in the findings file, probe output, or git history

## Answer

`:free` is usable. One-shot `laptop` map was schema-valid in 118s with
reasoning off. Raise `llm.js` timeout to 240s, drop DeepSeek `thinking`,
send OpenRouter `reasoning: { effort: "none" }` for JSON maps, keep the
`:free` slug. Findings:
[01-openrouter-nemotron-map-contract.md](../research/01-openrouter-nemotron-map-contract.md)

## Docs rule

None in `src/`. Pointer from this ticket to the findings file. Ticket 02
updates `.env.example`, README, and AGENTS.md stack when it lands the
transport.
