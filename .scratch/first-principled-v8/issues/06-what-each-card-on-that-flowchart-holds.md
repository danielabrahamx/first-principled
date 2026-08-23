# 06 - What each card on that flowchart holds

**Type:** grilling

**Status:** ready-for-human

**Blocked by:** [Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)

**Related:** [Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)

## Question

Etymonline cards show a form, a language/date tag, and a short gloss.
Which Reality Map fields occupy those three slots on a Dependence card,
and what is omitted?

## What

HITL, after Danny has seen the prototype.

Working recommendation: title = node name; tag = role or layer (not a
calendar date); gloss = the short because / observation line already on
the map. Dates and discoverers stay only on EPIPHANY records, and only
if the prototype still reads clearly with them in the gloss rather than
the tag. Do not invent new fields the generator does not already emit.

## Acceptance criteria

- [ ] Title, tag, and gloss each map to an existing Reality Map field
      (or are explicitly omitted)
- [ ] EPIPHANY-only history is placed or refused
- [ ] Map Decisions so far points at this lock

## Docs rule

If this becomes the product card contract, update the Tree (or renamed
surface) paragraph in `CONTEXT.md` in the same commit. Otherwise
pointer only.
