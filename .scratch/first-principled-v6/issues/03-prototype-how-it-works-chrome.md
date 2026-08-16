# 03 - Prototype how-it-works chrome

**Type:** prototype

**Status:** ready-for-agent

**Blocked by:** none

**Related:** [Ship how-it-works into the Tree home](05-ship-how-it-works.md), [Hide Tutor from the chrome](04-hide-tutor-from-the-chrome.md)

## Question

The empty Tree does not explain itself, and there is no How it works. What
does the locked framing look like as a cheap artifact: one sentence on the
empty Tree, a short How it works page in the header, and a word box that
asks for a thing in reality from its foundations?

## What

Build a standalone prototype under
`.scratch/first-principled-v6/research/03-how-it-works-prototype/`.
Plain HTML / CSS / JS. No Tutor chrome. Do not ship into `src/` in this
ticket.

Locked copy (grilling 2026-08-16):

- Placeholder: `A thing in reality (laptop, photosynthesis)`
- Empty-state line: `Type the thing you want to understand from its foundations.`
- How it works page: this is not designed to replace reading. It is for
  gaining understanding of relationships between layers. It is meant to
  help the learner open their own rabbit holes. Each node is a rabbit hole
  for what they wanted to learn. Then the prompt to type a thing in
  reality and understand it from its foundations.

1. **Empty Tree.** Word box plus the one-sentence empty-state line. No
   Tutor toggle.
2. **Nav.** A How it works control in the header. Short page, not a
   marketing site. Back to the Tree without losing the word box.
3. **Foundations language.** No "atomic facts" or "atomic principles".
4. **Mobile.** 375px and 320px: no horizontal page overflow.

## Acceptance criteria

- [ ] Prototype opens via a static server and shows empty-state + How it
      works page + word box with the locked copy
- [ ] No Tutor control
- [ ] 375px and 320px: no horizontal page overflow
- [ ] Asset path linked; Danny can react before
      [Ship how-it-works into the Tree home](05-ship-how-it-works.md)

## Docs rule

None in `src/`. A short README in the prototype folder covers how to serve
it. Resolution records whether the copy and layout are accepted as-is.
