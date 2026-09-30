# 03 - Generality and gate provenance

**Ticket:** `../issues/03-generality-and-gate-provenance.md`, resolved
2026-10-01. Research only. No threshold, prompt, coercion or validator was
changed. Every number below came from a run on 2026-09-29 or 2026-10-01.

**Route for every live run:** `deepseek` / `deepseek-flash`, 5 to 6 model
calls per word, 8 to 11s. Captures in `03-runs/`.

## The two questions, answered in order

1. **No clustering by category.** 20 words, 4 per category, 1 pass. Every
   category produced at least two distinct failure modes, and the physical
   mechanism category, which is what the gold four are made of, produced
   two of the six "no target-to-foundation path" failures. The gold four
   were an unlucky draw. There is no unwritten domain boundary, so there is
   no product decision to escalate.
2. **The `TOO_LARGE` rationales do not recur.** They are also not the
   mechanism. `tgtOK` 0 is caused by the model judging each candidate as
   resting **on** the whole target (part-of read as dependence, inverted),
   or by `NONE`, not by a withheld bridge. Kill criterion met: no targeted
   second pass, architecture untouched.

The threshold derivation produced **two floors that are wrong by one**, both
of which reject hand-written maps a human wrote on purpose. Proposed, not
applied.

## 1. Generality across categories

`node scripts/gold-words.mjs --words ... --json`, one attempt per word.
`phys.json`, `comp.json`, `bio.json`, `inst.json`, `abs.json` in this
directory. `tgtOK` is accepted SMALL prerequisites of the target, `tgtBig`
is target pairs refused with a jump other than SMALL.

| Category | Word | Stage | Nodes | Trunk | tgtOK | tgtBig | Verdict and failure mode |
| --- | --- | --- | --- | --- | --- | --- | --- |
| physical | sourdough | topology | - | - | 0 | 0 | FAIL no target-to-foundation path |
| physical | tidal power | topology | - | - | 0 | 0 | FAIL no target-to-foundation path |
| physical | cantilever bridge | pairs | - | - | - | - | FAIL frame: unexpected field "a" / "b" |
| physical | refraction | topology | - | - | 4 | 0 | FAIL crown invariant, 2 edges on target |
| computational | memory allocation | topology | - | - | 1 | 0 | FAIL degenerate trunk, longest 2 |
| computational | hash table | topology | - | - | 5 | 0 | FAIL degenerate trunk, longest 3 |
| computational | DNS resolution | inventory | - | - | - | - | FAIL frame: unexpected top-level field "type" |
| computational | git commit | topology | - | - | 1 | 0 | FAIL crown invariant, 2 edges on target |
| biological | gut microbiome | topology | - | - | 2 | 1 | FAIL degenerate trunk, longest 3 |
| biological | mitosis | topology | - | - | 2 | 0 | FAIL degenerate trunk, longest 3 |
| biological | enzyme | topology | - | - | 2 | 0 | FAIL no target-to-foundation path |
| biological | natural selection | pairs | - | - | - | - | FAIL gate: rationale mentions chronology |
| institutional | parliament | topology | - | - | 4 | 0 | FAIL degenerate trunk, longest 3 |
| institutional | supply chain | topology | 6 | 4 | 2 | 1 | **PASS**, copy realized, 7 warrants |
| institutional | contract | pairs | - | - | - | - | FAIL frame: unexpected top-level fields |
| institutional | inflation | topology | - | - | 0 | 0 | FAIL no target-to-foundation path |
| abstract | entropy | topology | - | - | 2 | 0 | FAIL degenerate trunk, longest 3 |
| abstract | debt | topology | - | - | 1 | 2 | FAIL degenerate trunk, longest 2 |
| abstract | justice | topology | - | - | 0 | 0 | FAIL no target-to-foundation path |
| abstract | argument | topology | - | - | 0 | 0 | FAIL no target-to-foundation path |

**1 of 20.** The four seed words from 2026-09-29 (`sourdough`,
`monarchy`, `supply chain`, `memory allocation`, 1 of 4) are not counted
again here; `sourdough` was re-run as a physical member and this table is
that run.

