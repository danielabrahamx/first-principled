/**
 * Laptop fixture for the ticket 01 cladogram prototype: 6 layers in the
 * v1 reality-tree shape (rootLabel + branches of stacked node cards).
 *
 * Chronology is the SAMPLE DATA order, not a global date sort: branch 0 =
 * apps (crown-nearest, most derived), last = physics (foundations bottom).
 * Dates live inside a layer and never reorder across layer boundaries.
 */

export const sampleMap = {
  rootLabel: "laptop",
  branches: [
    {
      id: "l5",
      name: "apps",
      nodes: [
        {
          id: "n-app",
          label: "application",
          date: "1979",
          observed: true,
          combines: 2,
        },
      ],
    },
    {
      id: "l4",
      name: "OS",
      nodes: [
        {
          id: "n-os",
          label: "operating system",
          date: "1969",
          observed: true,
          combines: 0,
        },
      ],
    },
    {
      id: "l3",
      name: "logic",
      nodes: [
        {
          id: "n-logic-gate",
          label: "logic gate",
          date: "1847",
          observed: true,
          combines: 0,
        },
        {
          id: "n-bit",
          label: "bit",
          date: "1937",
          observed: true,
          combines: 0,
        },
      ],
    },
    {
      id: "l2",
      name: "electronics",
      nodes: [
        {
          id: "n-transistor",
          label: "transistor",
          date: "1947",
          observed: true,
          combines: 0,
        },
        {
          id: "n-circuit",
          label: "circuit",
          date: "1958",
          observed: true,
          combines: 0,
        },
      ],
    },
    {
      id: "l1",
      name: "materials",
      nodes: [
        {
          id: "n-silicon",
          label: "silicon",
          date: "1824",
          observed: false,
          combines: 0,
        },
      ],
    },
    {
      id: "l0",
      name: "physics",
      nodes: [
        {
          id: "n-electricity",
          label: "electricity",
          date: "600 BC",
          observed: true,
          combines: 0,
        },
      ],
    },
  ],
};
