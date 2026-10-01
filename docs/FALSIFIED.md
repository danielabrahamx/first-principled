# FALSIFIED - things that were tried and killed, and why

Read this before proposing a new architecture. Every entry cost a full
version of the system. Rebuilding one is the default failure mode here,
not a reasonable exploration.

Each entry: what it was, the measured reason it died, and the
condition under which it becomes viable again. If you are about to
build something that resembles an entry, argue with the evidence in the
row or cite a measurement that has since changed.

Evidence lives in the effort directory named. Do not trust a summary
here over the recorded run.

## Generator architectures

### v1-v5: one-shot map, then per-layer growth

**What:** ask the model for a whole layered map in one call, then
optionally grow it layer by layer.

**Died because:** the model emits a list. `research/07-map-quality-baseline.md`
(v6) scores all four gold words as gate failures: a skipped layer on
`laptop`, a convergence combine from one layer on `battery`, empty
choices on `photosynthesis`, a crown that does not name `recursion`.

**Viable again if:** never, in this form. Asking one call for a global
graph is the root cause, not a prompt bug.

### v6: one-shot, layered, with derived structure

**What:** one call for layers/nodes/edges, then deterministic layering,
crown synthesis, and trunk derivation.

**Died because:** same failure, dressed better. Code forced the shape;
the semantics stayed list-shaped. All four gold words failed the gate.

**The lesson that still binds:** code can enforce a shape. It cannot
manufacture the dependence relations the shape is supposed to encode.

### v7: three-stage funnel (Chronology -> Epiphanies -> Arrange)

**What:** ordered capability regimes, then the results warranting
transitions, then a global edge-set. `realityMap.js`, `arrange.js`.

**Died because (measured, 2026-08-18):** it was falsified by its own
success criterion. The Arrange rule requires the map not to be a
stepwise copy of the Chronology; Arrange returned Chronology in order
on 3 of 4 gold words and disregarded it on the fourth. All four learner
maps were empty. `research/07-danny-followability.md`.

Two structural reasons, both still true:

1. Chronology is *ordered*, and every later call inherits that order.
   The contamination is built into the data flow.
2. Arrange asks one call for the global graph - the same global call
   that killed v6.

Plus the salvage cost: `deterministicArrange` synthesizes the crown,
force-attaches orphan nodes to it with a hardcoded sentence
(`arrange.js:212`), and ranks cycle-breaking edges by
`Math.min(edge.because.length, 9999)` (`arrange.js:379`) - choosing
which relations survive by counting characters in the model's prose.
`listnessProblems` is a three-flag heuristic whose own comment says it
was "pinned to the ticket 11 acceptance set."

**Still in prod.** Retained because the Chapel chrome, job/poll
envelope, transport, and MMG base shape are battle-tested and still
needed. The generator is retained only until the atomic switch.

**Viable again if:** never. Do not retune its prompts. Ticket 11 and
ticket 12 already tried prompt-level fixes and the evidence says the
task graph is the problem.

### v9 attempt 1-2: pairwise, strict envelope

**What:** the current architecture. Inventory, then 55 local pair
judgments, then pure code topology. Correct task graph, strict
envelope validation.

**Died because (measured, 2026-09-10):** envelope conformance, not
judgment. All four gold words failed terminally on shape: bare JSONL
objects, an echoed `type` field, a keyed-object envelope, `SMALL` on
`NONE` rows. Meanwhile the underlying judgments were "consistently
sensible," including correct `NONE` calls and an unprompted `TOO_LARGE`
citing a missing bridge.

**What replaced it:** the same architecture with mechanical frame
coercion (`normalizePairBatch`, `parsePairBatchText`). Not a new design.
`01-spike-evidence.md`, 2026-09-29.

**Lesson:** when a stage fails, ask whether the *content* is wrong or
the *frame*. Here the content was right and the architecture was
correct. The fix was 30 lines, not a new version.

## Data and infrastructure

### An acceptance threshold derived from the runs it judges

**What:** ticket 02 added `MIN_NODES` = 5 and promoted `MIN_TRUNK_NODES`
from 4 to an acceptance rule, in a session where the gold set was
failing. Ticket 03 measured both against `eval/map-quality/gold.js` on
2026-10-01: the maps a human wrote on purpose, as the definition of a
good Dependence Tree. Two of the four are rejected.

| Hand-written map | nodes | trunk | live gate |
| --- | --- | --- | --- |
| laptop | 8 | 8 | passes |
| photosynthesis | 5 | 4 | passes |
| recursion | 4 | 3 | **fails both floors** |
| battery | 4 | 3 | **fails both floors** |

`MIN_NODES` = 5 had no product derivation at all; the only recorded
reason for it was that the gold runs were failing. `MIN_TRUNK_NODES` = 4
had lineage as ticket 01's scoring preference, but promoting a preference
to a floor is what broke it: as a preference it chose among adequate
trunks, as a floor it rejected `battery`. Derived floors are 4 and 3.

**Killed 2026-10-01.** Daniel answered the question the evidence could
not: a 4-node map **is** a rabbit hole, so the hand-written maps are the
definition and ticket 04 applied the derivation. `MAX_FANIN_PER_TRUNK_NODE`
went 2 to 3 and `TRUNK_MAX` 7 to 8, both of which were module-private, so
nothing in the repo could assert on either. All four hand-written maps now
pass and `src/claims.test.js` asserts it by walking the imported maps.

