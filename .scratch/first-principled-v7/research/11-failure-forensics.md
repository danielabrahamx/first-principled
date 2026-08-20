# 11 - Failure forensics: why the v7 three-stage Tree generator fails its mechanical gate

Written 2026-08-20 from the 2026-08-18 live capture. No secrets read. All
citations are to files in this repo. The gate code under study:
`src/lib/agent/realityMap.js` (three-stage generator + arrangeCheck) and
`src/lib/mmg/validator.js` (reality map shape). Locked prompt source:
`.scratch/first-principled-v7/research/04-stage-prompts/stage-prompts.md`.
Live evidence: `.scratch/first-principled-v7/research/07-diagnostics/*.json`
(pass 2; pass 1 in `07-diagnostics-pass1/`).

## 1. Verdict

All four gold words failed the gate. Three (laptop, battery, recursion)
failed because Arrange returned a **self-invented JSON schema** - a flat,
input-order-preserving node/edge list with none of the required map fields
(`concept`, `layers`, node `layer`/`description`, edge `type`/`because`,
`trunk`) and a provenance object (`used_inputs`/`unused_inputs`/
`edge_rationale`) that the gate cannot read. One (photosynthesis) failed
because every Epiphanies history record marked `UNKNOWN` while carrying
non-empty facts, so Arrange never ran. The gate itself is sound: the
fixture capture (`06-capture-diagnostics.mjs --fixture`) passes with zero
errors, and every observed error string maps 1:1 to gate code.

The dominant root cause is a **prompt/contract gap, not a model defect and
not a gate bug**: the Arrange stage is the only stage with neither a JSON
Schema nor an example of the required output shape in the shipped prompt
(the JSON contract exists only in the human-facing doc and in the gate
code), and the Epiphanies prompt omits the one sentence that would have
prevented the photosynthesis failure (the v6 prompt had it, the v7 prompt
dropped it). A secondary, deeper issue - order preservation - survives
schema fixes and needs its own mechanical check.

## 2. What each stage emitted, per gold word

### Stage 1 Chronology - passed 4/4

All four runs returned the contract shape exactly: `{ concept, chronology:
[{ id, regime, new_capability, enabled_by_previous, ancestry_kind,
target_relevance }] }` with ids c1..cN (laptop 10, battery 7, photosynthesis
8, recursion 6). Zero chronology errors. Chronology is a simple flat
contract and is the only stage whose prompt fully describes its fields.

### Stage 2 Epiphanies - passed 3/4, photosynthesis failed (8 errors)

Laptop/battery/recursion returned `{ concept, epiphanies: [{ id,
from_regimes, to_regimes, result, joint_kind, history: { certainty, who,
when, observation, uncertainty_note }, candidate_node }] }` with
EXACT/APPROXIMATE records (details in each diagnostics file). Epiphanies is
the only stage with a strict JSON Schema
(`buildEpiphaniesJsonSchema`, realityMap.js:78-137, wired at 729-735), so
shape was constrained and held.

Photosynthesis returned 8 epiphanies, every one `certainty: "UNKNOWN"` with
**non-empty** `who`/`when`/`observation` and **non-empty**
`uncertainty_note` (note lengths 108-181 chars). Actual captured record,
e1:

```json
{
  "id": "e1",
  "from_regimes": [],
  "to_regimes": ["c1"],
  "result": "Photosynthetic pigments absorb light and convert photon energy into electronic excitation",
  "joint_kind": "OBSERVATION",
  "history": {
    "certainty": "UNKNOWN",
    "who": ["UNKNOWN"],
    "when": "UNKNOWN",
    "observation": "Early spectroscopic studies showed chlorophyll absorption peaks matching solar spectrum; fluorescence emission demonstrated excited state decay.",
    "uncertainty_note": "No single experiment or person is recorded as first establishing the photophysics of pigment excitation in vivo."
  },
  "candidate_node": "c1"
}
```

e8 shows the same pattern with real facts: `who: ["Melvin Calvin", "Andrew
Benson", "James Bassham"]`, `when: "1950s-1960s"`, non-empty observation,
non-empty note, certainty UNKNOWN. All 8 violations are the same gate
error, from `historyProblems` (realityMap.js:373-376): "UNKNOWN requires
empty facts and a non-empty uncertainty_note". The note requirement was
met; the empty-facts requirement was not. `prompts.arrange` is `false` in
the diagnostics: the pipeline aborted at Epiphanies (realityMap.js:736-739)
and Arrange was never called. `arrange` is null in the diagnostics file.

