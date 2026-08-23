# 04 - Prototype the etymology-style Dependence layout

**Type:** prototype

**Status:** ready-for-agent

**Blocked by:** none (02 and 03 resolved)

**Related:** [What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md)

## Question

Does an Etymonline-style flowchart, filled with Dependence nodes for one
gold word (not the English word's etymology), read as the product
surface Danny wants?

## What

HITL via `/prototype` (UI branch). Throwaway static HTML. Use the
orientation and DAG rules from tickets 02 and 03. Reference screenshot:
the Etymonline education tree Danny attached (title, small tag, short
gloss, merge bar, downward arrows).

Replace word-forms with knowledge bits from an existing gold Reality
Map (battery preferred; education only if we must match the screenshot
topic). Include at least one extra-parent merge. Caption that this is
Dependence, not etymology.

Danny reacts: keep, tweak, or kill the chrome direction. Do not wire
the generator or the poll.

## Acceptance criteria

- [ ] A runnable throwaway HTML prototype exists and is linked from this
      ticket
- [ ] It obeys the 02/03 locks
- [ ] Danny's keep / tweak / kill is recorded on this ticket
- [ ] Map Decisions so far points at the verdict

## Docs rule

Pointer only. No `CONTEXT.md` rename until ticket 06 or a later name
lock.
