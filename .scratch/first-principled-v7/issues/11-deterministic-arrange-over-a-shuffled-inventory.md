# 11 - Deterministic Arrange over a shuffled inventory

**Type:** task
**Status:** ready-for-agent
**Blocked by:** none (research 11, 12, 13 complete)
**Related:** 07 (falsified), 10 (schema on Epiphanies), 05 (three stages)

## Question

The three-stage funnel is falsified by its own rule: Arrange preserved
Chronology's order as a flat list on 3 of 4 gold words (CHRONOLOGY_CAPTURE,
123/79/58 gate errors) and disregarded it on the fourth
(CHRONOLOGY_DISREGARD, Epiphanies UNKNOWN contract). Learner maps were
empty on all four. Per map.md:47, the replacement candidate is an
unordered prerequisite inventory, then evidence enrichment, then Arrange.
Research sharpens that candidate: no shipped system lets the LLM emit the
final global arrangement in one call. Arrangement is always deterministic
over LLM-proposed parts. How does the replacement candidate take that
shape?

## What

Rebuild stage 3 so the model never emits the global arrangement. The
model proposes parts; the code arranges.

1. Stage 1 (Chronology) and Stage 2 (Epiphanies) keep their contracts,
   with two prompt fixes:
   - Restore the UNKNOWN emptiness sentence in the Epiphanies prompt:
     under an UNKNOWN certainty mark, the observation fields stay EMPTY
     and the uncertainty note carries the reason (the v7 prompt dropped
     the v6 sentence; the gate rule exists only in code,
     realityMap.js:373-376). Forensics: all 8 photosynthesis epiphanies
     had non-empty facts AND non-empty notes; the gate fires on the
     facts.
   - Keep certainty decided at inventory time. UNKNOWN endpoints
     propagate mechanically; no UNKNOWN on the final tree edges.
2. Stage 3 becomes Connect: input is the FULL inventory of stage 1 and
   stage 2 ids with their one-line definitions, SHUFFLED server-side,
   with the prompt stating the order is meaningless. Output is an
   EDGE-SET ONLY: `{ edges: [ { from, to, because, evidence_ids } ] }`
   where `from`/`to` are inventory ids, `because` is a one-line
   justification, and `evidence_ids` cites the stage 2 epiphany records
   that justify the edge. No nodes array, no layers, no trunk, no crown
   in the model output. Strict JSON Schema (buildArrangeJsonSchema,
   mirror of the Epiphanies schema) plus one output example in the
   prompt.
3. The code arranges deterministically: build the graph from the
   edge-set, validate every edge references existing inventory ids,
   topological sort, break cycles by weakest justification, assign
   layers by longest-path depth, crown is the deepest node. Layout
   falls out of the edges; it cannot be copied from Chronology because
   the model never emits it.
4. Gate additions (mechanical, no LLM):
   - Listness checker: rejects any output that is a reordered list or
     preserves input order (must flag all three captured Arrange
     outputs and the v6 one-shot maps; must pass the fixture).
   - Provenance accounting stays: every inventory id used or discarded,
     use-or-drop ledger.
   - Edge-set shape validation via the Arrange JSON Schema.
5. Order of work: run the six free tests from
   research/11-failure-forensics.md:282-307 first (listness checker,
   buildArrangeJsonSchema unit tests, v6-control revalidation, prompt
   text assertions, deterministic Arrange prototype, fixture
   regression), then one live Epiphanies-only probe on photosynthesis
   (small spend) to confirm UNKNOWN records come back empty-fact, then
   the full live pipeline on the four gold words.

## Acceptance criteria

- [ ] Listness checker unit tests flag all three captured Arrange
      outputs and the v6 one-shot maps; pass the fixture arrangement.
- [ ] buildArrangeJsonSchema rejects the three captured Arrange outputs
      and accepts the fixture.
- [ ] Prompt-text assertions green (emptiness sentence, "set certainty
      to" phrasing, "layers"/"trunk" wording where required).
- [ ] Deterministic Arrange prototype emits a conformant map for all
      four gold words offline; arrangeCheck passes.
- [ ] v6-control revalidation: arrangeCheck results recorded for the
      v6 one-shot maps.
- [ ] Live Epiphanies-only probe (photosynthesis): UNKNOWN records come
      back empty-fact with non-empty notes; gate passes.
- [ ] Live pipeline on the four gold words: all four pass the
      mechanical gate with non-empty learner maps.
- [ ] Danny walks the four trees and records KEEP or KILL
      (research/14-synthesis.md rubric rows).

## Docs rule

Map line, research record, and this ticket in the same commit as the
code. KEEP/KILL walk is a separate HITL step after the gate is green.
