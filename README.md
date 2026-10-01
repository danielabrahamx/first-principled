# first-principled

> **Start at `docs/STATUS.md`.** It is the single source of current
> truth and it is enforced by `src/claims.test.js`. `docs/DESIGN.md`
> explains the system, `docs/FALSIFIED.md` records what was killed and
> why.

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
  Pure: no LLM, no I/O. This is layer r0 in `docs/DESIGN.md`.
- `src/lib/agent/` - the agent engine: LLM transport (`llm.js`, the only
  file that knows a provider exists), defensive JSON parsing
  (`jsonParse.js`), reality map generation (`realityMap.js`, the v7
  three-stage path still in prod), the Socratic engine (`socratic.js`),
  deterministic gap selection (`gaps.js`), and the stateless phase
  orchestrator (`orchestrator.js`).
- `src/lib/agent/pairwise/` - the v9 pairwise generator (inventory, pairs,
  judgments, topology, realize). The live direction, not yet wired into the
  runtime; prod still runs the v7 three-stage path. `topology.js` makes no
  model call by design. Its acceptance thresholds are derived from the
  hand-written gold maps in `eval/map-quality/gold.js` (`MIN_NODES` = 4,
  `MIN_TRUNK_NODES` = 3, `MAX_FANIN_PER_TRUNK_NODE` = 3, `TRUNK_MAX` = 8)
  and all four of those maps pass the gate, asserted by
  `src/claims.test.js`. Read `docs/STATUS.md` finding 3 before changing
  any of them.
- `netlify/functions/agent/` - the one serverless function, `POST /api/agent`
  (rewritten from `/.netlify/functions/agent` by `netlify.toml`). Stateless:
  it receives the full session state with every call and stores nothing.
- `docs/` - `STATUS.md` (current truth), `DESIGN.md` (the system),
  `FALSIFIED.md` (killed approaches), `MISSION.md` (immutable).
- `.scratch/first-principled-v9/` - the current effort: map, issues, and
  the evidence record. `.scratch/first-principled-v*/` for v1-v8 is
  closed history. See `docs/agents/issue-tracker.md`.

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
   maps pass `thinking: false`; the OpenRouter default model mandates
   reasoning so the field is omitted there, DeepSeek sends `thinking`
   type disabled.
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
- `node scripts/gold-words.mjs` - the one command that answers "does the
  v9 generator still work". Live, needs a key in `.env`. Add `--dump` for
  inventories, edge graphs, target refusals and realized copy, or
  `--words a,b,c` to run any other set. It is a different harness from
  `npm test`: it calls the model and it is allowed to fail.

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
require a redeploy to take effect. The historical prod model was
`nvidia/nemotron-3-ultra-550b-a55b`; the default in `llm.js` is now
`z-ai/glm-5.3-flash`. Check `docs/STATUS.md` for the current route
before assuming anything about prod.

## Stack (v1)

Static frontend + one stateless serverless function, OpenAI-compatible
LLM via `LLM_PROVIDER=openrouter|deepseek`, no database, no auth, no
agent framework. Prod stays OpenRouter.
