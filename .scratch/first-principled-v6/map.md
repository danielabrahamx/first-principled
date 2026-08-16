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
  stay. Prompt retune is
  [Retune the one-shot Reality Map prompt](issues/10-retune-the-one-shot-reality-map-prompt.md),
  blocked on
  [Why prod init fails on Nemotron free](issues/09-why-prod-init-fails-on-nemotron-free.md).
  Do not rebuild the generator unless that research says the one-shot
  prompt cannot work. Do not touch uncommitted v2 engine-thread files
  (`src/lib/agent/gaps.js`, `confidence.js`, parked `eval/concepts.js`
  and tutor scorers). This effort owns `eval/map-quality`.
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
- Skills: grilling + domain-modeling on HITL, including
  [Danny scores followability](issues/12-danny-scores-followability.md);
  prototype skill on
  [Prototype how-it-works chrome](issues/03-prototype-how-it-works-chrome.md);
  `/research` on
  [Why prod init fails on Nemotron free](issues/09-why-prod-init-fails-on-nemotron-free.md).
  Existing test/tsc/netlify-build discipline.
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
- Tutor toggle, bottom sheet, and tutor-open layout are gone from the Tree home; Socratic engine and dock module stay unmounted. [Hide Tutor from the chrome](issues/04-hide-tutor-from-the-chrome.md)
- Live Tree home is variant A: header How it works + `#how` page, foundations word box, empty-Tree sentence. Copy unchanged from the grilling lock. [Ship how-it-works into the Tree home](issues/05-ship-how-it-works.md)
- Node click opens an invitation card: description, observation, dependence neighbors, rabbit-hole line. No learner-state chrome and no nested Build. [Node panel is an invitation card](issues/06-invitation-node-panel.md)
- Reality Map quality is `eval/map-quality`: structural gate, gold overlap, Danny rubric. Live Nemotron `:free` baseline recorded; recursion and photosynthesis pass the gate with low gold overlap; battery fails contiguity; laptop returned no choices. [Reality Map quality eval](issues/07-reality-map-quality-eval.md)
- Tree-only explorer is live at https://first-principled.netlify.app (deploy `6a821d5637d95139bd35956f`). Netlify `LLM_*` rotated to OpenRouter Nemotron `:free`. Chrome smoke 12/12. Live init is flaky: bit returned 1 node; recursion and photosynthesis returned `invalid_model_output`. [Deploy the tree-only explorer](issues/08-deploy-the-tree-only-explorer.md)

## Not yet specified

- Spine / layout retune if a live Nemotron tree still reads as a labeled
  list.
- Grow motion on a branching trunk.
- Layer-band visual: background stripes vs labels on the hang.
- Paid OpenRouter slug, only if
  [Why prod init fails on Nemotron free](issues/09-why-prod-init-fails-on-nemotron-free.md)
  or
  [Retune the one-shot Reality Map prompt](issues/10-retune-the-one-shot-reality-map-prompt.md)
  proves `:free` unusable.

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
- Discovery timeline (parked; not in this destination).

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
08 -> 09 why prod init fails on Nemotron free
09 -> 10 retune the one-shot Reality Map prompt
10 -> 11 deploy a followable tree
10 -> 12 Danny scores followability
```
