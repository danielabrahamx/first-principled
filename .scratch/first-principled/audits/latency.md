# Latency audit - first-principled init path

Scope: end-to-end latency of the Reality Map build (POST /api/agent phase
init) only. Measured fact: stage 1 (chronology) alone took 131.5s wall time
on a live call. Path: client POST (202) -> background function -> three
sequential LLM stages -> blobs terminal record -> client poll loop.

Headline: stage 1 emits roughly 300-500 tokens of JSON. At a typical 60-120
tok/s decode rate that is 3-8s of output. The other ~124-128s is mandatory
reasoning tokens plus retry waits and network. The model thinks for minutes
to write half a page. Everything else in this audit is second order.

Findings are ordered by estimated time cost.

---

## 1. Mandatory reasoning dominates every stage (est. 60-100s per stage, ~90% of total)

Evidence:
- `src/lib/agent/llm.js:172-175` - when `thinking === false` the OpenRouter
  branch omits the `reasoning` field entirely ("the default model mandates
  reasoning"). Net effect: all three stages run with provider-default
  reasoning effort, unbounded.
- `src/lib/agent/realityMap.js:714-717` - comment admits at maxTokens 8192
  "the Epiphanies schema call spent every token on thinking and truncated".
  Thinking alone exceeded 8k tokens on that call.
- `src/lib/agent/realityMap.js:718` - the response to that truncation was to
  raise the cap to 65536 rather than cap the reasoning.

Time cost: reasoning tokens decode at the same rate as content tokens. If
stage 1 is 131.5s and its JSON is ~5s of tokens, >90% of wall time is
reasoning. Applied across three serial stages this is the single largest
line item in the whole pipeline (see finding 2 for the sum).

Fix: stop omitting the field; constrain it. The model rejects
`effort: "none"` with HTTP 400 (`src/lib/agent/llm.js:57-58`), but low or
medium effort, or OpenRouter's `reasoning: { max_tokens: N }` cap (e.g.
2048), has not been tested per the repo comments. Send an explicit bounded
reasoning config on every map call. Tune using `usage` from the response,
which is already captured (`src/lib/agent/llm.js:264-268`) - log the
reasoning vs completion split once and size from data. The mechanical gates
(realityMap.js chronologyProblems/epiphaniesProblems/arrangeCheck) exist
precisely to catch any quality drop, so this is safe to A/B.

Estimated saving: stage 1 131.5s -> ~30-60s; pipeline total roughly halved
or better.

## 2. Three strictly sequential LLM round trips (est. total pipeline 220-350s today)

Evidence:
- `src/lib/agent/realityMap.js:727` - `await request("chronology", ...)`.
- `src/lib/agent/realityMap.js:740-746` - epiphanies awaited, payload and
  JSON Schema enum built from stage 1 ids (`buildEpiphaniesJsonSchema`,
  lines 88-92).
- `src/lib/agent/realityMap.js:759-789` - arrange awaited, inventory built
  from both prior outputs.

Time cost: latency is additive. Using 131.5s as stage 1 and assuming stages
2 and 3 cost less but carry the same reasoning mandate (plausibly ~0.4-0.9x
stage 1 each), total generation sits around 220-350s before polling.

The dependency chain is real as written: stage 2's schema enum needs stage
1's id set, stage 3's inventory needs both. `Promise.all` cannot help
without changing what a stage consumes. But the design choice itself is the
cost: stages 1+2 are one knowledge-extraction task split into two full LLM
round trips, each paying its own reasoning block and network overhead.

Fix (structural): merge chronology + epiphanies into one constrained call
returning `{concept, chronology[], epiphanies[]}` via a single JSON Schema;
keep arrange separate (it genuinely depends on both). Removes one full
round trip including one reasoning block: est. 40-130s saved. Tradeoff: the
mid-job Chronology snapshot (ticket 11 grow-in-place UX,
`realityMap.js:734-738`) loses its natural seam - the merged call can still
publish nothing until it lands, or the merge can be gated behind a flag.
Cheaper alternative if the merge is rejected: finding 1 still cuts each
remaining stage.

## 3. No caching of completed maps - identical concepts re-run everything (est. 0s saved per hit, minutes per miss avoided)

Evidence:
- `src/lib/agent/orchestrator.js:10-13` - "No module-level caches... no DB"
  by design; every init runs all three stages.
- The persistence primitive already exists: `netlify/functions/agent/agent.mjs:114`
  writes to a Blobs store with TTL; `netlify/functions/agent-status/agent-status.mjs:63`
  reads it back with strong consistency.

Time cost: any repeat concept (common learner words: inflation,
photosynthesis) pays the full 220-350s again for a deterministic-ish result.

Fix: before dispatch in the background function, look up
`map:<normalized-concept>` in a Blobs store (normalize like
`sameConcept`, `src/lib/agent/realityMap.js:936-941`; store the accepted
map after a successful gate). TTL days not minutes. Hit path drops end-to-end
latency to one poll cycle (~2-3s). Miss path unchanged. This is the cheapest
large win per line of code.

## 4. max_tokens 65536 is oversized and permits runaway reasoning (indirect; worst case doubles a stage)

Evidence:
- `src/lib/agent/realityMap.js:718` - `maxTokens: options.maxTokens ?? 65536`.
- Actual outputs are small: chronology is ~6 items x short strings; arrange
  edges similar. Hundreds of tokens each.
