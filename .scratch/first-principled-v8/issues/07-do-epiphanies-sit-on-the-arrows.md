# 07 - Do Epiphanies sit on the arrows

**Type:** grilling

**Status:** ready-for-human

**Blocked by:** none
([Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)
resolved; KEEP Chapel)

**Related:** [What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md),
[How stage products grow in place when Arrange reorders](05-how-stage-products-grow-in-place-when-arrange-reorders.md)

## Question

Danny wants Epiphanies as the **transformational periods on the arrows**,
not only as cards. The Chapel prototype showed none of that. Where does
an EPIPHANY record live on the chapel flowchart?

## What

HITL. Do not implement chrome. Lock placement: arrow label, joint
badge, card role, or some mix. Use existing generator fields only
(EPIPHANY role, observation / result, `because` on edges). Do not invent
a fourth stage. Chronology regimes stay a scaffold, not the arrow copy,
unless this ticket explicitly says otherwise.

Working recommendation: the downward arrow from support A to dependent
B carries the Epiphany that warrants that rest-on (short result line).
Cards stay concepts. Hover can hold discoverer and date (ticket 08).
Kill a picture that puts a famous person on every shaft.

## Acceptance criteria

- [ ] One placement locked (arrow, card, both, or refused)
- [ ] Stated which existing field is the arrow copy
- [ ] Map Decisions so far points at this lock

## Docs rule

Pointer unless the Tree paragraph must say arrows carry Epiphanies;
then edit `CONTEXT.md` in the same commit.
