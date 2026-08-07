# 04 - Reality map generation

**Type:** task
**Status:** resolved (opencode, 2026-08-07)
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

## Answer (2026-08-07)

Delivered as `src/lib/agent/realityMap.js` (generation), `src/lib/agent/llm.js`
(transport), `src/lib/agent/jsonParse.js` (defensive parse). The `.ts`
mentioned in "What" is delivered as JSDoc-typed ES modules per the ticket 02
decision - no runtime consumer runs `.ts` without a build step.

- **Prompt** (`buildRealityMapSystemPrompt`): mission + principles 11-12
  ("no skipped intermediate steps"), typed edges (built-on, abstraction-of,
  part-of, depends-on, predicts, contradicts), model-decided depth with a
  soft cap (default 6 layers, tunable), model knowledge only, and a refusal
  contract: `{"isValidConcept": false, "reason": "..."}` for non-teachable
  input, else `{"isValidConcept": true, "map": {...}}`. Contains the word
  "json" and an example - both required by DeepSeek JSON mode. Includes an
  edge-type translation table ("X produces Y" means Y depends-on X, etc.) -
  without it the model repeatedly invented types like "produces" for
  photosynthesis and burned the repair budget.
- **Attempt loop**: up to 3 calls - one generation plus two repair attempts.
  Repair 1 cites the validator errors; repair 2 (final) additionally narrows
  the instructions ("fix exactly the flagged problems, do not add or rename
  layers or nodes"). A mechanical cleanup pass drops edges referencing
  unknown node ids (pasted example fragments) before every validation; the
  validator remains the gate. Refusals are honored at any attempt, never
  repaired.
- **JSON handling** (per ticket 03): json_object mode, then fallback chain -
  JSON.parse, balanced `{...}` span extraction (tolerates fences/commentary),
  then the repair loop. A schema-invalid map (gapped chain, unknown ids,
  malformed layers) also triggers repair, citing the errors.
- **Thinking mode decision** (ticket 03 left it open): thinking OFF for map
  generation. Live: thinking ON gave 47-54s per map (over the 30s AC);
  thinking off gives 5-20s. Sent as top-level `thinking` param - the
  OpenAI-SDK style `extra_body` nesting is silently ignored by this API
  (verified live with probe calls).
- **Latency** (live, deepseek-v4-flash): single-attempt maps 5-14s; worst
  case with two repairs ~20-25s. Under the 30s per-call budget.
- **Graceful refusal**: "qwertyuiop" -> refused in ~1s with a clean reason,
  no map, in every live run.
- **Reliability, measured**: the naive one-repair design was ~80% on
  photosynthesis (the model repeated the same slip - invented edge types,
  then gapped chains, then double-unparseable replies). After the
  translation table + cleanup + second repair tier: 30/30 consecutive
  photosynthesis runs green, plus two consecutive full live suite runs
  24/24. Maps are only ever returned through the validator gate.
- **Validator bug found and fixed** (src/lib/mmg/validator.js): live model
  output with a layer missing its `nodes` array crashed `layerMirrorErrors`
  (it could throw instead of returning errors). Guarded; regression test
  added in mmg.test.js. The gate is total now: it never throws.
- **Tests**: 20 unit tests (mock transport: happy paths, flat/enveloped
  maps, refusals, empty input, cleanup, escalating repairs, error
  surfacing, prompt contract) + 4 live tests gated on `LIVE_LLM=1` (three
  fixture words and gibberish, using the real `.env` key). Full suite
  79 pass / 0 fail, 4 skipped without the gate; `npm run typecheck` clean.
- **Spec**: section 8 Init updated (generation internals, refusal behavior).
  No phase structure changed.
- **Live verification**: `LIVE_LLM=1 node --env-file=.env --test
  src/lib/agent/realityMap.test.js`. 24/24 green on the final runs.
