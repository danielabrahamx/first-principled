# 12 - live maps

Full one-shot Reality Maps for Danny scoring on
[Danny scores followability](../issues/12-danny-scores-followability.md).

Empty until the OpenRouter `:free` cap resets. Then, from the repo root:

```
node --env-file=.env eval/map-quality/run.js --live --maps-dir .scratch/first-principled-v6/research/12-live-maps --baseline .scratch/first-principled-v6/research/12-live-gate.md
```

Each concept becomes `<concept>.json` with layers, nodes, edges, and
observations. The ticket 07 baseline file is not overwritten. No secrets.
No prompt rewrite. Ticket 13 still waits on the cap for quality retune.
