# 01 - Can the poll carry stage snapshots

**Type:** research

**Status:** resolved

**Blocked by:** none

**Related:** [How stage products grow in place when Arrange reorders](05-how-stage-products-grow-in-place-when-arrange-reorders.md)

## Question

Can the existing Netlify background init job publish a learner-safe
snapshot after Chronology and after Epiphanies on the same Blobs record
the client already polls at `GET /api/agent-status?job=`, without
token streaming, without treating a snapshot as success, and without
triggering a background retry that double-spends LLM calls?

## What

AFK research against primary sources and this repo. Do not change
`src/` production behavior in this ticket.

1. **Platform.** Netlify background functions and Blobs: can the running
   invocation `setJSON` a non-terminal record while still in flight? What
   happens if the function throws after a snapshot write? Cite official
   docs plus the agent function under `netlify.toml`'s `functions`
   directory (retry contract: throw after 202 re-runs the whole job).
2. **Current poll.** The sibling status function and
   `src/api/agent.js` `pollForJob`: today, missing record and unrecognized
   shapes are `running` with **no body**. Success is terminal. What
   minimal status shape would carry a snapshot while staying `running`?
3. **Learner boundary.** Snapshots must not leak hidden provenance,
   discarded ids, raw prompts, or `reasoning_content`. Name what is safe
   to put on the wire after stage 1 vs stage 2 vs checked Arrange.
4. **Recommendation.** Keep poll + snapshots, or declare snapshots
   impossible on this stack (then ticket 05 and the map Notes must
   revisit SSE). Be specific enough that a later task can implement
   without re-researching Blobs or retry.

Findings go in
`.scratch/first-principled-v8/research/01-stage-snapshots-on-the-poll.md`.

## Answer

**Keep-snapshots.** Mid-flight `setJSON` on `agent-jobs` / `job:<id>` is
a supported Blobs overwrite while the background invocation is still
running. Keep `status: "running"` (plus `stage` and a learner-safe
`snapshot`) until the existing terminal success or error write. Never
throw after the 202 (retry is still +1 min then +2 min and re-runs the
whole job). Teach `agent-status` to forward `running` records; today it
strips them. Findings:
[01-stage-snapshots-on-the-poll.md](../research/01-stage-snapshots-on-the-poll.md).

## Acceptance criteria

- [x] Findings file exists; every platform claim cites official Netlify
      docs or this repo's function code
- [x] Recommendation is keep-snapshots or forbid-snapshots, with the
      poll JSON shape and retry constraint a later task can copy
- [x] Learner-safe vs hidden fields are named
- [x] No secrets in the findings file
- [x] Ticket status resolved and a line on the map's Decisions so far

## Docs rule

Pointer from this ticket and the map. Do not rewrite the spec or
`CONTEXT.md` until a later implementation ticket ships the snapshot
contract.
