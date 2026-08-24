# 07 - Do Epiphanies sit on the arrows

**Type:** grilling

**Status:** resolved

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

## Answer

**On the downward shaft, not as a card.** Cards are DOMAIN and
STRUCTURAL. The arrow from support A to dependent B shows `because` as
the short warrant. Chronology regimes are not arrow copy. If `because`
is missing, the shaft stays unlabeled; do not invent copy. Observation
records stay off the shaft (no hero-and-date on every arrow); hover is
[Hover inventors and inspection on the chapel flowchart](08-hover-inventors-and-inspection-on-the-chapel-flowchart.md).
Wait-state "grow joints" means labeled arrows appearing, not extra
epiphany cards. No fourth stage.

HITL 2026-08-24 (Cursor).

## Acceptance criteria

- [x] One placement locked (arrow, card, both, or refused)
- [x] Stated which existing field is the arrow copy
- [x] Map Decisions so far points at this lock

## Docs rule

Tree paragraph in `CONTEXT.md` says arrows carry Epiphanies via
`because`. Same commit.
