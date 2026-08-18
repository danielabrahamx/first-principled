# 08 - Mixed thinking on DeepSeek battery

Live probe: `08-mixed-thinking.mjs`. `LLM_PROVIDER=deepseek`. Concept
`battery`. 2026-08-18.

The timings and failure mode below remain the record. The leftover
suggestion to read JSON out of hidden thinking is dead:
[Lock the thinking architecture from the council](../issues/09-lock-the-thinking-architecture-from-the-council.md)
locked Option A (thinking off, JSON Schema on Epiphanies) and forbids
parsing `reasoning_content` as the JSON contract. Next:
[Ship JSON Schema on Epiphanies](../issues/10-ship-json-schema-on-epiphanies.md).

Chronology thinking off, Epiphanies thinking on, Arrange thinking off.

## Result

Mixed thinking does not get a Tree.

- Chronology, thinking off: 5096 ms. `content` 2235 chars. Hidden
  thinking 0. Parsed `concept` and `chronology`.
- Epiphanies, thinking on: 74777 ms. `content` 784 chars. Hidden
  thinking 34818 chars. Parser keys `null`. Error: epiphanies reply
  must contain an epiphanies array.
- Arrange: never ran.

Total 79877 ms. `OK=false`.

## What that means

Turning thinking on for the joints step brought back the "it thinks
for a long time and does not give us the JSON we need" problem. The
transport already copies hidden thinking into `content` when `content`
is empty. Here `content` was not empty, so that copy did not run, and
the 784 characters were not an `epiphanies` array.

Default stays thinking off on every stage. `thinkingByStage` remains
only as an unused seam. Do not parse the hidden thinking dump.

No secrets. No prompt rewrite. Prod stays OpenRouter.
