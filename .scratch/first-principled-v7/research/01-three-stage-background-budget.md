# 01 - Three-stage background budget (findings)

Resolved 2026-08-17. No live OpenRouter probe (duration is already
bounded by v6 Nemotron notes plus the `llm.js` abort). No secrets.

## Recommendation (ticket 05: copy this, do not re-research)

**Keep three stages inside one init job.** One learner-facing
`POST /api/agent`. Do not forbid one invocation. Do not graduate
client-chained stages.

v7 grilling already treats ~a minute of serial latency as acceptable
(`.scratch/first-principled-v7/map.md` Decisions so far). Three
`callChatCompletion` calls fit the 15-minute background budget even in
the abort worst case. The binding limit is the **client poll deadline
(10 min)**, not the platform (15 min). Ticket 05 must raise that
deadline; it must not split the job.

### Numbers ticket 05 must obey

| Knob | Value | Why |
| --- | --- | --- |
| Stages per init | 3 serial `callChatCompletion` in one background invocation | Platform 15 min covers 3 x 240 s abort |
| Learner HTTP | one `POST /api/agent` (existing empty-202 + blobs + poll) | Already shipped |
| Platform cap | **15 min (900 s), not configurable** | Netlify background execution limit |
| Sync cap (status fn) | 60 s | `agent-status` is synchronous; a blob read fits |
| Per-call abort | **240000 ms** (`llm.js` `DEFAULT_TIMEOUT_MS`) | Do not raise. Do not pass a shorter `timeoutMs` unless ticket 04 proves stages are tiny |
| Three-call worst case | **720 s (12 min)** plus glue | 3 x 240 s serial aborts |
| Three-call expected | **~54-70 s P50**; grilling ~1 min | Provider latency P50 17.64 s; e2e P50 23.42 s |
| Three-call e2e P95 bound | **~590 s (9.8 min)** | 3 x published e2e P95 196.61 s. Tight vs current 10 min poll |
| Client poll interval | 2000 ms | `src/api/agent.js` `pollIntervalMs` default |
| Client poll deadline | **raise default `deadlineMs` from 600000 to 840000 (14 min)** | 3 x abort (12 min) plus writeTerminal plus one poll sleep must land before the client collapses to `internal` |
| Job blob TTL | 1800 s (30 min) | Already longer than 14 min poll and 15 min platform |
| Retry | throw after 202 -> retry +1 min, then +2 min | Unchanged. Never throw. No in-job LLM retries |

### Ticket 05 must / must not

