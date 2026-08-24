# First-Principled v8 - Display and wait-state map

**Effort:** Replace the hanging-card Tree chrome with an Etymonline-style
flowchart that still draws Dependence, and grow Chronology then Epiphany
products in place while the background init job runs.
**Planning source:** wayfinder grilling 2026-08-23 (Cursor). v7 keeps the
generator and KEEP/KILL. This map is a sibling effort: structure first,
then implementation.

## Destination

A shipped wait-state and knowledge display: stage products (Chronology
regimes, then Epiphany records) appear on the same surface as they
finish; the finished Reality Map is shown as an Etymonline-style
flowchart of Dependence (title, small tag, short gloss, merge-in arrows),
not as word history and not as the current hanging-card Tree. Raw model
thinking stays off. Transport stays background poll plus stage snapshots
unless research kills snapshots. The map then carries that rewrite on
the v1 stack.

## Notes

- **This map carries implementation** after the structure tickets close.
  One session, one ticket (research excepted).
- Domain: read `docs/MISSION.md` and `CONTEXT.md`. The drawn relation is
  still **Dependence**. Chronology remains a scaffold, not the layout.
  The Etymonline screenshot is a chrome reference, not a new ontology.
  Do not tutor the English word's etymology.
- v7 is untouched: no prompt retune, no KEEP/KILL, no thinking-on, no
  fourth LLM call. Generator stays Chronology, Epiphanies, Arrange in
  one background init job.
- Wait-state: grow in place on this flowchart. No Chat page, no separate
  thinking pane, no token SSE.
  [Can the poll carry stage snapshots](issues/01-can-the-poll-carry-stage-snapshots.md)
  locked keep-snapshots.
- Skills: grilling + domain-modeling on HITL; `/research` on ticket 01
  (resolved); `/prototype` on ticket 04 (resolved; KEEP Chapel).
  anti-slop, tsc, netlify-build discipline.
- **Next session:** claim
  [Grow stage products in place on the Chapel flowchart](issues/11-grow-stage-products-in-place-on-the-chapel-flowchart.md)
  (AFK). Ticket 10 shipped Chapel on the finished Tree. Do not ship the
  throwaway prototype. One ticket per session.
- Style: single dashes, no emojis. Windows/PowerShell-tested.

## Decisions so far

<!-- grilling 2026-08-23, locked before tickets -->

- Destination: shipped etymology-style Dependence display plus
  stage-product wait-state. Execution map, not a spec handoff.
- One map for wait-state and finished display. Sibling to v7, not a
  rewrite of v7's generator destination.
- Stream **stage products**, not provider chain-of-thought. Option A
  (thinking off) stays.
- Chrome candidate: Etymonline flowchart (fan-in at the top, cards with
  title / tag / gloss, thin arrows). Cards hold bits of knowledge, not
  word forms.
- Grow in place on that surface.
- Transport intent: existing background poll plus mid-job snapshots.
  SSE/token streaming is out.
- Keep-snapshots: the background init job can `setJSON` learner-safe
  Chronology then Epiphanies records on the same `agent-jobs` key the
  client already polls. Status stays `running` until terminal success
  or error. Never throw after 202. Details:
  [01-stage-snapshots-on-the-poll.md](research/01-stage-snapshots-on-the-poll.md).
- Crown at the bottom: the typed concept sits at the bottom of the
  flowchart; supporting knowledge sits above it. An arrow from A down
  to B means B depends on A.
  [Which way is up on the etymology-style Tree](issues/02-which-way-is-up-on-the-etymology-style-tree.md).
- Spine plus fan-in: the vertical chain is the Dependence trunk walk,
  not Chronology order. Extra parents merge in from the side. No second
  hanging column.
  [How a Dependence DAG becomes that flowchart](issues/03-how-a-dependence-dag-becomes-that-flowchart.md).
