# STATUS - the one file that says what is true right now

Everything else in this repo is history. This file is current. If it
disagrees with the code, the code is right and this file is a bug:
fix this file in the same commit.

Last verified against the code: **2026-10-01**.

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
| Frontier | v9 ticket 05, the RealityMap adapter, unblocked | `.scratch/first-principled-v9/map.md` |
| Gold words | laptop, battery, photosynthesis, recursion | `eval/map-quality/gold.js` |
| Gold maps against the gate | **all four pass**, asserted by `claims.test.js` | `04-derived-threshold-application.md` |
| Gold result under the honest gate | **0 to 2 of 4 pass**, across eight runs 2026-09-29 to 2026-10-01 | `04-derived-threshold-application.md` |
| Generality, 20 words across 5 categories | **1 of 20 before the floor change, 2 of 20 after**, no failure clustering by category | `04-derived-threshold-application.md` |
| Largest failure mode | **crown invariant, 6 of 20**: the model judges candidates as resting on the whole target | `03-generality-evidence.md` |
| Gate floors | `MIN_NODES` 4, `MIN_TRUNK_NODES` 3, both derived from the hand-written maps | `src/lib/agent/pairwise/topology.js` |
| Realization | ships, not in prod | `src/lib/agent/pairwise/realize.js` |
| Live generator in prod | v7 three-stage (`realityMap.js`) | `src/api/agent.js` |
| Checks | `npm test` (448), `npm run lint`, `npm run typecheck` | all green 2026-10-01 |

Three of those rows are enforced by a test
(`src/claims.test.js`). If you change the model in `llm.js` without
updating this file, `npm test` fails and tells you.

## The one-paragraph version of where we are

The v9 pairwise generator is the live direction. It has an inventory
call, 55 local pair judgments, pure-code topology selection, and a
realization call that writes learner-facing copy for a shape code has
already chosen. **The gate was broken twice and is now fixed both times.**
It used to report a 2-node, 1-edge stub as a pass, so the recorded 4 of 4
was partly measuring nothing. The floors added to fix that then rejected
two of the four hand-written gold maps, so the gate was fitted to the
acceptance runs in the other direction. Both are closed: the floors are
derived from `eval/map-quality/gold.js`, all four hand-written maps pass,
and a test asserts it every run. The honest rate is **0 to 2 of 4** across
eight runs. Both earlier numbers were the bug, not the regression.

None of it is in prod. Prod still runs the v7 three-stage generator,
retained and battle-tested but known to produce list-shaped maps.

**What is fixed and what is not.** The cause of the short trunks was the
inventory, identified by reading the candidate labels: the prompt asked
for concepts "directly" necessary to the target and got ten parts of a
laptop, all at one level. That prompt is fixed. The gate is fixed: all
four hand-written gold maps pass it and a test says so on every run.
**What is not fixed is the model's semantics.** Asked whether the typed
target rests on a candidate, it often answers that the candidate rests on
the target, and the crown invariant correctly rejects the result. That is
now the largest single failure mode at 6 of 20 words, and it is a class
v6 and v7 both died of. Run-to-run variance is wider than any effect
measured so far: 0 of 4 twice in a row on the gold set, minutes apart.

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
enforced: `MIN_TRUNK_NODES` applied *before* trunk scoring, `MIN_NODES` on
the published tree, and a crown invariant rejecting any selected edge
resting on the target. `MAX_NODES` stayed a cap at 10. The honest gold
rate went from a recorded 4 of 4 to 1 to 2 of 4. **Both floors were then
wrong by one and are now 4 and 3**; see the correction below.

The tempting move at that point is to relax a threshold until the
number recovers. That is precisely the v7 failure: the gate gets fitted
to the failure it was meant to catch.

**Correction, 2026-09-29, closed 2026-10-01:** the gate *was* partly
fitted. Measured against `eval/map-quality/gold.js`, the hand-written
maps that define a good Dependence Tree: `recursion` at 4 nodes with a
3-node trunk failed `MIN_NODES` = 5 and `MIN_TRUNK_NODES` = 4, and
`battery` likewise. Two of the four maps a human wrote on purpose were
rejected by the gate written to judge them.

