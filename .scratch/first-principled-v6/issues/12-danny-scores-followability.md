# 12 - Danny scores followability

**Type:** grilling

**Status:** ready-for-agent

**Blocked by:** [Retune the one-shot Reality Map prompt](10-retune-the-one-shot-reality-map-prompt.md)

**Related:** [Reality Map quality eval](07-reality-map-quality-eval.md), [Deploy a followable tree](11-deploy-a-followable-tree.md)

## Question

The automated gate can pass a structurally honest map that is still not
worth following. How do the four gold live maps score on
`eval/map-quality/rubric.md` when Danny judges them?

## What

HITL. The agent does not stand in for Danny.

1. Put the ticket 10 live maps in front of Danny (baseline file plus the
   trees themselves). A map that failed the gate is not scored; the
   rubric already says stop there.
2. Grill through the rubric lines: followable foundations, no invented
   history, relationships are the point, would I open a rabbit hole.
3. Record 0/1 per line per concept in
   `.scratch/first-principled-v6/research/12-danny-followability.md`.
   No secrets.

Do not change the prompt in this ticket. If the scores fail the
followability bar, that graduates a later retune; it is not this
session's patch.

## Acceptance criteria

- [ ] Danny scored all gate-passing gold maps against the rubric
- [ ] Scores file exists, one row per concept, no secrets
- [ ] The agent did not invent Danny's scores
- [ ] No prompt or generator change in this ticket

## Docs rule

Pointer from this ticket and the map's Decisions so far. Rubric file
itself only changes if Danny names a missing line.
