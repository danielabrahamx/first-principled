# 03 - Generality and gate provenance

**Type:** research
**Status:** open
**Blocked by:** 02 (resolved 2026-09-29)
**Related:** `../research/02-realization-evidence.md`,
`../../docs/FALSIFIED.md`, `eval/map-quality/gold.js`,
`../../docs/STATUS.md` finding 3

## Question

Two questions, and they have to be answered in this order.

1. **Is the gold set representative?** Four physical and computational
   mechanisms, and the product is "reduce the cognitive distance between
   the learner's mental model and reality" for anything the learner
   types. If the generator only works where a thing has a mechanism to
   descend into, that is a product boundary nobody has named, and it is
   invisible while the acceptance set contains only laptops and
   batteries.
2. **Where do the judgments go?** The `no target-to-foundation path`
   failures have a measured signature: the target has **zero** accepted
   prerequisites (`tgtOK` 0, `tgtBig` 4 or 5). The model is saying "yes
   this depends on that, but a bridge is missing from the inventory",
   and `topology.js` drops the edge because `jump` is `TOO_LARGE`. Those
   rationales have never been read across runs.

1 comes first because **2 is measured against the gold four, and if the
gold four are not representative then 2 is a measurement of the wrong
population.**

## Why this ticket exists, and what it is not

Ticket 02 fixed the gate and lowered the honest score from a recorded 4
of 4 to 1 to 2 of 4. Then two things were found while checking whether
that number meant anything.

**The pipeline is not fitted to the four words.** Verified by execution,
not by reading: every occurrence of a gold word in
`src/lib/agent/pairwise/` is inside a comment. Prompts, schemas, and
payload builders were run against a non-gold word and diffed; the only
difference is the concept string. The v9 generator is reachable only
from `scripts/`, never from `eval/` or `src/api/`, so no gold shape is
wired into anything that runs for a learner. Four unseen words were run
live on 2026-09-29 and `sourdough` produced a 6-node trunk with a real
mechanistic chain and 13 coherent warrants, which no fitted pipeline
would do.

**But the gate thresholds are fitted to the four words, and that is my
fault.** Measured on 2026-09-29 against `eval/map-quality/gold.js`, the
hand-written maps that define what a good Dependence Tree looks like:

| Hand-written gold map | nodes | trunk depth | against ticket 02's gate |
| --- | --- | --- | --- |
| laptop | 8 | 8 | passes |
| photosynthesis | 5 | 3 | passes |
| recursion | 4 | 2 | **fails `MIN_NODES` = 5** |
| battery | 4 | 2 | **fails `MIN_TRUNK_NODES` = 4** |

Two of the four maps a human wrote on purpose would be rejected by the
gate written to judge them. `MIN_TRUNK_NODES` = 4 has real lineage, it
was `TRUNK_MIN` and ticket 01 named it. `MIN_NODES` = 5 and the crown
invariant are ticket 02 additions, and the only justification recorded
for `MIN_NODES` = 5 was that the gold runs were failing. That is fitting
the gate to the fixture, which is the documented v7 failure mode, one
session after it was written down.

`docs/STATUS.md` claims the thresholds "came from the product rather
than from the score". For `MIN_TRUNK_NODES` that is true. For `MIN_NODES`
it is not. Correcting that claim is part of this ticket's output.

## What this ticket does and does not do

**Does:** run live measurements, record them, and derive a proposed
threshold set from the hand-written gold maps with the evidence attached.

**Does not:** change a threshold. A proposal with evidence in one ticket,
applied in the next, so that the numbers are never changed in the same
breath as the measurement that produced them. This is the same discipline
the repo already applies to `docs/STATUS.md` and `src/claims.test.js`.

Ticket 04 (RealityMap adapter) stays blocked until the proposed
thresholds are applied and the gold set is re-measured against them.

## What

### 1. Generality across categories

Build a word set of roughly 16 concepts, at least 4 per category, and
run each once on `deepseek-flash` with `--dump`:

- **physical mechanism**: sourdough, tidal power, a cantilever bridge,
  refraction
- **computational**: memory allocation, hash table, DNS resolution, a
  git commit
- **biological**: gut microbiome, mitosis, an enzyme, natural selection
- **institutional or social**: a parliament, a supply chain, a contract,
  inflation
- **abstract or nominal**: entropy, debt, justice, an argument

