/**
 * Sample map for the ticket 07 motion prototype: a small laptop concept tree
 * in the exact shape the v1 reality tree consumes (rootLabel + branches with
 * stacked node cards). 6 layers, 7 nodes - enough divergence to read the
 * trunk, the sap flow, and the per-layer reveal, small enough to scan.
 */

export const sampleMap = {
  rootLabel: "laptop",
  branches: [
    {
      id: "l5",
      name: "apps",
      nodes: [{ id: "n-app", label: "application" }],
    },
    {
      id: "l4",
      name: "OS",
      nodes: [{ id: "n-os", label: "operating system" }],
    },
    {
      id: "l3",
      name: "logic",
      nodes: [
        { id: "n-logic-gate", label: "logic gate" },
        { id: "n-bit", label: "bit" },
      ],
    },
    {
      id: "l2",
      name: "electronics",
      nodes: [
        { id: "n-transistor", label: "transistor" },
        { id: "n-circuit", label: "circuit" },
      ],
    },
    {
      id: "l1",
      name: "materials",
      nodes: [{ id: "n-silicon", label: "silicon" }],
    },
    {
      id: "l0",
      name: "physics",
      nodes: [{ id: "n-electricity", label: "electricity" }],
    },
  ],
};
