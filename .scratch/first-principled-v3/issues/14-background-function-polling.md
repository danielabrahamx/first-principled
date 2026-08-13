# 14 - Background function + client polling for generation

**Type:** task

**What:** Move tree generation off the synchronous Netlify function (30s cap)
onto a background function (15 min budget) with client-side polling, so a
20-50s generation completes instead of being killed mid-run.

**Blocked by:** none

**Related:** 03 (latency evidence), 11 (map entry + shared generation), 13
(bigger per-layer prompts)

**Status:** resolved

## Question

2026-08-13, live at first-principled.netlify.app after the 10-13 deploy, Danny
gets "A fault happened on our side. Please try again." or "The tutor produced
an unreadable answer. Please try again." - nothing is created. It is NOT token
efficiency: the Netlify synchronous function is killed at its 30s cap while
real generation takes 16-52s.

## Evidence (verified 2026-08-13, do not re-litigate)

- Function logs (`netlify logs --source functions`): every failed request is
  `Duration: 30000 ms` - killed at the cap. Requests that completed (e.g.
  18719 ms, 29548 ms) are the rare sub-30s runs.
- Direct probes: `curl -X POST https://first-principled.netlify.app/api/agent
  -H "Content-Type: application/json" -d '{"word":"laptop","history":[],"phase":"init"}'`
  returns either the platform "Inactivity Timeout" HTML page or
  `{"errorType":"Error","errorMessage":"An unknown error has occurred"}` -
  both are Netlify runtime failures, NOT the app's stable error envelope.
  The client's api/agent.js collapses a non-JSON body to `internal`
  ("A fault happened...") and an invalid_model_output envelope to
  "unreadable answer".
- Ticket 03's verification table (research/03-observations-verification.md,
  run `node --env-file=.env`, direct to DeepSeek, NOT through the function):
  mean ~22s, max 51.7s (microscope), many 25-30s. So the sync cap was always
  borderline; ticket 13 (each layer call now sees ALL lower layers, bigger
  prompts) pushed typical runs over.
- netlify.toml has no `[functions]` timeout config (default sync cap applies).
- The 30/30 "live" verification in tickets 03/08 was measured direct-to-API,
  not through the deployed function - the function path was never exercised
  at generation scale until this deploy.

## What

1. **Server: mark the function background.** `netlify/functions/agent.json`
   (sibling of the agent dir) with `{"config": {"background": true}}`, or the
   netlify.toml equivalent. Background functions get a 15-minute budget.
   VERIFY the exact mechanism against the Netlify docs before committing -
   the config-file shape and the poll contract must match the live platform.
2. **Client: handle the 202 + poll.** `src/api/agent.js` `callAgent`:
   a POST that returns 202 with a job id becomes a poll loop against the
   job URL until the result arrives (or a stable error code, or a
   client-side deadline ~10-12 min). The rest of the app (generation.js,
   map.js, chat) must not change shape - the skeleton timer already covers
   the longer wait visually.
3. **Keep the error contract.** Every failure still collapses to a stable
   code (network / internal / invalid_model_output / ...) - never surface
   the platform HTML or the errorType envelope. The poll loop must map
   job-endpoint failures to the same codes.
4. **Follow-up turns still work.** Chat follow-ups are single LLM calls
   (usually < 30s) but must ride the same transport - do not fork the
   code path; make callAgent uniform.

## Acceptance criteria

- [ ] Live: a slow concept (microscope-class, 40-50s) generates a full tree
      through the deployed function - no 30s kill, no platform HTML
      (verified post-deploy by Hermes)
- [x] callAgent: 202 + job id -> polls -> returns the same result shape as
      today; non-JSON / job failures collapse to stable codes
- [x] Map entry (ticket 11 flow) and chat follow-ups both work against the
      background transport
- [x] npm test green (api/agent.test.js updated for the poll flow), tsc clean
- [x] 375px/320px CDP audits clean on the map entry flow (skeleton shows
      during the longer wait)
- [ ] Deployed via the manual Netlify command; live probes re-run against
      the URL (verified post-deploy by Hermes)

## Answer

2026-08-13, opencode session ses_0048a3bffffeyupupKz9v7S32r.

### The verified Netlify contract (from docs.netlify.com/build/functions/background-functions, read during this session)