- The cap exists only because reasoning was eating the budget
  (comment lines 714-717).

Time cost: the cap is not billed time itself, but it authorizes multi-minute
thinking blocks, and a truncated-JSON failure triggers a full user-visible
regeneration (worst case 2x a stage). It also forces the very long timeouts
in finding 8.

Fix: once finding 1 bounds reasoning, drop the cap to ~16384. Log
`usage.completion_tokens` per stage first to pick the number from evidence.

## 5. Pre-LLM abuse controls run sequentially inside the job (est. 0.3-1s, up to 8s)

Evidence:
- `netlify/functions/agent/agent.mjs:275` - body read.
- `netlify/functions/agent/agent.mjs:313` - `await overRateLimit(...)` =
  Blobs get + setJSON (two round trips, lines 158-168).
- `netlify/functions/agent/agent.mjs:323` - `await turnstileError(...)`,
  a Cloudflare fetch with an 8s abort (line 224).
- Only then `handleRequest` at line 341 starts the LLM clock.

Time cost: a few hundred ms typical; seconds when Cloudflare is slow. Small
against 131.5s but free to fix since the two checks are independent.

Fix: run rate-limit and Turnstile concurrently (`Promise.all`). Keep order
of failure reporting. Est. saving 0.2-0.8s.

## 6. Mid-job snapshot writes sit between stages on the critical path (est. 0.2-1s)

Evidence:
- `src/lib/agent/realityMap.js:734-738` and `753-757` -
  `await publishStageSnapshot(...)` blocks before the next stage starts.
- `netlify/functions/agent/agent.mjs:98-104,118` - the publish is an
  awaited Blobs setJSON.

Time cost: two blob writes x ~100-500ms RTT each, paid serially between
LLM stages.

Fix: write-behind - do not await snapshots in the generator (failures are
already swallowed, `realityMap.js:888-900`). Or await with a 500ms timeout.
Est. saving 0.2-1s. Minor.

## 7. Poll loop adds up to one interval before delivery (est. avg ~1s, max <2s)

Evidence:
- `src/api/agent.js:163` - fixed `pollIntervalMs = 2000`.
- `src/api/agent.js:167-169` - sleeps BEFORE checking, so a record that
  lands just after a poll waits a full interval.

Time cost: average ~1s added to final delivery; also ~420 polls per 14-min
session (cost, not latency). Honest note: this is NOT the bottleneck -
do not spend real effort here beyond hygiene.

Fix: adaptive interval (2s while no stage snapshot seen, 750ms after the
epiphanies snapshot arrives, i.e. during arrange). Saves under 1s; bundle
with other work or skip.

## 8. Hidden 429 retry waits inflate measured stage times (est. 0-14s+ per stage, unpredictable)

Evidence:
- `src/lib/agent/llm.js:194-197` - intermittent 429s documented on the
  stealth provider ("identical payloads succeed seconds later").
- `src/lib/agent/llm.js:206-230` - MAX_ATTEMPTS 4, backoff 2/4/8s or
  server Retry-After, all silent apart from console.error.
- Stage latency (`src/lib/agent/realityMap.js:818`) bundles retries into
  one number, so part of the measured 131.5s may be wait, not generation.

Time cost: up to ~14s+ extra per stage when 429s occur; worse, it corrupts
measurement, which matters when tuning finding 1.

Fix: keep retries, make them visible - log attempt count and cumulative
wait against jobId, and record `usage` per attempt. Zero risk, restores
 trustworthy numbers.

## 9. Timeout/deadline stack lets a hang burn 14 minutes of user patience and 15 minutes of tokens

Evidence:
- `src/lib/agent/realityMap.js:719` - per-call timeoutMs 600000 (10 min)
  per stage; three stages could theoretically hold the function for 30 min
  of fetch time against a 15-min platform budget (`agent.mjs:255`).
- `src/api/agent.js:38` - client deadline 840000 (14 min); its comment says
  "Three serial 240 second calls", stale versus the actual 600s override.
- Worst case: user abandons at 14 min while the server keeps generating to
  minute 15, spending LLM tokens nobody will see.

Time cost: not steady-state latency; it caps worst-case waste and sets how
long failure takes to surface.

Fix: bound each stage to ~180-240s once reasoning is capped (finding 1
makes long stages unnecessary anyway); keep sum of stages comfortably under
the 14-min client deadline; fix the stale comment in agent.js.

---

## Summary table

| # | Finding | Est. cost | Fix |
|---|---|---|---|
| 1 | Unbounded mandatory reasoning | 60-100s/stage | explicit effort / reasoning max_tokens |
| 2 | 3 sequential round trips | 40-130s (one trip) | merge stages 1+2 |
| 3 | No concept cache | minutes per repeat | blobs map cache |
| 4 | 65536 token cap oversized | indirect, 2x worst case | 16384 after #1 |
| 5 | Serial abuse controls | 0.3-1s | parallelize |
| 6 | Awaited snapshot writes | 0.2-1s | write-behind |
| 7 | Fixed 2s poll sleep-first | ~1s avg | adaptive interval (skip ok) |
| 8 | Silent 429 backoff | 0-14s+, corrupts metrics | log retries |
| 9 | 600s stage timeout vs 14min deadline | worst-case waste | 180-240s cap |

Top 3: (1) bound reasoning, (2) merge stages 1+2, (3) cache finished maps
by normalized concept.