### Stage 3 Arrange - 3/3 attempts returned a non-conforming shape

The shipped Arrange system prompt (realityMap.js:238-264) is prose only.
It names "map and provenance", "DOMAIN/EPIPHANY/STRUCTURAL" roles, and
"because" text, but contains **no JSON example and no schema**, and never
mentions `layers`, `trunk`, `concept`, or `provenance.nodes/edges/
discarded_input_ids`. The full contract exists only in
stage-prompts.md:190-244 (human documentation) and in `arrangeCheck`
(realityMap.js:459-565). The model invented a different shape on every
run - three runs, three ad-hoc schemas:

laptop (10+1 nodes, 17 edges):

```json
{
  "map": {
    "nodes": [{"id": "n1", "label": "Semiconductor Transistor", "kind": "EPIPHANY", "provenance_ids": ["e1"]}],
    "edges": [{"source": "n2", "target": "n1", "provenance_ids": ["e2"]}]
  },
  "provenance": {
    "used_inputs": {"chronology": ["c1", "...", "c10"], "epiphanies": ["e1", "...", "e10"]},
    "unused_inputs": [],
    "edge_rationale": {"n2->n1": "The monolithic integrated circuit rests on..."}
  }
}
```

battery (8 nodes, 9 edges): nodes `{"id","label","role","provenance_ids"}`,
edges `{"source","target","provenance_ids","dependence"}`,
provenance `{"used_inputs","dropped_inputs"}`.

recursion (7 nodes, 7 edges): nodes
`{"id","label","kind","description","provenance_ids"}`, edges
`{"from","to","label","provenance_ids"}`, provenance
`{"used_inputs","unused_inputs","notes"}`.

