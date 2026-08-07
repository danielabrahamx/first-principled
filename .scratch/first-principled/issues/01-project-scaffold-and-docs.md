# 01 - Project scaffold and docs

**Type:** task
**Status:** resolved (opencode, 2026-08-07)
**Blocked by:** none (start of the chain)
**Related:** `docs/MISSION.md`, `docs/agents/issue-tracker.md`, `README.md`, `AGENTS.md`

## Question

What is the skeleton every other ticket builds on?

## What

1. Repo layout: static frontend (`src/`) plus one serverless function
   (`api/agent` or Netlify `functions/agent`), `package.json` with a single
   install, `.env.example` with `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`,
   minimal `vercel.json` or `netlify.toml`.
2. `docs/MISSION.md`: the immutable mission, theory of learning, and 12 core
   principles from the spec (sections 1-3). Marked immutable; agent prompts
   reference it.
3. `docs/agents/issue-tracker.md`: local-markdown tracker config per the
   setup-matt-pocock-skills convention (issues live under `.scratch/`).
4. `README.md`: what the product is, layout, how to run locally, how to deploy.
5. `AGENTS.md`: already written by the orchestrator setup (2026-08-07, Danny
   confirmed AGENTS.md over CLAUDE.md). `docs/agents/issue-tracker.md` and
   `docs/agents/domain.md` also exist. Do not rewrite; only extend if a rule is
   missing.

## Acceptance criteria

- `npm install` runs clean on Windows.
- `docs/MISSION.md` matches spec sections 1-3 verbatim.
- Tracker config present and consistent with this map.
- README explains layout and local run.
- Everything committed and pushed before done.

## Docs rule

Commit and push before done. Update the map's Notes if layout changes.

## Resolution (2026-08-07)

Scaffold landed: `src/` static frontend (plain HTML/CSS/JS, no build step),
`netlify/functions/agent/agent.mjs` stub function, `netlify.toml` (publish
`src`, functions dir, `/api/agent` rewrite), `package.json` with zero deps
and `npm run dev` -> `netlify dev`, `.env.example` mirroring `.env` var names
(`LLM_API_KEY`, `LLM_MODEL=deepseek-chat`, `LLM_BASE_URL=https://api.deepseek.com`),
`docs/MISSION.md` (spec sections 1-3 verbatim, marked immutable), `README.md`.
`docs/agents/issue-tracker.md` and `AGENTS.md` already existed from setup;
verified consistent, not rewritten.

Verified on Windows: `npm install` clean (0 vulnerabilities), stub function
returns 200 with JSON, `netlify build --offline` packages the function and
completes.

Decision recorded for later tickets: v1 uses plain ES modules with zero npm
dependencies - no bundler, no framework; fetch is built into Node 18+.