### Failure modes, cross-tabulated by category

| Failure mode | physical | computational | biological | institutional | abstract | total |
| --- | --- | --- | --- | --- | --- | --- |
| no target-to-foundation path (`tgtOK` 0) | **2** | 0 | 1 | 1 | **2** | 6 |
| degenerate trunk, below the floor | 0 | **2** | **2** | 1 | **2** | 7 |
| crown invariant | 1 | 1 | 0 | 0 | 0 | 2 |
| envelope or gate failure before topology | 1 | 1 | 1 | 1 | 0 | 4 |
| PASS | 0 | 0 | 0 | 1 | 0 | 1 |
| total | 4 | 4 | 4 | 4 | 4 | 20 |

### The clustering verdict, with the numbers

**The failures do not cluster by category. Verdict: no domain boundary.**

The evidence, in the order that kills the hypothesis:

- **Every category has at least two distinct failure modes.** A domain
  boundary would give each domain one characteristic way of failing. The
  physical category produced a no-path, a crown-invariant and a frame
  failure. The abstract category produced two no-path and two trunk
  failures. The institutional category produced all four modes at once and
  is the only one that passed.
- **The physical mechanism category is the worst, not the best.** It holds
  2 of the 6 `tgtOK` 0 failures and 0 passes. The gold four are two
  physical, one biological and one computational word, so if the tutor only
  worked on physical mechanisms the gold set would be the best sample in
  the table and the boundary would be visible as a pass column. It is not
  there.
- **The most mechanical word in the set is the most instructive failure.**
  `hash table` produced `tgtOK` 5, the joint highest of the 20, and still
  failed on a 3-node trunk. `supply chain`, an institutional concept with
  no mechanism to descend into, is the only pass. So "the generator needs a
  mechanism to descend into" is not what the data says.
- **The one pass is not a category.** `supply chain` sits in the same
  institutional row as `parliament` (trunk failure) and `inflation`
  (no-path). Whatever distinguishes the three is variance, not domain.

So the honest reading is that the gate is the binding constraint plus
run-to-run variance, which is the simpler of the two problems the ticket
offered as alternatives. The kill criterion "if the failures cluster by
category, stop and ask a human" is **not** triggered, and no product
boundary decision is needed from a human.

### The one thing that did move

`argument` was run with the abstract-nominal intent and its inventory came
back as mating plugs, sperm competition and operational sex ratio. The
inventory call silently reinterpreted the word. That is a different defect
from everything else in this table and it is recorded here only so it is
not lost; it is not a category finding.

## A realized tree from outside the gold four, quoted in full

`supply chain`, `inst.json`, the only PASS of 20. Institutional category.
6 nodes, trunk 4, copy realized, 7 warrants. It is quoted in full because
followability was previously measured once, on a computational word
(`recursion`, 2026-09-29), and one measurement is not a general claim.

Trunk, foundation first, `T` marks trunk:

```
  T [rank 0] freight transport mode :: Freight transport mode
      The physical channel such as truck, ship, rail, or air used to move goods
      between locations. Each mode trades cost against speed and reach.
    [rank 1] standardized container :: Standardized container
      A reusable box of fixed dimensions that can be moved between ship, rail,
      and truck without unloading. It makes transfers fast and cheap.
  T [rank 1] order lead time :: Order lead time
      The delay between placing a replenishment order and receiving the goods.
      This delay forces firms to forecast and hold buffer stock.
  T [rank 2] batch production :: Batch production
      Making goods in fixed-size lots rather than one at a time, which creates
      waiting and stock between steps. It spreads setup costs but ties up
      inventory.
  T [rank 3] bullwhip effect :: Bullwhip effect
      The tendency for small changes in end-customer demand to cause growing
      swings in orders upstream. It creates waste and stockouts across the chain.
  T [rank 4] supply chain :: supply chain
      The entire network of firms, activities, and resources that move a
      product from raw materials to the end customer. Its performance depends
      on how well the parts coordinate.
```

