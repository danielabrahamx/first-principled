# 13 - Prior-art patterns for LLM-built dependence trees

Research for the v7 Tree builder (three-stage pipeline, zero-dep Netlify
background function, 3 serial LLM calls, mechanical JSON gate, no repair
loop, no extra critique call). Question: what do existing systems do to
reliably build LLM-generated knowledge graphs / concept maps /
prerequisite graphs, and what transfers to this pipeline?

Primary sources only: papers (arXiv), official docs, OSS repos. Claims
verified against abstracts/docs on 2026-08-20 unless marked (title-level).
Evidence strength is rated per pattern: High = multiple independent
benchmarks or deployed systems; Medium = one strong study or
domain-specific; Low = plausible, not directly measured.

Sibling evidence in this repo: `10-json-schema-epiphanies.md` records the
live Arrange gate failure (missing `concept`, `layers`, edge ids,
provenance) with no retry - the exact failure mode this research targets.

## 1. Prior art inventory and pipeline shapes

### 1.1 GraphRAG (Microsoft) - extract -> augment -> summarize
Paper: Edge et al., "From Local to Global: A Graph RAG Approach to
Query-Focused Summarization" (2024) https://arxiv.org/abs/2404.16130.
Docs (default dataflow): https://microsoft.github.io/graphrag/index/default_dataflow/
Repo: https://github.com/microsoft/graphrag

Pipeline shape (docs, verified): Phase 3 Graph Extraction (LLM entity and
relationship extraction per text chunk, then LLM relationship summarization)
-> Phase 4 Graph Augmentation (deterministic Leiden community detection) ->
Phase 5 Community Summarization (LLM per-community reports) -> retrieval.
Key facts: LLM extracts entities and relations in one JSON call per chunk
with in-prompt examples; every LLM output feeds deterministic algorithms
(clustering, tables); there is no hard semantic validation gate - the repo
tree contains only config validation (`validate_config.py`) and a noun-phrase
validator; quality control is downstream and statistical. Entity
duplication/noise is a known limitation discussed in the project.

### 1.2 HippoRAG - extract (one-shot) -> mechanical index
Paper: Gutierrez et al. (2024) https://arxiv.org/abs/2405.14831.
Pipeline shape: LLM OpenIE extracts (subject, relation, object) triples per
paragraph (single extraction call), triples are stored in a KG, then
Personalized PageRank over the KG does retrieval. Reported: up to 20%
better than SOTA RAG on multi-hop QA; 10-30x cheaper than iterative
retrieval (abstract, verified). Shape: LLM proposes triples, a deterministic
algorithm (PPR) does all arrangement/selection. No validation gate on the
triples themselves.

### 1.3 LLM KG construction surveys - three-layer pipeline consensus
"LLM-empowered knowledge graph construction: A survey" (2025)
https://arxiv.org/abs/2510.20345 (abstract verified). Describes the
classical three-layer pipeline (ontology engineering, knowledge extraction,
knowledge fusion) and two LLM paradigms: schema-based (structure,
normalization, consistency emphasized) vs schema-free (flexibility).
Takeaway: multi-stage pipelines with a strong schema layer are the
consensus; schema-free one-shot generation is treated as the flexible but
inconsistent option.

### 1.4 Concept map generation - review of 28 studies
"Generative Large Language Models for Knowledge Representation: A
Systematic Review of Concept Map Generation" (2025) https://arxiv.org/abs/2509.14554
(abstract verified). Six methodological categories: human-in-the-loop
systems, weakly supervised models, fine-tuned LLMs, pre-trained LLMs with
prompt engineering, hybrid systems with knowledge bases, and modular
frameworks combining symbolic and statistical tools. Validation strategies:
quantitative (precision/recall/F1, semantic similarity) and qualitative
(expert review, learner feedback). Findings: LLM concept maps are promising
but validity and interpretability remain open problems; the field leans on
human or expert validation.

### 1.5 Prerequisite graphs and curriculum - pairwise judgment + DAG
- Pan, Li, Li, Tang, "Prerequisite Relation Learning for Concepts in MOOCs"
  (ACL 2017) https://aclanthology.org/P17-1133/ (verified). Frames
  prerequisite extraction as PAIRWISE classification over concept pairs
  (does A precede B), then evaluates against gold prerequisite graphs.
  This pairwise framing, not free-form graph generation, is the standard in
  the field: the graph is assembled deterministically from pair judgments.
