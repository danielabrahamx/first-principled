# First-Principled - Project Instructions

This repo builds **first-principled**, an AI tutor whose mission is to reduce
the cognitive distance between the learner's mental model and reality. The
learner types a word or phrase; the agent builds a Reality Map from the model's
knowledge, then a Socratic conversation refines the learner's Mental Model
against it. v1 is a static web app plus one stateless serverless function on
Netlify, no database. Local LLM is `LLM_PROVIDER=openrouter|deepseek`.
Prod stays OpenRouter.

## Read in this order

1. **`docs/STATUS.md`** - what is true right now. Single source of truth,
   enforced by `src/claims.test.js`. If it disagrees with the code, the
   code is right.
2. **`docs/FALSIFIED.md`** - what was tried and killed, and the
   measurement that killed it. **Read this before proposing any new
   architecture.** Nine versions, three architectures, all killed by
   decisions made without the evidence in front of the reader.
3. **`docs/DESIGN.md`** - the system: the abstraction stack, the LLM
   contract pattern, and where the seams are.
4. `.scratch/first-principled-v9/map.md` - the live effort and its
   frontier.
5. `docs/MISSION.md` - immutable. Never edit without a human decision.

If you read only one file, read `docs/STATUS.md`.

**Map (only):** `.scratch/first-principled-v9/map.md`
**Spec:** `.scratch/first-principled/spec.md`
**Immutable mission:** `docs/MISSION.md`

**Resume:** v9 is the live direction. The v7 three-stage funnel is
retired in principle (falsified by its own rule: Arrange preserved
Chronology as a flat list) and the v8 Chapel chrome, job/poll envelope,
transport, MMG, and layout are retained and battle-tested. The v9
pairwise generator ships as a spike under `src/lib/agent/pairwise/`
plus `scripts/gold-words.mjs`; nothing in the runtime imports it yet,
and prod still runs the v7 three-stage path.

**v9 status:** Tickets 01, 02, 03 and 04 are resolved. 01 and 02 are a
GO on `deepseek-flash`. 03 was research and changed no code; 04 applied
the thresholds 03 derived. Record:
`.scratch/first-principled-v9/research/01-spike-evidence.md`,
`03-generality-evidence.md`, `04-derived-threshold-application.md`.

**Read `docs/STATUS.md` "Known to be broken" before planning.** The
load-bearing items as of 2026-10-01, in order.

1. **The gate is fixed. Do not treat it as the problem.** All four
   hand-written gold maps pass it and `src/claims.test.js` asserts that on
   every run by walking the imported maps. `MIN_NODES` = 4,
   `MIN_TRUNK_NODES` = 3, `MAX_FANIN_PER_TRUNK_NODE` = 3, `TRUNK_MAX` = 8,
   all derived from `eval/map-quality/gold.js`. Reproduce the table with
   `node .scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs`,
   which is offline and needs no model call.
2. **Inversion is the open defect: 6 of 20 words, the largest failure
   mode.** The model answers the target's pairs by judging each
   *candidate* as resting on the *whole target*, part-of read as
   dependence, so the crown invariant correctly rejects the map.
   **Do not escalate the prompts for this.** Two escalations were measured
   on 2026-09-29 and reverted the same day, and ticket 03 measured 14
   attempts across 5 words and found the refusals never name the same
   bridge twice.
3. **Run-to-run variance is wider than any effect measured so far.** The
   gold set returned 0 of 4 twice on 2026-10-01, minutes apart, with
   different failure modes. The 20-word set went 1 of 20 to 2 of 20 across
   a real code change, which is inside that spread. **One run measures
   nothing.**
4. **A max fan-in floor is proposed and deliberately not applied.** Lowering
   `MIN_NODES` retired the node floor's second duty. The property that
   separates `battery` from a bare four-node chain is max fan-in, 2 to 3
   against 1, not node count. It needs a ticket of its own.

**Blocker (2026-09-29, resolved):** a dead local OpenRouter key was
replaced. `openrouter/free`, `stealth/space-bunny-alpha`,
`z-ai/glm-5.3-flash`, and the Jev Decisions API all return 200, though
`/api/v1/credits` reports a zero balance. The DeepSeek key is also live.
Generator route stays `deepseek-flash`: on `stealth/space-bunny-alpha`
the same code passes only 2 of 4 gold words and returns 2-node trees.

Next: ticket 05, the RealityMap adapter, and it is **not blocked**. It
assembles a generated selection into a `RealityMap` through the existing
r5 rung; the seam was never the obstacle. Read item 2 above first, because
the adapter inherits whatever the generator produces, including the 6 in
20 inverted maps. One ticket per session.

## Golden rules

- **Read `docs/FALSIFIED.md` before building.** If your idea resembles an
  entry there, argue with the evidence in that row or cite a measurement
  that has since changed. A new architecture is the default failure mode
  in this repo, not a reasonable exploration.
- **Act on what the code does, not what the docs claim.** This repo has
  shipped documentation that named a model the code had not used for
  several versions. `src/claims.test.js` now guards the load-bearing
  claims, but the habit still matters for anything not covered.
- Work the **frontier**: the lowest-numbered open ticket in the map's Open
  frontier with blockers resolved. One session resolves at most one ticket
  (research excepted).
- **Cite the evidence you are acting on.** Say which run, which file,
  which date. An uncited decision is the thing that killed v7.
- **Commit and push before done.** Never end a session with uncommitted work.
- **Never commit secrets:** `.env`, any `sk-*` key, Netlify tokens. `.env` is
  gitignored; the LLM key lives there.
- Single dashes only - never em-dashes or en-dashes. No emojis.
- Windows/PowerShell-tested before shipping. Done means working.
- Docs update in the SAME commit as the code they describe.
- A ticket is resolved when: acceptance criteria met, `Status: resolved` set on
  the issue file, a line added to the map's Decisions so far, and everything
  committed and pushed.

## The loop that works

```bash
npm test                        # 448 tests: the real safety net
npm run typecheck               # JSDoc types over src/
npm run lint                    # anti-slop
node scripts/gold-words.mjs     # the acceptance set; exit 1 on any failure
```

`scripts/gold-words.mjs` is the one command that answers "does the
generator still work". Run it after any change to the generator, the
coercion layer, the judge prompt, or the transport. It prints nodes,
edges, trunk length, coercions, and drops per gold word, and compares
against the recorded baseline.

When a stage fails, ask: **is this the frame or the content?** If the
content is sound, the fix is a coercion in code, never a prompt rewrite
and never a new architecture. See "The Contract pattern" in
`docs/DESIGN.md`.

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
  [05 - RealityMap adapter and generated-map gate](.scratch/first-principled-v9/map.md)
  (to be written), unblocked since ticket 04 applied the thresholds.
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
