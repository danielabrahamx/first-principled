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

**v9 status:** Ticket 01 (pairwise falsification spike) is the open
frontier. Modules, 25 unit tests, and the diagnostic CLI are built and
green. Live evidence is partial: 0 of 4 gold words have a
target-to-foundation path, 1 failed honestly at pair validation, 1 was
blocked on credits, 2 unattempted. Record:
`.scratch/first-principled-v9/research/01-spike-evidence.md`.

**Blocker (2026-09-29):** the local OpenRouter key is dead. Every
OpenRouter endpoint returns HTTP 401 `User not found`, including
`/api/v1/credits`, `openrouter/free`, and the Decisions API. The
DeepSeek key is live and is currently the only working route. Replace
the key before any run that needs OpenRouter, `space-bunny-free`, or
Jev.

Next: run the four gold words on
[01 - Pairwise falsification spike](.scratch/first-principled-v9/issues/01-pairwise-falsification-spike.md)
and take a real Go/Kill. Do not start Ticket 02 until the first
attempts for the remaining three gold words are recorded. Do not ship
the throwaway prototype. One ticket per session.

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
  Schema. The next
  HITL ticket is
  [01 - Pairwise falsification spike](.scratch/first-principled-v9/issues/01-pairwise-falsification-spike.md).
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
