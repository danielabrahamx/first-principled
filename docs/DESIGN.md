# DESIGN - the system as one thing

This is the conceptual map. `docs/STATUS.md` says what is true now;
this says how the pieces fit and why they are shaped that way.

Read this when you need to change something and want to know what else
that change touches.

## The one-sentence shape

> Ask the model only questions it is good at, take its answer apart in
> code, and let the code own every decision that can be counted.

Everything below is a consequence of that sentence.

## The stack, from the model's judgement outward

Each layer narrows the one above it. The model's uncertainty is
absorbed as early as possible, so that by the time we reach the
frontend everything is decided and mechanical.

```
  learner types a word
          |
  [1] INVENTORY   model names candidate concepts        <- semantics
          |
  [2] JUDGMENTS   model judges explicit pairs          <- semantics
          |
  [3] TOPOLOGY    code picks the tree, no model call    <- mechanical
          |
  [4] REALIZATION model writes the learner-facing copy  <- semantics
          |
  [5] REALITYMAP  code assembles, validates, layers     <- mechanical
          |
  [6] TREE        the product surface
```

The load-bearing observation: **the model is only ever asked a local
question, and code is only ever asked a global one.** That separation
is the entire design. It is why the v9 generator works where v6 and v7
did not: those versions asked one call for a global graph, then wrote
~2500 lines of salvage code (`deterministicArrange`, cycle-breaking
ranked by prose length, a `listnessProblems` heuristic fitted to the
three fixtures that motivated it) to force a bad global answer into
shape.

### Why the pairwise generator is shaped the way it is

Judgment is a *local* question: "does A rest on B?" can be answered by
someone who has never heard of the target and sees only two glosses.
Topology is a *global* question that requires holding all 55 judgments
at once. Asking a model for the global answer is what failed, twice.

So: 55 cheap local judgments, then a pure function. `selectTopology`
takes judgments and returns a tree, and there is no model call anywhere
in it. That is the design, and it is why `topology.js` has no
`callChatCompletion` import.

The cost is 55 judgments instead of 1 call, at 5 total calls per word
and 8-9 seconds. Cheap.

## The abstraction tower

Each rung is a real seam: you can replace the thing above without
touching the thing below, and the tests prove it because every rung
below the LLM boundary is pure.

```
  r5  SURFACE          src/pages/, src/lib/mapview/   what the learner sees
  ---                 learner-facing; the only place copy is rendered
  r4  SESSION          orchestrator.js, session.js    phase machine
  ---                 stateless; owns init / active / end
  r3  ENGINE           socratic.js, gaps.js          the turn loop
  ---                 gap selection, confront / predict moves
  r2  GENERATION       pairwise/ + realityMap.js      building the map
  ---                 THE strangulation boundary
  r1  TRANSPORT        llm.js                         one provider seam
  ---                 the ONLY file that knows about OpenRouter
  r0  DOMAIN           mmg/types.js, validator.js     what a map IS
                      immutable, no LLM, no I/O
```

The rule that makes this a tower rather than a pile: **each rung may
only depend on the rungs below it.** r0 knows nothing about r5. r1
knows nothing about what it is carrying. That is why the pairwise
spike could be built without touching the runtime, and why switching
to it later is a contained change.

Two consequences worth knowing:

- **Transport isolation is total.** `llm.js` is the only file that
  knows a provider name, a model id, or that reasoning fields exist.
  Every other file passes a request object. Switching models is a
  one-file change, which is why "the model is bad" is a cheap thing to
  test - and why it was tested on four words in one afternoon.
- **r0 is pure and therefore trustworthy.** `validator.js` and
  `types.js` have no I/O and no model calls. When a shape question is
  in dispute, that is the layer to argue about, and there is no
  authority above it.

## The Contract pattern

Every LLM boundary in this codebase - all five of them - has the same
four parts. Recognising this is most of what makes the generator
navigable.

