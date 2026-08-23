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
  thinking pane, no token SSE unless
  [Can the poll carry stage snapshots](issues/01-can-the-poll-carry-stage-snapshots.md)
  proves snapshots impossible.
- Skills: grilling + domain-modeling on HITL; `/research` on ticket 01;
  `/prototype` on ticket 04. anti-slop, tsc, netlify-build discipline.
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
  SSE/token streaming is out unless research forbids snapshots.
- Keep-snapshots: the background init job can `setJSON` learner-safe
  Chronology then Epiphanies records on the same `agent-jobs` key the
  client already polls. Status stays `running` until terminal success
  or error. Never throw after 202. Details:
  [01-stage-snapshots-on-the-poll.md](research/01-stage-snapshots-on-the-poll.md).

## Not yet specified

- Whether the chrome still uses the glossary name Tree, or is renamed.
- Rabbit-hole invitations and the node inspection sheet on this geometry.
- Skeleton retirement vs keeping a cheap placeholder before the first
  snapshot.
- Motion (arrow draw, card fade) versus instant appear.
- What the poll shows if Chronology succeeds and Epiphanies or Arrange
  fails the mechanical gate.
- Mobile layout of long chains and dense fan-in.
- How How-it-works copy describes this surface.
- Exact snapshot payload (ids, text, edges) after ticket 01.

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
```

Further build tickets stay in fog until 04-06 close.

## Open frontier

- [Can the poll carry stage snapshots](issues/01-can-the-poll-carry-stage-snapshots.md)
  (research; resolved: keep-snapshots)
- [Which way is up on the etymology-style Tree](issues/02-which-way-is-up-on-the-etymology-style-tree.md)
  (grilling)
- [How a Dependence DAG becomes that flowchart](issues/03-how-a-dependence-dag-becomes-that-flowchart.md)
  (grilling)
