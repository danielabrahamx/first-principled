# First-Principled - Project Instructions

This repo builds **first-principled**, an AI tutor whose mission is to reduce
the cognitive distance between the learner's mental model and reality. The
learner types a word or phrase; the agent builds a Reality Map from the model's
knowledge, then a Socratic conversation refines the learner's Mental Model
against it. v1 is a static web app plus one stateless serverless function on
Netlify, no database. Local LLM is `LLM_PROVIDER=openrouter|deepseek`.
Prod stays OpenRouter.

**Map (only):** `.scratch/first-principled-v9/map.md`
**Spec:** `.scratch/first-principled/spec.md`
**Immutable mission:** `docs/MISSION.md` (written by ticket 01)
**Resume:** v9 is the live direction. The v7 three-stage funnel is
retired in principle (falsified by its own rule: Arrange preserved
Chronology as a flat list) and the v8 Chapel chrome, job/poll envelope,
transport, MMG, and layout are retained and battle-tested. The v9
pairwise generator ships as a spike under `src/lib/agent/pairwise/`
plus `scripts/pairwise-spike.mjs`; nothing in the runtime imports it
yet, and prod still runs the v7 three-stage path.

**v9 status:** Ticket 01 is resolved and it is a GO. All four gold
words (laptop, battery, photosynthesis, recursion) pass on
`deepseek-flash`, one predeclared attempt each, 5 calls per word. Before
the 2026-09-29 envelope coercion, 0 of 4 passed. Record:
`.scratch/first-principled-v9/research/01-spike-evidence.md`.

**Blocker (2026-09-29, resolved):** a dead local OpenRouter key was
replaced. `openrouter/free`, `stealth/space-bunny-alpha`,
`z-ai/glm-5.3-flash`, and the Jev Decisions API all return 200, though
`/api/v1/credits` reports a zero balance. The DeepSeek key is also live.
Generator route stays `deepseek-flash`: on `stealth/space-bunny-alpha`
the same code passes only 2 of 4 gold words and returns 2-node trees.

Next: write and work Ticket 02, surface realization and honesty. Known
carry-in, all three from the 2026-09-29 runs: trunks came back 3-4 nodes
against `TRUNK_MIN` 4 and two words returned only 4 nodes, so the tree
may be too small to be a rabbit hole; `selectTopology` returns `ok: true`
for a 2-node graph, which is a gate bug and the first thing to fix; and
run-to-run variance is real. Do not ship the throwaway prototype. One
ticket per session.

## Golden rules

- Work the **frontier**: the lowest-numbered open ticket in the map's Open
  frontier with blockers resolved. One session resolves at most one ticket
  (research excepted).
- **Commit and push before done.** Never end a session with uncommitted work.
- **Never commit secrets:** `.env`, any `sk-*` key, Netlify tokens. `.env` is
  gitignored; the LLM key lives there.
- Single dashes only - never em-dashes or en-dashes. No emojis.
- Windows/PowerShell-tested before shipping. Done means working.
- Docs update in the SAME commit as the code they describe.
- A ticket is resolved when: acceptance criteria met, `Status: resolved` set on
  the issue file, a line added to the map's Decisions so far, and everything
  committed and pushed.

## Stack (v1, do not drift)

- Static frontend (`src/`) + one stateless serverless function
  (`netlify/functions/agent`), `POST /api/agent` per the spec turn contract.
- Client holds session state in memory; the function stores nothing.
- OpenAI-compatible LLM via `LLM_PROVIDER=openrouter|deepseek` (default
  openrouter uses `LLM_*`; deepseek uses `DEEPSEEK_*`). Default OpenRouter
  model: `z-ai/glm-5.3-flash` at `https://openrouter.ai/api/v1` (set in
  `llm.js`; the older `stealth/ox-alpha` references in the v6/v7 research
  notes are historical). Prod stays OpenRouter. JSON maps send
  `thinking: false`, which on OpenRouter omits the `reasoning` field
  (the default model mandates reasoning; effort none returns HTTP 400;
  DeepSeek keeps `thinking` type disabled). Epiphanies sends JSON
  Schema. Jev (`typesafe/jev-1.13`) is reachable but measured and
  rejected for pair judgment: 1 of 3 real pairs correct, no rationale.
  The next
  HITL ticket is
  [02 - Surface realization and honesty](.scratch/first-principled-v9/issues/02-surface-realization-and-honesty.md)
  (to be written).
- No DB, no auth, no agent framework (Mastra/LangGraph is v2).
- Home is the Tree. v6 parks Tutor from the chrome (engine stays). There
  is no Chat page and no learner-map tab. How it works lives in the header.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/` (one feature dir,
one file per ticket). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

## Deploy

- Netlify CLI (authed as danielftabraham@outlook.com, team danielabrahamx):
  `"$APPDATA/npm/netlify.cmd"` in git-bash. Site is linked. Ticket 08
  rotated `LLM_*` to OpenRouter. `netlify deploy --prod` publishes `src/`
  plus `netlify/functions/`.