```
  1  PROMPT      the semantic question, in prose
  2  SCHEMA      the constrained decode, ids restricted to the request
  3  COERCE      mechanical repair of the frame, code-owned
  4  GATE        authoritative validation, code-owned
```

| Boundary | 1 prompt | 2 schema | 3 coerce | 4 gate |
| --- | --- | --- | --- | --- |
| inventory | `buildInventorySystemPrompt` | `buildInventoryJsonSchema` | - | `inventoryProblems` |
| judgments | `buildPairBatchSystemPrompt` | `buildPairBatchJsonSchema` | `normalizePairBatch` | `pairBatchProblems` |
| topology | none - no model call | - | - | `selectTopology` |
| reality map (v7) | `buildChronology/Epiphanies/Arrange` | two schemas | `normalizeChronology/Epiphanies/History` | `chronologyProblems`, `epiphaniesProblems`, `arrangeCheck` |
| socratic | `buildSocraticSystemPrompt` | - | `unpackTurn` | `validateTurn` |

**The law, and it is the most important line in this file:** stage 3
may only touch what stages 1-2 cannot. It repairs the *frame*. It may
never repair the *content*.

- Legal: wrap a bare array, lift a keyed-object envelope, drop an
  echoed field, canonicalize casing, set `jump` to `NOT_APPLICABLE` on
  a row where jump has no referent, restore a `pair_id` that only
  differs in case.
- Illegal: fill in a missing `confidence`, invent a rationale, pick a
  relation the model did not state, rescue a duplicate id.

The test suite enforces both halves
(`src/lib/agent/pairwise/judgments.test.js` has a test named "coercion
does not rescue..." for each illegal case). When a stage fails, ask
"frame or content?" - and if content is sound, the answer is stage 3,
never a prompt rewrite and never a new architecture.

Note that the v7 modules have 3 but not 4, in a bad way:
`normalizeHistory` *infers* a certainty from which fields are present.
That is content repair wearing a coercion's clothes. It is why v7
needed a prompt that said the same thing three times.

## Honesty as an architectural property

`UNKNOWN` is a legal, first-class value everywhere, and that is not a
copy style - it is a schema property.

- `ObservationRecord` fields carry a `mark` of
  `EXACT | APPROXIMATE | UNKNOWN`, and `dropUnknownValues` *removes* the
  value when the mark is `UNKNOWN`. An unknown is absent, never
  invented.
- A `noul`-style decision model was measured and rejected precisely
  because it could not carry a rationale to check honesty against.
- Open-world RDF reasoning would infer relations nobody asserted,
  which is the exact inverse of this property. See `docs/FALSIFIED.md`.

**Consequence:** any proposal that makes absence mean something other
than "not known" is a change to the product, not a refactor. It needs a
human decision.

## Why the state is in the browser

`orchestrator.js` is stateless: the full session arrives in the request
and leaves in the response. The function stores nothing.

This is not minimalism for its own sake. It means the entire session is
inspectable from the client, a turn is reproducible from a request body,
and there is no database to be wrong. It also means `netlify/functions/agent`
can be replaced by anything that speaks the turn contract.

The cost: the map is rebuilt per session and never reused, and there is
no cross-session memory. That is a product decision, not an oversight,
and it constrains any future work on the learner model.

## Where the seams are for the next change

Ticket 02 adds realization between r2 and r5. The intended insertion:

```
  [4] REALIZATION  new: model writes copy for the selected nodes
        |
  [5] REALITYMAP   existing: assemble into a validateRealityMap shape
```

The seam is already clean. `selectTopology` returns node ids, labels,
glosses, ranks, and rationales - everything a realization pass needs and
nothing it does not. It does not return a `RealityMap`, so
`validator.js` has never had to change and does not need to.

The constraint on that work: realization must not invent structure. It
writes strings for nodes that topology already selected. If it finds
itself choosing edges, it has crossed into r2 and the design is being
violated.