- Chapel KEEP: etymology-style Dependence flowchart in the live header
  shell (Fraunces / amethyst), crown at bottom, fan-in then spine.
  Throwaway prototype, do not copy into `src/` yet. Tweaks graduated.
  [Prototype the etymology-style Dependence layout](issues/04-prototype-the-etymology-style-dependence-layout.md).
- Morph grow-in-place: Chronology spine, then joints, then membership
  morph into Dependence. Status line `building tree...` until Arrange.
  Poll snapshots, not SSE.
  [How stage products grow in place when Arrange reorders](issues/05-how-stage-products-grow-in-place-when-arrange-reorders.md).
- Card slots: title = `label`; tag = layer name; gloss = `description`.
  History off the card face. EPIPHANY nodes are not cards.
  [What each card on that flowchart holds](issues/06-what-each-card-on-that-flowchart-holds.md).
- Epiphanies on the downward shaft via `because`. Unlabeled if missing.
  No hero-and-date on the shaft. Grow joints = labeled arrows.
  [Do Epiphanies sit on the arrows](issues/07-do-epiphanies-sit-on-the-arrows.md).
- Hover on the labeled arrow: discoverer and/or date when not UNKNOWN,
  plus note if non-empty. No hover if both UNKNOWN. No card hover. No
  click-to-inspect.
  [Hover inventors and inspection on the chapel flowchart](issues/08-hover-inventors-and-inspection-on-the-chapel-flowchart.md).
- Running poll forwards learner-safe Chronology then Epiphanies snapshots
  while status stays `running`. Missing blob stays running with no
  snapshot. Snapshot writes never throw after 202. Terminal shapes
  unchanged. No SSE, no fourth status.
  [Poll forwards running stage snapshots](issues/09-poll-forwards-running-stage-snapshots.md).
- Finished Tree home is Chapel geometry: crown at the bottom, spine plus
  side fan-in, cards `label` / layer name / `description`, `because` on
  shafts, hover on labeled arrows only (UNKNOWN: no hover). Instant
  appear. Mobile stacks extra parents. Wait-state snapshots stay ticket 11.
  [Ship the Chapel Dependence flowchart](issues/10-ship-the-chapel-dependence-flowchart.md).

## Not yet specified

- Whether the chrome still uses the glossary name Tree, or is renamed.
- How How-it-works copy describes this surface.
- How many nodes / phases the chapel picture should show when gold is
  thin and a live map is a practical cell. Not a v7 prompt retune.
- Rabbit-hole click after hover.

## Out of scope

- Raw `reasoning_content` / chain-of-thought as learner copy.
- Linguistic etymology of the typed word.
- v7 prompt retune, repair loops, KEEP/KILL, thinking-on.
- Tutor chrome, Chat page, Learner Mental Model tab.
- Nested generated trees from a node click.
- New stack (React, bundler, DB, SSE as the first design).
- Payments map work.

## Ticket sequence (dependency overview)

```
01 research can the poll carry stage snapshots
02 grilling which way is up
03 grilling how a Dependence DAG becomes the flowchart
02 + 03 -> 04 prototype the etymology-style Dependence layout
01 + 03 -> 05 grilling grow-in-place when Arrange reorders
04 -> 06 grilling what each card holds
04 -> 07 grilling do Epiphanies sit on the arrows
04 -> 08 grilling hover inventors and inspection
01 + 05 -> 09 poll forwards running stage snapshots
06 + 07 + 08 -> 10 ship the Chapel Dependence flowchart
09 + 10 -> 11 grow stage products in place on the Chapel flowchart
11 -> 12 deploy the Chapel Tree
```

Instant appear, cheap placeholder until first snapshot, and error-blob
wins after a failed later stage are folded into 10 and 11. Mobile folds
into 10.

## Open frontier

- [Grow stage products in place on the Chapel flowchart](issues/11-grow-stage-products-in-place-on-the-chapel-flowchart.md)
  (AFK; unblocked)
