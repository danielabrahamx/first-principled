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
discoveries that made the next stage possible. The user can hover over any part
of the tree and read how that layer came to be. The LLM chat is a secondary
surface; the learner's mental model tracking is not part of this effort.

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

## Decisions so far

<!-- one line per resolved ticket; empty until tickets resolve -->

## Open frontier

- [01 - Ship the inherited map-first concept tree](issues/01-ship-the-inherited-map-first-concept-tree.md) - unblocked, task (AFK)
- [02 - Observations content model: the crux](issues/02-observations-content-model-the-crux.md) - unblocked, grilling (HITL)
- [05 - STE subset for learner-facing copy](issues/05-ste-subset-for-learner-facing-copy.md) - unblocked, grilling (HITL)

## Not yet specified

- Entry flow: how the tree is born when the chat is secondary (word input
  still, or a library of pre-built trees?).
- The session/end story under tree-first: what a completed journey looks like
  without the Socratic session driving it; what remains of the transfer
  question and the comparison.
- What the learner does with the tree beyond reading (annotate, mark known,
  nothing?).

## Out of scope

- Engine thread (v2 tickets 01-07): Socratic engine, code-driven gap
  selection, prediction move, confidence anchoring, eval harness - pushed back
  by Danny 2026-08-12. Returns only as a fresh effort.
- Learner mental model tracking and chat-first UX.
- The v2 spec write-up (belongs to the v2 effort).
- Accounts, auth, server-side persistence, cross-device sync (unchanged).
- Web grounding, RAG, tool use. Agent frameworks (Mastra, LangGraph).
- Cross-concept linking (laptop to CPU).
- Mobile or native clients.
