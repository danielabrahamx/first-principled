# STATUS - the one file that says what is true right now

Everything else in this repo is history. This file is current. If it
disagrees with the code, the code is right and this file is a bug:
fix this file in the same commit.

Last verified against the code: **2026-09-29**.

## What the system is

An AI tutor. The learner types a thing; the agent builds a Reality Map
of that thing; the Tree is the product surface; a Socratic conversation
probes the learner's model of it. One stateless serverless function,
one static frontend, no database.

Mission (immutable, `docs/MISSION.md`): reduce the cognitive distance
between the learner's mental model and reality.

## What is true right now

| Fact | Value | Source of truth |
| --- | --- | --- |
| Default OpenRouter model | `z-ai/glm-5.3-flash` | `src/lib/agent/llm.js` `OPENROUTER_DEFAULT_MODEL` |
| Default DeepSeek model | `deepseek-v4-flash` | `src/lib/agent/llm.js` `DEEPSEEK_DEFAULT_MODEL` |
| Generator route that passes | `deepseek-flash` | `.scratch/first-principled-v9/research/01-spike-evidence.md` |
| Frontier | v9 ticket 02, surface realization and honesty | `.scratch/first-principled-v9/map.md` |
| Gold words | laptop, battery, photosynthesis, recursion | `eval/map-quality/gold.js` |
| Gold result | **4 of 4 pass**, twice, as of 2026-09-29 | `01-spike-evidence.md` |
| Gold node count | **2 to 9**, uncontrolled | `01-spike-evidence.md` |
| Live generator in prod | v7 three-stage (`realityMap.js`) | `src/api/agent.js` |
| Checks | `npm test` (416), `npm run lint`, `npm run typecheck` | all green 2026-09-29 |

Three of those rows are enforced by a test
(`src/claims.test.js`). If you change the model in `llm.js` without
updating this file, `npm test` fails and tells you.

## The one-paragraph version of where we are

The v9 pairwise generator is the live direction and it **works**: four
of four gold words now produce a bounded, connected, acyclic dependence
tree with one target-to-foundation trunk. Before 2026-09-29 that was
zero of four. The fix was mechanical envelope coercion, not a better
model - see `01-spike-evidence.md`. It is **not** in prod. Prod still
runs the v7 three-stage generator, which is retained and battle-tested
but is known to produce list-shaped maps.

**But "pass" currently means much less than it sounds.** The same code
on the same route returned a 9-node, 15-edge, 8-node-trunk tree for
`photosynthesis` and a 2-node, 1-edge stub for `laptop` in the same
run. The acceptance set cannot currently tell those apart. The task
graph is settled; the size and shape of what it produces are not.

## The three findings that should drive every future decision

These are the load-bearing lessons. They are not style preferences; each
one cost a full architecture to learn.

### 1. The failure mode here is epistemic, not technical

Nine versions, three generator architectures, all killed. Not one was
killed by a bug. Every one was killed because the agent driving it did
not know what had already been tried and measured - so it built a new
architecture instead of reading the evidence file, which had already
identified the bottleneck and proposed the fix.

The v9 win came from *reading* `01-spike-evidence.md` and acting on what
it already said, not from a new idea.

**Consequence:** a new architecture is the default failure. Before
building one, read `docs/FALSIFIED.md` and the current evidence record.
Cite the evidence you are acting on.

### 2. The model's judgments were always good. The frames were broken.

Every recorded terminal failure across all routes and all gold words
was an *envelope* defect: a bare array, an echoed `type` field, a
keyed-object envelope, `SMALL` on a row where jump has no referent. The
underlying dependence relations were judged correctly, including
correct `NONE` calls and an unprompted `TOO_LARGE` that correctly named
a missing bridge.

The v9 discipline, and the thing to preserve:

- **Code owns the frame.** Envelope shape, ids, casing, `jump` where
  jump is undefined. Coerce it in code, never in a prompt.
- **The model owns the judgment.** Which relation, how confident, why.
  Code never infers, repairs, or second-guesses these.