Warrants, the `because` on each selected edge:

```
  -> standardized container needs freight transport mode: A standard container
     makes any freight mode faster and cheaper to load, so transport choices
     depend on it.
  -> bullwhip effect needs order lead time: Long order lead times make it
     harder to match supply with demand, which lets small demand swings grow
     into bigger upstream order swings.
  -> batch production needs order lead time: Batch production creates waiting
     and stock between steps, which adds to the total order lead time.
  -> order lead time needs freight transport mode: The choice of freight
     transport mode sets how long goods spend moving, which is a key part of
     order lead time.
  -> bullwhip effect needs batch production: Batch production rules, such as
     long lot sizes and infrequent orders, amplify the bullwhip effect by
     adding delay and lumpiness.
  -> supply chain needs bullwhip effect: A supply chain's performance depends
     on how well it dampens the bullwhip effect, so the whole system rests on
     this dynamic.
  -> supply chain needs batch production: Batch production decisions shape the
     flow of goods through a supply chain, so the whole system rests on this
     practice.
```

**Walk it.** The foundation is a physical channel of transport, which is the
right kind of ground: someone who has never heard of a supply chain can
arrive at it. From there the walk goes up through the delay in getting
goods, then to making goods in lots, then to the compounding of small
demand changes, and only then to the network as a whole. Each step is a
consequence of the one below it, not a category label next to it. The
crown's own gloss says the whole depends on how well the parts coordinate,
which is exactly the warrant on the edge below it, so the crown earns its
position instead of asserting it.

Two things are genuinely wrong with it and neither is fatal. The trunk is
about **flows and delays**, so the map walks a supply chain as a logistics
process and never reaches the word "cooperation", which is what most people
mean by the phrase. And `standardized container` is the only side branch, so
the tree is one chain with one offshoot rather than a fan of prerequisites.
Compare the hand-written `laptop` map, which has three direct prerequisites
on its crown. That gap is in the generator, not in the gate, and it is the
same shape as the missing side prerequisites already recorded for the
generated `recursion` tree on 2026-09-29.

## 2. Judgment sparsity

`node .scratch/first-principled-v9/research/03-runs/target-pairs.mjs`, which
imports the same four modules `gold-words.mjs` does and prints every
judgment on the ten target pairs, verbatim, with its relation, confidence,
jump and rationale. Captures: `justice-pairs.txt`, `tgt0-pairs.txt`,
`tgt0-round3.txt`, `tidal-pairs.txt`. 14 attempts across 5 words that
failed with `tgtOK` 0.

### The ticket's premise was wrong, and that is the finding

The ticket says the `no target-to-foundation path` signature is `tgtOK` 0
with `tgtBig` 4 or 5, i.e. the model says yes-but-the-bridge-is-missing.
**On the 2026-10-01 runs `tgtBig` was 0 for 15 of the 20 words**, and 0 for
every single word that failed at `tgtOK` 0. Across the 14 target-pair
attempts there were 5 runs containing a `TOO_LARGE` on a target pair at
all. The premise has to be measured, not inherited.

### What the model actually says about the target

The dominant pattern is **inversion**. Asked whether the target rests on a
candidate, the model returns `A_RESTS_ON_B` with the **candidate** as A and
the **target** as B: the part is judged as resting on the whole. That is
part-of read as dependence, and it is what the crown invariant catches.
`inflation` attempt 2, verbatim:

```
  --  Money supply | NONE HIGH NOT_APPLICABLE | Inflation as a whole does not
     strictly rest on money supply alone.
  --  Price level | NONE HIGH NOT_APPLICABLE | Inflation is a sustained increase
     in the price level, but the concept of price level itself does not rest on
     inflation.
  --  Supply and demand | NONE HIGH NOT_APPLICABLE | Inflation can be explained
     via supply and demand, but the concept of inflation does not rest on the
     supply and demand model alone.
  --  Quantity theory of money | NONE HIGH NOT_APPLICABLE | Quantity theory of
     money is a specific theory about inflation, but the general concept of
     inflation does not rest on it.
  --  Aggregate demand | NONE MEDIUM NOT_APPLICABLE | Aggregate demand is a
     component of some inflation explanations, but inflation as a whole does not
     rest on aggregate demand alone.
```

