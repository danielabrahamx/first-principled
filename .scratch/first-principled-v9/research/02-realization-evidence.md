# Ticket v9-02 evidence: the honest gate, the generator, and realization

Date: 2026-09-29. Route throughout: `LLM_PROVIDER=deepseek`,
`deepseek-flash`, official base. Predecessor record:
`01-spike-evidence.md`. Ticket: `../issues/02-surface-realization-and-honesty.md`.

Command for every run below: `node scripts/gold-words.mjs`, 5 model calls
per word plus 1 realization call, one predeclared attempt per word.

## 1. The gate bug, and what it was measuring

`selectTopology` returned `ok: true` for a 2-node graph. `MAX_NODES` was
a cap and `TRUNK_MIN` only scored candidate paths, so nothing rejected a
degenerate tree. The 4 of 4 recorded in `01-spike-evidence.md` therefore
counted a 2-node, 1-edge stub as a pass.

Fixed in `src/lib/agent/pairwise/topology.js` with three exported
thresholds that are now acceptance rules, not preferences:

- `MIN_TRUNK_NODES` (4). Paths shorter than this are removed *before*
  trunk scoring, so a short high-confidence path can no longer out-score a
  longer one that exists. Failure names the longest path that did exist.
- `MIN_NODES` (5). The published tree must be more than a bare trunk.
- The crown invariant: no selected edge may have the target as its
  prerequisite. The target is the whole the learner typed, so a part
  resting on it means the map has no single top.

Twelve new tests in `topology.test.js`, including three that are named
for the defect: "a 2-node graph is not a tree", "a trunk shorter than the
minimum is rejected, with its length named", "nothing may rest on the
target: the crown invariant". Two existing fixtures were widened so the
suite keeps testing what it was written to test.

**Consequence, as predicted: previously green runs now fail honestly.**
Across the runs below the honest rate is 1 to 2 of 4, not 4 of 4. The
old number was partly measuring nothing.

The crown invariant is a rejection, not a silent edge drop. Dropping the
edge would be salvage of a judgment the model actually made, which is the
pattern that made v7 unreadable (`docs/FALSIFIED.md`, `arrange.js`
force-attaching orphans with a hardcoded sentence).

## 2. What the generator actually does, measured

`scripts/gold-words.mjs` gained a diagnostics table (relation and jump
histograms, accepted prerequisites of the target, the inventory verbatim,
the full accepted dependence graph, the target refusals) and a `--dump`
flag. The histograms separated the two candidate causes named in the
ticket: the inventory being too shallow, or the judgment being too
sparse.

**The cause is the inventory, and it was named by reading it.** The
2026-09-29 laptop run returned this candidate set:

```
Lithium-ion battery, Logic gate, LCD screen, Central processing unit,
Operating system, Transistor, Binary number system, Electrical circuit,
Semiconductor, Keyboard
```

That is a set of *parts of a laptop*, all at one level. The accepted edge
list for that run was 6 edges from the target to a part, and 2 edges
between parts. There was nothing to walk down to. The Ticket 01 inventory
prompt asked for "concepts that may be **directly** necessary to
understand the requested target", and "directly" is what produced a
one-level set. It is a prompt defect in stage 1, not a coercion case and
not a judgment-sparsity case.

Changed in `buildInventorySystemPrompt`: the first paragraph now asks for
a set spanning several levels of depth, including concepts that other
concepts in the list rest on, down to foundations a learner could point
at or run, and says plainly that a set of peers at one distance from the
target is the wrong answer.

**Two prompt changes were measured and reverted in the same session.**
Both are recorded because the negative result is the evidence:

1. A paragraph in the *pair* prompt telling the model the target is not
   a prerequisite of its own parts. It was motivated by a real
   observation on recursion, where the model judged "base case rests on
   recursion" HIGH. But the paragraph pushed the honest per-word call to
   zero on three of four words (tgtOK 0, 0, 0, 5). Reverted. The
   pair prompt is unchanged from Ticket 01.
2. A stronger inventory demand, "name at least three concepts that some
   other concept in your own list rests on". The inventory became more
   demanding and the judgment stage answered by refusing more pairs:
   laptop fell to 2 accepted edges out of 55. Reverted. Do not escalate
   the demand in the prompt; the remaining gap is a judgment-sparsity
   question and it is open.

**One new coercion, from a live failure.** `photosynthesis` batch 3
returned the judgment array under the user payload's key name (`pairs`)
instead of the schema's (`judgments`). That is the same class as the
recorded `type` echo, so `normalizePairBatch` now renames the key when
the record holds exactly one array whose every row carries a string
`pair_id`. Content is untouched.

**Where the run stands.** The gate now rejects honestly and the
generator clears it sometimes. Across the runs in this session, on
identical code and route: 2 of 4, 1 of 4, 2 of 4, 1 of 4. The node count
is still uncontrolled, but it is now uncontrolled *under a real gate*,
which is the difference that matters: a 2-node stub can no longer be
reported as a pass.

The remaining failures split cleanly in the diagnostics table, and the
split is the finding:

- `degenerate trunk` (laptop, battery, recursion): the target has
  accepted prerequisites but the chain below them is 2 or 3 nodes. The
  inventory still has no depth on that run.
- `no target-to-foundation path` (laptop, recursion): the target had
  0 accepted prerequisites, so nothing connects it. The model refused
  the target's real prerequisites, often with a `TOO_LARGE` and a
  bridge-missing rationale.
- `crown invariant broken` (photosynthesis, 1 run of 4): the model judged
  parts resting on the target, exactly the shape the prompt paragraph
  above tried to fix and could not.