- **Code validation stays authoritative** over whatever survives
  coercion. A coercion that starts rescuing *content* failures has
  crossed the line. (Tested: a genuinely absent required field is still
  terminal.)

**Consequence:** when a stage fails, ask "is this the frame or the
content?" If the content is sound, the fix is a coercion, not a
prompt rewrite and not a new architecture.

### 3. A gate that passes a degenerate output is worse than no gate

`selectTopology` returns `ok: true` for a two-node graph. `MAX_NODES` is
a cap; `TRUNK_MIN` only affects path *scoring*, never acceptance. So
the 2026-09-29 free-route run reported a "pass" for `laptop` that was
actually a 2-node, 1-edge tree - a false success that converted an
honest failure into a green check.

This is the same class of bug as the v7 funnel, which passed its own
gate while producing a flat list. Both times, the gate was fitted to
the failure it was meant to catch.

**Consequence:** a gate must reject the degenerate case by
construction, and the acceptance test must include a case that fails it.
`src/lib/agent/pairwise/topology.test.js` must gain a
"2-node graph is not a tree" test before ticket 02 is resolved.

## What is known to be broken or missing

Carried into ticket 02. All measured 2026-09-29.

- **The gate accepts degenerate trees.** `selectTopology` returns
  `ok: true` for a two-node graph. `MAX_NODES` is a cap; `TRUNK_MIN`
  only affects path *scoring*, never acceptance. A 2-node, 1-edge
  `laptop` and a 9-node, 15-edge `photosynthesis` both "pass" in the
  same run. This is the first thing ticket 02 must fix, and fixing it
  will make previously-green runs fail honestly, which is the point.
- **Output size is completely uncontrolled.** Across two full gold
  sets, node counts ranged 2 to 9 on the same code and route. Nothing
  in the system constrains it.
- **Run-to-run variance is real and large.** Two full sets, two
  different answers per word.
- **Trunks are short more often than not.** A trunk of 2 or 3 nodes
  against a `TRUNK_MIN` of 4 is the common case, not the exception.
- **Nothing is realized to learner-facing copy.** The generator emits
  ids, labels, glosses, and rationales. No human has walked one of
  these trees. Followability is entirely unmeasured, and it is the
  product.
- **18.5 MB of `.scratch/first-principled-v7/research/_sources/`** is
  scraped vendor HTML and plain text. Nothing imports it, no
  measurement depends on it, and it is 66 files of documentation the
  model does not need. Candidate for archival.

## The system is wired so the next change is cheap

Two deliberate properties, both worth preserving:

- **One transport file.** `llm.js` is the only file that knows a
  provider name or a model id. Testing "is the model the problem"
  across four words cost one afternoon, because of this.
- **Pure code below the LLM boundary.** `topology.js` makes no model
  call; `mmg/` has no I/O. Every rung of the stack is separately
  testable, which is why the 4/4 result is reproducible from a script.

`src/claims.test.js` extends that idea to the documentation: it asserts
that the entry docs agree with the code's actual constants, that the
frontier agrees with the issue statuses, and that every import in every
tracked file resolves. All four entry documents had drifted apart on the
default model while all 409 tests passed. That gate is the reason
drift cannot silently mislead the next session again.

## How to work in this repo

```bash
npm test                      # 409 tests, the real safety net
npm run typecheck             # JSDoc types over src/
npm run lint                  # anti-slop
node scripts/gold-words.mjs   # run the acceptance set, see the table
```

`scripts/gold-words.mjs` is the one command that answers "does the
generator still work". It runs the four gold words and prints nodes,
trunk, coercions, and drops per word, plus a pass line. Costs 20 model
calls. Use it after any change to the generator, the coercion layer, the
judge prompt, or the transport.

Read before you build: `docs/FALSIFIED.md`, then
`.scratch/first-principled-v9/map.md`, then
`.scratch/first-principled-v9/research/01-spike-evidence.md`.

## Where the pieces live

See `docs/DESIGN.md` for the module map and the abstraction stack.
Effort-local planning lives in `.scratch/first-principled-v9/`.
Historical effort directories (v1 through v8) are dead and are kept only
as the falsification record; nothing in them describes current state.
