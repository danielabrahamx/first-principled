# 02 - Surface realization and honesty

**Type:** task
**Status:** resolved (2026-09-29). Gate rejects degenerate trees with
named tests. Realization ships with the boundary enforced. The honest
gold rate is 1 to 2 of 4, down from a 4 of 4 that partly measured
nothing. Evidence: `../research/02-realization-evidence.md`.
**Blocked by:** 01 (resolved 2026-09-29, GO)
**Related:** 01 evidence `../research/01-spike-evidence.md`,
`docs/STATUS.md` "Known to be broken", `docs/DESIGN.md`
"The Contract pattern" and "Where the seams are for the next change"

## Question

`selectTopology` returns `ok: true` for a 2-node graph. Once the gate
rejects the degenerate case, can the generator clear the real gate
repeatedly, and is the resulting tree followable by a human?

## Why this is one ticket and not three

The evidence file already says it: "Ticket 02 is bigger than a
realization pass. It has to make the gate reject a degenerate tree, and
then make the generator reliably clear the stronger gate. Those are one
problem, not two." `01-spike-evidence.md`, 2026-09-29, section
"variance is worse than first measured".

A realization pass built on the current gate would realize a 2-node stub
into learner-facing copy and call it a product. The gate has to bite
first.

## What

### 1. The gate must reject a degenerate tree by construction

`src/lib/agent/pairwise/topology.js` today: `MAX_NODES` is a cap,
`TRUNK_MIN` is only a scoring preference inside `scoreTrunk`, so
acceptance never depends on size. Measured: in one run on identical code
`photosynthesis` returned 9 nodes / 15 edges / an 8-node trunk while
`laptop` returned 2 nodes / 1 edge, and both were reported PASS.

- Export `MIN_NODES` and use `TRUNK_MIN` as a rejection threshold, not a
  preference. The selected trunk must have at least `TRUNK_MIN` nodes and
  the tree at least `MIN_NODES` nodes, or `selectTopology` returns
  `ok: false` with a diagnostic that says which one failed.
- Selection must not fabricate. If the best available path is short, the
  honest answer is failure, not a padded tree.
- `MAX_NODES` stays a cap.

### 2. The generator must clear the stronger gate, measured not guessed

Node count ranged 2 to 9 across two full gold sets on the same code and
route. That range is the defect, and it is a generator question, not a
prompt rewrite. Before changing anything, measure where the nodes are
lost: relation histogram, jump histogram, and per-batch drop reasons for
each gold word.

The two candidate causes, to be separated by measurement and not by
preference:

- **Inventory too small or too shallow.** 8 to 10 candidates, one call,
  no notion of granularity. If the deepest concepts are all the same
  depth, no chain can reach a foundation.
- **Judgment too sparse.** The model calls NONE on most pairs, or calls
  TOO_LARGE on the real dependencies so `topology.js` drops every edge
  into the target. The recorded unprompted `TOO_LARGE` citing a missing
  bridge is exactly this shape.

Constraints on the fix: it is a coercion or a code-owned rule, never a
new architecture (the task graph is settled) and never a semantic
inference in code (`docs/DESIGN.md`: "The law... stage 3 may only touch
what stages 1-2 cannot"). Whichever cause measurement names is the one
that gets fixed, and the other is recorded as not-the-cause.

`scripts/gold-words.mjs` gains the histograms and the gate reason so the
next session can read the cause off one command.

### 3. Realization, after the gate bites

The model writes learner-facing copy for nodes `selectTopology` already
selected. The seam is already clean: `selectTopology` returns ids,
labels, glosses, ranks, and rationales, and does not return a
`RealityMap`.

- The realization call receives the selected nodes and edges as fixed
  input and returns copy keyed by existing node id and edge id.
- It must not invent structure. No new node, no new edge, no reordering.
  A returned id that topology did not select is a gate failure, not a
  row to drop. A node selected but unrealized is also a gate failure,
  because UNKNOWN copy is a change to the product and needs a human
  decision (`docs/DESIGN.md`, "Honesty as an architectural property").
- Same four-part Contract as every other boundary: prompt, schema,
  coercion (frame only), gate (authoritative).
- Not in prod this ticket. `realityMap.js` and the v7 runtime stay
  untouched. No Chapel work.

### 4. A human walks a tree

Followability is the product and it is entirely unmeasured. At least one
generated tree gets realized to a rendered form and walked against the
four questions the v9 map already predeclares: are the foundations
right, is there any invented history, are the relationships the point,
would you open a rabbit hole. Record the answers in
`../research/02-realization-evidence.md`.

## Acceptance criteria

- [x] `selectTopology` returns `ok: false` for a 2-node graph, and
      `topology.test.js` has a test named so that a degenerate tree is
      rejected. A test that only passes a non-degenerate tree is not
      evidence.
- [x] `selectTopology` returns `ok: false` for a tree whose best trunk is
      shorter than `TRUNK_MIN`, with a diagnostic naming the trunk
      length.
- [x] No change to `MAX_NODES` cap behaviour; `MAX_PATH_NODES` unchanged.
- [x] `node scripts/gold-words.mjs` prints relation and jump histograms
      and the gate reason per word.
- [x] The cause of the size variance is named from that output, with the
      run date and route, and only that cause is fixed.
- [x] Realization returns copy for every selected node and every selected
      edge, and nothing else. A hallucinated id fails the gate.
- [x] Realization is not in prod. `src/lib/agent/realityMap.js` and
      `src/lib/agent/arrange.js` are byte-identical to `main`.
- [x] One tree realized and walked by a human, recorded in
      `../research/02-realization-evidence.md`.
- [x] `npm test`, `npm run typecheck`, `npm run lint` green.
- [x] `docs/STATUS.md` updated in the same commit: gate now rejects
      degenerate trees, and the gold node range restated from the new
      runs.

### Not met, and carried forward

- [ ] **The generator does not reliably clear the stronger gate.** The
      honest rate is 1 to 2 of 4 across runs on identical code and route,
      and node count on a given word swings between 4 and 9. The gate is
      now correct, so this is a generator-quality gap, not a measurement
      gap. Recorded in `../research/02-realization-evidence.md` section 2,
      with the two prompt changes that were measured and reverted. Ticket
      03 is blocked on it: adapting a map with this much variance would
      bake the variance into the assembly layer.
- [ ] **The crown invariant fires on live data** (photosynthesis, 1 of 4
      runs: two selected edges resting on the target). The gate catches
      it, which is the fix working. The underlying model behaviour is
      unaddressed.

## Kill criteria

- If the honest pass rate on the gold set is zero after the gate bites
  and the measured cause is fixed, stop and record it. Do not lower the
  gate to make the number look better. A gate fitted to the failure it
  was meant to catch is what killed v7
  (`01-spike-evidence.md`, 2026-09-29).
- If the measured cause is dependence judgment itself being wrong
  (not its delivery, not its sparsity), that is the condition
  `docs/FALSIFIED.md` names for revisiting Jev. Record it; do not
  redesign the generator in this ticket.

## Out of scope

- RealityMap assembly, transport hardening, job integration, Chapel,
  deleting the v7 runtime, prod switch.
- Prompt rewrites of the v7 generator.
- Concept identity / RDF (deferred in `docs/FALSIFIED.md`).
