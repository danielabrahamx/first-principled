# Correctness audit - functional bugs and broken contracts

Scope: `src/lib/agent/{orchestrator,realityMap,jsonParse,socratic,llm,arrange,stageSnapshot}.js`,
`netlify/functions/agent/agent.mjs`, `netlify/functions/agent-status/agent-status.mjs`,
cross-checked against `src/api/agent.js`, `src/state/session.js`, `src/lib/generation.js`,
`src/lib/mmg/{validator,fixtures}.js`, and `eval/run.js`. Read-only: no source files modified.

Method: full read of the named files plus every module they gate on; grep for callers of
suspicious exports; two stubbed-LLM executions of `handleRequest` to confirm behavior
(non-brief probe rejected 502 under `forceBrief`; end-phase unreachable from client state).
Line numbers refer to current working tree.

Severity: P0 breaks a live or spec-mandated path; P1 wrong behavior / blind ops; P2 races
and drift; P3 robustness nits.

---

## Findings

### 1. [P0] Token-starved JSON turns on the mandated-thinking model; the repair retry changes nothing on OpenRouter

Evidence:
- `src/lib/agent/orchestrator.js:304` - `generateJson` defaults `maxTokens = 2048`;
  `orchestrator.js:589` passes `maxTokens: 1024` for grading.
- `src/lib/agent/socratic.js:567` - Socratic turns default `maxTokens = 4096`.
- `src/lib/agent/llm.js:168-174` - on OpenRouter, `thinking: true` sets
  `reasoning:{enabled:true}`; `thinking: false` OMITS the field entirely. The default model
  (`stealth/ox-alpha`) mandates reasoning (llm.js:8-14, realityMap.js:186-189), so a
  "thinking:false" call still spends reasoning tokens from the same completion budget.
- `src/lib/realityMap.js:713-719` documents the exact failure mode empirically: mandatory
  reasoning "burns the completion budget before the JSON: at 8192 the Epiphanies schema
  call spent every token on thinking and truncated", which is why map stages use 65536.
- `src/lib/agent/socratic.js:576-579` claims the repair attempt "takes a genuinely
  different path" because thinking is disabled - true only on DeepSeek (llm.js:175-178);
  on OpenRouter both attempts carry reasoning against the same small cap.

Impact: any turn whose mandated reasoning exceeds the cap truncates mid-JSON
(`finish_reason: length` is never inspected anywhere), `parseModelJson` returns null, the
repair attempt fails the same way, and the learner gets 502 `invalid_model_output`.
Live today: every dock/active briefing turn runs at 4096 with a full learner-map JSON to
emit. Latent: transfer question (2048) and grading (1024) are starved harder the moment
the end phase is re-wired (see finding 7).

Fix: raise the caps to match the documented budget reality (active turns >= 16384,
transfer >= 8192, grade >= 8192), or send an explicit low reasoning effort where supported;
log `choices[0].finish_reason === "length"` in llm.js so truncation is distinguishable from
shape errors; make the repair attempt differ in a way OpenRouter respects (see finding 2).

### 2. [P0] The repair-retry never shows the model its previous reply, so it cannot repair

Evidence:
- `src/lib/agent/orchestrator.js:324-340` - repair messages are `[sys, repair]`; the repair
  text says "Your previous reply did not meet the contract" but the failed assistant
  message is not included. The docstring at orchestrator.js:296-299 also promises "repair
  once with the problem cited", yet the cited problem is always the same generic sentence -
  even when `unpackQuestion`/`unpackGrade` failed on a specific shape.
- `src/lib/agent/socratic.js:539-548` and `:624` - same pattern (`[system, userMessage]`),
  except socratic at least cites `firstErrors` in the text.
- Combined with finding 1: on OpenRouter the second call has identical thinking/budget
  posture and no visibility into what went wrong, so it is a resample, not a repair.

Impact: elevated `invalid_model_output` rates; the two-attempt design buys almost nothing;
each failure costs double tokens before erroring.

Fix: append `{ role: "assistant", content: first.content }` to the messages before the
repair user message in both `generateJson` and `generateSocraticTurn`; cite the concrete
validation errors in `generateJson` like socratic already does.

### 3. [P1] Map-builder gates reject recoverable valid output, and each stage runs exactly once

Evidence:
- `src/lib/realityMap.js:353-374` - Stage 1 demands exact ids `c1..cN`
  (`item.id !== expectedId`) and validates `enabled_by_previous` refs against raw returned
  ids; there is NO id normalization for chronology.
