# 04 - Derived threshold application

**Ticket:** `../issues/04-apply-derived-gate-thresholds.md`, resolved
2026-10-01. The applying ticket that ticket 03 pointed at.

**What changed:** four constants in `src/lib/agent/pairwise/topology.js`
and two test files. No prompt, no coercion, no validator, no runtime
path. `scripts/gold-words.mjs` was not touched.

## The decision, and who made it

Ticket 03 derived the floors from the hand-written gold maps and
deliberately did not apply them, because "is a 4-node map deep enough to
be a rabbit hole" is a question about the learner. Daniel answered it on
2026-10-01: **a 4-node map is a rabbit hole.** Option A, the
hand-written maps are the definition, the floors drop.

That is the whole authority for this ticket. Every number below was
already derived from `eval/map-quality/gold.js` by
`03-runs/derive-thresholds.mjs`; this ticket applied a derivation and
invented nothing.

## What was applied

| Constant | Before | After | Derivation |
| --- | --- | --- | --- |
| `MIN_NODES` | 5 | **4** | smallest node count in any hand-written map: `recursion` and `battery`, both 4 |
| `MIN_TRUNK_NODES` | 4 | **3** | smallest trunk in any hand-written map: `recursion` and `battery`, both 3 |
| `MAX_FANIN_PER_TRUNK_NODE` | 2 | **3** | highest fan-in in any hand-written map: `laptop` and `recursion`, both 3 |
| `TRUNK_MAX` | 7 | **8** | deepest hand-written trunk: `laptop` at 8 |
| `MAX_NODES` | 10 | 10, unchanged | deepest hand-written map is 8; headroom above it is correct |
| `MAX_PATH_NODES` | 8 | 8, unchanged | exactly the deepest hand-written trunk |
| crown invariant | on | on, unchanged | all four hand-written maps have zero edges on the crown |

`MAX_FANIN_PER_TRUNK_NODE` and `TRUNK_MAX` were module-private, so
nothing in the repo could assert on either. Both are exported now, and
`src/claims.test.js` asserts that no numeric constant in `topology.js`
is unexported, so a future dead threshold fails the suite instead of
quietly existing.

`MAX_FANIN_PER_TRUNK_NODE` at 2 was actively wrong: `laptop`, the
canonical fixture, has a node with three dependents.

## The verification that matters

`node .scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs`:

```
Verdict against the live gate:
  laptop           passes
  recursion        passes
  photosynthesis   passes
  battery          passes
```

All four hand-written maps pass. Before this ticket, two of them were
rejected by the gate written to judge them.

**The assertion is not decorative.** Setting `MIN_NODES` back to 5 and
running the suite was done as a check, and it fails by name:

```
not ok - the hand-written gold maps pass the acceptance gate
  error: 'recursion is a hand-written gold map with 4 nodes and MIN_NODES
  is 5. The gate must accept the definition it is written against.'
```

The test imports `GOLD_MAPS` and walks the maps with the same traversal
`selectTopology` uses, so it measures rather than transcribes. A change to
a hand-written map moves the assertion.

## The score did not improve, and that is the finding

| Measurement | Before | After |
| --- | --- | --- |
| Gold four, `node scripts/gold-words.mjs` | 0 of 4 | **0 of 4** |
| Twenty words, 5 categories, one attempt each | 1 of 20 | **2 of 20** |

1 of 20 to 2 of 20 is **inside the run-to-run variance** already recorded
(0 to 2 of 4 on the gold four across six runs). This ticket does not
claim the generator got better. It claims the gate now stops rejecting
its own definition, which is a separate thing from the score.

The failure mix is where the information is. Twenty words, after:

| Failure mode | Before | After |
| --- | --- | --- |
| degenerate trunk | 7 | **3** |
| no target-to-foundation path | 6 | 5 |
| crown invariant | 2 | **6** |
| frame failure before topology | 4 | 4 |
| PASS | 1 | 2 |

**The floors were never the binding constraint.** Lowering them moved four
words out of "degenerate trunk" and most of them landed on the crown
invariant, which is the inversion ticket 03 measured: the model judges
candidates as resting on the whole target. That is a semantics failure at
r2, the class v6 and v7 died of, and the crown invariant rejecting it is
the invariant working correctly. The gate got weaker on one axis and the
true failure got louder on another.