Common to all three: no `map.concept`, no `map.layers`, no node `layer`,
edge `type`/`because` missing or renamed (`dependence`, `label`), and
provenance shaped as flat used/unused lists instead of per-node/per-edge
`input_refs` plus `discarded_input_ids`. The shared elements the model DID
emit (`provenance_ids`, `used_inputs`, `unused_inputs`) are direct
paraphrases of prompt phrases ("Cite chronology or epiphany IDs for every
DOMAIN or EPIPHANY node and every edge. List every unused input ID with a
short reason.") - the model followed the prose and guessed the keys.

**Order preservation.** All three Arrange outputs preserve the Stage 1/2
input order 1:1. laptop: n1..n10 = e1..e10 labels verbatim, crown n11
"Laptop" with `provenance_ids: ["concept"]` (not a valid input id). battery:
n0 = c1 regime, n1 = e1, n2 = e2, n3 = e3, n4 = e4, n5 = e5, n6 = e6, n7 =
c7 regime "Lithium-ion battery" (crown) - a chain in input order with two
branches (edges n1->n0, n2->n0, n3->n1, n4->n1, n4->n3, n5->n3, n5->n4,
n6->n2, n7->n6). recursion: n1..n6 = e1..e6 in order, n7 crowns with all
six refs. The Arrange prompt says "You may reorder, drop, collapse, rename,
and promote inputs" - permissive, not prescriptive - and "Chronology is not
a spanning chain"; the model ignored both because nothing shows what a
reordered tree looks like. battery labels are paraphrases (e.g. n1 "Voltaic
pile architecture" from e1), so the model CAN rename; it just never
reorders or drops (unused_inputs empty everywhere, no discarded list).

### Gate failure reconciliation (errors match the code exactly)

| Word | Errors | Breakdown vs gate code |
| --- | --- | --- |
| laptop | 123 | 11 nodes missing description + 11 missing layer (validator.js:193-214) + 11 invalid role (`kind` not `role`, arrangeCheck.js:480) + 17 edges missing type (validator.js:270) + 17 missing because (arrangeCheck.js:516) + no concept (validator.js:122) + concept mismatch (arrangeCheck.js:468) + no layers (validator.js:145) + undirected cycle n6-n9-n8-n4-n10-n6 (arrangeCheck.js:528) + no trunk (arrangeCheck.js:541) + provenance.nodes/edges/discarded_input_ids not arrays + 11 nodes and 17 edges without provenance entries (realityMap.js:579-633) + all 20 inputs neither used nor discarded (realityMap.js:642-644) |
| battery | 79 | 8 nodes missing description + 8 missing layer, 9 edges missing type + 9 missing because, 6 EPIPHANY nodes missing basis (arrangeCheck.js:483-487), no concept/layers, undirected cycle n3-n4-n5-n3, 3 crowns (n2, n5, n7 - nothing targets them; arrangeCheck.js:533-535), no trunk, provenance as above, 13 inputs unused |
| recursion | 58 | edges use `from`/`to`, so 14 source/target errors (validator.js:255-260, early return hides type checks), 7 nodes missing layer + 7 invalid role, no concept/layers, disconnected (adjacency built from missing source/target is empty; arrangeCheck.js:529), 7 crowns, no trunk, provenance as above, 12 inputs unused |
| photosynthesis | 8 | 8x `eN.history UNKNOWN requires empty facts and a non-empty uncertainty_note` (realityMap.js:374-376) |

The `input "e9" is neither used nor discarded` style errors occur because
the gate reads only `provenance.nodes/edges/discarded_input_ids`; the
model's `used_inputs` object is invisible to it, so nothing is ever marked
used or discarded.

## 3. Root-cause hypotheses, ranked by evidence

### H1 (highest confidence): Arrange has no output schema and no example in the shipped prompt

Evidence:
- The only stage with a strict JSON Schema (Epiphanies) is the only stage
  whose shape never failed. Chronology's contract is fully described in its
  prompt and never failed. Arrange - no schema, no example - failed shape
  on every attempt.
- Three runs produced three DIFFERENT ad-hoc schemas (laptop `kind` +
  `edge_rationale`, battery `role` + `dependence`, recursion `kind` +
  `from/to` + `notes`). A shared model misconception would repeat; ad-hoc
  reconstruction of the contract from prose hints does not.
- The model emitted exactly the concepts the prose names (provenance_ids,
  used/unused inputs, because text) and none of the concepts the prose does
  not name (`layers` and `trunk` appear nowhere in the Arrange prompt;
  "layers" appears in the Chronology prompt only as a forbidden output).
- Control: the v6 one-shot generator (git 34cbb8b^,
  `src/lib/agent/realityMap.js`) sent the model the current map JSON as an
  example every call, named the required shape explicitly, and built one
  layer per call. It produced conformant layered maps (see
  `.scratch/first-principled-v6/research/12-live-maps/*.json`: laptop l0-l7,
  battery l0-l5, recursion l0-l5). v6 failed the gate on substance, not on
  shape.
- The fixture capture passes the full gate with 0 errors when the Arrange
  reply conforms (ran 2026-08-20: `PASS`, `ERROR_COUNT=0`).

### H2 (high confidence): the model's default is a flat, order-preserving list; nothing mechanical stops it

Evidence:
- All three Arrange outputs keep Stage 1/2 array order 1:1 (battery is a
  textbook chain c1-e1-e2-e3-e4-e5-e6-c7). The prompt's reordering
  instruction is permissive ("You may..."), and no example shows reordering,
  dropping, or collapsing.
- Even with scaffolding, v6 kept a chronological spine: battery v6 layers
  are "electrochemistry -> galvanic cell -> voltaic pile -> wet cell ->
  dry cell -> modern battery". Chronology as default spine survives both
  prompt regimes.
- The gate currently has NO check for order preservation or label copying.
  "Do not emit a timeline" and "do not copy the Stage 1 or Stage 2 payload
  into map" are prose-only. A schema-conformant Arrange that still emits the
  inputs in order with an edge chain would pass the gate today. This is a
  gate gap, independent of the LLM.

### H3 (high confidence for photosynthesis): the UNKNOWN emptiness rule is uncommunicated and unenforceable by schema

Evidence:
- The Epiphanies system prompt (realityMap.js:220-235) says "Use UNKNOWN or
  NO_SINGLE_JOINT when history does not support a precise event." It never
  says what UNKNOWN means mechanically (empty who, null when, null
  observation, note carries the explanation).
- The JSON Schema cannot express the conditional: "Certainty rules stay in
  epiphaniesProblems" (realityMap.js:71-72); the OpenRouter strict subset
  forbids `if/then/allOf` (realityMap.js:71-72). So the emptiness rule
  exists only in the human doc (stage-prompts.md:141-142) and in gate code.
- The model's behavior was semantically reasonable: it recognized genuinely
  diffuse joints, marked them UNKNOWN honestly, and still supplied its best
  facts plus a note. The mechanical rule then threw the facts away. e1
  shows the token-literal trap: `who: ["UNKNOWN"]`, `when: "UNKNOWN"` -
  "use UNKNOWN" reads as "write the word UNKNOWN".
- The v6 per-layer prompt contained the missing sentence: "If you do not
  know a fact, mark it UNKNOWN and leave the value empty - never invent a
  fact" (git 34cbb8b^, realityMap.js:351). v7 dropped it.
- One stage-2 violation is total failure by design ("one pass per Stage and
  no repair call", stage-prompts.md:11-12): photosynthesis produced no map
  at all, even though Chronology was fine.

### H4 (weaker, untested): list-to-tree transformation may be fundamentally unreliable single-shot

Evidence: v6 one-shot, with maximum scaffolding (per-layer calls, examples,
repair loops with error feedback), still failed the gate 4/4 on substance
(laptop skipped layer l7; battery combines from 1 layer; photosynthesis
empty map; recursion crown not named). Once shape is fixed, the semantic
bar (contiguous layers, single crown naming the target, genuine Dependence
edges, honest observation records) is where v6 died. H1/H2 fixes are
necessary but may not be sufficient; H4 says the Arrange step may need a
different shape entirely (deterministic code layering, model only
reordering labels, or a repair pass).

## 4. Design constraints any working generator must satisfy

1. **The gate must keep rejecting flat lists - and must also reject
   order-preserving lists that happen to be schema-conformant.** Add a
   listness check as a pure function: (a) label-copy detection - node label
   near-equal to any input `regime`/`result` string, (b) order-preservation
   detection - node order in layers vs input array order correlation, (c)
   drop/rename evidence - at least one input discarded or one node label not
   derivable from any input. All three captured arrangements must fail it;
   the fixture arrangement must pass it.
2. **Arrange input format must make copying impossible.** Do not hand the
   model the ordered arrays as-is (realityMap.js:746-750). Options, cheap
   to prototype: shuffle chronology and epiphanies and state the order is
   arbitrary; strip `regime`/`result`/`candidate_node` labels to terse
   stubs and force the model to write new labels; require provenance
   `renamed_from` entries. Any variant is testable offline against the
   captured arrangements.
3. **Give Arrange a strict JSON Schema plus one worked example**, mirroring
   `buildEpiphaniesJsonSchema` (required: concept, layers with contiguous
   ids, node layer/description/role, edge type/because, trunk,
   provenance.nodes/edges/discarded_input_ids). This is the highest-evidence
   fix; Epiphanies proves the model holds schema-constrained shape.
4. **Name `layers` and `trunk` in the Arrange prompt** - or, better,
   **derive them in code**: layers from longest-path layering of the DAG and
   trunk from a code-chosen path. The model has never emitted layers in any
   v7 run and was actively told not to in Stage 1; anything the model
   reliably fails to emit should be computed, not requested.
5. **Enforce the certainty rules in the prompt, not only in the gate.**
   Add verbatim to the Epiphanies prompt: "When certainty is UNKNOWN, who
   must be an empty array, when null, observation null; put what you know
   in uncertainty_note." Rephrase "Use UNKNOWN" to "set certainty to
   UNKNOWN" to kill the token-literal fill (`who: ["UNKNOWN"]`). Consider
   steering genuinely diffuse joints to `GRADUAL_SYNTHESIS` or
   `NO_SINGLE_JOINT` (which may carry facts) instead of UNKNOWN+facts, or
   relax the UNKNOWN rule so the note, not emptiness, is the honesty
   carrier - a product decision, but the current rule discards real
   knowledge.
6. **Decide single-stage-failure semantics.** One bad epiphany record
   currently kills the whole map (photosynthesis -> empty learner map,
   rubric 0s). Either keep it (honest) and say so, or filter invalid
   epiphany items in code instead of rejecting the stage. The gate itself
   need not change for this.
7. **Keep the fixture capture as the regression harness.** It exercises the
   full gate path with zero LLM cost.

## 5. Cheap falsifiable tests (no live API spend)

1. **Fixture regression** (already green): `node
   .scratch/first-principled-v7/research/06-capture-diagnostics.mjs
   --fixture --out-dir <dir>`.
2. **Listness checker**: pure function + unit tests; must flag all three
   captured arrangements, must pass the fixture arrangement, must flag the
   v6 laptop map (chronological layers) and the v6 battery map
   (chronological layers). Free.
3. **Arrange JSON Schema unit test**: build `buildArrangeJsonSchema`
   (mirror of the Epiphanies schema), assert it rejects the three captured
   arrangements and accepts the fixture arrangement. Free, no LLM.
4. **v6-control revalidation**: run the v7 `arrangeCheck` against the v6
   one-shot maps in `12-live-maps/` to see which v6 maps would pass shape
   today and which semantic checks are the binding ones. Free.
5. **Prompt-text assertions**: unit-test that the shipped Epiphanies and
   Arrange prompts contain the emptiness sentence, the "set certainty to"
   phrasing, and the words "layers" and "trunk". Free, guards against
   regression.
6. **Deterministic Arrange prototype**: pure-code transformer (layering
   from `enabled_by_previous` + `from/to_regimes` + `candidate_node`) that
   emits a conformant map; gate it with `arrangeCheck`. Tests whether the
   tree step needs the model at all. Free.
7. **One live Epiphanies-only probe** on "photosynthesis" (~2 calls, small
   spend) with the revised prompt to confirm UNKNOWN records come back
   empty-fact/non-empty-note. This is the only test that costs money.

## 6. Corrections to the capture record

- `07-danny-followability.md:45` says photosynthesis epiphanies had "non-
  empty facts and empty uncertainty_note". The pass-2 captures show all 8
  notes NON-empty (108-181 chars). The gate error fires on the non-empty
  FACTS; the note rule was satisfied. The rubric row "gate fail: Epiphanies
  UNKNOWN history contract" is correct.
- `07-danny-followability.md:43` says "Node labels copy Chronology regimes
  in order". laptop labels copy Epiphany RESULTS in order (n1..n10 =
  e1..e10); battery paraphrases e-results in order with regime nodes at
  both ends. The precise failure is input-order preservation (joint list),
  with paraphrase, not verbatim regime copying.
- `07-danny-followability.md:43` lists provenance as
  `used_inputs`/`unused_inputs`/`edge_rationale`; battery used
  `dropped_inputs` and recursion `notes` instead of `unused_inputs`/
  `edge_rationale`. The three runs disagreed on their own invented schema,
  which is itself evidence for H1.

## 7. Key file and line references

- Arrange prompt (prose only, no schema/example): `src/lib/agent/realityMap.js:238-264`; Arrange call without jsonSchema: `:746-750`
- Epiphanies prompt: `:220-235`; JSON Schema: `:78-137` (comment "Certainty rules stay in epiphaniesProblems": `:72`); schema wired: `:729-735`; UNKNOWN rule: `:373-376`; stage abort on epiphany errors: `:736-739`
- arrangeCheck: `:459-565`; provenanceProblems ("neither used nor discarded"): `:574-647`
- validator.js: node description `:193-195`, node layer `:210-214`, edge type `:270-271`, layer contiguity `:282-299`, layer mirror `:324-350`
- stage-prompts.md: one pass/no repair `:11-12`; UNKNOWN contract `:141-142`; Arrange contract example `:190-244`
- Capture record: `.scratch/first-principled-v7/research/07-danny-followability.md:36-45`
- Evidence JSON: `.scratch/first-principled-v7/research/07-diagnostics/{laptop,battery,photosynthesis,recursion}-{diagnostics,learner}.json`
- v6 controls: `.scratch/first-principled-v6/research/12-live-maps/*.json`; v6 scaffolded prompt (example + UNKNOWN emptiness + repair): git `34cbb8b^`, `src/lib/agent/realityMap.js` (per-layer user message ~`:310-351`)
- Fixture gate run (2026-08-20): `PASS`, `ERROR_COUNT=0` via `06-capture-diagnostics.mjs --fixture`
