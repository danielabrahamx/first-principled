# First-Principled v6 - Build Map (MAIN FRONTIER)

**Effort:** Make the product a Tree-only explorer: hide Tutor, frame how it
works, and measure whether generated trees are actually followable.
**Planning source:** wayfinder grilling 2026-08-16 (Cursor). v5 shipped a
dependence-path Tree with Tutor as a closed bottom sheet. Generation quality
is still unmeasured; DeepSeek flash was the standing model.

## Destination

A shipped Tree-only explorer. The learner types a thing in reality, gets a
first-principles dependence path they can follow, and is told this is for
relationships between layers and for opening their own rabbit holes, not
for replacing reading. Tutor is gone from the chrome. Generation quality is
measured, not hoped. Provider for this effort: OpenRouter
`nvidia/nemotron-3-ultra-550b-a55b:free`.

## Notes

- **This map carries execution.** Tickets are the rewrite, not a spec to
  hand off. One session, one ticket (research excepted).
- Domain: Tree as a first-principles artifact and an invitation to study.
  Read `docs/MISSION.md` and `CONTEXT.md` before any ticket. Glossary: Tree,
  Dependence, Layer, Reality Map, Foundation, Rabbit hole, Tutor (parked).
- Rabbit hole means invitation: inspect a node, then go study. Not a nested
  generated Tree. Nested generation is out of scope.
- Salvage: `src/lib/agent/` (reality map, observations) and `src/lib/mmg/`
  stay. Do not rebuild the generator unless fog graduates a prompt-retune
  ticket after eval. Do not touch uncommitted v2 engine-thread files
  (`src/lib/agent/gaps.js`, `confidence.js`, `eval/`).
- Provider: OpenRouter, OpenAI-compatible. Env remains `LLM_API_KEY`,
  `LLM_MODEL`, `LLM_BASE_URL`. Key lives only in `.env` (gitignored) and
  later as a Netlify secret. Never paste keys into chat, tickets, or
  research notes. `:free` is the standing pick; a paid slug is the fallback
  if research proves free unusable.
- Known risk: Nemotron free P50 latency is ~18s and P90 e2e can exceed two
  minutes. Current call timeout is 45s. Serial per-layer generation may not
  survive. [OpenRouter Nemotron can serve the Reality Map contract](issues/01-openrouter-nemotron-map-contract.md)
  answers that before any prompt rewrite.
- Tutor engine (`socratic.js`, `forceBrief`, dock) stays in the codebase.
  Chrome removes the toggle and the sheet.
- Copy locked in grilling: placeholder "A thing in reality (laptop,
  photosynthesis)"; empty-state "Type the thing you want to understand from
  its foundations."; How it works holds the not-a-reading-replacement /
  relationships / rabbit-hole framing. One sentence of that framing also
  lives on the empty Tree.
- Eval retarget: Reality Map quality, not tutor questions. Gold maps
  already exist for laptop, recursion, photosynthesis, battery. Danny is
  the judge of "would I follow this." Code catches structural lies.
- Spine/layout retune, grow motion, and layer-band visuals stay fog unless
  a live Nemotron tree still reads as a labeled list.
- Skills: grilling + domain-modeling on HITL; prototype skill on
  [Prototype how-it-works chrome](issues/03-prototype-how-it-works-chrome.md);
  `/research` on ticket 01. Existing test/tsc/netlify-build discipline.
- Style: single dashes, no emojis. Windows/PowerShell-tested. Docs in the
  same commit as the code they describe.

## Decisions so far

<!-- grilling 2026-08-16, locked before tickets -->

- Destination: shipped Tree-only explorer, not a spec handoff.
- Tutor: gone from the chrome. Engine parked.
- Rabbit hole: invitation to go study, not a nested generated Tree.
- Tree must work better as layout and as generation quality. Generation
  quality is the real bar.
- How it works: one sentence on the empty Tree, the rest on a How it works
  nav page.
- Word box: foundations language. Not "atomic facts" or "atomic principles".
- Provider: OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free`. Stay on
  `:free` unless research proves it unusable, then switch slug not provider.
- Quality bar: Danny-scored rubric plus a small automated gate on gold maps.
- OpenRouter Nemotron `:free` can serve schema-valid one-shot Reality Maps; raise llm.js timeout to 240s, drop DeepSeek thinking, send reasoning effort none, stay on `:free`. [OpenRouter Nemotron can serve the Reality Map contract](issues/01-openrouter-nemotron-map-contract.md)
- Transport defaults, headers, and `reasoning` payload now match that finding; DeepSeek `thinking` is gone. [Land OpenRouter as the LLM transport](issues/02-land-openrouter-transport.md)
- How-it-works chrome prototype uses the locked copy as-is; recommended layout is A (header How it works + header word box + empty-Tree sentence). [Prototype how-it-works chrome](issues/03-prototype-how-it-works-chrome.md)

## Not yet specified

- Prompt / generator retune if live Nemotron maps are structurally valid
  but not followable.
- Spine / layout retune if a live Nemotron tree still reads as a labeled
  list.
- Grow motion on a branching trunk.
- Layer-band visual: background stripes vs labels on the hang.
- Paid OpenRouter slug, only if `:free` fails the contract.
- Discovery timeline (still parked).

## Out of scope

- Nested generated Trees from a node click.
- Full generator rebuild, new stack (React, bundler, DB).
- v2 engine thread (gap selection, confidence, tutor eval harness,
  prediction).
- Learner Mental Model as a tab, page, or node-panel chrome.
- Timeline scrubber / session replay.
- Accounts, auth, persistence, web grounding, agent frameworks.
- Cross-concept linking.
- Deleting the Tutor engine from `src/lib/agent/`.

## Ticket sequence (dependency overview)

```
01 research OpenRouter Nemotron map contract
01 -> 02 land OpenRouter as the LLM transport
03 prototype how-it-works chrome
03 + 04 -> 05 ship how-it-works into the Tree home
04 hide Tutor from the chrome
06 node panel is an invitation card
02 -> 07 Reality Map quality eval
02 + 04 + 05 + 06 + 07 -> 08 deploy the tree-only explorer
```