- Skill-it (Meta, ICML 2024) https://arxiv.org/abs/2307.14430 (abstract
  verified): learns a skill DAG with prerequisite ordering from data;
  reports +36.5 accuracy on synthetic LEGO and -13.6% target validation
  loss on Natural Instructions. Arrangement is computed by algorithm over
  pairwise skill relations, not generated as a list.
- "LLM-Assisted Knowledge Graph Completion for Curriculum and Domain
  Modelling" (2025) https://arxiv.org/abs/2501.12300 (title-level):
  LLMs fill and validate curriculum KGs, again completing a schema rather
  than free-generating layout.

### 1.6 Ontology engineering - LLMs propose, humans dispose
- OntoChat (2024) https://arxiv.org/abs/2403.05921 (abstract verified):
  conversational ontology engineering where users steer requirement
  elicitation and test early ontologies - explicit human-in-the-loop
  validation of LLM output.
- "Ontology engineering with Large Language Models" (2023)
  https://arxiv.org/abs/2307.16699 (abstract verified): fine-tuned GPT-3
  translates NL sentences to OWL axioms used to enrich an ontology "in a
  human supervised manner".

### Pipeline shape summary
| System | Shape | LLM proposes | Deterministic/mechanical steps |
|---|---|---|---|
| GraphRAG | extract -> augment -> summarize | entities, relations, community reports | Leiden clustering, graph tables, report assembly |
| HippoRAG | extract -> index -> retrieve | triples per paragraph | KG store, Personalized PageRank |
| Prereq literature (Pan 2017) | pairwise judge -> assemble | pairwise A-before-B labels | graph assembly, transitive closure, evaluation |
| Skill-it | measure -> order | (none; data-driven) | skill DAG, sampling schedule |
| Concept-map systems | varied | maps/nodes/links | validation against gold maps or expert review |
| Ontology engineering | elicit -> draft -> test | axioms, competency questions | human review loop |

No shipped system found that lets the LLM produce the final global
arrangement in one call. Arrangement is always a deterministic step over
LLM-proposed parts. This is the single most transferable fact.

## 2. Why LLMs collapse to flat ordered lists, and mitigations with evidence

### Mechanism evidence
- Listwise position bias: RankGPT (Sun et al. 2023) https://arxiv.org/abs/2304.09542
  (abstract verified) shows LLM listwise re-ranking is strong but
  order-sensitive; the method mitigates with a sliding-window permutation
  scheme plus voting, and even distills ranking via "permutation
  distillation". Direct evidence that LLMs anchor to input order on
  ordering tasks - the same failure as CHRONOLOGY_CAPTURE.
- Context order sensitivity: "Lost in the Middle" (Liu et al. 2023)
  https://arxiv.org/abs/2307.03172 (verified): performance degrades when
  relevant info sits mid-context; order of presented material changes
  answers.
- In-context example order: "What Makes Good In-Context Examples for GPT-3?"
  (Liu et al. 2022) https://arxiv.org/abs/2101.06804 (abstract verified):
  "empirical results depend heavily on the choice of in-context examples."
- Constraint overload: FollowBench (Jiang et al. 2023)
  https://arxiv.org/abs/2310.20410 (verified): constraint-following
  accuracy drops as the number of constraints grows; divide-and-conquer
  (decomposition) prompting recovers adherence. A single "arrange
  everything correctly" call piles up constraints (edges, layers, crown,
  provenance, chronology) - exactly the overloaded-call failure mode.
- Weak graph reasoning: NLGraph (Wang et al. 2023) https://arxiv.org/abs/2305.10037
  (abstract verified): 29,370 graph problems; LLMs show preliminary graph
  ability but are "brittle" and degrade on complex graph problems; explicit
  graph-structure prompting (Build-a-Graph, Algorithmic prompting) helps
  3.07-16.85%. GraphArena (Tang et al. 2024) https://arxiv.org/abs/2407.00379
  (title-level) benchmarks LLMs on graph computation.
- NULL/unknown bias: GPT-RE (Wan et al. 2023) https://arxiv.org/abs/2305.02105
  (abstract verified): LLMs show "the strong inclination to wrongly
  classify NULL examples into other pre-defined labels" in relation
  extraction. Direct support for the honesty-contract failure: models
  avoid emitting UNKNOWN and invent content instead.

