# 05 - Anchor confidence 0..1 so it is not arbitrary

**Type:** task
**Status:** resolved 2026-08-10 (parallel pass, Buffy)
**Blocked by:** none
**Related:** tickets 02, 07; v1 ticket 05; spec section 7;
src/lib/mmg/types.js (LearnerNode.confidence); src/lib/agent/socratic.js

## Question

The model assigns each learner node a confidence 0..1 with only "record the
model as it is, not as you wish it were" as guidance
(buildSocraticUserPrompt) - so confidence is unanchored and means something
different on every turn. What is the operational definition of confidence,
so it is code-computed where possible and model-assigned only within defined
bands?

## What

1. An operational definition, e.g. confidence as a function of: number of
   independent observations/evidence quotes, consistency of the learner's
   statements across turns, and (once 04 lands) prediction success rate.
2. Where the engine can compute it deterministically (evidence count and
   consistency are countable), do it in code; where semantics are required
   (misconception vs missing), let the model assign within bands the prompt
   states.
3. Keep the schema unchanged (confidence stays 0..1) unless the definition
   requires otherwise.

## Acceptance criteria

1. The definition is written into the spec and reflected in the prompt.
2. Confidence behaves sensibly on the eval (07): a learner who gives
   consistent, correct answers has rising confidence; a flip from
   misconception to correct moves confidence meaningfully.
3. All existing tests pass; `npm test` green, `npm run typecheck` clean.

## Docs rule

Spec section 7 (data model - confidence semantics) updated in the same
commit.

## Resolution (2026-08-10)

Landed: `src/lib/agent/confidence.js` - pure `anchorConfidence(state, node)`
maps a model-reported band to a deterministic 0..1 number. Bands are
enumerated in the system prompt (refused = 0.15, guessing = 0.35, shaky =
0.55, confident = 0.75, certain = 0.95). The model reports the band plus the
learner's own words; code picks the number, so confidence is anchored to
named epistemic states instead of an arbitrary float. The band snaps upward
(never downward) on new supporting evidence and decays toward 0.5 on
contradiction, capping at 0.99 and flooring at 0.1. Wired into socratic.js
before the diff is computed; bands are stated in the system prompt.
`validateTurn` still clamps any stray 0..1 number. Unit tests cover each band
and the snap/decay rules.