**The lesson, and it is the same one this file exists to hold:** the gate
is the thing that decides what counts, so a threshold justified by the
score it produces is circular. This was committed one session after it
was written down here, which is exactly the failure mode the rest of this
file is about. The correction is also a discipline: derive from the
hand-written target, propose with the derivation attached, apply in a
different session so the numbers are never changed in the same breath as
the measurement that produced them, and get the human product question
answered rather than guessing which number looks better. Reproducible
offline and with no model call:
`.scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs`.

**What it cost to find:** lowering the floors did not improve the score.
Gold 0 of 4 before and after, generality 1 of 20 to 2 of 20, both inside
the recorded variance. It moved the failure mix instead, degenerate trunk
7 to 3 and **crown invariant 2 to 6**, because words that stopped failing
the trunk floor started failing on the real defect. The floors were never
the binding constraint and the measurement says so.

**Viable again if:** never in this form. A threshold whose only
justification is a failing acceptance run is fitted to the fixture.

### A test that reads half the gate

**What:** `src/claims.test.js` carried an assertion that the gate rejects
its own target definition. It compared the live floors against
hand-written **node counts only** and discarded the trunk floor with a
bare `void minTrunk`.

**Died because:** the discarded half was exactly the half that was wrong
in a way the test could not see. Ticket 02 recorded that `battery` fails
`MIN_TRUNK_NODES` and the test stayed green, because it never looked at
trunk size. A test that covers one of two gates reads as coverage.

**The same mistake appeared twice more in one session, both fixed
2026-10-01.** `topology.test.js` had a trunk-floor test whose fixture
failed on the *node* floor first once the floors moved to 4 and 3, so the
trunk floor had quietly become untestable. And `MAX_FANIN_PER_TRUNK_NODE`
and `TRUNK_MAX` were module-private, so no test could reach them at all. A
threshold nobody can reach is a threshold nobody measured.

**Viable again if:** never. Both gates, both measured sizes, every numeric
constant exported. The test now imports `GOLD_MAPS` and walks the maps
rather than transcribing sizes into a comment, and a further assertion
fails if any numeric constant in `topology.js` is unexported.

### TriplyDB / RDF as the graph store

**Considered and deferred, 2026-09-29.** Not built, not killed.

**Why not now:** the data is a ~10-node map generated per session and
queried once. RDF's payoff is open-world inference and SPARQL over a
large heterogeneous corpus; neither applies. More seriously, RDFS/OWL
reasoning *infers relations nobody asserted*, which is the exact
inverse of the fail-honest contract (`docs/DESIGN.md`, "Honesty as an
architectural property"). UNKNOWN must mean absent, and an open-world
reasoner turns absent into inferred.

It also breaks statelessness, and adds a network hop inside a job that
is already the slowest thing in the system.

**The half that is genuinely good:** concept identity. The model
re-invents the same 10 concepts per session with free-text labels, and
"recursion" in one map has no way to be known as the same node as
"recursive call" in another. A label-to-URI layer with canonical
labels and `subclass of` from Wikidata is a real gain.

**Viable when:** the generator passes the gold set *and* repeated
sessions show concept drift as the limiting factor. Not before. Fixing
a failure mode that has not been diagnosed is how v7 happened.

### Jev (TypeSafe System One decision model) for pair judgment

**Considered, measured, rejected, 2026-09-29.**

`typesafe/jev-1.13` returns a typed answer with probabilities and
structurally cannot emit a malformed envelope - which looked like a
perfect fit for the exact failure above.

**Measured:** one of three real pairs correct. It inverted the
hinged-clamshell `NONE` call that the evidence record calls
informative, at 0.72 probability on the wrong answer. Confidence stayed
between 0.56 and 0.64 across all three, so no threshold fixes it. It
returns no rationale, so there is nothing to check the call against.

**Viable again if:** dependence judgment itself starts failing, rather
than its delivery. It is strictly worse at the job than the model it
would replace.

## Approaches that are working, and why

Not killed, but the reason they work is worth not breaking.

**Mechanical envelope coercion** (`normalizePairBatch`). Fixed 4 of 4
recorded failure shapes and took the gold set from 0/4 to 4/4. It works
because it touches only the frame. The moment it starts rescuing content
it will hide real failures the way a fitted heuristic does.

**Code-owned gap selection** (`gaps.js`). The v1 version was one line
of system prompt. Moving the countable rule into code made it
deterministic and testable, and the "confront" move (a misconception
sitting on the learner's own correct foundation) is now a named,
deterministic condition rather than a hope about model behaviour.

**Deterministic topology** (`topology.js`). No model call. Every
selected edge traces to one accepted pair judgment; code never
synthesizes a semantic edge. Cycle-breaking ranks by confidence then
stable pair id - never by prose length, which is what `arrange.js:379`
does and why it is on this list as a lesson rather than a feature.

## The pattern across all of it

Nine versions, three architectures, zero killed by a bug. All killed by
a decision made without the evidence in front of the reader.

The v9 win was not a new idea. It was reading the evidence file that had
already diagnosed the bottleneck and acting on what it said.
