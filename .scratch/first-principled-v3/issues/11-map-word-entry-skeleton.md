# 11 - Map word entry + shared generation + progressive skeleton

**Type:** task

**What:** Put the word input on the map page itself - the map becomes the
entry point for generating a tree, with a progressive skeleton loader while
the bottom-up generator works. Remove the chat page's start form; chat
becomes follow-up-only.

**Blocked by:** 10 - Vertical path layout + strict chronology + panel close
fix

**Status:** ready-for-agent

## Question

Today a word can only be entered on the chat page; the map page only reads
`state.word` after the fact. Generation takes ~20s mean (ticket 03) and the
tree area shows an empty state the whole time. Danny: "when I wanna put a
word into the map, I have to do it in chat then transfer over because
there's no responsive stuff."

## What

1. **Inline word input on the map.** A word input at the top of the map
   page (header area, sticky). Submitting it starts tree generation from
   the map - no route to chat required.
2. **Shared generation logic.** The map page currently makes zero network
   calls. Extract the generation call (word to tree, per-layer bottom-up,
   repairs, fail-honest contract) from `src/pages/chat.js` into a shared
   module both pages use. The map page owns the call for entry; chat keeps
   using it for follow-ups if needed.
3. **Progressive skeleton loader.** During generation, show a skeleton that
   mirrors the tree shape and lights up progressively as each layer lands
   (the generator builds bottom-up, so the skeleton reveals foundation
   first, then each layer upward). Replaces the current empty state.
4. **Chat becomes follow-up-only.** Remove the chat page's start form /
   first-word input. Chat remains for questions about the generated tree.
5. **Mobile-first.** The input and skeleton must be clean at 375px: input
   full-width, skeleton 1-up, no horizontal overflow.

## Acceptance criteria

- [ ] Word input on the map page starts generation; a generated tree lands
      on the map without visiting chat
- [ ] Generation logic lives in a shared module used by both pages (no
      duplicated word-to-tree call)
- [ ] Progressive skeleton: visible during generation, layers light up as
      they land, skeleton disappears when the tree renders
- [ ] Chat page has no start form; chat works for follow-up questions
- [ ] 375px and 320px CDP audits clean on the map page with input + skeleton
- [ ] Screenshots delivered for Danny approval before deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the map-entry + skeleton resolution.
Note in the map that chat no longer hosts the entry input.
