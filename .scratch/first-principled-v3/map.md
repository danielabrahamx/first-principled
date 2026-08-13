# First-Principled v3 - Build Map (MAIN FRONTIER)

**Effort:** Re-scope first-principled to a concept-tree-first product. The tree
is the product; the observations that made the next stages possible are the
crux. The LLM chat and the learner's mental model are pushed back.
**Planning source:** Danny redirection 2026-08-12 (Telegram): "take focus off
the llm chat and mental map of the user and push that back. for now let's get
the concept tree right, and the observations that made the next stages possible
will be the crux. everything discussed here we should ticket."

## Destination

The concept tree is the product: a chronological phylogenetic tree of how ideas
are built, foundations at the bottom, abstractions above, where every part is
hoverable and the crux of each node and layer is the observations and
discoveries that made the next stage possible. The user types a word or phrase
and the tree is generated with a structure that guarantees no gaps in the layer
chain. The observations are REAL discovery history, not rational
reconstruction. The tree is a pure knowledge artifact: browse like Wikipedia,
read-only, nothing to complete, no session. The LLM chat is an optional
secondary surface at most; the learner's mental model tracking is not part of
this effort.

## Notes

- Domain: knowledge tree as a first-principles artifact (MIT first-principles
  framing: strip to fundamentals, reason up from observations, test against
  reality). Read `docs/MISSION.md` and `CONTEXT.md` before any ticket.
- Inherited from v2 map-thread (built, UNCOMMITTED in the working tree as of
  2026-08-12): map-first layout with docked Tutor pane (v2 09), clickable node
  panel (v2 10), hover history + layer stories (v2 11), timeline scrubber +
  replay (v2 12), turn ledger (v2 08), foundation-first reality maps with
  `basis` field + `deriveCheck` (v2 06). Ticket 01 ships this inheritance.
- The v1 tree.js already renders a chronological phylogenetic lineage (central
  trunk, per-layer divergence, v1 tickets 13/17) - the chronology is done.
- No-leak rule stays relaxed: reality content is viewable mid-session (v1
  ticket 15), so node panels and hovers may show reality content.
- Reference: `~/portfoolio_clone2` (React/Vite) has a scroll-driven animated
  phylogenetic tree (RootTree.tsx, flowing "sap" paths via animateMotion,
  reduced-motion support). Port the motion, never the stack.
- Style: learner-facing copy moves toward STE-style controlled English
  (ASD-STE100 rules + a small approved vocabulary, ticket 05 decides the
  subset). Existing repo rule: single dashes only, no emojis.
- Repo rules (AGENTS.md): code owns the hard, countable rules; zero-dependency
  plain ES modules; docs update in the same commit as code; Windows-tested;
  194-test + tsc-clean + netlify-build discipline holds.
- Skills: grilling + domain-modeling on HITL tickets; prototype for
  "how should it look or behave" tickets.
