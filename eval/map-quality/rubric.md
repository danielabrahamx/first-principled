# Reality Map quality rubric

Judge a generated Tree the same way every time. The automated gate in
`eval/map-quality/gate.js` catches structural lies. This page is the
followability bar Danny scores by hand on a live map.

Score each concept 0 or 1 on every line. A map that fails the automated
gate is not followable; stop there.

## Followable foundations

- The bottom layer is something you could point at or measure, not a slogan.
- You can walk from that layer to the crown without inventing a missing step.
- Layer names read as kinds of thing (physics, materials), not as a table of
  contents.

## No invented history

- Discoverer and date look like real records, or they are marked UNKNOWN.
- No Hollywood montage (a lone genius, a round year, a fact the node does
  not need).
- UNKNOWN is honest. A confident wrong name is a fail.

## Relationships are the point

- Edges say what rests on what (`built-on`, `depends-on`, `abstraction-of`).
- You can say, for a typical node, why it cannot exist without the node
  below it.
- Chronology is not the layout. A later discovery may sit lower if the
  thing physically rests on it.

## Would I open a rabbit hole from a node

- At least one node makes you want to go read or look, not chat.
- The node is a thing in reality, not a quiz prompt and not a nested
  "build this next" control.
- The invitation is inspect, then study.

## How to record a judgement

Write four bits plus a one-line note per concept, for example:

```
laptop: foundations 1, history 1, relationships 1, rabbit-hole 1
note: I would follow electricity -> silicon -> transistor.
```

Do not average these with the automated gate. The gate is pass/fail. This
rubric is whether you would follow the Tree.
