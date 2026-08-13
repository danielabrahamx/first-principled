# 13 - Multi-stream convergence: nodes with many parents

**Type:** task

**What:** Let a node be built from discoveries in MULTIPLE different fields,
at any depth - not just the layer below. An LLM is not only transformers: it
also needs encoders, decoders, embeddings, and compute. The tree must show
all the streams that combined to make a layer possible.

**Blocked by:** 11 - Map word entry + shared generation + progressive
skeleton, 12 - Port the phylogenetic motion into the live tree

**Status:** ready-for-agent

## Question

The current model is a strict chain (ticket 08 contract): one call per
layer, each layer sees ONLY the layer below it, every edge is a down-edge to
the adjacent layer, every node has ONE basis record. Real discovery
history is convergent: independent streams meet at a layer and combine.
The strict chain cannot express that.

## What

1. **Content model (Q1):** a convergence node keeps ONE crux record - the
   discovery that combined the streams (e.g. Vaswani 2017) - plus a
   "combines" list of the enabling observations from other fields. The
   panel renders both: the crux record and the contributing observations.
2. **Edges (Q2):** an edge may skip layers. The LLM node points directly at
   attention, embeddings, and compute, at any depth. Validation rules:
   every node still traces to at least one valid record in a strictly
   lower layer; a convergence node must trace to records from 2+ distinct
   layers.
3. **Generation (Q3):** each layer call sees ALL lower layers, not only the
   one below. The prompt allows cross-layer edges when the crux is a true
   synthesis. deriveCheck validates the 2+ distinct-layer rule for
   convergence nodes.
4. **Rendering (Q4):** keep one trunk. Converging branches fan in at the
   node on desktop; a "combines N fields" chip on mobile. Must stay clean
   at 375px/320px with the ticket 10 vertical path.
5. **Fail-honest:** a stream the model cannot source stays an explicit gap
   (ticket 09 contract) - never invented.

## Acceptance criteria

- [ ] A convergence node renders its crux record plus all contributing
      observations from different fields
- [ ] Edges may skip layers; a convergence node has parents in 2+ distinct
      layers
- [ ] Generator produces cross-layer "combines" edges when the crux is a
      synthesis; deriveCheck enforces the 2+ distinct-layer rule
- [ ] Vertical path renders convergence: fan-in branches on desktop,
      "combines N fields" chip on mobile
- [ ] 375px and 320px CDP audits clean (no overflow, chip readable)
- [ ] Screenshots delivered for Danny approval before deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the convergence resolution. Note
that the ticket 08 "sees only the layer below" contract is extended, not
replaced: adjacent down-edges stay the default, cross-layer edges become
legal for true syntheses.
