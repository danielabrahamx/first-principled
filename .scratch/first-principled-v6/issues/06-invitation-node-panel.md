# 06 - Node panel is an invitation card

**Type:** task

**Status:** resolved

**Blocked by:** none

**Related:** [Hide Tutor from the chrome](04-hide-tutor-from-the-chrome.md), [Ship how-it-works into the Tree home](05-ship-how-it-works.md)

## Question

Clicking a node opens an inspect panel that still carries learner-state
chrome (untested / confidence / evidence / rotation trail). A rabbit hole
is an invitation to go study. What does that panel look like as a card:
what this is, what it rests on, why it is a rabbit hole?

## What

Retarget the live node panel. Do not generate a nested Tree.

1. **Keep.** Label, reality description, observation / crux, neighbors
   (what it rests on / what rests on it).
2. **Strip.** Learner state, confidence bar, evidence quotes, rotation
   trail, "you haven't engaged this node yet".
3. **Invitation.** One short line that this node is a rabbit hole: a
   thing to go understand, not a chat topic. No nested Build.
4. **Tests.** `nodePanelView` and map-page tests follow the new shape.

## Acceptance criteria

- [x] Node click shows description, observation, and dependence neighbors
- [x] No learner-state chrome on the panel
- [x] No control that generates a new Tree from the node
- [x] `npm test` and `npx tsc --noEmit` pass

## Answer

The live panel is an invitation card, not a learner-state inspect.

- Keep: label, description, observation / crux, Reality Map dependence
  neighbors (`built-on` / `depends-on` / `abstraction-of`) as "What it
  rests on" and "What rests on it".
- Strip: status/confidence, rotation trail, evidence quotes, unengaged
  copy. `nodePanelView` no longer returns those fields.
- Invitation line: `This node is a rabbit hole: a thing to go understand,
  not a chat topic.` No nested Build.
- Neighbors read from the Reality Map, not the learner map.

Spec section 9 and CONTEXT.md Rabbit hole updated in this commit.

## Docs rule

Spec section 9 node-panel paragraph updates in the same commit. CONTEXT.md
Rabbit hole entry already exists; tighten if the live card changes the
term.
