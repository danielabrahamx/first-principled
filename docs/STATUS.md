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
| Frontier | v9 ticket 03, blocked on generator variance | `.scratch/first-principled-v9/map.md` |
| Gold words | laptop, battery, photosynthesis, recursion | `eval/map-quality/gold.js` |
| Gold result under the honest gate | **1 to 2 of 4 pass**, across four runs 2026-09-29 | `02-realization-evidence.md` |
| Gold node count | **4 to 9**, still uncontrolled, now under a real gate | `02-realization-evidence.md` |
| Realization | ships, not in prod | `src/lib/agent/pairwise/realize.js` |
| Live generator in prod | v7 three-stage (`realityMap.js`) | `src/api/agent.js` |
| Checks | `npm test` (443), `npm run lint`, `npm run typecheck` | all green 2026-09-29 |

Three of those rows are enforced by a test
(`src/claims.test.js`). If you change the model in `llm.js` without
updating this file, `npm test` fails and tells you.

## The one-paragraph version of where we are

The v9 pairwise generator is the live direction. It has an inventory
call, 55 local pair judgments, pure-code topology selection, and now a
realization call that writes learner-facing copy for a shape code has
already chosen. **The gate was broken and is now fixed**: it used to
report a 2-node, 1-edge stub as a pass, so the recorded 4 of 4 was
partly measuring nothing. With `MIN_TRUNK_NODES`, `MIN_NODES`, and a
crown invariant enforced, the honest rate is **1 to 2 of 4**. The
previous number was the bug, not a regression.

None of it is in prod. Prod still runs the v7 three-stage generator,
retained and battle-tested but known to produce list-shaped maps.

**What is fixed and what is not.** The cause of the short trunks was the
inventory, identified by reading the candidate labels: the prompt asked
for concepts "directly" necessary to the target and got ten parts of a
laptop, all at one level. That prompt is fixed. What is not fixed is
run-to-run variance, and it is now visible per run instead of hidden
behind a green check. Ticket 03 is blocked on it. The next thing to
measure is judgment sparsity, not the next thing to build.

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

**This one is now fixed, and the fix lowered the score.** That is the
shape of the lesson, so it is worth reading twice.

`selectTopology` returned `ok: true` for a two-node graph. `MAX_NODES`
was a cap and `TRUNK_MIN` only affected path *scoring*, never
acceptance. So the 2026-09-29 free-route run reported a "pass" for
`laptop` that was actually a 2-node, 1-edge tree.

Ticket 02 replaced the preferences with three acceptance rules, all
exported from `topology.js` and all enforced: `MIN_TRUNK_NODES` is 4
and is applied *before* trunk scoring, `MIN_NODES` is 5 on the published
tree, and a crown invariant rejects any selected edge resting on the
target. `MAX_NODES` stays a cap at 10 and was not changed. The honest
gold rate went from a recorded 4 of 4 to **1 to 2 of 4**.

The tempting move at that point is to relax a threshold until the
number recovers. That is precisely the v7 failure: the gate gets fitted
to the failure it was meant to catch.

**Correction, 2026-09-29: the gate was partly fitted anyway.** Measured
against `eval/map-quality/gold.js`, the hand-written maps that define a
good Dependence Tree: `recursion` at 4 nodes fails `MIN_NODES` = 5, and
`battery` at 4 nodes with a depth-2 trunk fails `MIN_TRUNK_NODES` = 4.
Two of the four maps a human wrote on purpose are rejected by the gate
written to judge them.

`MIN_TRUNK_NODES` = 4 has lineage; it was ticket 01's `TRUNK_MIN`.
`MIN_NODES` = 5 and the crown invariant are ticket 02 additions, and
the only recorded justification for the node floor was that the gold
runs were failing. An earlier version of this file claimed all three
"came from the product rather than from the score". For `MIN_NODES`
that was false.

**Consequence:** a gate must reject the degenerate case by
construction, and the acceptance test must include a case that fails
it. `topology.test.js` now carries "a 2-node graph is not a tree", "a
trunk shorter than the minimum is rejected, with its length named", and
"nothing may rest on the target: the crown invariant". But a gate that
rejects the target definition is also wrong, and the thresholds are
disputed until ticket 03 re-derives them from the hand-written maps
rather than from the acceptance runs.

## What is known to be broken or missing

