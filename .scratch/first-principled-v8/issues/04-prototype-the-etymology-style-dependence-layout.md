# 04 - Prototype the etymology-style Dependence layout

**Type:** prototype

**Status:** resolved

**Blocked by:** none (02 and 03 resolved)

**Related:** [What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md),
[Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md),
[Hover inventors and inspection on the chapel flowchart](08-hover-inventors-and-inspection-on-the-chapel-flowchart.md)

## Question

Does an Etymonline-style flowchart, filled with Dependence nodes for one
gold word (not the English word's etymology), read as the product
surface Danny wants?

## Prototype

Throwaway HTML (not wired to the generator or poll):
[04-etymology-layout-prototype](../research/04-etymology-layout-prototype/README.md).
Run `npm run prototype:etymology-layout` and open http://127.0.0.1:4174/
(`?variant=A|B|C`, `?map=gold|live`). Winner to steal from: **B Chapel**.

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

## Answer

KEEP, with tweaks. Winning look is **B Chapel** (live header, Fraunces /
amethyst cards, same crown-at-bottom fan-in geometry). A is a reference
facsimile; C is spare parts only.

Tweaks that this ticket does not lock (graduated):

- Epiphanies should read as transformational periods **on the arrows**.
  Neither A nor B showed that.
  [Do Epiphanies sit on the arrows](07-do-epiphanies-sit-on-the-arrows.md).
- Hover is missing; inventor names are missing.
  [Hover inventors and inspection on the chapel flowchart](08-hover-inventors-and-inspection-on-the-chapel-flowchart.md).
- Card fields still open.
  [What each card on that flowchart holds](06-what-each-card-on-that-flowchart-holds.md).

The Nemotron slice was useful: gold battery is a thin chemistry chain
(ions / electrodes / electrolyte / battery). The model slice was a
practical cell (pile, paste, separator, sealed). Danny likes that
practical cut and wants more phases than either sample showed. Smarter
models may fill that; v8 does not retune v7 prompts. Capture only: do
not treat the gold fixture as the product inventory.

Do not ship this folder into `src/` as-is. Fold B when an
implementation ticket says so. After wiring, smoke OpenRouter `:free`.

## Acceptance criteria

- [x] A runnable throwaway HTML prototype exists and is linked from this
      ticket
- [x] It obeys the 02/03 locks
- [x] Danny's keep / tweak / kill is recorded on this ticket
- [x] Map Decisions so far points at the verdict

## Docs rule

Pointer only. No `CONTEXT.md` rename until ticket 06 or a later name
lock.
