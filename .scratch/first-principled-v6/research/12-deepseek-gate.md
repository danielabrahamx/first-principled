# 12 - DeepSeek dry-run gate

Recorded by `node --env-file=.env .scratch/first-principled-v6/research/12-deepseek-eval.mjs` on 2026-08-16.
Engine fingerprint: git 737170a (working tree dirty).
Model: `deepseek-v4-flash` (LLM-dependent). Local fallback only. Prod stays OpenRouter Nemotron `:free`.
Generator: one-shot via `buildOneShotSystemPrompt` and the landed transport with `LLM_*` swapped onto `DEEPSEEK_*`. Serial fallback is not scored. Not the ticket 07 Nemotron baseline.

This is a Reality Map quality bar, not a tutor-question eval. Deterministic
self-score of the gold maps is `node eval/map-quality/run.js` (no key).
Danny followability scores use `eval/map-quality/rubric.md` and are not in this file.

## Automated gate (live)

| Concept | Gate | Schema | Derive | Crown | Dependence | Adjacent | Gold labels | Gold pairs | Latency | Path | LLM |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| laptop | FAIL | no | no | no | no | yes | 0/8 | 0/7 | 73093ms | oneshot | yes |
| recursion | FAIL | no | no | no | no | yes | 0/4 | 0/5 | 76584ms | oneshot | yes |
| photosynthesis | FAIL | no | no | no | no | yes | 0/5 | 0/6 | 78072ms | oneshot | yes |
| battery | FAIL | no | no | no | no | yes | 0/4 | 0/4 | 75218ms | oneshot | yes |

## Node labels (live)

- none (generation did not return maps)

## Failures and blockers

- laptop: one-shot reply was not valid JSON in the required shape; schema: realityMap.layers must contain at least one layer; derive: map must have layers, nodes and edges; dependence: no built-on / depends-on / abstraction-of edge; crown: no node label names "laptop"
- recursion: one-shot reply was not valid JSON in the required shape; schema: realityMap.layers must contain at least one layer; derive: map must have layers, nodes and edges; dependence: no built-on / depends-on / abstraction-of edge; crown: no node label names "recursion"
- photosynthesis: one-shot reply was not valid JSON in the required shape; schema: realityMap.layers must contain at least one layer; derive: map must have layers, nodes and edges; dependence: no built-on / depends-on / abstraction-of edge; crown: no node label names "photosynthesis"
- battery: one-shot reply was not valid JSON in the required shape; schema: realityMap.layers must contain at least one layer; derive: map must have layers, nodes and edges; dependence: no built-on / depends-on / abstraction-of edge; crown: no node label names "battery"

No transport blocker. One or more live maps failed the automated gate (see rows above).

## Why (inspect, laptop)

DeepSeek understood the one-shot schema: content starts with
`isValidConcept`, `layers`, `l0` Physics. It still thinks. `thinking: false`
sends OpenRouter `reasoning: { effort: "none" }`, which DeepSeek ignores.
A second laptop call had 29599 chars of chain-of-thought and 4033 chars of
truncated JSON (`parseModelJson` null because the object never closes).
`maxTokens` 8192 is eaten by thinking, so the map JSON is cut mid-key.
Reading `reasoning` does not recover the map: the first `{...}` span is a
layer fragment (`id`, `name`, `nodes`), not the full object.

This is not the Nemotron ticket 12 bar. Replay `:free` after UTC midnight
into `12-live-maps`. No prompt rewrite here. A later DeepSeek transport
fix would send DeepSeek's own thinking-off flag, not an OpenRouter field.

No secrets in this file. Key material is redacted if it ever appears in an error string.
