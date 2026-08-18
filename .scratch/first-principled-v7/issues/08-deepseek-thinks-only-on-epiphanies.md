# 08 - DeepSeek thinks only on Epiphanies

**Type:** task

**Status:** resolved

**Blocked by:** [LLM_PROVIDER is a one-var switch](03-llm-provider-is-a-one-var-switch.md)

**Related:** [Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md)

## Question

Does turning thinking on only for Epiphanies let DeepSeek return joints
that pass the field checklist, without bringing back the empty wait on
Chronology or Arrange?

## What

All-off thinking made DeepSeek answer quickly, but Epiphanies came back
in the wrong shape (`TECHNICAL` instead of a joint kind, no `history`,
regime names instead of `c1`/`c2`). All-on thinking often sat for minutes
with empty `content`. Chronology already worked with thinking off.
Arrange never ran.

1. `generateRealityMap` can send thinking per stage via `thinkingByStage`.
2. No prompt rewrite. No deploy. Do not block
   [Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md).
3. Live DeepSeek probe on `battery`. Record timings, whether Epiphanies
   passes, and whether Arrange is reached. No secrets.

**Out of this ticket.** Prompt retune. Turning thinking on for Arrange.
Scoring followability. Pointing prod at DeepSeek.

## Answer

No. Chronology with thinking off still works (~5 s). Epiphanies with
thinking on took 75 s, wrote 34k characters of hidden thinking, and
left 784 characters of `content` that was not an `epiphanies` array.
Arrange never ran. Default stays thinking off. `thinkingByStage` stays
as an override. Record: [08-mixed-thinking.md](../research/08-mixed-thinking.md).

## Acceptance criteria

- [x] Per-stage thinking exists (`thinkingByStage`)
- [x] Default thinking is off, off, off (mixed DeepSeek default was tried
      live and failed, so it is not shipped)
- [x] Unit tests lock the default and the mixed override
- [x] Live DeepSeek `battery` probe recorded (fail: Epiphanies did not parse)
- [x] No prompt change
- [x] No prod deploy
- [x] Key-leak grep clean

## Docs rule

Pointer from this ticket and the map's Decisions so far. Standing line
stays "JSON maps send thinking false". Mixed thinking is an override,
not the default. Record: `research/08-mixed-thinking.md`.
