# 07 - Danny scores followability on the three-stage Tree

**Type:** grilling

**Status:** ready-for-agent

**Blocked by:** [Deploy the three-stage Tree](06-deploy-the-three-stage-tree.md)

**Related:** [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)

## Question

How do the four gold live maps from the three-stage builder score on
`eval/map-quality/rubric.md` when Danny judges them?

## What

HITL. The agent does not stand in for Danny. Same bar as v6, new
builder. Rubric still says chronology is not the layout.

1. Persist full live maps (layers, nodes, edges, epiphany records) after
   prod init works. If `:free` is 429, wait or record the blocker; do
   not score DeepSeek as this ticket's bar.
2. Grill the rubric lines: followable foundations, no invented history,
   relationships are the point, would I open a rabbit hole. Every line
   is 0 or 1. No skip. A gate fail is four 0s; still write the row.
3. Record scores in
   `.scratch/first-principled-v7/research/07-danny-followability.md`.
   No secrets.

Do not change prompts in this ticket. A failing bar graduates a later
retune; it is not this session's patch.

## Acceptance criteria

- [ ] Full live maps persisted as JSON
- [ ] Danny scored all four gold live maps against the rubric
- [ ] Scores file exists, one row per concept, every line 0 or 1, no skip,
      no secrets
- [ ] The agent did not invent Danny's scores
- [ ] No prompt or generator change in this ticket

## Docs rule

Pointer from this ticket and the map's Decisions so far. Rubric is
unchanged unless Danny locks a line change here.
