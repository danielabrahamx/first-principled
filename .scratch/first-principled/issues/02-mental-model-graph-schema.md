# 02 - Mental model graph schema

**Type:** task
**Status:** resolved (opencode, 2026-08-07)
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

## Resolution (2026-08-07)

The shared shape lives in `src/lib/mmg/` as plain ES modules with JSDoc
typedefs: `types.js` (typedefs plus `NODE_STATES` and `EDGE_TYPES` constants),
`validator.js` (`validateRealityMap` incl. the layer-chain contiguity
invariant, `validateLearnerMap`, `validateDiff`), `closeness.js`
(`closenessScore`), `fixtures.js` (full laptop reality map - physics to
materials to electronics to logic to OS to apps - plus a partial learner map
with a misconception and a missing node), and `mmg.test.js` (24 tests on the
built-in node:test runner).

**Decision - JSDoc over TypeScript.** Both runtime consumers (the browser
frontend and the Node 18+ Netlify function) must import this schema, and
neither runs `.ts` without a build step; ticket 01 pinned zero runtime
dependencies and no build step. So the shape is typed with JSDoc typedefs over
plain ES modules and verified with a dev-only `tsc --noEmit --checkJs`
(`npm run typecheck`; typescript + @types/node are devDependencies only, the
runtime stays zero-dep). Tests run via `node --test` (`npm test`). Verified on
Windows: typecheck clean, 24/24 tests pass, `npm run build` clean, `npm
install` 0 vulnerabilities.

**Shape:** matches spec section 7 with two small extensions recorded there -
learner edges carry `evidence` like learner nodes, and closeness is
`correct / known` where known = not untested, and 0 when nothing is known yet.
Contiguity invariant: every layer after the first must have at least one edge
connecting it to a strictly lower layer (either endpoint); the validator
rejects a gapped chain. All validators return `{ ok, errors }` and are pure;
`closenessScore` is deterministic (fixture: 3 correct of 6 known = 0.5).

Caught during work: an early draft of `validateDiff` compared the
`ValidationResult` object instead of the node id, which would have rejected
every valid flip - fixed before shipping and covered by tests.
