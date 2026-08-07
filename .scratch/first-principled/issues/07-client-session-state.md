# 07 - Client session state

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 06
**Related:** spec sections 6, 8; `src/state/session.ts`

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
