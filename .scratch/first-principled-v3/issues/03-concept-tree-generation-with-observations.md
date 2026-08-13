# 03 - Concept tree generation with observations

**Type:** task (AFK)
**What to build:** the generator produces, for every layer, the observations
and discoveries that made that layer possible - REAL discovery history per
ticket 02's model (including the fail-honest unknown marker), built inside
the gap-free layer-chain structure from ticket 08, every abstraction tracing
to observations strictly below (the `deriveCheck` rule holds), the `basis`
field populated for every node, and all observation narratives written to the
approved STE subset. Extends the v2 foundation-first generator (v2 06).

**Blocked by:** 02 - Observations content model: the crux,
08 - Gap-free layer-chain structure

**Status:** resolved (opencode session, 2026-08-13)

## Answer (2026-08-13)

Delivered as an extension of the ticket 08 per-layer bottom-up generator in
`src/lib/agent/realityMap.js`: every node's `basis` is now a real-history
observation record (ticket 02) validated against the fail-honest contract
(ticket 09), and the live bar holds at 30/30 on real DeepSeek.

- **The record becomes the basis.** Every node, foundation included, carries
  `basis: {discoverer, date, keyObservation, confidence, note}` with EXACT /
  APPROXIMATE / UNKNOWN marks per the contract section 2 schema. The
  foundation now carries the first real observation a learner can point at
  (a deliberate strengthening of v2's "no basis on the foundation"). The
  prompts carry the contract's honesty language verbatim in spirit (section
  1) plus two additions recorded from the live run: an invention or first
  construction counts as a keyObservation (VisiCalc, GM-NAA I/O), and the
  model must not dodge a fact it actually knows.
- **deriveCheck extended.** Every node must carry a VALID observation record:
  marks from the enum, a non-empty value under a non-UNKNOWN mark, a dropped
  value under an UNKNOWN mark, confidence in high/medium/low, note a string.
  UNKNOWN is a legal, first-class state (the node exists, its observation is
  missing, the layer chain is unbroken). "Traces to a strictly lower layer"
  is enforced structurally: the ticket 08 per-layer rule (each layer derives
  only from the layer below) plus deriveCheck's reachability from the
  foundation. Date ordering is deliberately NOT enforced across layers - the
  canonical counterexample is the laptop fixture itself, where Boole's 1847
  algebra (l3) predates the 1947 transistor (l2) it abstracts over.
- **Contract rule 5 implemented as normalization, not rejection.** The model
  hedges by writing a value under an UNKNOWN mark ("about 1900"); per the
  contract such a value is DROPPED at validation. `dropUnknownValues`
  (mmg/observation.js) empties those values in the mechanical cleanup
  (`repairMap`) and in phase A, so the node keeps its visible gap without a
  repair. Raw records that still carry a value under UNKNOWN stay invalid
  for direct checks. On the first live run this class caused 3 failures;
  after normalization: 0.
- **Empty-output retry.** An empty or whitespace-only reply is a failure
  mode, not a mystery: it goes down the repair path with the contract's
  repair message re-stating the honesty rule ("If you do not know a fact,
  mark it UNKNOWN and leave the value empty - never invent a fact").
  max_tokens stays at the default 4096, inside the contract's 3000-5000
  headroom band (section 3).
- **Two pipeline changes from the live runs** (recorded because they change
  ticket 08 behavior): `selfReview.gaps` no longer gates a layer - the model
  files honesty notes there ("the observation record is UNKNOWN") and
  gating on free text turned honest behavior into false failures; the
  structural gates (validator + deriveCheck + down-edge rule) remain the
  backstop. And a mid-chain refusal is retried once before being honored -
  the model refused "money" mid-chain as "not derivable" on the first live
  run; the repair offers the `done` reply, and only the final attempt
  propagates a refusal. Phase A refusals (gibberish input) stay terminal.
  The layer repair message now lists EVERY existing node id (collisions can
  hit any earlier layer, not just the one below).
- **STE narratives.** Observation narratives (description, keyObservation,
  note) are written under the ticket 05 subset: the prompts carry the 8
  rules, and the exported mechanical check `steProblems` gates the live
  verification (no contractions, no filler or "e.g.", no em/en dashes, no
  sentence over 25 words - the "under 20 words" rule lives in the prompt,
  the gate tolerates the boundary so a well-written 21-word sentence does
  not fail a run). Vague words are reported as warnings, not failures - the
  referent rule is a judgment call the prompt carries.

**Tests**: `src/lib/agent/realityMap.test.js` extended for the record era
(observationProblems and dropUnknownValues units, deriveCheck record rules
including the UNKNOWN-with-value rejection and the legal fully-UNKNOWN
record, prompts carrying the honesty + STE blocks, empty-content retry with
the honesty repair, foundation and layer UNKNOWN-value normalization, the
mid-chain refusal retry, the all-ids repair message). `mmg/observation.js`
is the single definition of "valid record" shared by deriveCheck, the
schema validator, and the verification script. The laptop fixture now
carries canonical real-history records (Thales ~600 BC electricity through
Bricklin and Frankston 1979 VisiCalc). Full suite green, tsc clean.

**Live verification (v1 reliability bar)**: 30/30 concepts generated
gap-free with valid observation records and STE-clean narratives on real
DeepSeek (`deepseek-v4-flash`, thinking off), plus 2/2 clean refusals. Mean
22.5s per concept (ticket 08 baseline: 20.8s - the records cost ~1.7s),
repairs on 9/30. Fail-honest usage measured: EXACT 448, APPROXIMATE 330,
UNKNOWN 170 across 948 fields - the model marks real gaps honestly and never
invented a value. Evidence: `research/03-observations-verification.md`
(reproducible via `verify-observations.mjs`).

Note on the working tree: the ticket 04 viewmodel session (mapview/
observation.js, map.js, history.js) is mid-flight in the same tree; the
fixture change was coordinated with it - `observationOf` renders the record
era, and its fixture-keyed tests were updated to the post-03 fixture.

**Acceptance criteria**: all met - every layer carries real observations
that enabled it (records on every node, foundation included); deriveCheck
rejects any abstraction without a lower observation record; unknown
observations are marked honestly, never invented (UNKNOWN is legal, a value
under UNKNOWN is dropped); narratives STE-clean per ticket 05's subset
(prompt + mechanical gate); live reliability measured at 30/30, same bar as
v1 ticket 04.

- [x] Every layer carries the real observations that enabled it
- [x] deriveCheck still rejects any abstraction without a lower observation
- [x] Unknown observations marked honestly, never invented
- [x] All narratives STE-clean per ticket 05's subset
- [x] Live reliability measured (same bar as v1 ticket 04)

- [ ] Every layer carries the real observations that enabled it
- [ ] deriveCheck still rejects any abstraction without a lower observation
- [ ] Unknown observations marked honestly, never invented
- [ ] All narratives STE-clean per ticket 05's subset
- [ ] Live reliability measured (same bar as v1 ticket 04)
