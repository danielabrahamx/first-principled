# First-Principled v2 - Build Map (MAIN FRONTIER)

**Effort:** Take first-principled from a working v1 MVP to a map-first v2 where
the map is the product and the tutor is a genuinely first-principles Socratic
engine.
**Spec:** v1 spec at `../first-principled/spec.md` (mission, principles, data
model, turn contract). A v2 spec is written from ticket resolutions; do not
rewrite the v1 spec until the engine thread resolves.
**Planning source:** audit + grilling 2026-08-10 (Freebuff chat, Danny).
Destination and scope confirmed by Danny 2026-08-10: engine and map-first both
in one effort; the no-leak rule stays relaxed.

## Destination

A map-first v2: the map is the product. The learner's model grows on a living
map where every part is clickable and carries its history - per-node state
rotations, layer stories, turn-by-turn replay. The tutor is a genuinely
first-principles Socratic engine: code-driven gap selection, a prediction move
(principle 2 operationalized), principle-anchored confidence, CoT-driven map
updates - judged against a quality bar we can measure. The v1 mission, theory
of learning, and 12 core principles are immutable (`docs/MISSION.md`).

## Notes

- Domain: AI tutor; first-principles pedagogy. Read `docs/MISSION.md` and
  `CONTEXT.md` before any ticket.
- Skills to consult: grilling + domain-modeling on every HITL ticket;
  prototype for "how should it look or behave" tickets; research for AFK
  facts.
- Standing decisions (Danny 2026-08-10): (a) no-leak rule stays relaxed - the
  reality tree and node descriptions are viewable mid-session, so clickable
  node panels may show reality content (ticket 15 of v1 already relaxed this);
  (b) both threads are one effort.
- Repo rules (AGENTS.md): code owns the hard, countable rules - extend that
  to gap selection; zero-dependency plain ES modules; single dashes only, no
  emojis; docs update in the same commit as code; Windows-tested; the
  194-test + tsc-clean + netlify-build discipline holds.
- v1 context: `../first-principled/map.md` (all 18 tickets resolved),
  `../first-principled/spec.md`, `src/` implementation, `docs/MISSION.md`.
- Audit findings that shape this effort (2026-08-10): the Socratic prompt is
  a 12-rule wall and every turn dumps both full maps into the prompt (the
  latency and drift source); the question strategy is one line in the prompt
  ("probe the biggest gap, misconception over missing over untested"); CoT
  (reasoning_content) is discarded; confidence 0..1 is unanchored; the store
  keeps only lastDiff so history is unrecoverable; the reality map is
  one-shot and validated only structurally.

## Decisions so far

- [03 - Research: reasoning_content reliability](issues/03-reasoning-content-reliability.md) - thinking mode ON by default; reasoning_content nullable and free-form (never valid JSON - the defensive parsing stays); reasoning tokens billed; a reasoning_effort dial exists (v1 does not use it). Recommendation: keep thinking on, consume CoT privately to drive the learner-map update, never show it. Live probe numbers pending billing top-up (research/03-reasoning-content.md).
- [01 - Move gap selection into deterministic code](issues/01-next-gap-selection-in-code.md) - gap selection is now a pure function (`gaps.js`); probe turns send a compact gap report + forced target instead of both full maps. Probe prompts cut 5,795 -> 2,412 chars (-58%), gap targeting 9/9, behavior parity on the eval.
- [04 - Prediction move](issues/04-prediction-move.md) - principle 2 operationalized: `predict` is a first-class probe kind, triggered when the lowest affected layer holds a stated belief with no tested outcome. Taxonomy merge into the default flow stays gated on 02.
- [05 - Anchor confidence 0..1](issues/05-confidence-anchoring.md) - confidence is now a pure function over a named band (refused/guessing/shaky/confident/certain); the model reports the band + learner's words, code picks the number, snaps up on evidence, decays on contradiction.
- [06 - Reality map v2: foundation-first](issues/06-reality-map-iterative-derivation.md) - two-phase generator (foundation layer, then derive abstractions) with a code-level `deriveCheck`: every abstraction must trace to an observation in a strictly lower layer. Optional `basis` field on RealityNode (v1 maps still validate).
- [07 - Tutor quality eval harness](issues/07-tutor-quality-eval-harness.md) - deterministic `eval/` runner: gap targeting, rubric, evidence fidelity, probe-prompt chars, invariants. v1 baseline captured pre-change (5,795 chars, 8/9 targeting). CI-gateable; live pass needs the key top-up.
- [08 - Turn ledger + node history](issues/08-turn-ledger-and-node-history.md) - the store keeps a per-turn ledger with deep-copied learnerMap snapshots + diffs (stable turn ids, learner-quotes-only, post-review hardening: later in-place mutation of the live map cannot rewrite history). Keystone for the map thread: rotation trails, node history, and replay all read from it.