Every row is the same sentence with a different noun: *the target does not
rest on this, alone*. `tgtOK` 0 with `tgtBig` 0 means nine or ten `NONE`s
and a refusal the model cannot articulate, not a withheld bridge. `tidal
power` attempt 3 is the same shape taken to its limit: **0** target
prerequisites claimed, and 9 of 10 candidates judged as resting on the
whole, each with the rationale "is a core mechanism within tidal power;
understanding tidal power requires grasping such turbines".

### The recurrence question, answered

**No. The `TOO_LARGE` rationales do not name the same missing bridges across
runs, and where they do appear they are the minority outcome.**

| Word | attempts | runs with `TOO_LARGE` on a target pair | what the rationale named |
| --- | --- | --- | --- |
| justice | 3 | 1 of 3 | "missing bridge", "a bridge from enforcement to justice is missing", "not direct without intermediaries" |
| sourdough | 3 | 1 of 3 | "many bridging processes are omitted" (starch granule), "a full bridge from molecular process to bread structure is missing" |
| tidal power | 3 | 1 of 3 | "requires tidal bulge formation as an intermediate", "intermediate tidal and energy conversion concepts are omitted" |
| inflation | 3 | 2 of 3 | "a bridge is missing" (price level), "direction and bridge are unclear"; the third run refused on a different pair with no bridge claim |
| argument | 2 | 0 of 2 | none |

Two things follow, and they point the same way.

- **The mechanism words do name intermediates, and the intermediates differ
  every run.** `sourdough` names starch and bread structure. `tidal power`
  names the tidal bulge. Both are locally sensible, both are absent from
  that run's inventory, and neither recurs on a second attempt of the same
  word, because the second attempt's inventory is a different ten
  candidates. A bridge is named relative to an inventory that is itself
  redrawn per run, so it cannot recur.
- **For the abstract and institutional words, `TOO_LARGE` is not even a
  bridge claim.** `inflation` run 3 refused `wage-price spiral` with
  `TOO_LARGE` and then said "the general concept does not require them",
  which is a refusal, not a diagnosis.

**Consequence, per the ticket's kill criteria: no targeted second pass is
built.** The premise was that the model was pointing at a specific gap in a
specific inventory. It is not pointing at anything stable. The negative is
recorded and the architecture is left alone. The evidence also says the
cause is upstream of `TOO_LARGE` altogether: it is the inversion above, plus
the fact that a 10-candidate inventory for an abstract noun is mostly its
own components, and a component does not rest on its whole.

## 3. Threshold provenance

`node .scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs`.
Pure, offline, reads `eval/map-quality/gold.js` and the live constants out
of `src/lib/agent/pairwise/topology.js`. No model call. Each hand-written
map is measured on the four properties the gate actually tests.

| Hand-written map | nodes | edges | longest trunk | crown's direct prerequisites | max fan-in | edges resting on the crown |
| --- | --- | --- | --- | --- | --- | --- |
| laptop | 8 | 9 | 8 | 1 | 3 | 0 |
| recursion | 4 | 5 | 3 | 3 | 3 | 0 |
| photosynthesis | 5 | 6 | 4 | 3 | 2 | 0 |
| battery | 4 | 4 | 3 | 2 | 2 | 0 |

Every row's crown is the one node nothing rests on, and it is also the node
whose label equals the map's concept. The script asserts that; it passed
on all four. So the crown invariant is not a fitted rule either: **all four
hand-written maps have zero edges on the crown**, which makes the invariant
a property of the target rather than of the acceptance runs.

### Every threshold, with its derivation