- **Must** keep `generateRealityMap` as three awaited `callChatCompletion`
  calls inside the existing `handleInit` path. Catch per stage (same as
  today's one-shot / serial `try/catch` in `realityMap.js`) so an abort
  becomes `kind: "error"` -> `upstream_error`, not an uncaught throw.
- **Must** keep `agent.mjs` never-throw / `writeTerminal` contract. A
  long three-stage run does not change it.
- **Must** raise `src/api/agent.js` `deadlineMs` default to **840000**.
  Leave `pollIntervalMs` at 2000. Do not change job TTL.
- **Must not** raise `DEFAULT_TIMEOUT_MS`. 3 x 240 s is 12 min; extra
  per-call headroom would crowd the 15 min kill.
- **Must not** retry a failed stage inside the same invocation. In-job
  retries can push past 15 min and skip `writeTerminal`.
- **Must not** client-chain stages. That graduation stays fog.

## 1. Platform budget

### Max duration on this site

**15 minutes. Not configurable.**

Netlify Background Functions "run for up to 15 minutes"
(https://docs.netlify.com/build/functions/background-functions/).
Default values table: "Background execution limit | 15 minutes | No"
(https://docs.netlify.com/build/functions/optional-configuration/#default-values,
same table at
https://docs.netlify.com/build/functions/configuration/#default-values).

The feature is available on credit-based plans including Free, Personal,
and Pro, and on Enterprise
(https://docs.netlify.com/build/functions/background-functions/). This
repo already deploys the agent as background
(`netlify.toml` `[functions.agent] background = true` and
`netlify/functions/agent/agent.mjs` `export const config = { background: true }`,
lines 225-234). No live account-plan dump (avoids tokens). There is no
documented shorter background cap on those plans; the 15 min row is
"Configurable? No".

Synchronous functions are 60 s, also not configurable (same defaults
table). `agent.mjs` header still says "sync 30s cap" (lines 3-5); that
comment is stale vs current docs. `src/api/agent.js` already states
"15-minute budget, no 30s kill" (lines 11-14). Use the docs figure
(60 s sync / 15 min background).

Background request/response payload is 256 KB (same defaults table).
Irrelevant here: the client 202 is empty; the map travels via Blobs, not
the 202 body.

### What happens if it exceeds 15 min

The function "will run separately in the background until it completes
or it reaches the 15 minute execution limit"
(https://docs.netlify.com/build/functions/background-functions/#how-background-functions-work).
The originating client already has its empty 202, so a kill is silent to
HTTP. If `writeTerminal` has not run, `GET /api/agent-status` keeps
returning `{status:"running"}` (`agent-status.mjs` lines 67-68) until the
client deadline, then `callAgent` returns `{ok:false, code:"internal"}`
(`src/api/agent.js` lines 162-164).

Docs do **not** say a 15 min kill is classified as "function invocation
returns an error" (the retry sentence is separate). Do not use the
platform kill as the abort. Finish or `writeTerminal` an error **before**
900 s.

### Empty-202 plus blobs plus poll (confirmed)

Netlify: the client "receives an empty `202` response immediately";
there is no built-in status endpoint; "you generally pass the invocation
result to a destination other than the originating client"
(https://docs.netlify.com/build/functions/background-functions/#create-background-functions).
`background: true` in function config or `netlify.toml` `[functions.<name>]
background = true` (same page). This repo does both.

Local contract:

1. Client `callAgent` mints `jobId`, POSTs it in the body
   (`src/api/agent.js` lines 63-71, 89-92).
2. Platform answers empty 202; handler runs out of band
   (`agent.mjs` lines 5-6, 225-227).
3. Handler writes a terminal record to Blobs store `agent-jobs`, key
   `job:<jobId>`, TTL `JOB_TTL_SECONDS = 30 * 60`
   (`agent.mjs` lines 11-13, 44, 83-89, 312-318).
4. Client polls `GET /api/agent-status?job=<id>` every 2 s
   (`src/api/agent.js` lines 15-18, 155-159).
5. Status function is **synchronous on purpose** (a background function
   cannot serve a poll). Mapping:
   - no record -> 200 `{status:"running"}`
   - success + httpStatus 200 -> 200 `{status:"success", body}`
   - success + non-200 envelope or error record -> 200 `{status:"error", code, message}`
   (`agent-status.mjs` header and lines 67-98).
6. Redirects: `/api/agent` and `/api/agent-status` in `netlify.toml`.

No change to this contract for three stages besides the poll deadline.

## 2. Per-call timeout vs three serial aborts

`src/lib/agent/llm.js`:

- `DEFAULT_TIMEOUT_MS = 240000` (line 17). JSDoc: covers OpenRouter
  Nemotron `:free` e2e P95 plus margin (lines 37-38).
- `callChatCompletion` uses `options.timeoutMs ?? DEFAULT_TIMEOUT_MS`,
  `AbortController` + `setTimeout` abort (lines 98-117). Abort throws
  `LLM request failed: aborted after ${timeoutMs}ms`.
- `handleRequest`'s default transport does not pass `timeoutMs`
  (`orchestrator.js` lines 625-627), so every stage inherits 240 s.

Three serial calls are three independent timers, not one shared 240 s.
Worst case (each hits abort): **720000 ms**. Plus parse / validate /
`writeTerminal`. Still under 900 s if glue stays well under 3 min.

Expected duration, **no new live call** (v6 ticket 01 findings
`.scratch/first-principled-v6/research/01-openrouter-nemotron-map-contract.md`,
OpenRouter model page https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free
fetched 2026-08-16):

- Provider table latency P50 **17.64 s** (the ~18 s figure).
- E2E P50 / P90 / P95: **23.42 s / 127.25 s / 196.61 s**.
- Tiny JSON, reasoning on: 18378 ms (matches ~18 s).
- Tiny JSON, reasoning off: 870 ms.
- Live one-shot Reality Map (`laptop`, reasoning off, 8192 tokens):
  **118120 ms**. Other v6 one-shots: ~39-120 s
  (`.scratch/first-principled-v6/research/12-live-gate.md`).
- Prod one-LLM `bit`: 17475 ms
  (`.scratch/first-principled-v6/research/09-why-prod-init-fails-on-nemotron-free.md`).

Three v7 stages (chronology, epiphanies, arrange) should each be smaller
than a full one-shot map. **P50 ballpark: 3 x 18-23 s = ~54-70 s**,
inside the grilling "about a minute" bar. P90 ballpark: 3 x 127 s =
~6.4 min, under today's 10 min poll. P95 ballpark: 3 x 197 s = ~9.8 min,
inside 10 min only with seconds to spare. Abort worst case (12 min)
**misses** the current 10 min client deadline.

v6 already warned that many sequential calls at 20-120 s risk the 15 min
budget (same v6 findings, serial per-layer with repairs). Three fixed
stages without in-job retries do not.

## 3. Retry / double-spend

Netlify: "If function invocation returns an error, a retry happens after
one minute. If it fails again, another retry happens two minutes later"
(https://docs.netlify.com/build/functions/background-functions/#how-background-functions-work).

`agent.mjs` already documents this as the CRITICAL retry contract (lines
15-19): an uncaught throw after the 202 re-runs the **whole** generation
and double-spends tokens. Every path writes a terminal record; outer
`try/catch` is last-resort (lines 76-77, 210-220, 312-322).
`writeTerminal` itself never throws (lines 83-93).

A long three-stage run does **not** change the retry rule. Duration is
not an error. Retry fires on throw, not on "took 8 minutes".

What three stages do change: a throw on **stage 2 or 3** would re-run
stage 1 as well (double-spend). Ticket 05 must keep:

- per-stage `try/catch` in `generateRealityMap` (today: one-shot line
  881, serial lines 1038 and 1167) mapping transport failure to
  `kind: "error"`
- `handleInit` mapping that to `upstream_error` without throwing
  (`orchestrator.js` `modelError`, lines 171-185, 421-437)
- `run()` catching anything else and `writeTerminal(jobId, internal)`
  (lines 312-322)

Do not add a fourth LLM call (map: mechanical check only). Do not retry
a stage in-process.

If the 15 min kill happens mid-call, there is no terminal record and
docs are silent on retry. Stay off that path: 3 x 240 s + glue < 900 s,
and write the blob before return.

## 4. Why not client-chained stages

Client-chaining would be three POSTs, three job ids, three 202s, three
poll loops, and three retry surfaces. The map parks that unless this
ticket forbids one invocation (`.scratch/first-principled-v7/map.md`
Not yet specified). One invocation is allowed. Chaining would also
triple `:free` rate-limit exposure (v6 already saw 429
`free-models-per-day` on a serial probe,
`.scratch/first-principled-v6/research/09-why-prod-init-fails-on-nemotron-free.md`).

The only code change this research requires of ticket 05 besides the
three-stage generator itself: **`deadlineMs` 600000 -> 840000** in
`src/api/agent.js` (and the matching default in the JSDoc / tests). 14
min is under the 15 min kill and under the 30 min blob TTL, and it
covers 12 min of serial aborts plus `writeTerminal`.
