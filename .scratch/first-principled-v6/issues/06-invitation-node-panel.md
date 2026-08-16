# 06 - Node panel is an invitation card

**Type:** task

**Status:** ready-for-agent

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

- [ ] Node click shows description, observation, and dependence neighbors
- [ ] No learner-state chrome on the panel
- [ ] No control that generates a new Tree from the node
- [ ] `npm test` and `npx tsc --noEmit` pass

## Docs rule

Spec section 9 node-panel paragraph updates in the same commit. CONTEXT.md
Rabbit hole entry already exists; tighten if the live card changes the
term.