| Constant in `topology.js` | Live | Derived from the hand-written maps | Proposed | Standing |
| --- | --- | --- | --- | --- |
| `MIN_NODES` | 5 | floor 4 (`recursion` 4, `battery` 4) | **4** | **Wrong by one. Live value rejects two hand-written maps and its only recorded justification was that gold runs were failing.** |
| `MIN_TRUNK_NODES` | 4 | floor 3 (`recursion` 3, `battery` 3, `photosynthesis` 4) | **3** | **Wrong by one. Had lineage as ticket 01's `TRUNK_MIN`, but the value does not pass the target definition.** |
| `MAX_NODES` | 10 | deepest human-authored map is 8 | 10, unchanged | Cap, not a floor. Keeping headroom above the deepest map is correct and does not accept anything a floor would reject. |
| `MAX_PATH_NODES` | 8 | deepest hand-written trunk is 8 | 8, unchanged | Exactly the deepest human-authored trunk. Correct, and at the limit. |
| crown invariant | on | 0 on all four maps | on, unchanged | **Derived.** Every hand-written map has a single top. |
| `MAX_FANIN_PER_TRUNK_NODE` | 2 | max fan-in across the maps is 3 (`laptop`, `recursion`) | **3** | **Clips `laptop`.** Live value 2 would reject the canonical fixture's shape. Also **not exported**, so no test can assert on it today. |
| `TRUNK_MAX` | 7 | deepest hand-written trunk is 8 (`laptop`) | **8** | Scoring preference inside `scoreTrunk`, not an acceptance rule, so it cannot reject a tree. It does demote `laptop`'s 8-node trunk out of the preferred range on the `lengthBonus` term. **Also not exported.** Found by the new `claims.test.js` assertion, which caught that the first draft of this table had omitted it. |

### Where the two numbers came from, stated plainly

- `MIN_TRUNK_NODES` = 4 was ticket 01's `TRUNK_MIN`, a scoring preference.
  Ticket 02 promoted it to an acceptance rule. The promotion is what broke
  it: as a preference it chose among adequate trunks, as a floor it
  rejects `battery`, which a human wrote on purpose.
- `MIN_NODES` = 5 has no product derivation at all. `docs/STATUS.md`
  claimed it came from the product. It did not. It was added because the
  gold runs were failing. `MAX_NODES` is still correctly described as
  derived from the product.
- The crown invariant is the one threshold that survives both tests: it is
  derived from the maps **and** justified independently by the two realized
  trees on 2026-09-29.

### The product question this exposes, for a human

Two of the four hand-written maps are 4 nodes with a 3-node trunk. A rabbit
hole needs depth and a 3-node chain may not be one. There are two
internally consistent positions and the numbers cannot decide between them:

- **The hand-written maps are the definition, so the floors drop** to 4
  nodes and a 3-node trunk. The cost is stated plainly: under those floors
  the 20-word table's 7 trunk failures and some of the 6 no-path failures
  become passes of 3 or 4 nodes, and the gate stops rejecting small maps.
  Whether a 4-node map is a rabbit hole is a product judgement about the
  learner, not about the code.
- **The hand-written maps are underspecified and should grow.** `battery`
  and `recursion` were written to be 5 and 6 nodes with 4-node trunks, and
  the floors stand. The cost is that two human-authored fixtures get
  edited to match a threshold written after them, which is how a fixture
  stops being evidence.

This is a human decision. It is not resolved by whichever pair of numbers
makes the acceptance set score better, and this ticket does not resolve it.

### What cannot be computed until the thresholds are applied

Lowering a floor can only convert a FAIL to a PASS, never the reverse, so
the table's verdict counts above are a lower bound on the proposed set's
score. The exact new score is **not** claimed here: the JSON captures
record `nodes: 0` for every word that failed the gate, so the `MIN_NODES`
floor cannot be re-evaluated offline on those runs. Recomputing it needs a
replay of the saved judgments, which `--json` does not keep. Whoever
applies the thresholds must re-run `node scripts/gold-words.mjs` and the
20 words, and record both numbers.

## The proposed `claims.test.js` assertion, for the applying ticket

