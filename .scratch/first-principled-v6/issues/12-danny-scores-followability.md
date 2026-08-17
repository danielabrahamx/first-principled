# 12 - Danny scores followability

**Type:** grilling

**Status:** claimed (cursor, 2026-08-16)

**Blocked by:** [Init uses one-shot with no serial fallback](10-init-uses-one-shot-with-no-serial-fallback.md)

**Related:** [Reality Map quality eval](07-reality-map-quality-eval.md), [Deploy a followable tree](11-deploy-a-followable-tree.md), [One-shot gold maps pass the quality gate](13-one-shot-gold-maps-pass-the-quality-gate.md)

## Question

The automated gate can pass a structurally honest map that is still not
worth following. How do the four gold live maps score on
`eval/map-quality/rubric.md` when Danny judges them?

## What

HITL. The agent does not stand in for Danny.

1. Replay one-shot after the `:free` cap resets. Persist full live maps
   (layers, nodes, edges, observations) with `--maps-dir` and a new
   `--baseline` so the ticket 07 file is not overwritten. Put those JSON
   trees in front of Danny. Do not generate while the cap is 429.
2. Grill through the rubric lines: followable foundations, no invented
   history, relationships are the point, would I open a rabbit hole.
   Every line is 0 or 1. No skip. A gate fail is four 0s; still write
   the row.
3. Record 0/1 per line per concept in
   `.scratch/first-principled-v6/research/12-danny-followability.md`.
   No secrets.

Do not change the prompt in this ticket. If the scores fail the
followability bar, that graduates a later retune; it is not this
session's patch.

## Settled (2026-08-16 grilling)

- Score the four gold live maps, not gold fixtures.
- Every rubric line is 0 or 1. No skip.
- Gate fail is four 0s with a note naming the gate error.
- Labels-only is not enough. Full JSON must be in front of Danny.
- Replay command (after the cap resets; no prompt rewrite):

```
node --env-file=.env eval/map-quality/run.js --live --maps-dir .scratch/first-principled-v6/research/12-live-maps --baseline .scratch/first-principled-v6/research/12-live-gate.md
```

## Dry-run (2026-08-16)

OpenRouter `:free` was 429. Local `deepseek-v4-flash` four-gold live eval
all FAIL. Shape inspect: the model starts the one-shot schema, then
thinking eats `maxTokens` and content truncates. Record:
[12-deepseek-gate.md](../research/12-deepseek-gate.md).
Replay Nemotron into `12-live-maps` after the cap resets. Do not score
DeepSeek maps as this ticket's bar.

## Acceptance criteria

- [ ] Full live maps persisted as JSON (layers, nodes, edges, observations)
- [ ] Danny scored all four gold live maps against the rubric
- [ ] Scores file exists, one row per concept, every line 0 or 1, no skip,
      no secrets
- [ ] The agent did not invent Danny's scores
- [ ] No prompt or generator change in this ticket

## Docs rule

Pointer from this ticket and the map's Decisions so far. Rubric recording
rule changed this session (no skip; gate fail is four 0s). Not a new line.