### Mitigations with evidence
1. Decomposition: least-to-most (Zhou et al. 2022) https://arxiv.org/abs/2205.10625
   (verified): decompose into subproblems, solve sequentially - big gains
   over CoT on composition tasks. FollowBench divide-and-conquer (above).
   Tree of Thoughts (Yao et al. 2023) https://arxiv.org/abs/2305.10601 and
   Graph of Thoughts (Besta et al. 2024) https://arxiv.org/abs/2308.09687:
   branching/non-linear exploration beats single linear decoding on hard
   tasks. Strength: High. Implication: one-shot whole-tree generation was
   the wrong call; staged decomposition is right, and each stage should
   carry as few constraints as possible.
2. Two-phase generate-then-verify with an independent second pass: GPT-RE
   (verification prompt after extraction - verified abstract), Chain-of-
   Verification (Dhuliawala et al. 2023) https://arxiv.org/abs/2309.11495
   (verified): plan verification questions, answer them independently,
   revise. Strength: Medium-High. Implication: an "enrich with evidence"
   stage between inventory and arrangement is the verification pass.
3. External mechanical verifier instead of LLM self-critique: "Large
   Language Models Cannot Self-Correct Reasoning Yet" (Huang et al. 2023)
   https://arxiv.org/abs/2310.01798 (verified): intrinsic self-correction
   without external feedback degrades performance. LLM-Modulo (Kambhampati
   et al. 2024) https://arxiv.org/abs/2402.01817 (verified): LLMs cannot
   plan or self-verify alone; LLM proposes, sound external verifier checks.
   Strength: High. Implication: the deliberate "no extra critique call"
   constraint is evidence-aligned; the mechanical JSON gate IS the
   verifier, and resampling (not critiquing) is the fix path.
4. Sample multiple, select mechanically: Self-Consistency (Wang et al.
   2022) https://arxiv.org/abs/2203.11171 (verified: GSM8K +17.9%, SVAMP
   +11.0%, AQuA +12.2% with sampling + majority vote); CodeT (Chen et al.
   2022) https://arxiv.org/abs/2207.10397 (verified): sample code, generate
   tests, rank by test pass rate. Strength: High. Implication: if budget
   allows, best-of-k on the Arrange stage beats one attempt; with a fixed
   3-call budget, the client-side job retry (re-invoking the function) is
   the same pattern at job granularity.
5. Ordering-agnostic input: shuffle/permute inventory before Arrange, and
   explicitly state order carries no meaning. Evidence: RankGPT permutation
   mitigation (above), Lost in the Middle (above). Strength: Medium-High
   for ordering tasks, Low for graph layout specifically - be honest.
6. Structured output constraints fix syntax only: OpenAI Structured
   Outputs docs https://platform.openai.com/docs/guides/structured-outputs
   (verified from fetched text: "While both ensure valid JSON is produced,
   only Structured Outputs ensure schema adherence"); DeepSeek JSON mode
   https://api-docs.deepseek.com/guides/json_mode; Outlines (guaranteed
   syntax via constrained decoding) https://github.com/dottxt-ai/outlines;
   Instructor (retry-on-validation pattern) https://github.com/jxnl/instructor.
   Strength: High for syntax, zero for semantics. Implication: JSON Schema
   is necessary but cannot fix CHRONOLOGY_CAPTURE; the gate must check
   semantics (edges, layers, crown, provenance) mechanically.
7. Edge justification grounded in evidence: GPT-RE verification and CoVe
   (above) show requiring the model to justify/verify each relation
   improves extraction. Strength: Medium (relation-extraction domain). 
8. Node-first vs edge-first: GraphRAG, HippoRAG, and the KG survey all
   extract entities before/alongside relations in separate phases; the
   concept-map review's "modular frameworks" category combines symbolic and
   statistical tools. Strength: Medium (architectural consensus, no clean
   ablation). Implication: the planned replacement (unordered inventory ->
   evidence -> arrange) is node-first and matches consensus.

## 3. Validation gates without repair loops: what shipped systems do

Findings, stated honestly:
- No shipped system found that mechanically validates LLM-generated graph
  semantics and fails hard. GraphRAG validates configuration and has a
  typed data model, but no semantic gate; bad extractions flow downstream.
