# 14 - Synthesis: the path to a working Tree

Recorded 2026-08-20. Three parallel research agents (deleg_7bd00b7c)
converged on one architecture. Ticket 11 encodes the build.

## The falsification verdict

The three-stage funnel is falsified by its own rule (map.md:47, 2026-08-17):
Arrange preserved Chronology as a flat list on 3 of 4 gold words and
disregarded it on the fourth. KILL is recorded. No prompt retune, no
repair loop. The replacement candidate graduates.

## What the research says

- Forensics (11-failure-forensics.md): Arrange is the only stage with no
  JSON Schema and no output example in the shipped prompt; the model
  invented a new schema on every run (3 runs, 3 shapes). No gate check
  detects timeline output - a schema-conformant flat list would pass
  today. The UNKNOWN emptiness rule lives only in gate code; the v7
  prompt dropped the v6 sentence. All 7 design constraints and 6 free
  falsifiable tests are in the file.
- Providers (12-provider-capability-matrix.md): the "no provider ships
  thinking plus structured outputs in one call" claim is FALSE today.
  DeepSeek V4 strict tool calls support thinking and non-thinking modes
  (beta); paid Nemotron advertises structured_outputs plus reasoning
  (thinking plus schema in one call undocumented - needs a probe). Cost
  is trivial (~$0.02-0.24 per pipeline). Not the bottleneck.
- Prior art (13-prior-art-patterns.md): no shipped system lets the LLM
  emit the final global arrangement in one call. GraphRAG extracts then
  arranges deterministically (Leiden). HippoRAG one-shot triples then
  mechanical PPR. Prerequisite extraction uses pairwise judgments,
  assembled in code. Collapse-to-flat-list mechanisms are documented:
  position bias, context order, constraint overload, and NULL-label bias
  (models avoid UNKNOWN - the exact honesty-contract failure). Transfer:
  stage 3 emits an edge-set over a shuffled inventory; layers, crown,
  and order are computed mechanically.

## The working shape (ticket 11)

LLM proposes parts, code arranges:

1. Chronology and Epiphanies keep their contracts. Prompt fix: restore
   the UNKNOWN emptiness sentence (empty facts, non-empty note).
2. Connect (was Arrange): input is the shuffled full inventory, order
   declared meaningless. Output is an edge-set only, strict JSON Schema
   plus one example. Nodes, layers, trunk, crown are never emitted.
3. Code arranges: edge validation, topological sort, cycle-break by
   weakest justification, layers by longest-path depth, crown deepest.
   Deterministic. The listness checker rejects any reordered-list
   output.

Bar: all four gold words pass the mechanical gate with non-empty
learner maps, then Danny walks them and records KEEP or KILL.
