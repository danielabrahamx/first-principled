# Architecture audit - first-principled

Date: 2026-08-25. Scope: whole repo. Method: read AGENTS.md, CONTEXT.md,
docs/MISSION.md; surveyed src/ and netlify/functions/; ran `node --test`
(369/369 pass, under 1s), `npm run lint` (1 failure, in a root probe
script, not source), `npm run typecheck` (clean). No source files modified.

## Question

Is this codebase worth fixing or should it be rebuilt?

## Inventory (source LOC, tests excluded)

| Area | Files | LOC | Role |
|---|---|---|---|
| src/lib/agent | 9 | 3,931 | three-stage pipeline, Socratic engine, transport |
| src/lib/mapview | 7 | 1,709 | Chapel geometry, history, observation, viewmodel |
| src/lib/mmg | 7 | 1,287 | types, validator, observation rules, fixtures |
| src/pages | 4 | 1,913 | map.js 1,576 + dock 241 + how 64 + chat 32 |
| src/state + src/api | 4 | 722 | session store, router, poll client |
| app.js / demo.js / turnstile.js / index.html | 4 | 463 | wiring, demo seed, captcha |
| styles.css | 1 | 2,125 | the shipped Chapel look |
| netlify functions | 2 (+tests) | ~455 | background job recorder + status poll |
| Total source | | ~12,500 JS+CSS | |

Tests: 6,771 lines, 369 tests, all green, sub-second. Every module has a
test file except thin wiring (app.js, demo.js, turnstile.js).

## Keep-list (solid)

- **src/lib/agent pipeline** (realityMap.js 1,040; arrange.js 638;
  socratic.js 694; orchestrator.js 645; llm.js 269; jsonParse.js;
  stageSnapshot.js). This is the product. Stages run once each, mechanical
  gates do use-or-drop accounting, JSON Schema constrains Epiphanies, the
  LLM transport handles both providers' reasoning quirks with 429 backoff.
  Every unit takes an injected `callLLM`, so the whole engine is testable
  without a key. This is the hardest-won code in the repo.
- **netlify/functions** (agent.mjs 355; agent-status.mjs 100). Thin,
  correct, and battle-scarred in the good way: never throws after the 202
  (a throw makes Netlify re-run the job and double-spend tokens), terminal
  records for every outcome, body cap then rate limit then Turnstile in
  order, fail-open store with fail-closed captcha. The Blobs `setJSON` vs
  `set` gotcha is documented at both ends of the pipe.
- **src/lib/mmg validator + types + observation**: the single shared data
  contract. Both the server gate and the client validate against it. One
  seam, no drift.
- **src/lib/mapview/tree.js + grow.js + layout.js**: pure DOM-free
  geometry for the Chapel flowchart, viewport-fit tested down to 320px.
  The locked card/arrow/hover contracts live here as constants and pure
  functions.
- **state/session.js + api/agent.js**: poll deadline, node history,
  snapshot application. Clean store-subscriber shape.
- **styles.css + pages/how.js + map.js active surfaces**: this is the
  shipped v8 chrome. Working on prod.

Coupling is clean everywhere it matters. Dependency direction is one-way:
pages -> mapview -> mmg types; functions -> agent engine -> mmg types.
map.js is the composition root and the only file that imports across
sides. No cycles found. The three named subsystems (agent builder, Chapel
UI, socratic turn engine) touch only through the orchestrator's request
envelope and the RealityMap type - exactly right.

## Kill-list (dead weight)

Verified by import graph, not vibes:

- **pages/chat.js (32) + chat.test.js (91)**: exists to keep its own test
  green. Zero production importers.
- **pages/dock.js (241)**: parked Tutor dock. Zero importers, zero tests.
  Pure dead file.
- **agent/gaps.js (236) + gaps.test.js (235)**: imported only by its test.
  Dead since Tutor left the chrome.
- **agent/confidence.js (164) + confidence.test.js (110)**: same fate.
- **Hidden chrome inside map.js**: timeline scrubber, title/closeness row,
  legend, learner grid scroll, comparison block, ended note - all built
  then `.hidden = true` forever. Roughly 250-350 lines of mounted-but-dead
  UI, dragging partially dead support modules: mapview/comparison.js (88,
  feeds only the hidden block), most of mapview/history.js (225), and
  mmg closeness/metrics via session.js.
- **state/router.js (121)**: vestigial - one route renders - but cheap and
  serves old-hash resolution. Borderline keep.
- **demo.js (305)**: ?demo=1 review path. Not product, but useful for
  keyless review. Borderline keep.

Total deletable today without touching prod behavior: about 900-1,100
lines including their tests. That is under 9% of the repo.

Test coverage quality: high where it counts. Contracts are tested, not
implementation trivia: gate acceptance/rejection, diff determinism,
layout fit at narrow widths, poll envelope collapse, copy vocabulary
(ste-copy.test.js enforces approved learner-facing words). Gaps are the
thin wiring files, acceptable.

## Rebuild cost estimate

A rebuild that preserves behavior must relearn, at minimum:

1. OpenRouter quirks: default model mandates reasoning; `reasoning:
   {effort:"none"}` returns HTTP 400, so maps omit the field entirely.
   DeepSeek writes JSON into reasoning_content when content is blank.
2. The Netlify background retry contract: any throw after 202 re-runs the
   generation and double-spends tokens; every path must write a terminal
   record instead.
3. Netlify Blobs: `set()` stores objects as "[object Object]"; setJSON or
   the poll silently breaks.
4. Turnstile fail-open vs fail-closed policy and ordering with rate limit.
5. The mechanical gate semantics: role-marked nodes, declared trunk,
   Dependence reasons, hidden provenance, complete use-or-drop accounting.
6. Chapel layout constraints: crown-at-bottom, because-on-shaft, 320px
   fit, fan-in spine, grow-in-place snapshots.
7. The locked card/arrow/hover and poll snapshot contracts from v8.

Items 1-3 each cost a failed deploy to rediscover. Realistic cost to reach
parity: 3-5 focused sessions for the pipeline + function + layout port,
plus re-running Danny's HITL followability scoring, because regenerated
prompts and gates will drift behavior even with copied code. Savings from
the rebuild: deleting ~1,000 dead lines you can delete anyway in an
afternoon, plus whatever map.js decomposition you would do regardless.

## Verdict

Fix, do not rebuild. The core value - the three-stage pipeline, its
gates, the transport, and the two function wrappers - is ~4,400 lines of
well-tested, correctly decoupled code encoding expensive platform
knowledge that no rewrite gets to skip. The debt is not architectural:
it is one fat composition root (map.js, 1,576 lines) carrying parked
chrome, plus four fully dead modules kept alive by their own tests. A
single deletion pass removes ~1,000 lines with zero prod risk, and a
follow-up pass can split map.js into build/tree/how sections along seams
that already exist. Rebuilding spends weeks to re-buy knowledge already
paid for, to delete weight that costs nothing while parked.

Recommended order, if acted on:

1. Deletion PR: chat.js, dock.js, gaps.js, confidence.js, hidden blocks
   in map.js, comparison.js if the cmp block goes too. Tests updated in
   the same commit.
2. map.js decomposition: extract skeleton, generation flow, and Chapel
   render into modules behind the existing pure-function seams.
3. Leave router.js and demo.js until a ticket needs them gone.

One lint failure noted for the fixer: `.probe-latency.mjs:34` fails the
anti-slop rule (conditional empty-object spread). Root probe script, not
source.
