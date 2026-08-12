# 08 - Gap-free layer-chain structure

**Type:** task (AFK)
**What to build:** word-to-tree generation structured so the LLM cannot leave
gaps in the layer chain. The generator builds the tree bottom-up, layer by
layer: the foundation layer first, then each layer derived only from the layer
immediately below it, so a skipped intermediate step is structurally
impossible rather than merely validated against. The contiguity validator
(v1 02) and the repair loop (v1 04) stay as the backstop gate; the soft layer
cap stays. Extends the v2 two-phase foundation-first generator (v2 06).

**Blocked by:** None - can start immediately.

**Status:** resolved (opencode, Daniel session, 2026-08-12)

## Question

How does word-to-tree generation guarantee a gap-free layer chain by
construction, instead of by validation alone?

## Answer (2026-08-12)

Delivered as a rewrite of the generator's phase B in `src/lib/agent/realityMap.js`:
the two-phase flow (foundation + one full-map derive call) becomes a
per-layer bottom-up loop. A skipped intermediate step is now structurally
impossible, not merely rejected.

- **Phase A (foundation) unchanged in spirit**: the deepest observable layer,
  always normalized to layer id `l0`. New: the foundation's shape is
  validated in phase A (layer id/name/nodes, non-empty node list) - phase C
  locks the foundation in, so phase B's old habit of silently patching a
  malformed foundation is replaced by an explicit phase-A repair.
- **Phase C (per-layer derive loop)**: one LLM call per layer. Each call
  receives the concept and ONLY the layer immediately below it (the current
  top layer's full node definitions). The prompt fixes the next layer id
  (code assigns `l1`, `l2`, ... in order - the id sequence itself cannot
  skip), requires 1-3 nodes with `basis` (principle 5), 1-3 typed edges with
  at least one edge to the layer below, a per-layer self-review, and a
  `done` flag for when the given layer already contains the concept. The
  model never sees the foundation or any lower layer, so it cannot express a
  layer that is not the immediate successor of the last one built.
- **Code owns the hard checks at every step** (the backstop the ticket
  keeps): the merged candidate must pass `validateRealityMap` (v1 02
  contiguity + schema) AND `deriveCheck` (v2 06 reachability + basis) AND
  the per-layer rule (new layer connects to the layer immediately below it).
  Failures drive the v1 04 repair loop - up to two escalating repairs per
  layer citing the exact problems, with a final-attempt narrowing. The
  repair loop is real and exercised: 15 of 30 live concepts needed it, and
  it closed every failure it was given.
- **Edges may reference any already-built node** (so `predicts` edges to the
  foundation survive), but the layer below is the only map content the call
  sees - the structural guarantee lives in what the model can reference, not
  in what the validator permits.
- **Final backstop gate**: the assembled map leaves the function only through
  both validators, exactly as before. The soft layer cap stays (default 6,
  tunable) and is now hard-clamped to the validator's structural max (12).
- **Prompt-level id rule**: live runs showed the model occasionally reuses a
  node id from the layer below when a higher layer contains the same concept
  (n-flame, n-render); the prompt and repair message now require NEW unique
  ids per layer. This was the last reliability leak found during the 30/30
  verification.

**Tests**: `src/lib/agent/realityMap.test.js` rewritten for the per-layer
flow (34 tests: happy path with one call per layer, structural-proof test
that each call sees only the layer below, wrong-id / no-down-edge /
missing-basis / self-review / disconnected-node repairs, done handling, soft
cap, cap clamp, refusals, garbage-edge cleanup). `orchestrator.test.js` init
tests scripted to the per-layer shape. `eval/run.js` routing updated for the
per-layer generator (npm run eval green: 0 invariant errors). Full suite
274/274, `npm run typecheck` clean.

**Live verification (v1 reliability bar)**: 30/30 concepts generated
gap-free and valid against all three gates on real DeepSeek
(`deepseek-v4-flash`, thinking off), plus 2/2 clean refusals. Mean 20.8s per
concept (max 34.0s), including repairs - under the v1 30s per-call budget
per call, and one call per layer by construction. Evidence:
`.scratch/first-principled-v3/research/08-gapfree-verification.md`
(reproducible via `verify-gapfree.mjs`).

**Acceptance criteria**: all met - generation is structurally bottom-up;
a skipped intermediate step is impossible by construction (the layer it
would skip is the only content the next call receives); the contiguity
validator + deriveCheck + repair loop gate every layer and the final map as
backstop; live maps verified gap-free 30/30, recorded in the research
evidence file.
