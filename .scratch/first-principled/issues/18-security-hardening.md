# 18 - Security hardening: rate limiting, Turnstile, input caps, headers

**Type:** task
**Status:** resolved (2026-08-08)
**Blocked by:** none
**Related:** tickets 06, 11; spec sections 8; netlify/functions/agent/agent.mjs;
src/turnstile.js; src/_headers; src/lib/agent/orchestrator.js;
src/lib/mmg/validator.js

## Question

Danny's review (2026-08-08): "I don't think we have any rate-limiting or any
security measures at all." Correct: POST /api/agent was a fully open paid
endpoint - no auth, no rate limit, no request size cap, no cap on map or
history size. Anyone on the internet could script unlimited DeepSeek calls
(and amplify each call with a giant client-supplied reality map) and run up
the API bill. How do we cap the blast radius with zero spend and no auth
(auth is deferred to v2 by spec)?

## What

1. Function-side abuse controls in netlify/functions/agent/agent.mjs, all
   before any LLM call:
   - Body cap: reject requests over 64KB with 413 too_large.
   - Per-IP rate limit: RATE_LIMIT_MAX requests per IP per hour (default
     60) counted in a Netlify Blobs store (works on every plan, no DB).
     Fail-open when the store is unavailable so the site never goes down
     on a store error.
   - Turnstile: when TURNSTILE_SECRET_KEY is set, every request must carry
     a valid single-use Turnstile token (action "agent_turn", verified
     against Cloudflare, 8s timeout, fail closed). Skipped when the secret
     is unset so local dev and the unconfigured site keep working.
2. Input caps in src/lib/agent/orchestrator.js: word max 100 chars, message
   content max 10000 chars, history truncated to the last 60 messages
   (real sessions end at 24 turns = 48 messages).
3. Map caps in src/lib/mmg/validator.js: reality map max 60 nodes, 120
   edges, 12 layers (live maps are ~11 nodes).
4. Client: src/turnstile.js invisible widget helper (site key placeholder,
   widget created per submit and removed after the token); chat.js fetches
   a token per turn; api/agent.js carries it in the body; new stable error
   codes too_large, rate_limited, captcha_required, captcha_failed with
   friendly wording.
5. src/_headers: CSP (same-origin + Google Fonts + challenges.cloudflare.com
   for the widget), X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
   Permissions-Policy, Cross-Origin-Opener-Policy.

## Acceptance

- 194 tests green (7 rate-limiter unit tests covering the blob-store
  counting and the in-memory fallback), tsc clean.
- Live: 413 on a >64KB body, 400 on bad JSON, 400 on an over-long word,
  security headers present on the static site, a full init turn still
  works, Google Fonts and the Turnstile script load under the CSP.
- NOT live-verified: 429. Netlify does not inject the Netlify Blobs
  context into this function on the free plan (the site-level blob API
  works, the function env does not carry NETLIFY_BLOBS_CONTEXT), and
  free-tier function instances cold-start per request, which resets the
  in-memory fallback. The limiter is therefore best-effort until the blob
  context exists (upgrade or support toggle) or the site sits behind a
  proxy with its own rate limiting. Evidence recorded honestly; the
  primary wall for a public demo remains Turnstile (fail-closed once
  TURNSTILE_SECRET_KEY is set).
- Turnstile gate activates by setting TURNSTILE_SECRET_KEY (Netlify env)
  and pasting the public site key into src/turnstile.js; until then the
  site runs ungated.

## Decisions

- Blobs store over native Netlify rate limiting: works on every plan,
  testable locally, no config dependency.
- Fail-open rate limiter, fail-closed Turnstile: the limiter protects cost
  (a missed counter costs cents), Turnstile protects identity (an unvetted
  request must not spend tokens at all).