- The strongest "gates" in the wild are syntax gates: OpenAI Structured
  Outputs strict mode (schema adherence guaranteed - docs verified),
  Outlines/guidance constrained decoding (syntax guaranteed by
  construction), and retry-until-valid wrappers (Instructor). These make
  JSON errors near-zero but say nothing about semantic correctness.
- The closest hard-fail gates are in code generation, where mechanical
  tests select among candidates (CodeT, pass@k style), and in planning
  where sound verifiers reject proposals (LLM-Modulo). The pattern that
  has evidence is NOT "one attempt, then fail"; it is "k attempts,
  mechanical selection" or "propose, verify, propose again".
- Public gate-failure-rate numbers for semantic LLM-graph gates: none
  found. Do not cite fabricated rates. The honest claim is that syntactic
  gate failure can be driven near zero by constrained/structured outputs,
  and semantic gate failure is the open problem the concept-map review
  flags as "validity remains a challenge".

## 4. Transfer map to the 3-call serverless pipeline

Constraints: zero-dep Netlify background function, 3 serial HTTP calls,
mechanical JSON gate, no DB, no worker, no framework, no extra critique
call, one-shot already failed. Budget means retries are expensive: a whole
job retry is 3 calls.

### Recommended shape (evidence-aligned)
Stage 1 (inventory): unordered concept inventory, each item with id,
one-line definition, per-item certainty, and explicit UNKNOWN markers
when the model cannot ground a concept. Node-first, few constraints.
Stage 2 (evidence): for each inventory item, one piece of concrete
evidence/observation text with a source id. This is the grounding and
verification pass (GPT-RE/CoVe pattern). Empty evidence forces the item
to stay UNKNOWN - enforced mechanically.
Stage 3 (arrange): input = inventory as a SET of ids (order shuffled with
a stable seed; prompt states order is meaningless - RankGPT/lost-in-middle
pattern). Output = edge list only: {prereq_id, postreq_id, reason,
evidence_ids[]}, plus a suggested crown id. Every edge must cite evidence
ids from stage 2; the gate rejects edges citing none.
Mechanical post-step (free, deterministic): dedupe ids, drop
self-loops, topo-sort, break cycles by dropping the lowest-certainty or
least-evidenced edge, assign layers by longest-path depth (this replaces
the LLM-computed `layers` that failed the gate - the LLM never computes
layers again), pick the crown as the unique maximal element (if multiple
maxima, use the suggested crown id or fail). This is the
"LLM proposes, solver disposes" pattern (LLM-Modulo, GraphRAG, HippoRAG,
prerequisite literature).

### Pattern transfer table
| Pattern | Evidence strength | Change in this pipeline | Cost |
|---|---|---|---|
| Node-first stages (inventory -> evidence -> arrange) | Medium | Already the planned replacement; keep | 0 |
| Edges as pairwise judgments by id, not a reordered list | High (prereq literature) | Arrange emits edge set; gate rejects flat lists | prompt + gate |
| Ordering-agnostic input (shuffle ids, state order is meaningless) | Medium-High (ranking), Low (graph layout) | Shuffle inventory before Arrange; detect output-order == input-order as CHRONOLOGY_CAPTURE signal | 0 |
| Mechanical post-processing (topo sort, cycle break, depth layers, crown) | High (LLM-Modulo, GraphRAG, HippoRAG) | Move layers/crown/order out of the LLM entirely | 0 (code) |
| Evidence-grounded edge justification | Medium (RE domain) | Edge reasons must cite stage-2 evidence ids; gate enforces | prompt + gate |
| Structured outputs for syntax | High (syntax only) | Keep json_schema on Epiphanies; use json_schema for Arrange where the provider supports it (paid Nemotron did); gate remains semantic | 0 |
| No LLM self-critique call | High (self-correct, LLM-Modulo) | Already the constraint; do not add a 4th call | 0 |
| Sampling + mechanical selection | High (self-consistency, CodeT) | Two options: (a) one Arrange call returns 2 candidate edge sets, gate picks the less-violating one (novel, Low evidence); (b) gate failure = job failure, client re-invokes the whole job (strong evidence, costs 3 calls per retry). Recommend (b), optionally (a) behind a flag | 1x-2x Arrange, or job retry |
| Fail-hard gate | Low (no shipped precedent found) | Acceptable only with client-side job retry; report gate failure rate from prod logs | 0 |
| Decompose constraints per call | High (FollowBench, least-to-most) | Arrange asks only for edges + crown; layers and chronology are mechanical | prompt |
| Honesty/UNKNOWN enforcement | Medium (GPT-RE NULL bias) | UNKNOWN decided at inventory time per item; mechanically propagated - no UNKNOWN may appear as an edge endpoint; do not ask the model to retro-declare honesty | gate |

