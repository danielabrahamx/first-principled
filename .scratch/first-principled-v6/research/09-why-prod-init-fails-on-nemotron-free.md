# 09 - Why prod init fails on Nemotron free

Resolved 2026-08-16. Primary sources: this repo's generator and error
envelope, ticket 01/07/08 recorded runs, and a live probe with the
gitignored `.env` key. The key is never printed here. Probe script:
`.scratch/first-principled-v6/research/09-probe.mjs` (reuses the
`08-api-smoke.mjs` 202-then-poll pattern).

## Recommendation (ticket 10: do this, do not re-research)

**Lever (b): a named transport/parse tweak.** Stay on
`nvidia/nemotron-3-ultra-550b-a55b:free`. Do not retune
`buildOneShotSystemPrompt` as the prod-init fix. Do not declare `:free`
unusable. Do not rebuild the generator.

Prod init is still the **serial** per-layer path. Ticket 01 already
required one-shot in production; ticket 02 landed the transport but left
`fastPath` opt-in (`?fast=1`). Serial on this model fails with
`kind: "invalid"` after layer repairs, which `modelError` maps to
`invalid_model_output`. One-shot photosynthesis still works.

Ticket 10 applies all three of these, in this order:

1. `src/lib/generation.js` `generateTree` (lines 113-115): always pass
   `fastPath: true`. Stop gating one-shot on `wantsFastPath()` /
   `?fast=1`.
2. `src/lib/agent/orchestrator.js` `handleInit` (line 418): default
   one-shot even when the client omits the flag
   (`fastPath: request.fastPath !== false`), so `08-api-smoke.mjs` and
   the live Tree hit the path ticket 01 measured.
3. `src/lib/agent/realityMap.js` `generateRealityMap` (lines 986-998):
   when the one-shot attempt fails with `kind: "invalid"` or
   `"error"`, **return that result**. Do not fall through to serial.
   Serial fallback is what turned a failed one-shot into a 184s
   `invalid_model_output` on prod `fastPath: true`.

Empty-choices retry in `llm.js` (lines 139-140) is optional flake
insurance for laptop. It is not the prod-init lever. Battery layer-chain
gaps stay a one-shot quality gap for a later prompt pass, not this lever.

## Code paths (what maps to what)

| Failure | Function | Learner/API code |
| --- | --- | --- |
| Empty OpenRouter `choices` | `callChatCompletion` throws `"LLM response had no choices"` (`src/lib/agent/llm.js` 139-140) | `generateRealityMap` catch -> `kind: "error"` (`realityMap.js` 1029-1037, 1158-1167, 880-885). `modelError("error")` -> 502 `upstream_error` (`orchestrator.js` 175-181) |
| Abort / timeout | `llm.js` 98-117 aborts after 240000 ms, throws `"aborted after ${timeoutMs}ms"` | same `kind: "error"` -> `upstream_error` |
| HTTP 429 / provider error | `llm.js` 123-133 throws `"LLM API error ${status}"` | same `kind: "error"` -> `upstream_error` |
| Unparseable JSON | `parseModelJson` returns null (`jsonParse.js` 61-85). One-shot: `kind: "invalid"` (`realityMap.js` 887-894). Serial: repair, then `kind: "invalid"` (`realityMap.js` 1215-1226) | `modelError("invalid")` -> 502 `invalid_model_output` (`orchestrator.js` 183-187) |
| `validateRealityMap` / `deriveCheck` reject | one-shot: `kind: "invalid"` (`realityMap.js` 900-911). Serial layer: repair up to `MAX_LAYER_ATTEMPTS` (3, line 697), then `kind: "invalid"` with reason `"valid, derivable next layer after two repair attempts"` (1219-1222) | `invalid_model_output` |
| `repairMap` | mechanical cleanup only: drop stray edges and UNKNOWN values (`realityMap.js` 1275-1304). Does **not** invent a 1-node stub | n/a |
| Foundation + `done` | serial `unpack.done` (`realityMap.js` 1197-1200) ships the foundation-only map as `ok` | 200, `phase: "active"`, 1 layer |
| Background poll | POST empty 202 (`agent.mjs` 225-234, 312-318). `GET /api/agent-status` returns `running` until the blob lands (`agent-status.mjs` 67-68), then maps a non-200 envelope to `{status:"error", code}` (78-85). Client poll deadline 10 min (`src/api/agent.js` 157, 162-164) -> `internal`. Probe poll miss -> `poll_timeout` | not `invalid_model_output` |

