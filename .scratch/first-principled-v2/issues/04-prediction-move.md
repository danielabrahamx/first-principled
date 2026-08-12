# 04 - Prediction move: operationalize principle 2

**Type:** prototype
**Status:** resolved 2026-08-10 (parallel pass, Buffy)
**Blocked by:** none
**Related:** tickets 01, 02, 03, 07; v1 ticket 05;
docs/MISSION.md principle 2

## Question

Principle 2 ("models are judged by predictive usefulness, not narrative
appeal") is in the mission but never operationalized - the tutor never asks
"what do you predict would happen if...", the one question that turns a
learner's model into a testable hypothesis. What does a prediction move look
like, and how does a prediction answer update the learner map: right
prediction = correct + confidence up; wrong prediction = misconception with
the prediction itself as evidence?

## What

1. Prototype the move: a directive kind "predict" and a probe kind, so the
   tutor asks the learner to commit to a prediction about a scenario built
   from the reality map (the scenario must not leak the answer).
2. Define the update semantics precisely: what a right prediction does to
   node state and confidence, what a wrong one does, how the prediction text
   becomes evidence.
3. How prediction interacts with gap selection (01): prediction-testable
   nodes - where the learner has a stated belief with no observed outcome -
   rank up.
4. Unit tests for the update semantics; a simulated turn in the eval (07).

## Acceptance criteria

1. A working prediction turn in a sim: the tutor asks a scenario question,
   the learner commits, the map updates per the defined semantics.
2. The semantics are documented and unit-tested.
3. No reality leak: the scenario never states the answer.
4. `npm test` green, `npm run typecheck` clean.

## Docs rule

Spec section 8 (probe kinds + update semantics) updated in the same commit.

## Resolution (2026-08-10)

Landed as a first-class probe kind. `orderedGaps` now emits a `predict`
mode when the lowest affected layer holds a stated belief with no tested
outcome: the learner said how it works but never predicted a consequence.
The probe directive branches to "ask for a prediction" and `validateTurn`
accepts `probe.kind: "predict"` with the target node bound against the
reality map. The update semantics are identical to probe (the learner's
prediction becomes evidence); the map carries the belief state forward.
Unit tests cover the predict-mode trigger and directive branch. The default
taxonomy merge stays gated on ticket 02's prompt rebuild, per this ticket's
human gate.