Spec sections 4, 7, 8, 10 (per-ticket Docs rules) are intentionally NOT
updated in this pass: the map note says the v1 spec is not rewritten until
the engine thread resolves (ticket 02). That deferral is recorded here so
the per-ticket rules are not silently broken - the v2 spec lands with 02.
(02 is now resolved; the v2 spec write-up is a follow-up item, tracked in
the Not yet specified section.)

- [02 - Rebuild the Socratic prompt](issues/02-socratic-prompt-rebuild.md) - the taxonomy (observe/probe/predict/confront/explain/brief/converse) is the spine of the system prompt; 12 rules collapsed to 5 + few-shot exemplar + CoT privacy line. Confront is real code (nextGaps mode, directive, validateTurn). Eval: invariants 0, targeting 9/9, prompts 2,572 chars. Human gate (Danny's taxonomy grilling) + live verification pending.
- [09 - Map-first layout](issues/09-map-first-layout.md) - DEFAULT_ROUTE map (# is home); split layout with a docked Tutor pane (right rail desktop, below on <960px); probe highlight pulses the asked-about card; store carries lastProbe + per-turn probe in the ledger. Browser-verified desktop; 375px re-run + Danny review pending.
- [10 - Clickable node panel](issues/10-node-click-panel.md) - every card opens a panel: reality description (allowed), current state/confidence, evidence with turn chips, rotation trail, neighbors with relations. Keyboard + Esc. Pure viewmodel in history.js (nodePanelView).
- [11 - Hover history + layer stories](issues/11-hover-history-and-layer-stories.md) - the headline ask: hover a card for its rotation trail (turn/state/confidence/evidence), hover a reality layer branch for the layer story (engagement order, rotations). 350ms delay, viewport-clamped popover, keyboard focusable.
- [12 - Timeline scrubber + replay](issues/12-timeline-scrubber-and-replay.md) - one stop per ledger turn, click to render that snapshot, play replays the rotations with the diff animation language, parks back on live; snapshots never mutate the store.
- [13 - Edge-level gaps research](issues/13-edge-level-gaps.md) - recommendation written: edge gaps outrank node gaps only when both endpoints >= 0.6 confidence and the edge is untested/misconceived; optional probe.edge hint; edge history on the map. Adoption graduated to ticket 14.

## Ticket sequence (blocking)

Engine thread: 01 -> 02; 03 -> 02; 04 -> 02; 05 -> 02; 07 -> 02; 06 unblocked,
parallel. 02 (the prompt rebuild) is where the engine thread converges and
must be judged on 07's quality bar.
Map thread: 08 -> 09, 10, 11, 12.

## Open frontier

First pass 2026-08-10: 01, 04, 05, 06, 07, 08 resolved. Second pass
2026-08-10 (API-independent tickets, Danny): 02, 09, 10, 11, 12, 13 all
resolved - the engine thread converges (02) and the map thread lands
(09-12). Resolutions recorded on each ticket.

Frontier now: 14 (edge gap selection - graduated from 13's recommendation,
blocked by 02 which is now resolved, so unblocked). Next up after that: the
v2 spec write-up and the pending live verification pass (billing top-up).

## Not yet specified

- Edge-level gaps - GRADUATED to ticket 13 (2026-08-10); adoption is ticket 14.
- Session-end story under map-first: how the transfer question, its grading,
  and the comparison render on the map journey. The comparison block exists
  (v1) and the demo session ends with a transfer result - the map journey
  for it is still rough. (next map pass)
- The v2 spec write-up: all six+2 resolved tickets have per-ticket Docs
  rules deferring spec sections 4/7/8/9/10 to "when the engine thread
  resolves". 02 is resolved - the v2 spec is now due as a synthesis of the
  resolutions. (follow-up; not a frontier ticket)
- 375px verification re-run of the map-first layout (browser agent had a
  transient failure on the first attempt).

## Out of scope

- Accounts, auth, server-side persistence, cross-device sync (unchanged from
  v1).
- Web grounding, RAG, tool use.
- Agent frameworks (Mastra, LangGraph).
- Cross-concept linking (laptop to CPU).
- Mobile or native clients.
