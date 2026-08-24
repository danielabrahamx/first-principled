# 06 - What each card on that flowchart holds

**Type:** grilling

**Status:** resolved

**Blocked by:** none
([Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)
resolved; KEEP Chapel)

**Related:** [Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md),
[Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md),
[Hover inventors and inspection on the chapel flowchart](08-hover-inventors-and-inspection-on-the-chapel-flowchart.md)

## Question

Etymonline cards show a form, a language/date tag, and a short gloss.
Which Reality Map fields occupy those three slots on a Dependence card,
and what is omitted?

## What

HITL. Chapel is the winning look. Prototype cards used title = name,
tag = layer, gloss = description. Danny: not enough phases in the
samples; gold omitted the practical cell cut the Nemotron slice showed;
inventors and hover are ticket 08; Epiphanies-on-arrows is ticket 07.

Working recommendation: title = node name; tag = role or layer (not a
calendar date); gloss = the short because / description already on the
map. Dates and discoverers stay off the card face. Do not invent new
fields the generator does not already emit. Do not use this ticket to
retune v7 prompts or thicken the gold fixture.

## Answer

Title = `label`. Tag = layer name (`layer` / `layers[].name`), never a
calendar date and never `role`. Gloss = `description` (truncate in
chrome; do not add a second gloss field). Discoverer, date, and
`keyObservation` are omitted from the card face. `EPIPHANY` nodes are
not cards; that placement is
[Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md).
DOMAIN and STRUCTURAL nodes stay cards. No new generator fields. No v7
prompt retune.

HITL 2026-08-24 (Cursor).

## Acceptance criteria

- [x] Title, tag, and gloss each map to an existing Reality Map field
      (or are explicitly omitted)
- [x] EPIPHANY-only history is placed or refused
- [x] Map Decisions so far points at this lock

## Docs rule

Product card contract: Tree paragraph in `CONTEXT.md` in the same
commit.
