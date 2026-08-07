# Issue tracker

This repo uses the **local-markdown** issue tracker.

## Where issues live

- One feature directory per effort under `.scratch/<feature>/`.
- The map: `.scratch/<feature>/map.md` (label `wayfinder:map` equivalent).
- Tickets: `.scratch/<feature>/issues/<NN>-<slug>.md`, one file per ticket.
- Spec: `.scratch/<feature>/spec.md`.
- Research findings: `.scratch/<feature>/research/` or recorded as ticket
  answers.

## How issues are expressed

- Ticket file header: `# NN - Title`, `**Type:**`, `**Status:**`,
  `**Blocked by:**`, `**Related:**`, then `## Question`, `## What`,
  `## Acceptance criteria`, `## Docs rule`.
- Ticket types: research, prototype, grilling, task.
- Status values: ready-for-agent, claimed (<writer>, <date>), resolved,
  ready-for-human, needs-triage, wontfix.
- Blocking is expressed in the `**Blocked by:**` field and in the map's
  ticket-sequence block. A ticket is unblocked when every ticket it lists is
  resolved. The frontier is the lowest-numbered open, unblocked, unclaimed
  ticket.

## Claiming

Claim a ticket by setting `**Status:** claimed (<writer>, <date>)` before
starting work, so concurrent sessions skip it. Resolve by meeting the
acceptance criteria, committing and pushing, setting
`**Status:** resolved`, and adding a line to the map's Decisions so far.

## Writing tickets

Follow the wayfinder skill: a ticket is a question sized to one agent session,
with acceptance criteria and a docs rule. Never create a ticket without a
blocked-by field and a sequence position in the map.
