# first-principled

An AI tutor. The learner types a word or phrase (laptop, recursion,
photosynthesis). The agent builds a Reality Map of that thing from the model's
own knowledge. Home is the Tree of that map. A closed-by-default Tutor dock
is optional Q&A. Learner Mental Model tracking remains in the engine and is
parked from the UI.

Mission (immutable): **reduce the cognitive distance between the learner's
mental model and reality.** See `docs/MISSION.md`.

## Layout

- `src/` - static frontend (plain HTML/CSS/JS, no build step). Home is the
  Tree; Tutor is a closed-by-default dock.
- `src/lib/mmg/` - the shared Mental Model Graph schema (types, validators,
  closeness score, fixtures), imported by both the frontend and the function.
- `src/lib/agent/` - the agent engine: LLM transport (llm.js), defensive JSON
  parsing (jsonParse.js), reality map generation (realityMap.js, ticket 04),
  the Socratic engine with learner map updates (socratic.js, ticket 05), and
  the stateless phase orchestrator (orchestrator.js, ticket 06).
- `netlify/functions/agent/` - the one serverless function, `POST /api/agent`
  (rewritten from `/.netlify/functions/agent` by `netlify.toml`). Stateless:
  it receives the full session state with every call and stores nothing.
- `.scratch/first-principled/` - the build map (`map.md`), product spec
  (`spec.md`), and ticket files (`issues/`). See `docs/agents/issue-tracker.md`.
- `docs/MISSION.md` - immutable mission, theory of learning, 12 core principles.
- `AGENTS.md` - instructions for agent sessions working this repo.

## Run locally

Requirements: Node 18+, Netlify CLI (installed globally as
`$APPDATA/npm/netlify.cmd`).

1. `npm install` - installs the lockfile; the only dependencies are the
   dev-only type checker (typescript, @types/node) for `npm run typecheck`.
2. Copy `.env.example` to `.env` and fill in `LLM_API_KEY` (see
   `~/.local/share/opencode/auth.json` for the deepseek entry). `LLM_MODEL` and
   `LLM_BASE_URL` are pre-filled for DeepSeek.
3. `npm run dev` - serves `src/` at `http://localhost:8888` with the function
   available at `/api/agent`.

## Checks

- `npm test` - unit tests (built-in node:test runner).
- `npm run typecheck` - JSDoc type checking over `src/` (tsc --noEmit).

## Deploy

Live: **https://first-principled.netlify.app** (site id `1a5638ca-2cd1-418a-9110-4f4fbd092480`,
account danielftabraham@outlook.com, team danielabrahamx).

One-time setup: `netlify sites:create --name first-principled` (creates and
links the site), then set the platform secrets from `.env`:
`netlify env:set LLM_API_KEY <key>`, `netlify env:set LLM_MODEL <model>`,
`netlify env:set LLM_BASE_URL <base url>`. The key is a platform secret, never
client-side - the function reads it from the environment, and the published
`src/` bundle must never contain it.

Deploy: `netlify deploy --prod` publishes `src/` plus
`netlify/functions/` per `netlify.toml` (no build step). New env values
require a redeploy to take effect.

## Stack (v1)

Static frontend + one stateless serverless function, DeepSeek via the
OpenAI-compatible API, no database, no auth, no agent framework.
