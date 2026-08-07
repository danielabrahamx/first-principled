# 02 - Mental model graph schema

**Type:** task
**Status:** ready-for-agent
**Blocked by:** 01
**Related:** spec section 7, `src/lib/mmg/`

## Question

What is the exact TypeScript shape of the Mental Model Graph both sides of the
system share?

## What

1. `src/lib/mmg/types.ts`:
   - RealityMap: concept, layers (ordered, contiguous), nodes (id, label,
     layer, description), edges (source, target, type in part-of | depends-on |
     built-on | abstraction-of | predicts | contradicts).
   - LearnerMentalModel: nodes with state (untested | missing | misconception |
     correct), confidence 0..1, evidence (learner quote strings); edges with
     state and confidence.
   - Diff: added, flipped (from, to), updated.
   - closenessScore(learnerMap): fraction of known learner nodes whose state is
     correct. Known = state is not untested.
2. Layer-chain contiguity invariant: every layer after the first has at least
   one edge from a lower layer; the validator rejects gaps.
3. JSON fixtures in `src/lib/mmg/fixtures.ts`: a full "laptop" example with a
   contiguous chain (physics to materials to electronics to logic to OS to
   apps) and a partial learner map with at least one misconception and one
   missing node.
4. Unit tests: schema validation, contiguity rejection, closeness score
   determinism.

## Acceptance criteria

- Types compile, validator rejects a gapped layer chain.
- Fixtures valid against the schema.
- closenessScore deterministic and matches hand calculation.
- Tests pass on Windows.

## Docs rule

Commit and push before done. Update spec section 7 if the shape diverges.
