# 05 - RealityMap adapter and generated-map gate

**Type:** task
**Status:** open
**Blocked by:** none (04 resolved 2026-10-01)
**Related:** `../research/04-derived-threshold-application.md`,
`../research/03-generality-evidence.md`, `../../src/lib/agent/pairwise/realize.js`,
`../../src/lib/agent/pairwise/topology.js`, `../../src/lib/mmg/validator.js`,
`../../docs/DESIGN.md`

## Question

`selectTopology` returns node ids, labels, glosses, ranks, rationales and
a trunk. `realizeTree` returns learner-facing headings, glosses and
`because` warrants. **Neither returns a `RealityMap`.** So the one shape
the frontend and the Socratic engine both consume has never been produced
by the v9 generator.

Does a generated selection assemble into a `RealityMap` that
`validateRealityMap` accepts, without the adapter inventing anything?

The seam was never the obstacle. `selectTopology` returns everything a
realization pass needs and nothing it does not, so this is assembly, not
design.

## What this ticket is for

One function, one module, one table in `scripts/gold-words.mjs`. The
questions it has to answer:

1. **What is a layer?** `selectTopology` returns `ranks`, computed as
   leaves 0 and every other node one above its deepest prerequisite. The
   `RealityMap` wants ordered contiguous `layers`. Is "rank" the layer, or
   is a rank gap possible?
2. **Does layer contiguity hold?** `validator.js` rejects any layer with
   no edge to a strictly lower layer. Ranks are computed over the
   *selected* nodes, so it should hold by construction. Prove it on a real
   run rather than reasoning about it, because a failure here is silent
   until the frontend draws it.
3. **What does honesty look like with no history?** The v9 generator
   produces **no `ObservationRecord` at all**. Every `basis` in
   `eval/map-quality/gold.js` is a real discovery the adapter did not
   make and must not fabricate. So a generated map has `role` absent and
   `basis` absent. That is honest and it is also a visible product
   consequence: **Chapel arrow-hover history will be empty for v9 maps**
   until the edge-history adapter in ticket 08. Confirm that is true
   rather than assuming it, and write it down either way.
4. **What `type` does a Dependence edge get?** Pair judgments are
   dependence only. `EdgeType` allows six. Picking `depends-on` for all of
   them is the only defensible answer and it should be stated as a
   decision, not left implicit.

## Constraints, all of them inherited

- **Code owns the frame, the model owns the judgment.** The adapter
  invents no node, no edge, no label, no `because`. Every edge traces to
  one accepted pair judgment and every node to one candidate or the
  target. This is the law in `docs/DESIGN.md`, "The Contract pattern".
- **The adapter must not repair the generator.** The selection handed to
  it includes the inverted maps that died on the crown invariant, 6 of 20
  words in the 2026-10-01 run. If the adapter is asked to assemble a
  selection `selectTopology` returned `ok: false` for, it fails honestly
  and returns the reason. It does **not** reinterpret it, drop the
  offending edges, or reach for `droppedJudgments` to build something.
  Salvaging a rejected selection is the v7 pattern in
  `docs/FALSIFIED.md`, and it is the specific thing this ticket exists to
  not do.
- **No history, so no `EPIPHANY`.** Do not synthesise an
  `ObservationRecord` to fill the field. `UNKNOWN` is legal and absent is
  honest. See "Honesty as an architectural property" in
  `docs/DESIGN.md`.
- **Nothing reaches prod.** No `src/api/agent.js` change, no runtime
  import, no fallback chain, no Chapel change. The v7 three-stage
  generator stays exactly where it is. The switch is a later ticket and
  it is atomic.

## Acceptance criteria

- [ ] An adapter module exists under `src/lib/agent/pairwise/` that takes
      a successful `selectTopology` result plus a `realizeTree` result and
      returns a `RealityMap`.
- [ ] Its output passes `validateRealityMap` with zero errors, on every
      real run, including the ones where the generator produced a
      degenerate-but-accepted tree.
- [ ] Every edge it emits traces to one accepted pair judgment, and there
      is a test asserting that: no edge whose endpoints are not both in
      the selection, no duplicate `source,target` pair.
- [ ] Layer assignment is derived from `ranks`, contiguity holds, and a
      test covers a selection with a rank gap.
- [ ] `role` and `basis` are absent on every generated node, with a test
      asserting no `ObservationRecord` is ever synthesised.
- [ ] `scripts/gold-words.mjs` prints the assembled map's node count,
      layer count and validator verdict per word.
- [ ] Given a selection with `ok: false`, the adapter returns a named
      failure carrying `selectTopology`'s reason, and a test asserts it
      does not return a map.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` green.
- [ ] `node scripts/gold-words.mjs` re-measured, before and after, both
      numbers recorded.
- [ ] Docs updated in the same commit: `docs/STATUS.md`, and
      `docs/DESIGN.md` if the insertion point moved.

## Kill criteria

- If a valid `RealityMap` cannot be assembled from a valid selection
  without inventing structure, **stop and write down what is missing.**
  That is a finding about the seams, not a licence to synthesise.
- If layer contiguity fails on a real run and the only fix is to invent
  an edge to bridge two layers, **stop.** That is code manufacturing a
  dependence relation, which `docs/DESIGN.md` says code cannot do.
- If the adapter needs to know *why* a candidate was in the inventory, or
  anything about judgments it was not handed, the seam is wrong. Fix the
  seam, report it.
- **Do not go looking for the inversion.** It is 6 of 20 words, it is
  diagnosed, and it is not this ticket. See
  `../research/03-generality-evidence.md` section 2.

## Out of scope

- Any threshold in `topology.js`. They are derived, applied and asserted
  by `src/claims.test.js`.
- Any prompt, coercion or validator change.
- History, `EPIPHANY`, the crux, edge provenance on hover. Ticket 08.
- Chapel, transport, job integration, the prod switch, deleting v7.
- Fixing the generator's semantics.

## The number to beat

Gold set, `node scripts/gold-words.mjs`, `deepseek-flash`: **0 to 2 of 4**
across eight runs as of 2026-10-01. Anything this ticket reports as an
improvement smaller than that spread is noise. **One run measures
nothing**: the gold set returned 0 of 4 twice on 2026-10-01, minutes
apart, with different failure modes.