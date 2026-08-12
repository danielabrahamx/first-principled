# 09 - Fail-honest contract for observation sourcing

Drafted 2026-08-12 from the ticket 09 probe. The contract has three parts:
the prompt the tree generator must carry, the response schema the node
builder validates, and the pipeline rules that make empty or invalid output
resolve to a visible gap instead of an invented observation.

## 1. Prompt language (system block, one node at a time)

```
You are a factual history-of-science annotator for a product that displays
REAL discovery history, not reconstructed history.

For each fact field, respond with EXACT, APPROXIMATE, or UNKNOWN.

- EXACT: a single well-documented value (person, year).
- APPROXIMATE: the record itself is low resolution or contested (a decade,
  multiple claimants, a convention with no primary source).
- UNKNOWN: you have no defensible value. NEVER invent a plausible answer to
  avoid UNKNOWN. An observation that never happened is UNKNOWN - do not
  describe a plausible observation as if it existed.

If a year is contested in the historical record, give the best-documented
year and mark APPROXIMATE. Where credit is shared or disputed, name all
documented parties and mark APPROXIMATE when the primary credit is not
settled.
```

The v1 JSON mode contract still applies: the word "json" and an example shape
must appear in the user message (DeepSeek `response_format json_object` is
best-effort, see `src/lib/agent/llm.js` and ticket 03 findings).

## 2. Response schema (one observation object per node)

```json
{
  "observation": {
    "discoverer": { "value": "string", "mark": "EXACT|APPROXIMATE|UNKNOWN" },
    "date": { "value": "string", "mark": "EXACT|APPROXIMATE|UNKNOWN" },
    "keyObservation": { "value": "string", "mark": "EXACT|APPROXIMATE|UNKNOWN" },
    "confidence": "high|medium|low",
    "note": "string"
  }
}
```

- `note` carries hedge context (contested credit, later rejection, shared
  discovery) for display on hover - this is where the Vulcan case lives
  ("claimed observation, never confirmed, later rejected").
- A node is UNKNOWN when any of the three marks is UNKNOWN. UNKNOWN is a
  legal, first-class state, not an error.
- Validation on the client side: marks must be from the enum; a missing
  field, an empty `value`, or unparseable JSON counts as no answer and goes
  down the retry path, never the invention path.

## 3. Pipeline rules (these are hard requirements from the probe)

1. Token budget with headroom: `max_tokens` must leave room after reasoning
   tokens. At 500, deepseek-v4-flash burned the whole budget reasoning about
   hard nodes and returned empty content 5/15 times. Budget 3000-5000
   recovered all. This confirms the existing warning in
   `src/lib/agent/llm.js` ("headroom matters: a low cap truncates JSON").
2. Empty-content detection: an empty or whitespace-only reply is a failure
   mode, not a mystery. It must trigger a retry with the repair message,
   matching the existing two-attempt JSON turn pattern in
   `src/lib/agent/orchestrator.js`.
3. Retry with a repair message that re-states the honesty rule: "Your
   previous reply did not meet the contract: it was not valid JSON in the
   required shape. Reply with JSON only, exactly the required shape. If you
   do not know a fact, mark it UNKNOWN."
4. After retries, unresolved nodes render as a visible gap in the tree: an
   explicit "unknown" state on the node's observation card (the tree SHOWS
   the gap - the node exists, its observation is missing, the layer chain is
   unbroken).
5. No placeholder generation, ever: no "about 1900", no "some
   contemporaries", no model-written guess in a value field. A value with
   mark UNKNOWN is dropped at validation; the node keeps its gap.

## 4. Recommendation (recorded as the ticket answer)

Web grounding is NOT required for the crux to be REAL discovery history at
this product's scope. Evidence: parametric coverage held across all three
obscurity tiers (40/45 fields EXACT, 5/45 APPROXIMATE - all dates, 0/45
UNKNOWN, 1 confident-error incident). The model demonstrably has canonical
discovery history in parametric memory, and it plays honest when told to:
the invented-discoverer test returned UNKNOWN across all fields, and the
never-observed Vulcan case was documented as claimed-then-rejected, not
invented.

What IS required is the fail-honest contract, because the probe shows
defense-in-depth matters: the one confident conflation (spiral nebulae, M104
vs M31) slipped past honesty instructions, and empty completions arrive
silently on hard nodes. The contract converts both into visible gaps, which
the product can survive. Grounding cannot, so it is not the lever; the
contract is.

Conditions to keep grounding out of scope:

- Concept corpus stays canonical: famous-to-obscure classic discoveries.
  The long tail (recent research, niche subfields, non-English discovery
  histories) is where parametric memory thins and the model cannot
  distinguish real-unknown from missing.
- Gap density is monitored: if a corpus sample shows UNKNOWN or gap rates
  rising (order of magnitude, ~10% of observation fields), revisit
  grounding with that evidence. Grounding is the fix for the long tail, not
  for canonical content.

This is a recommendation only. Adoption is Danny's scope decision.
