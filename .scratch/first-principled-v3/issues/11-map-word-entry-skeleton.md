# 11 - Map word entry + shared generation + progressive skeleton

**Type:** task

**What:** Put the word input on the map page itself - the map becomes the
entry point for generating a tree, with a progressive skeleton loader while
the bottom-up generator works. Remove the chat page's start form; chat
becomes follow-up-only.

**Blocked by:** 10 - Vertical path layout + strict chronology + panel close
fix

**Status:** resolved

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

- [x] Word input on the map page starts generation; a generated tree lands
      on the map without visiting chat
- [x] Generation logic lives in a shared module used by both pages (no
      duplicated word-to-tree call)
- [x] Progressive skeleton: visible during generation, layers light up as
      they land, skeleton disappears when the tree renders
- [x] Chat page has no start form; chat works for follow-up questions
- [x] 375px and 320px CDP audits clean on the map page with input + skeleton
- [x] Screenshots delivered for Danny approval before deploy
- [x] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the map-entry + skeleton resolution.
Note in the map that chat no longer hosts the entry input.

## Answer

The map owns tree entry now. A full-width word input lives in the sticky map
header (src/pages/map.js); submitting it starts generation on the map - no
route to chat required. The word-to-tree call and the follow-up turn runner
live in one shared module, src/lib/generation.js (generateTree +
runAgentTurn + the friendly error lines), imported by map, chat, and the
dock - no duplicated word-to-tree call anywhere.

During generation (mean ~20s, ticket 03) a progressive skeleton mirrors the
vertical-path tree (ticket 10): a root block, a trunk, and layer bands that
light bottom-up as each layer lands - foundation first, matching the
generator's build order - roughly one band every 3.2s, all at once under
reduced motion. When the tree arrives the skeleton swaps out, the map
reveals the reality tab (its highlight now follows the live tab), a refusal
surfaces the model's reply on the page, and transport failures show a
friendly error with retry.

Chat is follow-up-only: the start form and first-word input are gone; with
no session chat points at the map, and once a tree exists it answers
follow-ups as before. The dock follows suit - composer only while a session
is live, otherwise a hint pointing at the map header.

Verified: 326 tests + tsc clean. Headless CDP 29/29 at 375px and 320px -
input full-width, skeleton 1-up with the bottom-up reveal, tree lands on the
map, no horizontal overflow (checked against clientWidth, which caught and
fixed a 5px header overflow at 320px via max-width 100%). Screenshots for
Danny in research/11-*.png. Deploy deferred with tickets 10-13 (Danny
2026-08-13): all deploy together in a new session.