- Contrast `realityMap.js:256-263` - `normalizeEpiphanies` renumbers epiphany ids by
  position explicitly because "The Stage 2 prompt never pins the id format, so models drift
  (ep1, joint-1, prose)... renumbering by position is safe and beats rejecting the stage."
  The same drift applies to Stage 1; only Stage 1 kills the whole generation when it fires.
- Exact concept echo required: `realityMap.js:350` and `:391` (`value.concept !== concept`)
  while the file's own comment (:188-190) says OpenRouter treats the pinning JSON Schema as
  a hint, not enforcement - and `arrangeCheck` deliberately uses fuzzy `sameConcept`
  (:538, :936-942). Two different standards for the same echo problem in one file.
- No retry: `generateRealityMap` (:684 docstring "Each stage runs exactly once";
  `retried: false` hardcoded :920) returns `failure("invalid")` on the first violation
  after minutes of waiting; accepted earlier stages are discarded (the chronology snapshot
  is already published, then thrown away if Epiphanies slips).

Impact: a single formatting drift anywhere = 502 after a multi-minute wait, with the
client's only recourse being a full re-roll. This is the classic "site does not work"
failure shape the gates were meant to prevent.

Fix: mirror the epiphanies defense - positionally normalize chronology ids (and canonicalize
refs) before gating; compare concept echoes with `sameConcept`; add one repair attempt per
stage that feeds the stage's error list back (the machinery already exists in
`generateJson`/`generateSocraticTurn`). Optionally keep per-stage snapshots so a Stage 2
failure does not discard an accepted Stage 1.

### 4. [P1] Silent error swallowing hides real failures server-side

Evidence:
- `netlify/functions/agent/agent.mjs:349-353` - `catch {}` around `handleRequest`: the
  error object is dropped without even `console.error`; a programming fault surfaces only
  as a generic "internal" job record.
- `agent.mjs:240-248` - the last-resort guard also logs nothing AND writes its terminal
  record under a fresh `serverJobId()`, not the client's jobId. If anything ever throws
  between jobId extraction and the internal try/catch, the real job key never lands and the
  client polls until its 14-minute deadline (`src/api/agent.js:38,169-172`) before showing
  "internal".
- `src/lib/agent/orchestrator.js:497` and `:591` - `modelError(turn.kind)` discards
  `turn.errors`/`turn.reason` with no logging. Contrast `realityMap.js:909-912`, whose
  `failure()` logs the first five problems - the Socratic path leaves zero trace of why a
  turn was judged invalid.

Impact: invalid-output incidents (findings 1-3) are undiagnosable in prod logs; a crash
class turns into a 14-minute client hang instead of a fast error.

Fix: `console.error(err)` in both agent.mjs catches; log kind + joined errors in the
orchestrator's modelError paths; hoist the last-resort write so it uses the parsed `jobId`
whenever one exists.

### 5. [P2] Job-record writes can regress terminal states back to "running"

Evidence:
- `agent.mjs:98-104` (`writeSnapshot`) and `:112-124` (`writeJobRecord`) both do an
  unconditional `setJSON` on the same key `job:<jobId>`. Within one invocation the writes
  are awaited sequentially, so snapshot->terminal ordering holds. But Netlify retries a
  background invocation that fails at platform level (crash, timeout) - the header comment
  (:15-19) documents retry-on-throw - and the rerun reuses the SAME client jobId. A rerun's
  `writeSnapshot("chronology")` overwrites run A's terminal success/error back to
  `"running"`; `agent-status.mjs:93-95` then reports running after the client may have
  already observed (and stopped on) a different terminal. Interleaved duplicate submissions
  sharing a jobId behave the same way.
- Mitigating: the shipped client mints a fresh UUID per call (`src/api/agent.js:70,
  131-141`), so the main vector is platform retry, not normal traffic.

Impact: rare but real status flapping and double LLM spend; polls can resurrect "running".

Fix: split namespaces - terminal records under `job:<id>`, snapshots under
`job:<id>:snap:<stage>`; agent-status reads the terminal key first and falls back to the
snapshot keys. That removes any writer overlap without needing conditional puts. (The rate
limiter's get->setJSON TOCTOU at `agent.mjs:155-169` similarly undercounts under
concurrency; acceptable for a fail-open abuse gate, but worth a comment saying so.)

### 6. [P2] Rate-limit window contradicts its own contract (2h window sold as hourly)

