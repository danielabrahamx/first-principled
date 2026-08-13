# 14 - Background function + client polling for generation

**Type:** task

**What:** Move tree generation off the synchronous Netlify function (30s cap)
onto a background function (15 min budget) with client-side polling, so a
20-50s generation completes instead of being killed mid-run.

**Blocked by:** none

**Related:** 03 (latency evidence), 11 (map entry + shared generation), 13
(bigger per-layer prompts)

**Status:** ready-for-agent

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
- [ ] callAgent: 202 + job id -> polls -> returns the same result shape as
      today; non-JSON / job failures collapse to stable codes
- [ ] Map entry (ticket 11 flow) and chat follow-ups both work against the
      background transport
- [ ] npm test green (api/agent.test.js updated for the poll flow), tsc clean
- [ ] 375px/320px CDP audits clean on the map entry flow (skeleton shows
      during the longer wait)
- [ ] Deployed via the manual Netlify command; live probes re-run against
      the URL (reuse research/11/12/13-live-probe.mjs patterns)

## Docs rule

Update the map's Decisions so far with the background-function resolution:
note the sync 30s cap killed generation at the 10-13 deploy, and that the
transport now polls a background job. Note the fix in the map's Not yet
specified if any follow-up work (e.g. real per-layer progress instead of the
timer) becomes visible.