- LLM key billing topped up 2026-08-12 - live verification is unblocked.
- The v1 spec is NOT rewritten by this effort; the v3 spec emerges from ticket
  resolutions (02's content model decision first).

## Fog cleared 2026-08-12 (Danny)

- Entry flow: word input stays - generate the tree, but with a structure that
  ensures the LLM leaves no gaps in the layer chain (ticket 08).
- Journey: no session at all - pure knowledge artifact, nothing to complete,
  no grading, no transfer question. Chat pane optional.
- Learner action: read-only for now (no marking, no notes).
- Observations: REAL discovery history (actual discoveries/discoverers), not
  rational reconstruction. Open question: what happens when the model does not
  have the information - ticket 09 probes coverage + fail-honest design.

## Decisions so far

<!-- one line per resolved ticket -->
- [05] STE subset: 8 STE100 rules + own ~60-word approved list (docs/ste.md); applies to learner-facing copy (generated via prompt, hand-written edited); microcopy exempt from sentence rules but approved words only; never code identifiers (2026-08-12).
- [09 - Observation sourcing research](issues/09-observation-sourcing-research.md) - parametric coverage holds across tiers (40/45 EXACT, 0 UNKNOWN, 1 confident error); fail-honest contract drafted (UNKNOWN marker, visible gap, token headroom + retry); web grounding NOT required for canonical corpus - contract, not grounding (2026-08-12).
- [01 - Ship the inherited map-first concept tree](issues/01-ship-the-inherited-map-first-concept-tree.md) - the v2 map-thread inheritance ships: map-first layout + docked Tutor pane, clickable node panels, hover history + layer stories, two-phase reality maps (basis + deriveCheck), demo loader. Scrubber/replay parked hidden (session machinery moot under no-session). Live-verified on DeepSeek (laptop: 6 layers, 20 nodes, 29 edges, basis everywhere), 375px clean, deployed to first-principled.netlify.app. Known gap for 08: the derive prompt omits the per-layer node-list shape, so the model sometimes drops `layers[].nodes` and generation fails after repairs (2/3 concepts on the live probe) (2026-08-12).
- [08 - Gap-free layer-chain structure](issues/08-gap-free-layer-chain-structure.md) - word-to-tree is structurally bottom-up: foundation l0, then one call per layer that sees ONLY the layer below it (code-assigned layer ids, required down-edge), so a skipped intermediate step is impossible by construction, not validated against. Contiguity validator + deriveCheck + the repair loop gate every layer and the final map as the backstop; soft cap stays, clamped to the validator max. Live: 30/30 concepts gap-free on real DeepSeek (mean 20.8s, repairs used on 15/30, 0 failures), refusals 2/2. Evidence in research/08-gapfree-verification.md (2026-08-12).
- [02 - Observations content model](issues/02-observations-content-model-the-crux.md) - an observation is a real-history record per abstraction (discoverer, date, key observation - discovery, measurement, experiment, or theoretical result), never rational reconstruction. Attaches per-node (basis becomes the record); layer story = layer observations chronologically; dates drive ordering (oldest at foundation). Fail-honest contract adopted from 09 (EXACT/APPROXIMATE/UNKNOWN, explicit gap, never invent). deriveCheck: every abstraction traces to a valid record in a strictly lower layer. Danny: the tree maps the extent of known ignorance; the reality map is first an excellent reference point (2026-08-12).
- [07 - Port the phylogenetic motion](issues/07-port-the-phylogenetic-motion.md) - sap pulses (SMIL animateMotion, rising foundations-to-crown), scroll-driven growth (trunk draws, layers bud deepest-first) and node lifecycle stagger ship; parallax, cursor hydrotropism, root hairs, grain filter do not. Reduced motion: JS skips SMIL + scroll wiring, CSS media query kills animations. Prototype in research/07-motion-prototype (2026-08-13).
- [03 - Concept tree generation with observations](issues/03-concept-tree-generation-with-observations.md) - every node's basis is a real-history observation record (discoverer/date/keyObservation with EXACT|APPROXIMATE|UNKNOWN marks, confidence, note), foundation included; deriveCheck requires a valid record on every node; a value under an UNKNOWN mark is dropped at validation (contract rule 5, normalization not rejection); empty replies retry with the honesty repair message; max_tokens 4096 in the 3000-5000 band; narratives STE-clean (prompt rules + mechanical gate, vague words reported not gated); self-review gaps no longer gate (honesty notes are legal) and mid-chain refusals retry once before being honored (both live-run fixes to 08 behavior). Live: 30/30 concepts on real DeepSeek, mean 22.5s, EXACT 448 / APPROXIMATE 330 / UNKNOWN 170 fields, evidence in research/03-observations-verification.md (2026-08-13).

## Open frontier

- [04 - Observation-first tree UI](issues/04-observation-first-tree-ui.md) - unblocked (01, 02, 03 all resolved), task (AFK, prototype if the look needs deciding) - in flight in the working tree (mapview/observation.js viewmodels)
- [06 - Apply STE to all learner-facing copy](issues/06-apply-ste-to-all-learner-facing-copy.md) - unblocked (03 and 05 both resolved), task (AFK)

## Not yet specified

- Discovery timeline: the parked scrubber/replay machinery (v2 12) could be
  reframed as a timeline of the tree's own emergence (layers appearing as
  their enabling observations land) instead of learner-turn replay. Sharp
  enough to ticket only after 02 and 08.
- Chat pane "when": the optional Q&A surface over the tree - what it asks,
  when it returns. Parked by Danny (2a).
- Tree scale: one concept per tree (current) vs cross-concept linking - stays
  out (unchanged from v2).

## Out of scope

- Engine thread (v2 tickets 01-07): Socratic engine, code-driven gap
  selection, prediction move, confidence anchoring, eval harness - pushed back
  by Danny 2026-08-12. Returns only as a fresh effort.
- Learner mental model tracking, chat-first UX, and the Socratic session
  itself - the journey is browse-only (Danny 2026-08-12).
- Session machinery as built (v2 08 turn ledger, v2 12 scrubber/replay):
  moot under the no-session decision; parked for the discovery-timeline
  reframe (see Not yet specified), not shipped as learner-turn replay.
- Transfer question, grading, session-end comparison (v1 10): no session to
  end, ruled out with the journey decision.
- The v2 spec write-up (belongs to the v2 effort).
- Accounts, auth, server-side persistence, cross-device sync (unchanged).
- Web grounding, RAG, tool use. Agent frameworks (Mastra, LangGraph).
- Cross-concept linking (laptop to CPU).
- Mobile or native clients.
