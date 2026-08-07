# 08 - Chat page UI

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 07
**Related:** spec sections 8, 9; `src/pages/chat.tsx` or equivalent

## Question

What is the minimal chat surface that carries the whole Socratic loop?

## What

1. A single page: word or phrase input at the start, then a message list
   (learner and agent turns), a sending state while the API call is in flight,
   and a phase indicator (starting, exploring, refining, session end).
2. Enter-to-send, graceful handling of API errors (retry affordance, no raw
   error text).
3. Session end: the agent's transfer question appears as a normal message;
   the learner answers; the result is shown and the comparison entry point
   appears.
4. No map content on this page. The only link to the map is navigation to the
   separate map page (ticket 09).
5. Plain, minimal styling; no framework beyond what ticket 01 chose.

## Acceptance criteria

- Full loop usable in a browser against the local function: word in, turns,
  transfer question, session end.
- Errors surface as friendly retry prompts, never raw JSON.
- The page works on a narrow viewport.

## Docs rule

Commit and push before done. Update spec section 9 if UX details change.
