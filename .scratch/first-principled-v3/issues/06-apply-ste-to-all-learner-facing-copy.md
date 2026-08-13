# 06 - Apply STE to all learner-facing copy

**Type:** task (AFK)
**What to build:** every learner-facing string (UI copy, node descriptions,
observation narratives, layer stories, error banners, empty states) rewritten
to the approved STE subset from ticket 05, with a cheap vocabulary check in
the test suite if it stays zero-dep.

**Blocked by:** 03 - Concept tree generation with observations,
05 - STE subset for learner-facing copy

**Status:** resolved by opencode (deepseek-v4-flash) on 2026-08-13

- [x] All learner-facing strings rewritten to the subset
- [x] Vocabulary check in tests (if cheap, zero-dep)
- [x] Existing copy rules (single dashes, no emojis) still hold

## Resolution

Every hand-written learner-facing string is rewritten to the subset:

- Error banners (chat.js ERROR_MESSAGES): no vague words ("that",
  "something"), no "and" run-ons, active voice, under 20 words.
- Phase labels unified: Starting / Seeing / Testing / Session end (the
  exploring/refining synonyms removed - one word per concept, rule 6).
- Hero eyebrows de-contracted: "You are seeing" / "You are testing".
- Buttons: Begin -> Start, "Try a demo" -> "See a demo session".
- Start panel, dock hints, empty states: v3 wording ("the tutor will build a
  tree of the concept") replacing the pushed-back mental-model language
  ("map what you know").
- Nav labels: Chat -> Ask, Map -> Tree (approved words for the surfaces).
- Refusal reasons (realityMap.js, orchestrator.js) are learner-facing replies:
  rewritten to the subset.
- Generator prompt (realityMap.js steBlock) already carried rules 2-8; rule 1
  (one meaning per word) added so rules 1-6 are all present.
- demo.js assessment rewritten; scripted tutor replies were already STE-clean.

Cheap zero-dep vocabulary check: src/ste-copy.test.js scans the hand-written
UI copy (index.html, chat.js, dock.js) against the approved list from
docs/ste.md plus documented function-word and UI-chrome allowlists (tutor,
session, retry, send - words the 63-word domain list cannot express). Inflected
forms of approved words pass (Testing -> test). Scripted demo content and
generated narratives are STE-gated by the generator prompt + steProblems, so
they are not scanned; error envelopes are internal API text the client never
shows. The check also runs steProblems on every copy string, so contractions
and long sentences fail the suite.

Untouched by design: src/pages/map.js and src/styles.css (ticket 04 owns
uncommitted edits - coordinated via git status; their learner-facing strings
remain 04's to apply), code identifiers, internal module names, commit
messages, ticket files. docs/ste.md gained a line pointing at the check.
Verified: 309/309 tests, tsc clean.