Carried into ticket 03. All measured 2026-09-29, recorded in
`02-realization-evidence.md`.

- **The gate accepts degenerate trees.** FIXED in ticket 02, but the
  fix is **disputed**. `MIN_TRUNK_NODES`, `MIN_NODES`, and the crown
  invariant are acceptance rules now, each with a test named for the
  defect it replaced. Two of the four hand-written gold maps fail them.
  See finding 3 above.
- **The gold four may not be the product.** They are four physical and
  computational mechanisms. Run against four unseen words on
  2026-09-29, the generator produced a good tree for `sourdough` and
  failed `monarchy`, `supply chain`, and `memory allocation`, the latter
  two both with zero accepted prerequisites for the target. The pipeline
  is verifiably not fitted to the four words (checked by execution, see
  `.scratch/first-principled-v9/map.md`). Whether the *failures* cluster
  by category is unmeasured and is ticket 03's first question. If they
  do, the tutor has an unwritten domain boundary and that is a product
  decision, not a generator bug.
- **The generator does not reliably clear the real gate.** The honest
  rate is 1 to 2 of 4 across four runs on identical code and route, and
  node count on a given word swings 4 to 9. The gate is correct, so this
  is a generator-quality gap. **This blocks ticket 03.**
- **The inventory is often one level deep.** The 2026-09-29 laptop run
  returned ten parts of a laptop, all peers of the target. The prompt
  asked for concepts "directly" necessary to the target and got
  exactly that. Fixed in the prompt. Two escalations of that demand
  were measured and reverted the same day, because a more demanding
  inventory made the judgment stage refuse more pairs rather than reach
  deeper. Do not retry them without new evidence.
- **Judgment sparsity is the open cause.** On the runs that fail with
  `no target-to-foundation path`, the target has 0 accepted
  prerequisites: the model refuses the target's real prerequisites,
  often with a `TOO_LARGE` and a bridge-missing rationale. This is the
  next thing to measure and it is not yet diagnosed.
- **The crown invariant fires on live data.** One photosynthesis run of
  four produced two selected edges resting on the target. The gate
  catches it, which is the fix working; the model behaviour is not
  addressed.
- **Trunks bottom out above ground.** A realized `recursion` tree
  bottoms out at "stack frame", which is not a foundation a reader could
  arrive at without prior knowledge. The four-node floor is met and the
  map is walkable, but it is a walk inside a closed loop.
- **Realization has never been in prod.** It ships with the boundary
  enforced (a hallucinated id is a gate failure, not a dropped row) but
  nothing calls it except `scripts/gold-words.mjs`.
- **18.5 MB of `.scratch/first-principled-v7/research/_sources/` was
  scraped vendor HTML.** Imported by nothing, cited by no measurement.
  **Deleted 2026-09-29**, repo working size 113.9 MB to 95.4 MB. It was
  untracked so the deletion is not in git history; `docs/ARCHIVE.md`
  carries the record.

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
npm test                      # 443 tests, the real safety net
npm run typecheck             # JSDoc types over src/
npm run lint                  # anti-slop
node scripts/gold-words.mjs   # run the acceptance set, see the table
node scripts/gold-words.mjs --dump   # inventories, edge graphs, realized copy
```

`scripts/gold-words.mjs` is the one command that answers "does the
generator still work". It runs the four gold words and prints nodes,
trunk, coercions, and drops per word, plus a pass line. Costs 6 model
calls per word (5 to select, 1 to realize). Use it after any change to
the generator, the coercion layer, the judge prompt, the topology
thresholds, or the transport.

It also prints a diagnostics table, and that table is how ticket 02
found the real cause: relation and jump histograms, the accepted
prerequisites of the target, and the gate's own reason per word. The
`--dump` flag adds the inventory verbatim, the full accepted dependence
graph, the target refusals, and the realized copy. Reading a candidate
list told us more than any histogram did.

Read before you build: `docs/FALSIFIED.md`, then
`.scratch/first-principled-v9/map.md`, then
`.scratch/first-principled-v9/research/02-realization-evidence.md`.

## Where the pieces live

See `docs/DESIGN.md` for the module map and the abstraction stack.
Effort-local planning lives in `.scratch/first-principled-v9/`.
Historical effort directories (v1 through v8) are dead and are kept only
as the falsification record; nothing in them describes current state.