Evidence:
- `agent.mjs:24-26` - "RATE_LIMIT_MAX requests per IP per hour (default 60)".
- `agent.mjs:46` - `RATE_LIMIT_WINDOW_HOURS = 2`, used for both the bucket hour comparison
  (:153 slices ISO to the hour, but the counter persists across the 2h expiry) and the TTL
  (:167). Effective cap: 60 per 2 hours.

Impact: operators tuning `RATE_LIMIT_MAX` against the documented contract get half the
expected throughput; users see `rate_limited` twice as early.

Fix: either set the window to 1 hour or fix the comments/docs to say 120/hour equivalent;
add the window to the env name or docs.

### 7. [P2] End-phase machinery is dead code reachable only by hand-crafted requests; eval suite asserts the opposite contract

Evidence:
- `sessionEndDue` (`orchestrator.js:80`) has zero production callers (grep: tests only).
- `runTransferTurn` (`orchestrator.js:519`) is never called.
- `handleActive` hardcodes `forceBrief: true` (:493) and always answers `phase: "active"`
  (:504); the test suite pins this ("active still briefs when every node is known (no
  transfer push)", orchestrator.test.js:357) and pins briefing-only turns (:339).
- The client never originates phase "end": `src/state/session.js:287-289` only mirrors the
  server's phase, and nothing server-side ever emits "end" - so `handleEnd` /
  `buildTransferSystemPrompt` / MAX_TURNS termination are unreachable from the shipped UI.
  Verified by stubbed execution: with all nodes correct and `sessionEndDue === true`,
  handleActive still returns an active briefing turn.
- Meanwhile `eval/run.js:376-393` asserts the OLD contract ("one more active request
  triggers the transfer question (sessionEndDue)... graded in phase end") and records an
  invariant failure when it does not happen - the eval harness now reports failures against
  pinned prod behavior.

Impact: the product-level end moment (transfer + grade + `sessionEnded`) cannot occur;
`MAX_TURNS` is inert; any hand-crafted `phase:"end"` request gets a live grading turn with
no session-state proof (a small token-spend surface); eval drift erodes trust in the
harness.

Fix: decide deliberately - either wire `sessionEndDue` into `handleActive` (restore the
spec section 8 flow) or delete/dead-flag `runTransferTurn`+`handleEnd`+MAX_TURNS with a
comment pointing at the parking decision, and update `eval/run.js` expectations to match.

### 8. [P3] llm.js transport robustness nits that compound findings 1-3

Evidence:
- `llm.js:208-224` - the abort timer is cleared in `finally` right after headers arrive;
  `response.json()` (:246) runs outside timer protection, so a stalled body can hang past
  `timeoutMs` inside a background function.
- The 429 retry loop (:225-230) never cancels the stale response body.
- Truncation is silent: `finish_reason` is never read (see finding 1).

Fix: wrap the body read in the same AbortController lifetime (clear the timer after the
body is consumed); `response.body?.cancel()` on the retry path; log finish_reason when it
is not "stop".

### 9. [P3] jsonParse takes the FIRST balanced brace span, which can be prose, not the answer

Evidence: `src/lib/agent/jsonParse.js:19-52,74-84` - if a model writes an illustrative
`{...}` before its actual reply, the example is parsed and shape-checked; the real JSON
further down is never reached.

Impact: low - unpack functions reject wrong shapes and trigger repair - but it converts a
would-have-succeeded reply into a resample.

Fix (cheap): try ALL balanced spans (or the LAST one) instead of only the first before
returning null.

---

## Non-findings checked

- `normalizeHistory` vs `historyProblems`: derivation rules align exactly
  (EXACT/APPROXIMATE/UNKNOWN requirements are pre-coerced, fallback note filled), so the
  Stage 2 mechanical gate is consistent with its own normalizer.
- `arrangeCheck` over `deterministicArrange` output: crown uniqueness, trunk-edge matching,
  connectivity, provenance coverage, and use/discard accounting all hold by construction
  whenever `edgeSetProblems` passed. Residual kill paths are the validator caps
  (>60 nodes / >12 layers from an unbounded chronology) and intentional listness heuristics.
- Snapshot publish cannot break generation: `publishStageSnapshot` swallows and logs
  (realityMap.js:888-900); test-pinned in agent.test.mjs:95.
- agent-status strong-consistency reads (:40,:63) are correctly opted into; unrecognized
  record shapes degrade to "running" rather than erroring.
- setJSON (not set) is used consistently for object values, including the injectable test
  stores - the "[object Object]" hazard is covered.
