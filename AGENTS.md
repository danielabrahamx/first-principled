# First-Principled - Project Instructions

This repo builds **first-principled**, an AI tutor whose mission is to reduce
the cognitive distance between the learner's mental model and reality. The
learner types a word or phrase; the agent builds a Reality Map from the model's
knowledge, then a Socratic conversation refines the learner's Mental Model
against it. v1 is a static web app plus one stateless serverless function on
Netlify, DeepSeek-backed, no database.

**Map (only):** `.scratch/first-principled-v4/map.md`
**Spec:** `.scratch/first-principled/spec.md`
**Immutable mission:** `docs/MISSION.md` (written by ticket 01)
**Resume:** `CONTEXT.md` section Frontier. Ticket 04 resolved. Ticket 05 is next.

## Golden rules

- Work the **frontier**: the lowest-numbered open ticket in the map's Open
  frontier with blockers resolved. One session resolves at most one ticket
  (research excepted).
- **Commit and push before done.** Never end a session with uncommitted work.
- **Never commit secrets:** `.env`, any `sk-*` key, Netlify tokens. `.env` is
  gitignored; the LLM key lives there and in
  `~/.local/share/opencode/auth.json` (deepseek entry).
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
- DeepSeek via OpenAI-compatible API. Env: `LLM_API_KEY`, `LLM_MODEL`,
  `LLM_BASE_URL` (from `.env`, gitignored).
- No DB, no auth, no agent framework (Mastra/LangGraph is v2).
- Home is the Tree. Tutor is a closed-by-default dock. There is no Chat page
  and no learner-map tab. Every dock turn is a briefing: the Tutor may quote
  the Reality Map because the learner asked. Init does not open with a probe.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/` (one feature dir,
one file per ticket). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

## Deploy

- Netlify CLI (authed as danielftabraham@outlook.com, team danielabrahamx):
  `"$APPDATA/npm/netlify.cmd"` in git-bash. Ticket 11 links the site and sets
  the env secrets.
