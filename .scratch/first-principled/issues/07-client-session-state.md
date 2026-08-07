# 07 - Client session state

**Type:** task
**Status:** resolved (2026-08-07)
**Blocked by:** 06 (resolved)
**Related:** spec sections 6, 8; `src/state/session.js` (session.ts became .js
per the ticket 02 decision: plain ES modules with JSDoc types)

## Question

How does the client hold the whole session without any server-side storage?

## What

1. An in-memory session store in the frontend: word, realityMap, learnerMap,
   history (message list), phase. Lifecycle: new session clears all of it.
   Nothing is written to disk, localStorage, or any server.
2. Serialization matching the API contract exactly, so every turn sends the
   full state and receives the updated state back.
3. Page routing: chat and map are separate routes (hash or history routing)
   sharing the same session store, so switching pages keeps the session.
4. Session end detection: when the API returns sessionEnded, the store freezes
   and the comparison view data is kept until the user starts a new session.

## Acceptance criteria

- Session survives navigation between chat and map pages.
- New session resets all state; no cross-session leakage in one browser tab.
- State serializes to the exact request shape in spec section 8.

## Docs rule

Commit and push before done. Update spec section 6 if storage decisions change.

## Resolution

- `src/state/session.js`: `createSessionStore()` plus the `sessionStore`
  module singleton both pages share. State: word, realityMap (null until init
  returns it), learnerMap, history (ChatMessage[]), failedAttempts, phase,
  ended, transferResult, lastDiff, lastReply, closeness (recomputed from the
  learner map on every response via mmg/closeness.js).
- Lifecycle: `startSession(word)` replaces the whole state object - a new
  word (or a retry after an init refusal) can never leak the previous
  session. `appendUserMessage(content)` records the learner's message before
  the turn request. `applyResponse(response)` merges one 200 turn: appends
  the assistant reply to history, adopts learnerMap/diff/failedAttempts/
  phase, and on init adopts realityMap. A refusal keeps phase "init" with no
  realityMap. When the response sets sessionEnded the store freezes: further
  user messages and responses are refused, and the comparison data (maps,
  transferResult) is kept until the next startSession.
- `toRequest()` serializes to exactly the spec 8 shape: init sends
  `{word, history, phase}`; active and end send the held maps,
  failedAttempts and history with the phase. Verified against the
  orchestrator contract (06) in the round-trip unit tests.
- `src/state/router.js`: hash routing (`#chat`, `#map`), chosen over history
  routing because the static site has no server-side rewrites - hashes are
  plain anchors any static host serves, and switching pages never reloads
  the document, so the store singleton survives navigation. The router takes
  an injectable location-like object, so node:test drives it without a DOM;
  in the browser it uses globalThis.location.
- `src/app.js` toggles the two views on route changes (chat UI and map UI
  content arrive with tickets 08 and 09; this ticket only wires the routes).
- Docs: spec section 6 updated - the store module, hash routing, and the
  nothing-is-persisted rule are now explicit.
- Verification: 119 node:test cases pass (24 pre-existing + 12 store + 8
  router), tsc --noEmit clean, `netlify dev` serves index/app.js/session.js/
  router.js (200), and the modules import as ES modules outside the browser.
  On Windows, the first `netlify dev` attempt failed on a stale port 3999
  holder (EADDRINUSE); killed the orphaned process and re-ran clean.
