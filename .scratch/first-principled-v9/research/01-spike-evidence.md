# Ticket v9-01 spike evidence (live runs)

Date: 2026-09-10. Route: OpenRouter `z-ai/glm-5.3-flash` (committed
default; `LLM_MODEL` unset). No secrets recorded.

## Attempt log

### recursion, attempt 1 (2026-09-10): FAILED at pair validation

- Inventory: PASS with JSON Schema. 10 candidates plus fixed target
  gives 55 pairs in 4 batches (14/14/14/13).
- Pair batches: 5 model calls total. Batches 2-4 validated clean.
  Batch 1 returned the right shape but set `jump: SMALL` on three NONE
  rows. The contract requires NOT_APPLICABLE for NONE and
  SAME_CONCEPT. Job ended terminally with `invalid_model_output`.
  No repair prompt, per the ticket.
- Local judgments looked semantically sensible where valid (for
  example infinite recursion resting on function invocation).
- No topology was selected: the validator did its job before code ran.

### laptop, attempt 1 (2026-09-10): BLOCKED on transport

- `LLM API error 402`: request would exceed available credits given
  in-flight requests. Inventory call never completed. Not a model
  failure; top up credits and retry as a new recorded attempt.

### battery, photosynthesis: NOT ATTEMPTED

- Same credit blocker. First attempts remain to be run.

## 2026-09-10 route switch: DeepSeek V4.1 Flash

- Local `.env` (gitignored) switched to `LLM_PROVIDER=deepseek`,
  `DEEPSEEK_MODEL=deepseek-flash` (per DeepSeek API news, V4.1-Flash
  is live under `deepseek-flash`; `deepseek-v4-flash` routes to it).
  Base stays the configured proxy. No code or committed docs changed.
- Probe call 2026-09-10: provider, model, and base resolve; the proxy
  returns 402 credit balance exhausted, not model-not-found, so the
  route and model id are valid. Wallet top-up needed before any live
  attempt on this route. OpenRouter credit was likewise exhausted
  earlier, so both routes are currently blocked on billing, not on
  the spike.

## Findings for the next tickets

1. `json_object` mode drifts shape on this route (bare arrays,
   `concepts` for `candidates`). JSON Schema constrains shape where
   the route enforces it; code validation stays authoritative.
2. Schema cannot express the conditional jump rule (SMALL only for
   directional). The model defaults NONE rows to SMALL. Ticket 02 or
   04 must co-design prompt plus schema for this: either restate the
   jump rule as a per-row instruction in the user payload, or relax
   the validator to coerce NONE/SAME jumps to NOT_APPLICABLE in code
   (documented as mechanical, not semantic). No decision taken here.
3. Unbounded reasoning on the default route burns the 4000-token
   budget into hidden thinking (`finish_reason=length`). Explicit
   `reasoningEffort: low` fixed truncation on every call after it.
4. Cost signal: one recursion attempt cost 5 calls; usage counts were
   not captured before the failure path. The CLI now reports
   prompt/completion tokens on success.

## Verdict on Ticket 01

Spike modules, validators, selector, unit tests (25 green), and CLI
are built. Live evidence is partial: 0 of 4 gold words have a
target-to-foundation path yet, 1 failed honestly at validation, 1
blocked on credits, 2 unattempted. Go/kill undecided. Do not proceed
to Ticket 02 until the remaining first attempts are recorded.

## 2026-09-10 DeepSeek attempts (official platform, `deepseek-flash`)

Route: `LLM_PROVIDER=deepseek`, official base URL, platform key.
The DeepSeek path downgrades JSON Schema to `json_object`, so these
runs test shape conformance without constrained decoding. All four
inventories passed validation (10 candidates, 55 pairs, 4 batches).
All four failed at pair-batch validation on envelope shape, never on
dependence semantics. No repair sent in any run. No topology selected.

- recursion attempt 2: batches 2 clean. Batch 1 returned bare
  newline-delimited judgment objects (no wrapper). Batch 3 echoed
  `{"type":"json_object","judgments":[...]}`. Batch 4 same echo plus
  one rationale mentioning position/chronology.
- laptop attempt 1: batches 3-4 clean. Batch 1 the `type` echo.
  Batch 2 a keyed object (`{"p-k10--k6":{...}}`) instead of an array.
- battery attempt 1: batches 3-4 clean. Batches 1-2 the keyed-object
  envelope.
- photosynthesis attempt 1: batches 1-3 the keyed-object envelope,
  batch 4 the `type` echo.

Envelope failure modes seen across both routes: SMALL on NONE rows,
bare JSONL objects, `type` echo, keyed-object envelope, one
chronology-mentioning rationale. Against that, the underlying local
judgments are consistently sensible: correct NONE reasoning (hinged
clamshell not necessary to a portable computer; light reactions not
depending on carbon dioxide), correct directional calls (cathode
rests on electron concept), and an unprompted TOO_LARGE with a
bridge-missing rationale on battery.