Ticket 03 re-derived every threshold from the hand-written maps and
ticket 04 applied the derivation. **Both floors were wrong by one and
neither had product lineage.** `MIN_NODES` = 5 was added because the gold
runs were failing; its derivation is 4. `MIN_TRUNK_NODES` = 4 had lineage
as ticket 01's `TRUNK_MIN` scoring preference, but ticket 02 promoted it
to an acceptance rule and the promotion is what broke it: as a preference
it chose among adequate trunks, as a floor it rejected `battery`. Its
derivation is 3. An earlier version of this file claimed all three
"came from the product rather than from the score". For `MIN_NODES` that
was false and it is now stated as false.

The human decision that authorised it, made 2026-10-01: **a 4-node map
is a rabbit hole.** The hand-written maps are the definition, so the
floors take their derived values. Current state:

| Constant | Value | Derivation |
| --- | --- | --- |
| `MIN_NODES` | 4 | smallest node count in a hand-written map (`recursion`, `battery`) |
| `MIN_TRUNK_NODES` | 3 | smallest trunk in a hand-written map (`recursion`, `battery`) |
| `MAX_FANIN_PER_TRUNK_NODE` | 3 | highest fan-in in a hand-written map (`laptop`, `recursion`). Was 2, which clipped `laptop`. Now exported. |
| `TRUNK_MAX` | 8 | deepest hand-written trunk (`laptop`). Was 7. Now exported. |
| `MAX_NODES` | 10 | deepest hand-written map is 8; headroom above it is correct |
| `MAX_PATH_NODES` | 8 | exactly the deepest hand-written trunk |
| crown invariant | on | all four hand-written maps have zero edges resting on the crown |

**All four hand-written gold maps pass the gate**, and
`src/claims.test.js` asserts it on every run by walking the imported maps
with the same traversal `selectTopology` uses, so it measures rather than
transcribes. Mutation-checked: setting `MIN_NODES` back to 5 fails it by
name (`recursion is a hand-written gold map with 4 nodes`). That
assertion is the thing to break first if anyone tries to make the score
look better. A second assertion fails if any numeric constant in
`topology.js` is unexported, because `MAX_FANIN_PER_TRUNK_NODE` and
`TRUNK_MAX` were module-private for a whole session and nothing could
assert on either.

Reproduce the whole table offline, with no model call:
`.scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs`.

**Consequence:** a gate must reject the degenerate case by
construction, and the acceptance test must include a case that fails
it - and, now, a case that the target definition must *pass*.
`topology.test.js` carries "a 2-node graph is not a tree", "a 2-node
stub is still not a tree", "a trunk shorter than the minimum is rejected,
with its length named", "the node floor rejects a tree smaller than the
derived minimum", "nothing may rest on the target: the crown invariant",
and one test named "RETIRED PREMISE: a bare four-node chain now passes,
and that is the decision", which carries its own reasoning in its comment
because a retired test that leaves no trace is a lie waiting to be
re-added.

## What is known to be broken or missing

Measured 2026-09-29 (`02-realization-evidence.md`), 2026-10-01
(`03-generality-evidence.md` and `04-derived-threshold-application.md`).

Ordered by how much it blocks the next ticket.

- **The gate is fixed. Stop treating it as the problem.** All four
  hand-written gold maps pass it and `src/claims.test.js` asserts that on
  every run. Both floors were wrong by one until 2026-10-01 and are now at
  their derived values. See finding 3.
- **Inversion is the open defect, and it is the biggest one.** On the
  20-word generality set the largest failure mode is now the **crown
  invariant at 6 of 20**: asked whether the typed target rests on a
  candidate, the model frequently answers that the **candidate rests on
  the target**, which is part-of read as dependence. It rose from 2 of 20
  when the floors were lowered, because more words survived to be
  inspected. This is a semantics failure at r2, the class v6 and v7 died
  of, and it is invisible to any histogram of pair counts.
  **Do not fix it by escalating the prompts.** Two escalations were
  measured on 2026-09-29 and reverted the same session; a more demanding
  inventory made the judgment stage refuse more pairs rather than reach
  deeper. And ticket 03 measured 14 attempts across 5 words and found the
  refusals do **not** name the same bridges twice, so a targeted second
  pass would be building against a signal that is not there.
- **Run-to-run variance is larger than any effect measured so far.** Gold
  set: 0 of 4 twice on 2026-10-01, minutes apart, with different failure
  modes; 0 to 2 of 4 across eight runs on identical code. Generality set:
  1 of 20 before the floor change, 2 of 20 after, which is **inside**
  that spread. **A single run of anything measures nothing.** Anything
  proposed on the strength of one run is not measured.
