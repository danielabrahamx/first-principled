# 04 - Reality map generation

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 01, 02, 03
**Related:** spec sections 4, 7, 8; `docs/MISSION.md`; `src/lib/mmg/`

## Question

How does the agent turn a bare word or phrase into a complete, contiguous
Reality Map?

## What

1. A generation prompt in `src/lib/agent/realityMap.ts` that:
   - Takes the word or phrase and returns a RealityMap JSON per the schema.
   - Directs the model to enumerate the full contiguous layer chain from
     observation-level reality to the thing itself - no skipped intermediate
     steps (principle 12). For "laptop" that means physics to materials to
     electronics to logic gates to microarchitecture to OS to apps.
   - Uses typed edges (built-on, abstraction-of, part-of, depends-on) so the
     layer structure is explicit.
   - Lets the model decide depth, with a soft cap (default around 6 layers,
     tunable) so it does not rabbit-hole.
   - Uses the model's own knowledge only; no web calls in v1.
2. JSON-mode / structured output per ticket 03 findings, with the text-parse
   fallback.
3. Unit tests with fixture words (laptop, recursion, photosynthesis):
   schema-valid output, contiguous layers, sane depth.

## Acceptance criteria

- Each fixture word produces schema-valid RealityMap JSON with a contiguous
  layer chain and no obvious skipped intermediate steps.
- Generation latency acceptable (under 30s per call at the chosen model).
- Non-word or gibberish input returns a graceful refusal, not a hallucinated
  map.

## Docs rule

Commit and push before done. Update spec section 8 if phase behavior changes.