The ticket's starting assumption - "a POST that returns 202 with a job id" -
is wrong for Netlify. Background functions return an EMPTY 202 immediately;
there is NO job id in the response and NO built-in status endpoint. The docs:
"the client receives an empty 202 response immediately, so you generally pass
the invocation result to a destination other than the originating client."
The background budget is 15 minutes (vs the 30s sync cap that killed
generation). Background functions do not support response streaming and have
a 256 KB request/response payload cap (our requests are < 64 KB). Retry
behavior is critical: "If function invocation returns an error, a retry
happens after one minute. If it fails again, another retry happens two
minutes later" - so the function must NOT throw after the 202, or the whole
generation re-runs and double-spends LLM tokens.

Design that fits the real platform (client-generated jobId + blob result
store + a SECOND synchronous status function - "poll the job URL" does not
exist on Netlify):

- netlify.toml: `[functions.agent] background = true` (docs-verified config
  shape; the alternative `export const config = { background: true }` is
  equally valid, toml preferred) plus a second redirect
  `/api/agent-status -> /.netlify/functions/agent-status`.
- netlify/functions/agent/agent.mjs (background): reads the client jobId from
  the body (missing/invalid -> a terminal bad_request record under a
  server-generated id, never a throw), runs the existing abuse controls
  (body cap, rate limit, Turnstile) and handleRequest exactly as before, and
  writes EVERY outcome to the "agent-jobs" Netlify Blobs store under
  `job:<jobId>` with a 30-minute TTL: success = {status, httpStatus, body},
  stable error = {status:"error", code, message}, unexpected throw =
  internal. The whole handler is wrapped so nothing throws after the 202.
- netlify/functions/agent-status/agent-status.mjs (NEW, synchronous - a
  background function can never serve a poll): GET ?job=<id>, reads the
  record, answers no-record -> running, success -> {status:"success", body}
  (a non-200 success record maps to the error shape from its body.error),
  error -> {status:"error", code, message}; store access is try/caught and
  a store failure is the stable 500 envelope, never platform HTML.
- src/api/agent.js callAgent (the only client file whose shape changed):
  generates a jobId per call (crypto.randomUUID, hex fallback) and sends it
  in the POST body (the function ignores unknown fields, so the orchestrator
  is unaffected). A 202 POST enters a poll loop against the status endpoint
  (default "/api/agent-status?job=", injectable statusEndpoint/pollIntervalMs
  /deadlineMs) until success -> {ok:true, data}, error record -> {ok:false,
  code}, status-envelope error -> {ok:false, code}, poll network failure ->
  network, non-JSON / unexpected -> internal, or the 10-minute deadline ->
  internal. A non-202 POST keeps the exact old sync behavior, so local dev,
  stubbed fetch, and a non-background deploy stay backward-compatible.
  generation.js, map.js, chat.js and the store are untouched - the skeleton
  timer already covers the longer wait visually.

### Test counts

353 tests pass (agent.test.js grew from 7 to 16: the 200-path tests kept,
plus 202->success, running-then-success, error record code, non-JSON status
body -> internal, status network failure -> network, status-endpoint envelope
code, tiny-deadline -> internal, success-without-body -> internal, and the
POST carries a jobId / status endpoint is polled with the job id, via an
injected fetchImpl that asserts URLs). `npx tsc --checkJs` clean.

### CDP results (local, against the src/ static server)

24/24 checks at 375px and 320px on the map entry flow with both endpoints
intercepted (POST /api/agent -> empty 202, GET /api/agent-status -> running
for the first polls then the success fixture): skeleton visible right after
submit and holding while the job runs, tree lands on the map after the poll
success and the skeleton hides, no horizontal overflow at any state, tap
targets 44px, status polls hit /api/agent-status?job=<id>. Screenshots in
research/14-map-entry-{375,320}.png, 14-skeleton-{375,320}.png,
14-tree-{375,320}.png. 14-live-probe.mjs (raw fetch: POST with a jobId, poll
to the tree or a stable error) is written for Hermes to run against the live
URL after the deploy - the deploy and the live verification are the
verifier's step, not this session's.

## Docs rule

Update the map's Decisions so far with the background-function resolution:
note the sync 30s cap killed generation at the 10-13 deploy, and that the
transport now polls a background job. Note the fix in the map's Not yet
specified if any follow-up work (e.g. real per-layer progress instead of the
timer) becomes visible.
