# first-principled

An AI tutor. The learner types a word or phrase (laptop, recursion,
photosynthesis). The agent builds a Reality Map of that thing from the model's
own knowledge. Home is the Tree of that map. How it works lives in the header.
Tutor is parked from the chrome. Learner Mental Model tracking remains in the
engine and is parked from the UI.

Mission (immutable): **reduce the cognitive distance between the learner's
mental model and reality.** See `docs/MISSION.md`.

## Layout

- `src/` - static frontend (plain HTML/CSS/JS, no build step). Home is the
  Tree. How it works is a header control plus `#how`. Tutor is parked from
  chrome.
- `src/lib/mmg/` - the shared Mental Model Graph schema (types, validators,
  closeness score, fixtures), imported by both the frontend and the function.
- `src/lib/agent/` - the agent engine: LLM transport (llm.js), defensive JSON
  parsing (jsonParse.js), reality map generation (realityMap.js, ticket 04),
  the Socratic engine with learner map updates (socratic.js, ticket 05), and
  the stateless phase orchestrator (orchestrator.js, ticket 06).
- `netlify/functions/agent/` - the one serverless function, `POST /api/agent`
  (rewritten from `/.netlify/functions/agent` by `netlify.toml`). Stateless:
  it receives the full session state with every call and stores nothing.
- `.scratch/first-principled/` - v1 product spec (`spec.md`). Current
  effort map: `.scratch/first-principled-v7/map.md`. See
  `docs/agents/issue-tracker.md`.
- `docs/MISSION.md` - immutable mission, theory of learning, 12 core principles.
- `AGENTS.md` - instructions for agent sessions working this repo.

## Run locally

Requirements: Node 18+, Netlify CLI (installed globally as
`$APPDATA/npm/netlify.cmd`). `npm run lint` needs Node 22.14+ so oxlint
can load the vendored TypeScript anti-slop plugin.

1. `npm install` - installs the lockfile. Dev tools are the JSDoc type
   checker (`npm run typecheck`) and oxlint plus `@oxlint/plugins`
   (`npm run lint`). The runtime dependency is `@netlify/blobs`.
2. Copy `.env.example` to `.env` and fill the key for the provider you
   want. Switch with `LLM_PROVIDER=openrouter` or `LLM_PROVIDER=deepseek`
   in `.env`, then restart `npm run dev`. Prod stays OpenRouter. JSON
   maps turn thinking off per provider (OpenRouter `reasoning` effort
   none; DeepSeek `thinking` type disabled).
3. `npm run dev` - serves `src/` at `http://localhost:8888` with the function
   available at `/api/agent`.

## Checks

- `npm test` - unit tests (built-in node:test runner).
- `npm run lint` - vendored anti-slop via oxlint (`oxlint.config.js`).
- `npm run typecheck` - JSDoc type checking over `src/` (tsc --noEmit).
- `npm run eval:map-quality` - Reality Map quality gate on the gold maps
  (no API key). Live maps follow `LLM_PROVIDER`:
  `node --env-file=.env eval/map-quality/run.js --live`.
  Followability scoring persists full maps with `--maps-dir` and a
  separate `--baseline` so the ticket 07 file is not overwritten.

## Deploy

Live: **https://first-principled.netlify.app** (site id `1a5638ca-2cd1-418a-9110-4f4fbd092480`,
account danielftabraham@outlook.com, team danielabrahamx).

One-time setup: `netlify sites:create --name first-principled` (creates and
links the site), then set the OpenRouter platform secrets from `.env`:
`netlify env:set LLM_API_KEY <key>`, `netlify env:set LLM_MODEL <model>`,
`netlify env:set LLM_BASE_URL <base url>`. Local switching is
`LLM_PROVIDER` in `.env`. Do not set Netlify `LLM_PROVIDER=deepseek`.
The key is a platform secret, never client-side - the function reads it
from the environment, and the published `src/` bundle must never contain it.

Deploy: `netlify deploy --prod` publishes `src/` plus
`netlify/functions/` per `netlify.toml` (no build step). New env values
require a redeploy to take effect. v6 rotated `LLM_*` to OpenRouter
Nemotron `:free` (deploy `6a821d5637d95139bd35956f`).

## Stack (v1)

Static frontend + one stateless serverless function, OpenAI-compatible
LLM via `LLM_PROVIDER=openrouter|deepseek`, no database, no auth, no
agent framework. Prod stays OpenRouter.
