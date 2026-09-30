# 03 - Generality and gate provenance

**Type:** research
**Status:** resolved (2026-10-01)
**Blocked by:** 02 (resolved 2026-09-29)
**Related:** `../research/02-realization-evidence.md`,
`../research/03-generality-evidence.md`,
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

- [x] `../research/03-generality-evidence.md` exists with the full
      per-word table, the category clustering verdict, and at least one
      realized tree from outside the gold four quoted in full.
- [x] The clustering question is answered one way or the other with the
      numbers, not with an impression. "Mostly fine" is not a verdict.
      **Answered: no clustering. 1 of 20 across 5 categories, every
      category with at least two distinct failure modes, and the
      physical-mechanism category holding 2 of the 6 no-path failures
      and 0 passes.**
- [x] The `TOO_LARGE`-on-target-pairs rationales are read across at least
      three runs per word and the recurrence question is answered.
      **Answered: they do not recur, and they are not the mechanism.
      `tgtBig` was 0 on 15 of 20 words and 0 on every `tgtOK` 0 word.
      The cause is inversion: candidates judged as resting on the whole
      target, or `NONE`. 14 attempts over 5 words. Kill criterion met, no
      targeted second pass built.**
- [x] Every threshold in `topology.js` has a stated derivation, and any
      threshold whose only justification was a failing gold run says so
      in `docs/STATUS.md` rather than claiming product lineage.
- [x] A proposed threshold set, with evidence, is recorded. Not applied.
      **`MIN_NODES` 5 to 4, `MIN_TRUNK_NODES` 4 to 3,
      `MAX_FANIN_PER_TRUNK_NODE` 2 to 3 and export it. `MAX_NODES`,
      `MAX_PATH_NODES` and the crown invariant unchanged and confirmed
      derived. Reproducible offline via `03-runs/derive-thresholds.mjs`.**
- [x] `docs/STATUS.md` no longer claims `MIN_NODES` came from the
      product. It did not, and the file says so.
- [x] No threshold, prompt, or coercion is changed in this ticket.
- [x] `npm test`, `npm run typecheck`, `npm run lint` green.
- [x] `node scripts/gold-words.mjs` unchanged in behaviour. Run it once
      before and once after and record both numbers, so "nothing changed"
      is a measurement rather than a claim. **0 of 4 before and 0 of 4
      after, different failure modes. Honest range across six runs is
      now 0 to 2 of 4.**

## Result, and what it hands to the next ticket

Both questions answered, and neither one opened a new architecture.
Ticket 03 changed no threshold, prompt, coercion or validator. It
corrected `docs/STATUS.md`, and it corrected two `src/claims.test.js`
assertions that were themselves part of the defect:

- The dispute test measured node count only and discarded the trunk floor
  with a `void`, which is why `battery`'s `MIN_TRUNK_NODES` rejection
  shipped unmeasured for a whole session. It now measures both floors and
  requires the derivation and the proposal to be on record.
- A new test asserts that every non-exported constant in `topology.js` is
  named as such in the evidence file, because `MAX_FANIN_PER_TRUNK_NODE`
  was unreachable by any test.

**The product decision this ticket cannot make.** Two of the four
hand-written gold maps are 4 nodes with a 3-node trunk. Either a 4-node
map is an acceptable Dependence Tree and both floors drop to 4 and 3, or
the hand-written maps are underspecified and should grow and the floors
stand. The numbers cannot decide it, and it is not resolved by whichever
pair makes the acceptance set score better. A human has to answer it
before ticket 04, because ticket 04 assembles maps against this gate.

**For the applying ticket.** The proposed `claims.test.js` assertion that
the hand-written gold maps pass the gate is written out verbatim in
`../research/03-generality-evidence.md`, section "The proposed
`claims.test.js` assertion". It cannot be added here: with the live floors
it fails, and this ticket forbids changing a threshold. It goes in when the
floors move, and `MAX_FANIN_PER_TRUNK_NODE` has to be exported with it.

## Kill criteria

- If the failures cluster by category, **stop and ask a human**. That is
  a product boundary question about what the tutor is for, and it is not
  a generator problem to be tuned away. Do not fix a domain boundary by
  changing prompts until the boundary stops appearing.
  **NOT TRIGGERED. Measured across 20 words, no clustering.**
- If the `TOO_LARGE` rationales do not recur for a word, do not build a
  targeted second pass. Record the negative and leave the architecture
  alone. **TRIGGERED AND HONOURED. Recorded as a negative; no second
  pass was built.**
- If the hand-written gold maps turn out to disagree with each other
  about what a Dependence Tree is, stop. Two human-written answers to
  the same question means there is no target to measure against yet.
  **NOT TRIGGERED. All four agree that the crown is the one node nothing
  rests on, and that assertion passed on all four. They disagree on
  depth, 3 to 8 nodes, which is a spread not a contradiction, and it is
  what makes the floor a judgement call rather than a derivation.**

## Out of scope

- Changing any threshold, prompt, coercion, or validator. This ticket
  measures.
- The RealityMap adapter, transport, job integration, Chapel, prod
  switch, deleting the v7 runtime.
- Widening `MAX_NODES`, `MAX_PATH_NODES`, or the candidate count.
- Treating the four gold words as the product. If they are not
  representative, the correct response is a finding, not a bigger
  acceptance set that has the same bias.
