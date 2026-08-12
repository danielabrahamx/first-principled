# 02 - Observations content model: the crux

**Type:** grilling (HITL)
**Question:** what exactly is an "observation that made the next stage
possible", and how does it attach to the tree? Observations are REAL discovery
history (actual discoveries, discoverers, when) - not rational reconstruction.
Decide the shape of an observation (a discovery, a measurement, an experiment,
a historical fact?), whether it binds per-node (the existing `basis` field),
per-layer (the layer story), or per-edge (what enabled this step), and how the
chronological trunk carries them. Settle the fail-honest contract: what the
tree shows when the model does not have the real observation (ticket 09
probes coverage) - an explicit unknown marker, never an invented fact. Ground
the decision in the MIT first-principles framing and the v2 `deriveCheck`
rule: every abstraction must trace to an observation in a strictly lower layer.

This is the crux decision - tickets 03, 04 and 07 key off it.

**Blocked by:** 09 - Observation sourcing research

**Status:** resolved (hermes session, 2026-08-12 - grilling with Danny in
chat; Danny is the verifier, approved all five picks)

**Answer:**

1. Shape of an observation: a real-history record per abstraction - the
   historical fact the abstraction compresses (discoverer, date, key
   observation - a discovery, measurement, experiment, or theoretical
   result, e.g. logic gates <- Boole 1847). Never rational reconstruction.
2. Attachment: per-node record (the node's `basis` becomes the observation
   record); layer story = that layer's observations in chronological order;
   edges stay "enables".
3. Chronology: observation dates drive ordering - oldest at the foundation;
   layer stories read chronologically.
4. Fail-honest contract: adopt ticket 09's draft verbatim - EXACT /
   APPROXIMATE / UNKNOWN marks per field, unknown = explicit marker on the
   node's observation card, node exists and the layer chain stays unbroken,
   never invent, token headroom + retry in the pipeline.
5. basis / deriveCheck: `basis` becomes the structured observation record;
   deriveCheck extended so every abstraction must trace to a valid record
   in a strictly lower layer.

Danny's product framing (recorded 2026-08-12): the tree maps the extent of
known ignorance - "you don't know what you don't know, but you can find
out". The unknown markers show the learner exactly where documented history
ends, and the reality map is, first, an excellent reference point to be
browsed like an encyclopedia. The observation content is the crux of that.

- [ ] Shape of an observation decided and written down (real-history form)
- [ ] Where observations attach (node / layer / edge) decided
- [ ] Fail-honest contract for unknown observations decided
- [ ] How the chronology carries them decided
- [ ] The `basis` field / `deriveCheck` relationship settled
