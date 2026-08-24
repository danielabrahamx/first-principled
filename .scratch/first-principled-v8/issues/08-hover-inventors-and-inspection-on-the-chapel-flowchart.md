# 08 - Hover inventors and inspection on the chapel flowchart

**Type:** grilling

**Status:** ready-for-human

**Blocked by:** none
([Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)
resolved; KEEP Chapel)

**Related:** [What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md),
[Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md)

## Question

The old hanging-card Tree had observation hover. The Chapel prototype
has no hover and no inventor names. What inspection affordance does
the chapel flowchart use, and which fields (discoverer, date, note)
appear there versus on the card or arrow?

## What

HITL. Do not implement chrome. Rabbit-hole invitations stay fog unless
this ticket must mention a click. Nested generated trees stay out of
scope. Prefer existing observation records on EPIPHANY nodes. Do not
put a hero-and-date on every DOMAIN card.

Working recommendation: hover (or a small sheet) on a card or arrow
shows discoverer and date when the mark is not UNKNOWN; cards stay
title / tag / gloss. Kill a chrome that dumps the full observation
JSON.

## Acceptance criteria

- [ ] One inspection affordance locked (hover, sheet, both, or none)
- [ ] Inventor / date placement stated
- [ ] Map Decisions so far points at this lock

## Docs rule

Pointer only unless hover becomes the product inspection contract;
then one Tree paragraph in `CONTEXT.md` in the same commit.