`generation.js` only words codes the transport already produced
(`invalid_model_output` at line 44). It does not classify upstream
failures.

Init without `fastPath` is serial: `orchestrator.js` 416-418
(`fastPath: request.fastPath === true`). The Tree only sets the flag when
the URL has `?fast=1` (`generation.js` 94-99, 115). `08-api-smoke.mjs`
line 49 posts `{ word, history, phase: "init" }` with no `fastPath`.

Ticket 01 already said: production maps must call with `fastPath: true`;
serial is a fallback this model is unlikely to finish
(`01-openrouter-nemotron-map-contract.md` lines 20, 171-177, 276-278).

## Live probe (2026-08-16)

`node --env-file=.env .scratch/first-principled-v6/research/09-probe.mjs`.
Model `nvidia/nemotron-3-ultra-550b-a55b:free`. No raw upstream text. No
key.

| Target | Word | Result | ms | Notes |
| --- | --- | --- | --- | --- |
| local-oneshot | photosynthesis | ok, 8 nodes / 5 layers, path `oneshot` | 47876 | Matches ticket 07 pass (40582 ms) |
| prod (no fastPath) | photosynthesis | POST 202, poll HTTP 200, `invalid_model_output` | 113895 | Matches ticket 08 (116402 ms). 35 polls; not a poll timeout |
| prod-fast | photosynthesis | POST 202, poll HTTP 200, `invalid_model_output` | 183684 | One-shot then serial fallback; still `invalid` |
| local-serial | photosynthesis | `kind: invalid`, 0 nodes | 147313 | Reason: valid, derivable next layer after two repair attempts |
| local-serial | bit | `kind: error` in 189 ms | 189 | `LLM API error 429: Rate limit exceeded: free-models-per-day` |
| prod (no fastPath) | bit | POST 202, `upstream_error` | 3711 | Same 429 mapped through `modelError("error")` |

Recursion, laptop, and battery were not re-run after the daily free-model
cap. Classifications below use ticket 07/08 recorded runs plus the code
paths this probe confirmed.

## Classification of known failures

### Prod `bit` (1 node / 1 layer, phase active, 17475 ms)

**Serial foundation plus immediate `done`, shipped as a successful map.**
Not a stub from `repairMap`. Not `invalid_model_output`. Not a poll
failure.

Evidence: ticket 08 (`08-prod-smoke.md` line 29) recorded phase `active`
with 1 node / 1 layer in 17.5s. That duration is one LLM call, not a
40s-120s one-shot (ticket 01 laptop 118s; this probe one-shot
photosynthesis 48s). Serial `unpack.done` after the foundation
(`realityMap.js` 1197-1200) returns `ok` with the 1-layer assembled map
(`realityMap.js` 1092-1100, 1231-1246). `handleInit` then returns 200
`phase: "active"` (`orchestrator.js` 438-447). `08-api-smoke.mjs` never
sends `fastPath`, so this is serial.

Today's prod `bit` returned `upstream_error` in 3.7s because the
`:free` daily cap was already hit. That is a later 429, not the ticket 08
shape.

### Prod recursion (`invalid_model_output`, 190867 ms)

**Serial layer-repair exhaustion (`kind: "invalid"`), not empty choices,
not abort, not poll timeout.**

Empty choices / abort / 429 become `upstream_error` (`orchestrator.js`
175-181), which this probe confirmed on prod `bit` after the 429.
Ticket 08 recorded `invalid_model_output`, so `modelError` saw
`kind !== "error"` (`orchestrator.js` 183-187). The matching generator
reason, reproduced locally on photosynthesis serial, is
`"The model could not produce a valid, derivable next layer after two repair attempts."`
(`realityMap.js` 1219-1222). 190s is several serial calls plus repairs,
under the 240s per-call abort (`llm.js` 17, 98) and under the 10 min
poll deadline. `08-api-smoke.mjs` would have printed `timeout` on a poll
miss (lines 45, 57).