For each: node count, trunk length, gate verdict, `tgtOK`, `tgtBig`, and
the failure mode. The question is whether the failures cluster **by
category**. Clustering would mean the product has an unwritten domain
boundary and needs a human decision about it. No clustering, with four
failures spread evenly, means the gold four were an unlucky draw and
the gate is the binding constraint, which is a different and simpler
problem.

`sourdough`, `monarchy`, `supply chain`, and `memory allocation` were
already run on 2026-09-29 and are in the record: 1 of 4, with `monarchy`
and `memory allocation` both at `tgtOK` 0. Those four are the seed of
the set, not new evidence.

Record the whole run in `../research/03-generality-evidence.md`. If any
realized tree from a new category is worth reading end to end, quote it
and walk it. Followability was measured once, on a computational word,
and one measurement is not a general claim.

### 2. Judgment sparsity

For the gold four and for whichever new words failed with `tgtOK` 0, run
at least three attempts each with `--dump` and extract the `TOO_LARGE`
rationales on the **target pairs only**. The rest of the rejection noise
is not the signal.

One question decides the follow-up: **do the refusals for a given word
name the same missing bridges across runs?**

- They recur, so the model is pointing at a specific gap in a specific
  inventory, and a targeted second pass is a cheap real fix.
- They do not recur, so `TOO_LARGE` is the model hedging rather than
  reporting a gap, and the next move is a different one entirely.

Either answer is a good outcome. What is not acceptable is choosing a
fix before reading the rationales, which is what tickets 11 and 12 did.

### 3. Threshold provenance

Derive the acceptance thresholds from `eval/map-quality/gold.js`, the
hand-written maps, rather than from the acceptance runs.

- Every threshold in `topology.js` must be traceable to a property of the
  hand-written maps, stated in words, with the numbers shown.
- Where a hand-written map and a generated run disagree, the hand-written
  map wins and the run is the thing that is wrong.
- **State the product question this exposes.** Two of four
  hand-written maps are 4 nodes with a depth-2 trunk. A rabbit hole
  needs depth, and a depth-2 chain may not be one. If the hand-written
  maps are right, then either a 4-node map is acceptable and `MIN_NODES`
  should be lower, or the hand-written maps are underspecified and should
  grow. **This needs a human decision and is not resolved by whichever
  number makes the acceptance set look better.**
- Propose the values. Do not apply them.
- Add the missing `claims.test.js` assertion now, in a failing state is
  not acceptable, so instead: record the proposed assertion in this
  ticket's acceptance criteria for the applying ticket.

## Acceptance criteria

- [ ] `../research/03-generality-evidence.md` exists with the full
      per-word table, the category clustering verdict, and at least one
      realized tree from outside the gold four quoted in full.
- [ ] The clustering question is answered one way or the other with the
      numbers, not with an impression. "Mostly fine" is not a verdict.
- [ ] The `TOO_LARGE`-on-target-pairs rationales are read across at least
      three runs per word and the recurrence question is answered.
- [ ] Every threshold in `topology.js` has a stated derivation, and any
      threshold whose only justification was a failing gold run says so
      in `docs/STATUS.md` rather than claiming product lineage.
- [ ] A proposed threshold set, with evidence, is recorded. Not applied.
- [ ] `docs/STATUS.md` no longer claims `MIN_NODES` came from the
      product. It did not, and the file says so.
- [ ] No threshold, prompt, or coercion is changed in this ticket.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` green.
- [ ] `node scripts/gold-words.mjs` unchanged in behaviour. Run it once
      before and once after and record both numbers, so "nothing changed"
      is a measurement rather than a claim.

## Kill criteria

- If the failures cluster by category, **stop and ask a human**. That is
  a product boundary question about what the tutor is for, and it is not
  a generator problem to be tuned away. Do not fix a domain boundary by
  changing prompts until the boundary stops appearing.
- If the `TOO_LARGE` rationales do not recur for a word, do not build a
  targeted second pass. Record the negative and leave the architecture
  alone.
- If the hand-written gold maps turn out to disagree with each other
  about what a Dependence Tree is, stop. Two human-written answers to
  the same question means there is no target to measure against yet.

## Out of scope

- Changing any threshold, prompt, coercion, or validator. This ticket
  measures.
- The RealityMap adapter, transport, job integration, Chapel, prod
  switch, deleting the v7 runtime.
- Widening `MAX_NODES`, `MAX_PATH_NODES`, or the candidate count.
- Treating the four gold words as the product. If they are not
  representative, the correct response is a finding, not a bigger
  acceptance set that has the same bias.
