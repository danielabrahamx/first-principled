# 01 - Can the poll carry stage snapshots

Resolved 2026-08-23. Primary sources: Netlify docs (fetched and indexed
this session) and this repo. No `src/` changes. No secrets.

## Recommendation (later tickets: copy this, do not re-research)

**Keep-snapshots.** The existing background init job can publish a
learner-safe snapshot after Chronology and after Epiphanies on the same
Blobs key the client already polls. Do not add token SSE. Do not treat a
snapshot as success. Do not throw after the 202.

Ticket 05 can assume grow-in-place over poll snapshots. SSE stays out.

### Poll JSON a later task can copy

Blob store: `agent-jobs` (same as today). Key: `job:<jobId>`.
Write with `setJSON` and `{ expires: JOB_TTL_SECONDS }` (30 min TTL,
same as `netlify/functions/agent/agent.mjs`).

Non-terminal blob (overwrite after each accepted stage):

```json
{
  "status": "running",
  "stage": "chronology",
  "snapshot": {
    "concept": "<word>",
    "chronology": []
  }
}
```

After accepted Epiphanies, same shape with `"stage": "epiphanies"` and
snapshot `{ "concept", "chronology", "epiphanies" }`.

`GET /api/agent-status?job=` must forward that object as HTTP 200 JSON.
Today it collapses any non-success, non-error record to
`{ "status": "running" }` with no extra fields
(`netlify/functions/agent-status/agent-status.mjs` unrecognized-shape
branch). A later task must add an explicit `status === "running"` arm
that returns `{ status, stage, snapshot }` and still omits hidden
fields. Missing blob stays `{ "status": "running" }` with no snapshot
(today's "not started / not yet written" signal).

Terminal records stay exactly as now:

- success blob: `{ "status": "success", "httpStatus": 200, "body": <init envelope> }`
- status GET: `{ "status": "success", "body": <init envelope> }`
- error blob: `{ "status": "error", "code", "message" }`
- status GET: `{ "status": "error", "code", "message" }`

Client `pollForJob` (`src/api/agent.js`): `status === "running"` already
continues and ignores extra keys. `status === "success"` is terminal.
A later UI task may read `stage` and `snapshot` while looping. It must
not stop the poll on a snapshot. Do not invent a fourth status string
(`"snapshot"`): today's client treats unknown 200 JSON as `internal`.

### Retry constraint a later task can copy

Netlify: after the empty 202, the function runs until it finishes or
hits the 15 minute background limit. If the invocation **returns an
error**, Netlify retries after one minute, then after two more minutes.
Background functions do not stream a response.
Sources:
https://docs.netlify.com/build/functions/background-functions/
https://docs.netlify.com/build/functions/background-functions.md
https://docs.netlify.com/build/functions/optional-configuration.md
(default values: background execution limit 15 minutes, not
configurable; background request/response payload 256 KB, which is the
function HTTP envelope, not Blobs).

This repo already encodes that as never-throw-after-202
(`netlify/functions/agent/agent.mjs` header and `writeTerminal`).

Copy these rules:

1. Snapshot `setJSON` uses the same never-throw wrapper as
   `writeTerminal`. A failed snapshot write logs and continues. It must
   not throw.
2. `status` on the blob stays `"running"` until the existing terminal
   success or error write. Never write `"success"` after Chronology or
   Epiphanies.
3. `setJSON` overwrites the same key. That is documented Blobs behavior
   (https://docs.netlify.com/build/data-and-storage/netlify-blobs.md).
   Do not use `onlyIfNew` for snapshots (a retry or second stage write
   would no-op).
4. Snapshots do not make retries idempotent. If the platform retries,
   the whole generation runs again and overwrites the blob. Prevention
   is still: never throw after 202; catch stage failures into a
   terminal error record, as today.
5. Optional later hardening (not required to ship snapshots): on
   handler entry, if `job:<id>` is already `success` or `error`, return
   204 without calling the LLM. Do not no-op on `running` unless you
   also resume from a persisted stage (out of scope).
6. Default Blobs consistency is eventual: **creates** are globally
   visible immediately; **updates** propagate within 60 seconds
   (https://docs.netlify.com/build/data-and-storage/netlify-blobs.md
   Consistency). The Chronology snapshot is a create (no record today
   until terminal). The Epiphanies snapshot and the terminal success
   write are updates. `agent-status` should `getStore({ name:
   "agent-jobs", consistency: "strong" })` (or per-get
   `consistency: "strong"`) so pollers see overwrites inside the 2 s
   poll, not after up to 60 s. Strong reads are documented as slower;
   that is acceptable for a status GET.

Blobs object size limit is 1 GB (same Blobs page, Requirements and
limitations). Stage JSON is nowhere near that. Do not put snapshots on
the background function HTTP response (256 KB cap; the 202 body is
empty and discarded).

## 1. Platform: mid-flight Blobs writes

**Yes.** Background functions have no client-visible result channel.
Docs: the client gets an empty 202 immediately; you pass the result to
some other destination; background functions do not support response
streaming because they do not return responses.

This repo's destination is already Netlify Blobs `agent-jobs` /
`job:<jobId>`, polled by the sibling **synchronous** function
`netlify/functions/agent-status`. `setJSON` may be called any time
during the invocation. Nothing in the Blobs API requires the function
to have finished. Overwrite of an existing key is explicit in
`setJSON`.

If the function throws after a snapshot write, Netlify treats that as
an invocation error and retries the **whole** job (1 min, then 2 min).
The in-flight snapshot does not cancel that retry. That is why
`writeTerminal` swallows store errors and the outer catch writes a
terminal record instead of throwing.

`netlify.toml` `functions = "netlify/functions"` and
`[functions.agent] background = true`, plus `export const config =
{ background: true }` in `agent.mjs`. Canonical dir is
`netlify/functions`, not another functions folder.

## 2. Current poll

`agent-status`: missing record -> `{ status: "running" }` with no body.
Unrecognized blob shape (including a future `{ status: "running",
stage, snapshot }` until the status function is taught to forward it)
-> the same stripped `{ status: "running" }`. Success is terminal.
Error is terminal.

`src/api/agent.js` `pollForJob`: success with `body` stops as ok;
success without `body` is `internal`; error stops as failure; running
continues; any other 200 JSON is `internal`. Deadline default 840000 ms.

So: snapshots are possible on the blob **now** from the writer's side,
but they are **invisible to the client until `agent-status` forwards
`running` records**. The client loop does not need a new terminal
status.

## 3. Learner-safe vs hidden

Gate: only **accepted** stage JSON (passed `chronologyProblems` /
`epiphaniesProblems`). Invalid stage output is not a snapshot; it
follows today's terminal error path.

`generateRealityMap` already keeps `diagnostics` (chronology,
epiphanies, provenance, discardedInputIds, prompts) off the init HTTP
body. `handleInit` returns only `realityMap` in the success envelope
(`src/lib/agent/orchestrator.js`). Snapshots must keep that boundary.

### After accepted Chronology (`stage: "chronology"`)

**Learner-safe (on the wire):** `concept`; each chronology item
`id`, `regime`, `new_capability`, `enabled_by_previous`,
`ancestry_kind`, `target_relevance` (the Stage 1 contract in
`src/lib/agent/realityMap.js`).

**Hidden:** system/user prompts; raw model payload;
`reasoning_content` / `reasoning` / `reasoning_details`;
`diagnostics`; anything not in the chronology item contract.

### After accepted Epiphanies (`stage: "epiphanies"`)

**Learner-safe:** the Chronology snapshot plus each epiphany
`id`, `from_regimes`, `to_regimes`, `result`, `joint_kind`,
`candidate_node`, and `history` (`certainty`, `who`, `when`,
`observation`, `uncertainty_note`). These are the Stage 2 product
fields the wait-state can grow. `candidate_node` is a provisional
label, not provenance.

**Hidden:** same as stage 1, plus Arrange inventory shuffle,
edge-set drafts, and any discarded-id lists.

### After checked Arrange (terminal success, not a snapshot)

**Learner-safe:** today's init `body.realityMap` (layers, role-marked
nodes, Dependence edges, declared trunk, Epiphany observation records
on EPIPHANY nodes). That write is still `{ status: "success", ... }`.

**Hidden (never on the poll, never on success body):** `provenance`,
`discarded_input_ids` / `discardedInputIds`, prompts, raw LLM,
reasoning fields, `diagnostics`, rejected Arrange payloads.

CONTEXT.md: provenance is the hidden diagnostic trace and never
learner copy. v8 wait-state may show **stage products**, not Stage
machinery, prompts, or CoT.

## 4. Why not forbid-snapshots

Blobs mid-flight overwrite is a supported key/value write, not a
streaming protocol. The retry hazard is the existing throw-after-202
contract, not snapshots themselves. Forbidding snapshots would force
ticket 05 onto "skeleton until the checked map" or SSE, which
background functions cannot provide.