Not added here. It cannot be: with the live floors it fails, and the ticket
says a failing assertion is not acceptable in this ticket, while the ticket
also forbids changing a threshold. The assertion to add, verbatim, in the
ticket that applies the proposal:

```js
// The hand-written gold maps define a Dependence Tree. If the acceptance
// thresholds reject them, the thresholds are fitted to the fixture, which
// is the documented v7 failure mode. Derived 2026-10-01 from
// .scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs.
test("the hand-written gold maps pass the acceptance gate", () => {
  for (const map of GOLD_MAPS) {
    const measured = measureAgainstGate(map);
    assert.ok(measured.nodes >= MIN_NODES, ...);
    assert.ok(measured.trunk >= MIN_TRUNK_NODES, ...);
    assert.equal(measured.onCrown, 0, ...);
  }
});
```

`measureAgainstGate` is the measurement already written, lifted out of
`03-runs/derive-thresholds.mjs` into the test. The companion assertion that
must be added with it, and cannot today because the constant is not
exported: **`MAX_FANIN_PER_TRUNK_NODE` must be exported** so a test can hold
it to the fan-in observed in the hand-written maps. `TRUNK_MAX` needs the
same treatment.

## The `claims.test.js` assertion that ships with this ticket

Two defects in the test file were part of the defect this ticket was
written to find, so both were fixed here rather than recorded for later.
Neither changes the gate.

1. **The dispute test could not see half the gate.** It compared the live
   floors against hand-written *node counts only* and then discarded the
   trunk floor with a bare `void minTrunk`. That is precisely why
   `battery`'s `MIN_TRUNK_NODES` rejection was not caught when ticket 02
   recorded it. It now holds both floors, holds both measured sizes for
   each hand-written map, names which floor rejected which map, and
   requires the evidence file to state the live value next to its
   proposal. A test that reads one of the two thresholds is worse than no
   test, because it reads as coverage.
2. **A new test guards unexported constants.** Any numeric `const` in
   `topology.js` that is not exported cannot be asserted on by anything.
   The test requires each one to be named in this evidence file. It
   immediately caught `TRUNK_MAX`, which the first draft of the table
   above omitted. That is the test earning its place in one run.

## What did not change

- No threshold, prompt, coercion or validator was touched.
- `src/lib/agent/pairwise/` is untouched. The two scripts added for this
  ticket live under `.scratch/first-principled-v9/research/03-runs/` and
  import the product modules, they do not fork them.
- The v7 three-stage runtime in `src/api/agent.js` is untouched.
- `npm test` 446 pass, `npm run typecheck` clean, `npm run lint` clean,
  2026-10-01.

## The acceptance set, before and after, as a measurement

`node scripts/gold-words.mjs`, `deepseek-flash`, identical code, no edits
between the two runs.

| Run | laptop | battery | photosynthesis | recursion | result |
| --- | --- | --- | --- | --- | --- |
| 2026-10-01, before | trunk 2 | trunk 3 | crown invariant | trunk 2 | **0 of 4** |
| 2026-10-01, after | trunk 3 | inventory concept mismatch | trunk 3 | trunk 2 | **0 of 4** |

Both are 0 of 4. The recorded STATUS figure is 1 to 2 of 4 across four runs
on 2026-09-29, so the honest range across six runs is now **0 to 2 of 4**.
One of the two runs also failed at the inventory stage on
`battery`, with `inventory concept must match the request`, which is a
fourth frame shape not in the recorded list. The point of the table is that
"nothing changed" is a measurement: same code, same route, and the run-to-run
spread is wider than the recorded range.

## Seed data reconciliation

The 2026-09-29 record has `monarchy` and `memory allocation` failing at
`tgtOK` 0. `memory allocation` was re-run on 2026-10-01 and came back at
`tgtOK` 1, failing on a 2-node trunk. `monarchy` was not re-run: it is not
in the ticket's category list and the institutional row is already
populated by `parliament`, `supply chain`, `contract` and `inflation`. The
seed point stands and is consistent with the verdict, since `inflation` in
the same institutional category failed at `tgtOK` 0 again.