# 09 - Lock the thinking architecture from the council

**Type:** grilling

**Status:** resolved

**Blocked by:** [DeepSeek thinks only on Epiphanies](08-deepseek-thinks-only-on-epiphanies.md)

**Related:** [Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md), [Ship JSON Schema on Epiphanies](10-ship-json-schema-on-epiphanies.md)

## Question

Given the council reply on thinking vs schema vs host timeout, which
architecture do we try next so DeepSeek returns valid joints JSON
quickly?

## What

HITL. Danny already has a council answer. This session exists to receive
it, store it, and lock one next move. Do not re-research. Do not reopen
followability scoring. Do not treat Netlify timeouts as the problem:
the background job can already wait 14 minutes, and thinking-on still
fails to return JSON. We want speed.

Facts already locked by
[DeepSeek thinks only on Epiphanies](08-deepseek-thinks-only-on-epiphanies.md):

- Thinking off: fast. Chronology parses. Epiphanies JSON is the wrong
  shape (bad `joint_kind`, missing `history`, names instead of `c1`).
- Thinking on, including mixed Epiphanies-on: slow hidden dump, content
  not an `epiphanies` array. Arrange never runs.
- Default stays thinking off. `thinkingByStage` exists as an override.

1. Paste the council reply into
   `research/09-thinking-architecture-council.md`. No secrets.
2. Lock one next architecture. Do not raise host timeouts. Do not add a
   fourth LLM call or a per-stage model unless the council kills the
   locked three-stage same-model rule with a concrete failure mode.
3. If the lock is "thinking off, fix the field contract," say so. If it
   is "read JSON from hidden thinking when content is short," say so.
   If it is something else, name it.
4. Do not change prompts or generator code unless Danny confirms that
   the locked option is an execution ticket for a later session.

**Out of this ticket.** Deploy. Prod DeepSeek. Followability KEEP/KILL.
Prompt rewrite without a locked architecture.

## Answer

Option A. Thinking off on every stage. JSON Schema on the Epiphanies
call, matching the existing Stage 2 field checklist. Chronology and
Arrange stay as they are. If a provider ignores `json_schema`, keep
`json_object`, fail the mechanical gate, and do not retry.

Rejected: Option B (thinking on plus a two-region emit; DeepSeek
refuses `response_format` with thinking). Option C (few-shot exemplars).
Raising Netlify timeouts. A fourth LLM call. Per-stage models. Parsing
`reasoning_content` as the JSON contract.

The tradeoff is owned: schema-valid joints at thinking-off speed, not
the deeper joints in the hidden thinking dump. Execution is
[Ship JSON Schema on Epiphanies](10-ship-json-schema-on-epiphanies.md).
[Danny scores followability on the three-stage Tree](07-danny-scores-followability-on-the-three-stage-tree.md)
waits on that ship. Record:
[09-thinking-architecture-council.md](../research/09-thinking-architecture-council.md).

## Acceptance criteria

- [x] Council reply stored in `research/09-thinking-architecture-council.md`
- [x] One next architecture locked, with the rejected options named
- [x] Netlify-timeout-as-fix is accepted or killed in writing
- [x] Ticket 07 is not claimed or scored in this session
- [x] No secrets
- [x] Map Decisions so far points at the lock

## Docs rule

Pointer from this ticket and the map. Do not restate the council essay
on the map. The research file holds the detail.
