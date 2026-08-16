# 09 - Why prod init fails on Nemotron free

**Type:** research

**Status:** resolved

**Blocked by:** none

**Related:** [OpenRouter Nemotron can serve the Reality Map contract](01-openrouter-nemotron-map-contract.md), [Reality Map quality eval](07-reality-map-quality-eval.md), [Deploy the tree-only explorer](08-deploy-the-tree-only-explorer.md), [Init uses one-shot with no serial fallback](10-init-uses-one-shot-with-no-serial-fallback.md)

## Question

Ticket 01 showed OpenRouter Nemotron `:free` can return a schema-valid
one-shot Reality Map. Ticket 07 local live mixed (recursion and
photosynthesis passed the gate; laptop had no choices; battery failed
contiguity). Ticket 08 prod init failed (`bit` 1 node / 1 layer;
`recursion` and `photosynthesis` `invalid_model_output` at 116-190s).
What failure mode is each of those, and which lever should
[Init uses one-shot with no serial fallback](10-init-uses-one-shot-with-no-serial-fallback.md)
turn: one-shot prompt, transport/parse, or declare `:free` unusable?

## What

Investigate against primary sources: this repo's generator and error
envelope (`src/lib/generation.js`, `src/lib/agent/orchestrator.js`
`modelError`, `src/lib/agent/llm.js`, `src/lib/agent/realityMap.js`,
Netlify background `agent` / `agent-status`), plus the recorded baselines
and a live probe with the gitignored `.env` key. Never print the key.
No `src/` changes.

1. **Classify the known failures** against code paths: empty OpenRouter
   choices, abort/timeout, unparseable JSON, `validateRealityMap` /
   `deriveCheck` reject, repair collapsing to a stub, background-status
   poll. Cite the function that maps each path to `invalid_model_output`
   or to phase `active` with a 1-node map.
2. **Live probe.** Same words locally (`eval/map-quality` live and/or
   `POST /api/agent` via `netlify dev`) and against prod
   https://first-principled.netlify.app. Record HTTP status, error
   `code`, duration, `generationPath` / node-layer counts when present.
   Do not paste raw upstream text or secrets.
3. **Local vs prod.** Photosynthesis passed ticket 07 locally and failed
   ticket 08 on prod. Say whether that is flake, payload drift, or the
   background function path.
4. **Lever.** Recommend one: (a) one-shot prompt/schema instructions,
   (b) a named transport/parse tweak, or (c) `:free` is unusable and the
   paid slug graduates from fog. Specific enough that ticket 10 does not
   re-research. Generator rebuild stays out unless (c) or the prompt
   cannot work.

Findings go in
`.scratch/first-principled-v6/research/09-why-prod-init-fails-on-nemotron-free.md`
on branch `research/why-prod-init-fails-on-nemotron-free`. A probe script
may live beside it.

## Acceptance criteria

- [x] Findings file exists, every claim cited to a primary source or a
      live probe
- [x] Each known failure (prod `bit`, prod recursion, prod
      photosynthesis, local laptop, local battery) is classified
- [x] Recommendation names the ticket 10 lever: prompt, transport/parse,
      or `:free` unusable
- [x] No secrets in the findings file, probe output, or git history
- [x] No `src/` changes

## Answer

Prod init is still serial. `invalid_model_output` is serial layer-repair
exhaustion (`kind: "invalid"`), not empty choices. `bit` 1-node is
foundation plus `done`. Photosynthesis local vs prod is path drift
(one-shot eval vs serial API), not flake. Lever (b): default `fastPath`
true and do not fall back to serial.
Findings:
[09-why-prod-init-fails-on-nemotron-free.md](../research/09-why-prod-init-fails-on-nemotron-free.md)

## Docs rule

None in `src/`. Pointer from this ticket to the findings file. Ticket 10
applies the lever; it does not re-research.