- **Frame failures are the second-largest pre-topology loss.** 4 of 20
  words never reach topology: an echoed `type` field with no `judgments`
  array, unexpected top-level `pair_id`/`relation`, invalid `jump` values,
  and `inventory concept must match the request`. `normalizePairBatch`
  was built to coerce four recorded shapes and these are not all of them.
  **Read the raw reply before adding a coercion.** Per the Contract law in
  `docs/DESIGN.md`, stage 3 may repair the frame and never the content,
  and guessing from a validator's error string is how a content defect
  gets coerced away.
- **The gold four are not the product, and that is measured.** Twenty
  words across five categories, 4 each, one attempt each on
  `deepseek-flash`: 1 of 20 before the floor change, 2 of 20 after. The
  failures do **not** cluster by category. Every category produced at
  least two distinct failure modes, and the physical-mechanism category,
  which is what the gold four are made of, produced two of the six
  `no target-to-foundation path` failures and no passes in the first
  run. The single pass in that run, `supply chain`, is institutional. So
  there is **no unwritten domain boundary** and no product decision is owed
  on that question. Full cross-tabulation in `03-generality-evidence.md`
  section 1.
- **The inventory is often one level deep.** The 2026-09-29 laptop run
  returned ten parts of a laptop, all peers of the target. The prompt
  asked for concepts "directly" necessary to the target and got exactly
  that. Fixed in the prompt. Two escalations of that demand were measured
  and reverted the same day. Do not retry without new evidence.
- **A max fan-in floor is proposed and not applied.** Lowering
  `MIN_NODES` retired the node floor's second duty, rejecting maps with no
  side prerequisites. Measured against the hand-written maps, the property
  that separates `battery` (one node with two dependents) from a bare
  four-node chain (one dependent everywhere) is **max fan-in**, 2 to 3
  against 1, not node count. Not applied: it is a new acceptance rule and
  ticket 04's authority was a derivation, not an invention.
  `.scratch/first-principled-v9/research/04-derived-threshold-application.md`.
- **The node floor is now the only thing rejecting a bare chain, and it
  no longer does.** A four-node path with no side prerequisite passes.
  That is the decision, not an oversight, and the test that records it is
  named "RETIRED PREMISE" so nobody re-adds the old expectation by
  accident.
- **Every realized tree is a spine.** The trunk runs the full height and
  side edges are rare. The 2026-10-01 `natural selection` tree is 6 nodes,
  9 warrants, and **all six on the trunk**, so there is nothing to
  explore sideways. Compare the hand-written `laptop`, an 8-node spine
  with a shortcut edge running alongside it. Same shape as the missing
  side prerequisites recorded on 2026-09-29, now on a second category.
- **Realization has never been in prod.** It ships with the boundary
  enforced (a hallucinated id is a gate failure, not a dropped row) but
  nothing calls it except `scripts/gold-words.mjs`.
- **Trunks still bottom out above ground sometimes.** The 2026-09-29
  `recursion` tree bottomed out at "stack frame", which is not a
  foundation. The 2026-10-01 `natural selection` tree bottomed out at
  "heritability of traits", which is one, so this is word-dependent and
  unmeasured as a rate.
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
npm test                      # 448 tests, the real safety net
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

One limit of the table, found 2026-10-01: it records `nodes: 0` for every
word that failed the gate, so a threshold cannot be re-evaluated offline
from a captured run, and `--json` does not keep the judgments. Ticket 03's
two research scripts exist because of this.
`.scratch/first-principled-v9/research/03-runs/target-pairs.mjs` prints
every judgment the model made on the target's ten pairs, verbatim, which
is how the inversion recorded above was diagnosed. Deriving every gate
constant from the hand-written gold maps, offline and with no model call,
is
`.scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs`.
Run it before touching a threshold; it prints the live values beside the
values the hand-written maps imply.

Read before you build: `docs/FALSIFIED.md`, then
`.scratch/first-principled-v9/map.md`, then
`.scratch/first-principled-v9/research/04-derived-threshold-application.md`
and `03-generality-evidence.md`.

## Where the pieces live

See `docs/DESIGN.md` for the module map and the abstraction stack.
Effort-local planning lives in `.scratch/first-principled-v9/`.
Historical effort directories (v1 through v8) are dead and are kept only
as the falsification record; nothing in them describes current state.
