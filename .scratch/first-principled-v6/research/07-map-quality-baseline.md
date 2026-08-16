# 07 - Reality Map quality baseline

Recorded by `node --env-file=.env eval/map-quality/run.js --live` on 2026-08-16.
Engine fingerprint: git 699a463 (working tree dirty).
Model: `nvidia/nemotron-3-ultra-550b-a55b:free` (LLM-dependent).
Generator: one-shot via `buildOneShotSystemPrompt` and the landed OpenRouter transport. Serial fallback is not scored.

This is a Reality Map quality bar, not a tutor-question eval. Deterministic
self-score of the gold maps is `node eval/map-quality/run.js` (no key).
Danny followability scores use `eval/map-quality/rubric.md` and are not in this file.

## Automated gate (live)

| Concept | Gate | Schema | Derive | Crown | Dependence | Adjacent | Gold labels | Gold pairs | Latency | Path | LLM |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| laptop | FAIL | no | no | no | no | yes | 0/8 | 0/7 | 120684ms | oneshot | yes |
| recursion | PASS | yes | yes | yes | yes | yes | 2/4 | 0/5 | 43566ms | oneshot | yes |
| photosynthesis | PASS | yes | yes | yes | yes | yes | 1/5 | 0/6 | 40582ms | oneshot | yes |
| battery | FAIL | no | no | yes | no | no | 2/4 | 0/4 | 43031ms | oneshot | yes |

## Node labels (live)

- recursion: call stack, function call, self-reference, recursive definition, recursion
- photosynthesis: visible light, carbon dioxide and water, oxygen comes from water in green plants, light energy fixes carbon into sugar, chloroplasts are the site of photosynthesis, two photosystems drive electron flow from water to NADP+, photosynthesis
- battery: redox reaction, electric charge flow, anode material, cathode material, electrolyte, galvanic cell, voltaic pile, daniell cell, lead-acid battery, lithium-ion battery

## Failures and blockers

- laptop: LLM response had no choices; schema: realityMap.layers must contain at least one layer; derive: map must have layers, nodes and edges; dependence: no built-on / depends-on / abstraction-of edge; crown: no node label names "laptop"
- battery: schema: layer chain gap: layer "material components" (l1) has no edge connecting it to a lower layer; schema: layer chain gap: layer "electrochemical cell" (l2) has no edge connecting it to a lower layer; schema: layer chain gap: layer "voltaic pile" (l3) has no edge connecting it to a lower layer; schema: layer chain gap: layer "improved batteries" (l4) has no edge connecting it to a lower layer

Exact blocker (laptop row): LLM response had no choices (empty OpenRouter choice at 120s). Battery failed the automated gate. Recursion and photosynthesis passed the gate with low gold-label overlap. Danny rubric scores are not in this file.

No secrets in this file. Key material is redacted if it ever appears in an error string.