### Budget arithmetic
3 calls, no DB. Worst case per job: 3 calls. Retry = re-invocation (each
3 calls). The 14-minute poll deadline (from AGENTS.md) allows roughly 2-3
job retries worst-case; recommend: retry once on gate failure, then fail
hard with a structured error the frontend can render. Do not burn the
budget on LLM critique calls - the evidence says they do not help without
an external verifier, and the gate already is the verifier.

### Honest limitations of this research
- No benchmark directly measures "LLM copies input order when asked to
  build a tree"; the CHRONOLOGY_CAPTURE explanation is inferred from
  ranking/context-order evidence (RankGPT, Lost in the Middle). Medium
  confidence, not proven for graph layout.
- Evidence strength for node-first over one-shot within a 3-call budget is
  architectural consensus, not an ablation.
- No public gate-failure-rate numbers exist for semantic graph gates; the
  pipeline should instrument its own (count gate failures per stage per
  concept) - that will be the honest dataset.
- Multi-candidate-in-one-response selection (option a above) is not backed
  by published evidence; treat it as an experiment.

## 5. Sources
- GraphRAG paper: https://arxiv.org/abs/2404.16130
- GraphRAG default dataflow docs: https://microsoft.github.io/graphrag/index/default_dataflow/
- GraphRAG repo (validate step check): https://github.com/microsoft/graphrag
- HippoRAG: https://arxiv.org/abs/2405.14831
- LLM KG construction survey: https://arxiv.org/abs/2510.20345
- Concept map generation review: https://arxiv.org/abs/2509.14554
- Prerequisite Relation Learning for Concepts in MOOCs (ACL 2017):
  https://aclanthology.org/P17-1133/
- Skill-it: https://arxiv.org/abs/2307.14430
- LLM KG completion for curriculum modelling: https://arxiv.org/abs/2501.12300
- RankGPT: https://arxiv.org/abs/2304.09542
- Lost in the Middle: https://arxiv.org/abs/2307.03172
- What Makes Good In-Context Examples for GPT-3: https://arxiv.org/abs/2101.06804
- NLGraph: https://arxiv.org/abs/2305.10037
- GraphArena: https://arxiv.org/abs/2407.00379
- Large Language Models Cannot Self-Correct Reasoning Yet:
  https://arxiv.org/abs/2310.01798
- LLM-Modulo: https://arxiv.org/abs/2402.01817
- Chain-of-Verification: https://arxiv.org/abs/2309.11495
- Self-Consistency: https://arxiv.org/abs/2203.11171
- CodeT: https://arxiv.org/abs/2207.10397
- FollowBench: https://arxiv.org/abs/2310.20410
- Least-to-Most: https://arxiv.org/abs/2205.10625
- Tree of Thoughts: https://arxiv.org/abs/2305.10601
- Graph of Thoughts: https://arxiv.org/abs/2308.09687
- GPT-RE: https://arxiv.org/abs/2305.02105
- InstructUIE: https://arxiv.org/abs/2304.08085
- OntoChat: https://arxiv.org/abs/2403.05921
- Ontology engineering with LLMs: https://arxiv.org/abs/2307.16699
- OpenAI Structured Outputs docs: https://platform.openai.com/docs/guides/structured-outputs
- OpenAI Structured Outputs announcement: https://openai.com/index/introducing-structured-outputs-in-the-api/
- OpenAI Structured Outputs: Factuality eval: https://openai.com/index/structured-outputs-factuality/
- DeepSeek JSON mode: https://api-docs.deepseek.com/guides/json_mode
- Outlines: https://github.com/dottxt-ai/outlines
- Instructor: https://github.com/jxnl/instructor
- Repo evidence: .scratch/first-principled-v7/research/10-json-schema-epiphanies.md
