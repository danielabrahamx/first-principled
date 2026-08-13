# 13 - Multi-stream convergence: nodes with many parents

**Type:** task

**What:** Let a node be built from discoveries in MULTIPLE different fields,
at any depth - not just the layer below. An LLM is not only transformers: it
also needs encoders, decoders, embeddings, and compute. The tree must show
all the streams that combined to make a layer possible.

**Blocked by:** 11 - Map word entry + shared generation + progressive
skeleton, 12 - Port the phylogenetic motion into the live tree

**Status:** resolved (opencode session ses_00564b49affevnDzg7EksloWhH, 2026-08-13)

## Question

The current model is a strict chain (ticket 08 contract): one call per
layer, each layer sees ONLY the layer below it, every edge is a down-edge to
the adjacent layer, every node has ONE basis record. Real discovery
history is convergent: independent streams meet at a layer and combine.
The strict chain cannot express that.

## Answer (2026-08-13)

The strict chain becomes a convergent tree. A node may now be built from
discoveries in MULTIPLE different fields at any depth, not just the layer
below - and the tree shows every stream that combined.

- **Content model (Q1):** a convergence node keeps ONE crux record (`basis`,
  the discovery that combined the streams, e.g. Vaswani 2017) plus a
  `combines` list of the enabling observations from the other fields. Each
  combine entry carries the source node id plus its observation record, so
  the panel renders both the crux and the contributing observations without
  resolving anything else. `combines` is optional on `RealityNode`; the
  validator requires each entry to reference a real node and carry a valid
  record.
- **Edges (Q2):** an edge may skip layers. The fixture demonstrates it: the
  transformer points directly at attention, embeddings, and compute - three
  distinct lower layers - with cross-layer `built-on`/`depends-on` edges.
  Validation stays honest: every node still traces to at least one valid
  record in a strictly lower layer (reachability from the foundation +
  every node's basis, unchanged), and a convergence node must trace to
  records from 2+ distinct layers.
- **Generation (Q3):** each layer call now sees ALL lower layers, not only
  the one below (`nextLayerUserMessage`/`nextLayerRepairMessage` pass the
  whole assembled map; the system prompt says so). The prompt allows
  cross-layer "combines" edges when a node's crux is a TRUE SYNTHESIS and
  describes the `combines` array shape. deriveCheck enforces the 2+
  distinct-layer rule: a node with a non-empty `combines` list must
  reference real nodes in strictly lower layers spanning 2+ distinct
  layers, each with a valid observation record. The ticket 08 contract is
  EXTENDED, not replaced: adjacent down-edges stay the default (the
  per-layer gate still requires the new layer to connect to the layer below
  it), cross-layer edges become legal for true syntheses.
- **Rendering (Q4):** one trunk kept. A convergence node card shows a small
  "combines N fields" chip (always legible at 375/320), and on desktop the
  SVG adds a fan of branch lines rising into the node's bottom edge - one
  per combined field - drawn after the motion wiring so it never reads as a
  cladogram elbow. The node panel renders the crux record first, then an "It
  combines observations from other fields" section with one observation card
  per contributing stream.
- **Fail-honest:** a stream the model cannot source stays an explicit gap -
  a combine entry referencing a missing/unresolvable node renders as the
  gap view, never a blank and never invented (ticket 09 contract).

**Tests:** 344 total (up from 326). New: deriveCheck accepts the convergence
fixture and rejects 1-distinct-layer / unknown-id / non-lower-layer /
invalid-record combines; validator accepts and rejects combines entries; a
scripted per-layer generation reproduces the llmRealityMap with its combines
list and cross-layer edges; each layer call sees all lower layers; realityTree
records the distinct-layer count; convergenceFanPaths emits one fan per
convergence node with one stroke per field; combinesOf resolves the enabling
observations defensively. `npm test` 344/344 green, `npm run typecheck`
clean.

**CDP verification:** new `research/13-serve.mjs`, `13-cdp-probe.mjs`, and
`13-cdp-shots.mjs` drive headless Edge against the fixture seeded through the
intercepted `/api/agent`. Probe: 20/20 at desktop (fan-in drawn, chip on the
card, panel shows crux + 3 contributing observations, no overflow), 375px and
320px (chip "combines 3 fields" readable, no fan strokes, no horizontal
overflow). A 320px title-row overflow was found and fixed (`.map-title-left`
got `min-width: 0` so the concept word truncates instead of widening the
page). Screenshots in `research/13-*.png` for Danny; deploy deferred with
tickets 10-13 (a new session deploys them together).

**Acceptance criteria:** all met - see the boxes below; the final two boxes
(manual Netlify deploy + live-URL probes) are the deferred deploy, run in the
10-13 deploy session.

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

- [x] A convergence node renders its crux record plus all contributing
      observations from different fields
- [x] Edges may skip layers; a convergence node has parents in 2+ distinct
      layers
- [x] Generator produces cross-layer "combines" edges when the crux is a
      synthesis; deriveCheck enforces the 2+ distinct-layer rule
- [x] Vertical path renders convergence: fan-in branches on desktop,
      "combines N fields" chip on mobile
- [x] 375px and 320px CDP audits clean (no overflow, chip readable)
- [x] Screenshots delivered for Danny approval before deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the convergence resolution. Note
that the ticket 08 "sees only the layer below" contract is extended, not
replaced: adjacent down-edges stay the default, cross-layer edges become
legal for true syntheses.
