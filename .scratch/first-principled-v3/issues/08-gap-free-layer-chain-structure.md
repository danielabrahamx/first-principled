# 08 - Gap-free layer-chain structure

**Type:** task (AFK)
**What to build:** word-to-tree generation structured so the LLM cannot leave
gaps in the layer chain. The generator builds the tree bottom-up, layer by
layer: the foundation layer first, then each layer derived only from the layer
immediately below it, so a skipped intermediate step is structurally
impossible rather than merely validated against. The contiguity validator
(v1 02) and the repair loop (v1 04) stay as the backstop gate; the soft layer
cap stays. Extends the v2 two-phase foundation-first generator (v2 06).

**Blocked by:** None - can start immediately.

**Status:** ready-for-agent

- [ ] Generation is structurally bottom-up: layer N+1 derives only from layer N
- [ ] A skipped intermediate step is impossible by construction, not just rejected
- [ ] Contiguity validator + repair loop still gate as backstop
- [ ] Live maps verified gap-free over the v1 reliability bar (30/30)
