# 07 - Tutor quality eval harness: the measurable bar

**Type:** task
**Status:** resolved 2026-08-10 (parallel pass, Buffy)
**Blocked by:** none
**Related:** tickets 01, 02, 04, 05, 06; v1 ticket 04 (reliability numbers);
spec section 10 (metrics)

## Question

The destination says the rebuilt tutor must be "judged against a quality bar
we can measure." What is that bar? The v1 engine was measured for reliability
(30/30 map generations) but never for teaching quality. What does a scored,
CI-runnable eval of gap selection, question quality, map validity, and
transfer grading look like - and what is the v1 baseline every engine change
is compared against?

## What

1. A fixed concept set (e.g. laptop, recursion, photosynthesis, battery, a
   transfer question set) usable with a stubbed or live LLM.
2. Scorers:
   - Gap selection: does the chosen probe target a real gap, in dependency
     order (checkable against the reality map deterministically)?
   - Question quality: a rubric (Socratic not lecturing, single question,
     prediction-forcing, no leak) scored by the model or by rubric rules.
   - Map fidelity: does the learner map update match the learner's actual
     words (evidence accuracy)?
   - Transfer grading: agreement of the grade with a rubric judge.
3. Baseline: run the harness against the current v1 engine and record scores.
4. CI integration: a script (npm run eval) so every engine change reports
   before/after; ticket 02 is only resolvable against this bar.

## Acceptance criteria

1. The harness runs locally and in CI with a single command.
2. Baseline scores for the v1 engine are recorded in the ticket resolution
   and in `research/07-eval-baseline.md`.
3. The rubric is written down so a later session can judge consistently.
4. No flaky tests: the harness is deterministic or marks LLM-dependent scores
   clearly.

## Resolution (2026-08-10)

Landed as `eval/` (excluded from tsc, run with `node eval/run.js`):
concept fixtures, scorers, and a runner that scores a scripted session per
concept. Metrics: fixture validity, session invariants (errors), gap
targeting (dependency-order compliance), question rubric, evidence fidelity,
probe prompt char count (the prompt-budget lever), llm calls per session,
and transfer grading (scripted now; real grading needs a live key).
`--baseline` captured v1's numbers on the pristine tree before any engine
change: probe prompts avg 5,795 chars, gap targeting 8/9, rubric 1.00,
evidence 1.00.

Eval is deterministic (no live LLM needed) so it runs in CI and gates
regressions; the live DeepSeek pass waits on the key top-up. Baseline lives
in research/07-eval-baseline.md.