### Prod photosynthesis (`invalid_model_output`, 116402 ms)

**Same serial `kind: "invalid"` as recursion.** Reproduced today: prod
no-fastPath photosynthesis -> `invalid_model_output` at 113895 ms, 35
status polls, POST 202. Local serial photosynthesis -> `kind: invalid`
at 147313 ms with the two-repair-attempts reason. Background status poll
delivered a terminal record; it did not invent the code.

### Local laptop (no choices)

**Empty OpenRouter `choices` on the one-shot eval path.** Ticket 07
(`07-map-quality-baseline.md` lines 16, 29, 32): 120684 ms, gate fail,
reason `LLM response had no choices`. That string is thrown at
`llm.js` 139-140. Eval `generateLive` catches it and scores an empty map
(`eval/map-quality/run.js` 149-158, 221-226). It does not go through
`modelError`. If it did, the API code would be `upstream_error`, not
`invalid_model_output`. Schema errors on that row (`layers must contain
at least one layer`) are the empty-map fallback, not a model JSON reject.

### Local battery (contiguity / layer chain gap)

**One-shot JSON parsed and normalized; `validateRealityMap` rejected
layer-chain gaps.** Ticket 07 (`07-map-quality-baseline.md` lines 19, 30):
43031 ms, path `oneshot`, labels present, schema errors
`layer chain gap: layer "..." (l1..l4) has no edge connecting it to a lower layer`.
That string is `src/lib/mmg/validator.js` 295. Eval still built a
candidate (`run.js` 128, `gate.js` `candidateFromOneShot`). This is a
one-shot prompt/schema miss, not transport. It is not why prod init
failed on bit / recursion / photosynthesis.

## Local vs prod photosynthesis

**Path drift, not flake of the same path, and not a unique background
function bug.**

- Ticket 07 local live is one-shot with **no serial fallback**
  (`eval/map-quality/run.js` 8-9, 103-104, 115-126). Pass, 40s then 48s
  today, 8 nodes / 5 layers.
- Ticket 08 prod is `POST /api/agent` with **no `fastPath`**
  (`08-api-smoke.mjs` 49) so serial (`orchestrator.js` 418). Fail,
  `invalid_model_output`, 116s then 114s today.
- Local serial today failed the same way (147s, `kind: invalid`, two
  repair attempts). The background wrapper only records that envelope
  (`agent.mjs` 312-318; `agent-status.mjs` 78-85).

`prod-fast` (explicit `fastPath: true`) still failed at 184s. That is
the one-shot-then-serial fallback in `generateRealityMap` (lines 960-998):
one-shot failure is not terminal unless it is a refusal, so serial runs
and fails again. Payload is not drifted (same `buildOneShotSystemPrompt`,
same `callChatCompletion`). The learner-visible path is.

## Why not (a) or (c)

(a) One-shot prompt: photosynthesis one-shot already returns a
schema-shaped tree (ticket 07 and this probe). Retuning the prompt does
not stop prod from calling serial, and does not stop serial fallback
after a failed one-shot.

(c) `:free` unusable: ticket 01 one-shot laptop was schema-valid
(118s, 11 nodes). Ticket 07 recursion and photosynthesis passed the
gate. This probe one-shot photosynthesis: 8 nodes / 5 layers in 48s.
The 429 `free-models-per-day` is a quota. Serial burns one call per
layer plus repairs (`MAX_LAYER_ATTEMPTS = 3`); one-shot burns one call.
Stay on `:free`. Paid slug stays fog.

Generator rebuild stays out: serial already exists and is the wrong
production path for this model, not a missing architecture.

## What ticket 10 should not re-open

- Do not re-probe whether `:free` can emit JSON. It can.
- Do not treat `invalid_model_output` as empty choices. Empty choices
  are `upstream_error`.
- Do not treat the 1-node `bit` tree as `repairMap` collapsing to a stub.
- Battery contiguity and laptop empty choices are real one-shot quality
  gaps. They are not the prod-init failure. Ticket 10's eval-all-four
  bar may still fail those two after (b); that is a later prompt or
  empty-choices retry, not a reason to skip (b).

No secrets in this file. Key material is redacted if it ever appears in
an error string.