Reading: the bottleneck is envelope conformance, not dependence
judgment. No kill criterion is triggered: dependence is not
inconsistent, chronology does not appear in topology (never reached),
and there is no evidence of omitted-bridge no-paths. Ticket 02 or 04
must decide: keep the strict envelope and treat this as model
incapability, or add documented mechanical tolerance (accept bare
arrays, ignore the `type` echo, coerce NONE jumps) while keeping
code validation authoritative. No decision taken here; the strict
record stands.

## 2026-09-29 decision and implementation

The decision above is now taken: add documented mechanical tolerance.
The tolerance lives in `normalizePairBatch` and `parsePairBatchText`
(`src/lib/agent/pairwise/judgments.js`), and `pairBatchProblems` is
unchanged and still authoritative over what survives.

Coerced, each traced to a live failure in this file:

- bare array of judgments, no wrapper (recursion batch 1)
- newline-delimited judgment objects, one per line (recursion batch 1)
- echoed `type` field beside `judgments` (recursion batch 3, laptop 1,
  photosynthesis 4)
- keyed-object envelope keyed by pair_id (laptop 2, battery 1-2,
  photosynthesis 1-3)
- SMALL or TOO_LARGE on a non-directional row, where jump has no
  referent (recursion 1)
- enum tokens in free case or with separators
- pair_id case mismatch against the requested set

Deliberately NOT coerced, each a real signal about the judgment rather
than its frame: missing / unknown / duplicate pair_id, a rationale that
names position or chronology, and unexpected fields.

Offline replay of the four recorded failure shapes:
`.scratch/first-principled-v9/research/verify-coercion.mjs`. Run
2026-09-29: 4 of 4 now survive validation, each with the coercions it
needed listed. Suite 409/409, lint and typecheck green.

What this does NOT establish: the gold acceptance is one predeclared run
per word, not repeated runs. Read the two attempts below as evidence
that the stage is no longer envelope-blocked, not as a quality verdict.

## 2026-09-29 first live runs after the coercion

Route: `LLM_PROVIDER=deepseek`, `deepseek-flash`, official base. This is
the only working route; the OpenRouter key is dead.

### recursion, attempt 3: PASS, first tree ever selected

- 5 calls, 55 pairs, 4 batches, 9.1s, 5753 prompt / 4306 completion
  tokens.
- Coercions applied: keyed-object envelope lifted (batch 2), echoed
  `type` dropped (batches 1 and 4). Without these the run dies exactly
  as attempt 2 did.
- `selectTopology` returned ok with 5 nodes, 4 edges, a 3-node trunk
  `k7 -> k3 -> target`, and honest drops: `k1` merged into the target as
  a HIGH-confidence duplicate, and every NONE judgment listed with its
  reason.
- Edges carry real rationales, e.g. "a recursive function requires a
  base case to terminate; self-reference alone cannot define a finite
  computation."

### recursion, attempt 4: PASS, different tree

- 5 calls, 9.4s, 5933 prompt / 4186 completion tokens.
- Coercions: echoed `type` dropped (batch 2), keyed-object lifted
  (batch 3).
- `ok` with 5 nodes, 4 edges, trunk `k7 -> k3 -> target`,
  `k1` merged again.

### What this means, and what it does not

The envelope blocker is gone. Both attempts cleared a stage that had
terminally failed on all four gold words before.

Two things to be honest about. First, run-to-run variance is real: the
node set and edges differ between attempt 3 and attempt 4, and the
three-node trunk is short against the ticket's `TRUNK_MIN` of 4. That
is a quality question for Ticket 02, not an envelope question, and it
is not settled by two runs. Second, `recursion` was already the word
whose underlying judgments the earlier evidence called "consistently
sensible", so it is the most likely word to pass. The other three
gold words are unattempted on this route since the coercion.

Next: laptop, battery, photosynthesis on this route, one recorded
attempt each, before any Go/Kill.


## 2026-09-29 Jev decision mode: not adopted

Jev (`typesafe/jev-1.13`, Decisions API) returns typed answers with
probabilities and cannot emit a malformed envelope, which is exactly
the failure class recorded above. It is the wrong tool for this
project, for three reasons:

1. It answers Choice / Noul / Score against criteria the caller
   defines. A dependence relation is not a fixed option set; defining
   `A_RESTS_ON_B` and `B_RESTS_ON_A` as two Choice options is
   possible, but the gloss and the relation arrive together in one
   probability distribution, so the semantic work is still done by a
   model whose output we cannot inspect.
2. The pairwise prompt deliberately asks for a `rationale` per
   judgment, and one of the hard gates is that the rationale must not
   appeal to position or chronology. Jev returns no rationale and no
   reasoning trace at all. The evidence shows an unprompted
   `TOO_LARGE` with a bridge-missing rationale was genuinely
   informative; that signal is the thing we would be deleting.
3. Untestable here. The Decisions endpoint is OpenRouter-only and the
   local OpenRouter key is dead, so this is a judgement on the design,
   not a measurement.

Revisit only if a future run shows dependence judgment itself is
wrong, rather than its delivery. Envelope conformance is no longer the
bottleneck, and that was never Jev's differentiator anyway.