The per-word table, after, one attempt each on `deepseek-flash`,
2026-10-01. Captures `03-runs/04-phys.json`, `04-comp.json`, `04-bio.json`,
`04-inst.json`, `04-abs.json`.

| Category | Word | Verdict and failure mode |
| --- | --- | --- |
| physical | sourdough | FAIL frame: unexpected top-level fields in batch 3 |
| physical | tidal power | FAIL degenerate trunk, longest 2 |
| physical | cantilever bridge | FAIL crown invariant, 3 edges on target |
| physical | refraction | **PASS**, 6 nodes, trunk 5, copy realized |
| computational | memory allocation | FAIL crown invariant, 2 edges on target |
| computational | hash table | FAIL frame: echoed `type`, no judgments array |
| computational | DNS resolution | FAIL frame: invalid jump on two judgments |
| computational | git commit | FAIL crown invariant, 3 edges on target |
| biological | gut microbiome | FAIL no target-to-foundation path, `tgtOK` 0 |
| biological | mitosis | FAIL crown invariant, 1 edge on target |
| biological | enzyme | FAIL degenerate trunk, longest 2 |
| biological | natural selection | **PASS**, 6 nodes, trunk 6, copy realized |
| institutional | parliament | FAIL crown invariant, 1 edge on target |
| institutional | supply chain | FAIL crown invariant, 3 edges on target |
| institutional | contract | FAIL no target-to-foundation path, `tgtOK` 0 |
| institutional | inflation | FAIL degenerate trunk, longest 2 |
| abstract | entropy | FAIL frame: unexpected top-level fields in batch 2 |
| abstract | debt | FAIL no target-to-foundation path, `tgtOK` 0 |
| abstract | justice | FAIL no target-to-foundation path, `tgtOK` 0 |
| abstract | argument | FAIL no target-to-foundation path, `tgtOK` 0 |

The gold run is worth one line because its failures moved *upstream*:
before, all four words reached topology; after, only `battery` did, and
the other three failed on frame shapes or an inventory concept mismatch.
That is variance, not an effect of the thresholds, and it is a further
reminder that a single gold run cannot measure anything on its own.

## A realized tree the new floors admit, quoted in full

`natural selection`, biological category, 6 nodes, trunk 6, 9 warrants.
The first realized tree from a biological word in this effort.

```
  T [rank 0] heritability of traits :: Heritability of traits
      Offspring resemble their parents more than unrelated individuals for a
      given trait. This resemblance is required for selection to change a
      population.
  T [rank 1] Mendelian segregation of alleles :: Mendelian segregation of alleles
      Gene variants separate into gametes so offspring receive one copy from each
      parent. This rule explains how variants are passed on and reshuffled.
  T [rank 2] allele frequency change across generations :: Allele frequency change across generations
      The proportions of gene variants in a population shift over time. Such
      shifts are the measurable outcome of evolution.
  T [rank 3] fitness as relative reproductive output :: Fitness as relative reproductive output
      Fitness is an individual's share of offspring in the next generation
      compared with others. It determines which traits become more common.
  T [rank 4] trait variation within a population :: Trait variation within a population
      Individuals in a group differ in measurable features such as size, color, or
      speed. This variation is the raw material that selection acts on.
  T [rank 5] natural selection :: Natural selection
      Natural selection is the process where organisms with traits better suited
      to their environment tend to survive and reproduce more. Over generations,
      this leads to populations changing and adapting.
```

Warrants:

