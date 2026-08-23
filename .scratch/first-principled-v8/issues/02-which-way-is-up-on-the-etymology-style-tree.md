# 02 - Which way is up on the etymology-style Tree

**Type:** grilling

**Status:** ready-for-human

**Blocked by:** none

**Related:** [How a Dependence DAG becomes that flowchart](03-how-a-dependence-dag-becomes-that-flowchart.md), [Prototype the etymology-style Dependence layout](04-prototype-the-etymology-style-dependence-layout.md)

## Question

On the Etymonline flowchart, contributing forms sit at the **top** and
the modern word sits at the **bottom**. The current Tree glossary puts
the **crown** (typed concept) at the **top** and foundations at the
**bottom**. Which vertical convention does the Dependence flowchart use?

## What

HITL. Do not implement chrome. Lock one direction so the prototype can
be drawn without guessing.

Working recommendation: match the screenshot. Parts and supporting
knowledge at the top, the typed concept at the bottom, arrows pointing
down the dependence chain (A above B means B depends on A, or the
inverse: pick one and write it). This inverts today's crown-at-top Tree.
If Danny wants to keep crown-at-top, the screenshot is rotated, not
copied.

Call the clash with `CONTEXT.md` Tree in the answer. Do not rename Tree
in this ticket unless the direction lock forces a glossary sentence.

## Acceptance criteria

- [ ] One vertical convention locked (top is either foundations/parts or
      crown)
- [ ] Arrow meaning stated in one sentence (what "A points to B" means
      for Dependence)
- [ ] The CONTEXT clash is acknowledged; glossary update is done here
      only if the name or orientation is now the product rule
- [ ] Map Decisions so far points at this lock

## Docs rule

If orientation becomes the product rule, one Tree paragraph in
`CONTEXT.md` in the same commit. Otherwise pointer only.
