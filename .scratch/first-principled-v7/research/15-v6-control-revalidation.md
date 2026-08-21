# 15 - v6 control revalidation (ticket 11 acceptance 5)

Recorded 2026-08-20. The v7 arrangeCheck ran against the persisted v6
one-shot maps in `.scratch/first-principled-v6/research/12-live-maps/`.
Inputs (chronologyIds, epiphanyIds) are empty: v6 maps carry no
provenance, so the ledger has nothing to account.

## Result

| Map | validateRealityMap (shape) | arrangeCheck (v7 contract) |
| --- | --- | --- |
| v6 laptop | 0 errors | 159 unique errors |
| v6 battery | 0 errors | 29 unique errors |

## What binds

- Shape: PASS. The v6 maps are structurally valid RealityMaps (layers,
  nodes, edges, mirror, contiguity all check).
- The v7 arrange contract adds three things v6 maps do not carry:
  - role on every node (v6 nodes have none; the invalid-role and
    history-only-on-EPIPHANY errors fire on every node),
  - a non-empty because on every edge (v6 edges carry type only),
  - provenance with use-or-drop accounting plus a declared trunk
    (v6 maps have neither).
- Binding semantic checks (recorded, not gating v6 as controls): role
  history rules and the reason text. The one-shot generator never had
  these fields, so v6 maps cannot pass the v7 gate by construction.

## Consequence

v6 maps stay valid as one-shot comparison CONTROLS for the KEEP/KILL
walk (they render), but they are not gate-eligible under the v7
contract. The listness gate (ticket 11) flags both v6 maps as timeline
copies regardless, which is the intended defense-in-depth signal.