```
-> trait variation within a population needs fitness as relative reproductive output: Without variation in traits, there can be no differences in reproductive output to favor one form over another.
-> trait variation within a population needs allele frequency change across generations: Selection can only change allele frequencies if individuals in the population vary in their traits.
-> natural selection needs trait variation within a population: Natural selection depends on individuals within a population differing in their traits.
-> fitness as relative reproductive output needs allele frequency change across generations: Changes in allele frequencies across generations result from differences in reproductive output among individuals.
-> fitness as relative reproductive output needs heritability of traits: Heritability of traits is necessary for differences in reproductive output to be passed on to offspring.
-> Mendelian segregation of alleles needs heritability of traits: Mendelian segregation provides the mechanism by which traits are inherited from parents to offspring.
-> natural selection needs heritability of traits: Natural selection requires that traits be heritable so that favored traits appear in the next generation.
-> allele frequency change across generations needs Mendelian segregation of alleles: The rules of Mendelian segregation explain how allele frequencies can change from one generation to the next.
-> natural selection needs Mendelian segregation of alleles: Natural selection depends on Mendelian segregation to generate the inheritance patterns it acts upon.
```

**Walk it.** The foundation is heritability, which is an observation anyone
can make: look at a family, notice the resemblance. That is the right kind
of ground, and it fixes the defect ticket 02 recorded against the realized
`recursion` tree, which bottomed out at "stack frame", a thing a reader
cannot arrive at without prior knowledge. From there the walk goes up
through the mechanism that carries variants, then to the measurable
population shift, then to what determines who reproduces more, then to
the variation that makes any of it possible, then to the crown.

Two things are worth naming. **The warrants are the argument, not the
nodes.** "Without variation in traits, there can be no differences in
reproductive output to favor one form over another" is the thing a learner
actually needs, and it is on the arrow, which is where the product puts
it. And **the trunk is dense.** Nine warrants on six nodes means almost
every node has more than one reason to be there, so a learner who stops
at any level has two ways to keep going.

The honest weakness: **every node is on the trunk**, so there is no
side branch to wander into. The map asks to be read top to bottom and
offers nothing to explore. `heritability` has three dependents, so it
renders with three arrows merging into it, which is genuine fan-in, but
the fan-in is *within* the spine rather than off it. Compare the
hand-written `laptop`, which is an 8-node spine with a shortcut edge
`silicon rests on electricity` running alongside it. That difference is
the generator, not the gate, and it is the same shape as the missing side
prerequisites already recorded on 2026-09-29.

## Two tests retired, and why it is not a red suite

`src/lib/agent/pairwise/topology.test.js` had a test named "a chain with
no fan-in is rejected on the node minimum". Its fixture was a bare
four-node chain, rejected because 4 was below `MIN_NODES` = 5. The
decision made that premise false: a 4-node map is acceptable. The test is
replaced by one named "RETIRED PREMISE: a bare four-node chain now
passes, and that is the decision", which asserts the new behaviour and
carries the reasoning in its comment.

The consequence is real and is not papered over: **the node floor was
carrying a second duty it no longer carries**, rejecting a map with no
side prerequisites. Measured against the hand-written maps, the property
that separates `battery` (4 nodes, one node with two dependents) from a
bare chain (4 nodes, one dependent everywhere) is **max fan-in, not node
count**: all four hand-written maps have max fan-in 2 to 3, a pure chain
has 1.

**That rule is proposed, not applied.** It is a new acceptance rule, and
this ticket's authority is a derivation that Daniel already answered, not
an invention. It is recorded here and in the next ticket's brief.

One more guard was added rather than retired, because the decision must
not have opened a hole at the bottom: "a 2-node stub is still not a
tree" asserts the 2026-09-29 defect stays caught at any threshold, and
"a trunk shorter than the minimum is rejected" got a fixture that clears
the node floor so it still reaches the trunk check. With the floors at 4
and 3, a 3-node fixture fails on nodes first, which means the trunk floor
had become untestable. That is the same shape as the `void minTrunk` bug
ticket 03 fixed in `claims.test.js`, and it would have been easy to miss.

## Checks

`npm test` 448 pass, `npm run typecheck` clean, `npm run lint` clean,
2026-10-01. The mutation check above was reverted; `MIN_NODES` = 4 is
what is committed.

## What this ticket does not claim

- It does not claim the generator improved. 1 of 20 to 2 of 20 is inside
  the recorded variance.
- It does not fix the crown invariant or the inversion behind it. That is
  6 of 20 words and is the next thing to work.
- It does not apply the max fan-in rule.
- It does not touch the v7 three-stage runtime, which is still what prod
  runs.