**This is not a kill.** The ticket's kill criterion is a zero pass rate
after the measured cause is fixed, with no further honest work. One of
two candidate causes is fixed and measured, and the gate now distinguishes
a real map from a stub, which it did not before. What is *not* fixed is
run-to-run variance, and it is now visible per run instead of hidden
behind a green check.

## 3. Realization

New module `src/lib/agent/pairwise/realize.js`, the fourth LLM boundary
in the stack. It follows the same four-part Contract as the other three
(`docs/DESIGN.md`): prompt, schema, coercion, gate. Eighteen tests.

The boundary is the whole point of the ticket:

- The model is given node ids, labels, glosses, and edge ids. It returns
  `node_copy[{id, heading, gloss}]` and `edge_copy[{id, because}]`.
- **A hallucinated id is a gate failure, not a dropped row.** Silently
  dropping it would hide a model that has crossed back into r2 and
  started doing the job code already did. Two tests cover this, and a
  third proves the coercion does not rescue it.
- **A selected node with no copy is a gate failure**, because a card with
  a blank face is a change to the product and `UNKNOWN` copy needs a
  human decision (`docs/DESIGN.md`, "Honesty as an architectural
  property"). This is the one place in the v9 stack where there is no
  UNKNOWN, deliberately.
- Copy is held to the same sentence rules as the hand-written UI copy.
  `steProblems` is imported from the v7 module rather than
  reimplemented, so the rules live in one place.
- Nothing is in prod. `realityMap.js` and `arrange.js` are untouched.

**Two defects the walk found, both fixed:**

1. *Machine phrasing on the crown card.* The target gloss read "The typed
   concept under study: battery" and the realization model lifted it
   verbatim onto the card a learner reads. The gloss is now a neutral
   description of the target's role, the realization prompt says the
   crown card describes the concept in full, and `pairs.test.js` asserts
   the gloss neither names the concept nor uses study vocabulary.
2. *A repeated id answered four times.* One `battery` run returned the
   same edge id four times with four rewordings of the same warrant. The
   coercion now collapses **byte-identical** repeats only, and leaves two
   genuinely different answers to one id as a gate failure. Choosing
   between them would be choosing the model's judgment, which is not
   code's job. There is a test for each half.

**One measured failure worth recording rather than hiding:** the 25-word
sentence cap from `docs/ste.md` failed realization three times before the
prompt stated the limit. A model cannot meet a rule it was never told.
`MAX_SENTENCE_WORDS` is now exported and interpolated into the prompt, so
the prompt and the gate cannot drift apart silently.

## 4. A human walks a tree

The `recursion` tree from the 2026-09-29 run, 5 cards, 6 warrants, ranks
0 to 4, every warrant under 25 words. Walked against the four questions
the v9 map predeclares.

```
T [0] Stack frame       A block of memory that holds one call's local
                        variables and return address. Each self-call gets
                        its own frame, so recursion needs stack space.
T [1] Function call     A transfer of control to a named block of code.
                        Every self-call is a function call, so it follows
                        the same rules.
T [2] Call stack        A runtime structure that tracks active function
                        calls and their return points. It keeps each
                        self-call separate until it returns.
T [3] Function self-call  A function invoking itself during its own
                        execution. It is the direct act that makes
                        recursion happen.
T [4] Recursion         A function solving a problem by invoking itself on
                        smaller inputs.
```

- **Foundations right?** Yes. Stack frame, function call, call stack are
  the three a reader would accept as the floor, and each rests on the one
  below it for a stated reason rather than by assertion. The bottom card
  is DEMONSTRABLE in the strong sense: a reader can point at a frame in a
  debugger.
- **Any invented history?** No. No discoverer, no date, no observation
  field is emitted at all, and the gate rejects them, so there is nothing
  to invent into.
- **Are the relationships the point?** Yes, and this is the finding. The
  warrants are the only thing carrying the argument. "A self-call adds a
  new entry to the call stack, so the stack grows with each recursive
  step" is the whole reason the node is in the map. If the warrant were
  removed the card would be a vocabulary word, not a step in an
  argument.
- **Would you open a rabbit hole?** Yes, on three of five cards. Call
  stack invites the reader into stack traces; stack frame invites return
  addresses and calling conventions. That is the intended behaviour for a
  product whose mission is reducing the distance between a mental model
  and reality.

**One weakness, stated rather than smoothed over.** A reader who does not
already know what a stack frame is will not be rescued by this tree. The
trunk bottoms out at rank 0 with no demonstrable foundation beneath it,
because the inventory on this run had none. The four-node floor is met
and the map is walkable, but it is a walk inside a closed loop rather
than a walk down to ground. That is the same `degenerate trunk` finding
seen from the learner side, and it is why the gate now exists: this tree
had to be earned, and shorter ones are now rejected.

## 5. Status of the ticket

- Gate rejects degenerate trees: done, with tests named for the defect.
- Generator clears the stronger gate: partially. One of two measured
  causes fixed (inventory depth). Run-to-run variance remains and is
  recorded, not hidden.
- Realization: done, with the boundary enforced and two walk-found
  defects fixed.
- Human walk: done, above.
- Not in prod. The v7 runtime is untouched and still serves prod.

**Ticket 03 (RealityMap adapter) is blocked on the variance.** Adapting a
map that appears on 1 to 2 of 4 runs, and whose node count swings between
4 and 9 on the same word, would bake the variance into the assembly
layer. The next thing to measure is judgment sparsity, not the next thing
to build.
