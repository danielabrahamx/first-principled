/**
 * Laptop + LLM fixtures for the ticket 01 dependence-path prototype.
 *
 * Copied from src/lib/mmg/fixtures.js so the prototype stays standalone.
 * Layout uses built-on / depends-on / abstraction-of only. Dates are hover
 * records. part-of and predicts are present on laptop and must not move y.
 */

export const LAYOUT_EDGE_TYPES = ["built-on", "depends-on", "abstraction-of"];

export const laptopRealityMap = {
  concept: "laptop",
  layers: [
    { id: "l0", name: "physics", nodes: ["n-electricity"] },
    { id: "l1", name: "materials", nodes: ["n-silicon"] },
    { id: "l2", name: "electronics", nodes: ["n-transistor", "n-circuit"] },
    { id: "l3", name: "logic", nodes: ["n-logic-gate", "n-bit"] },
    { id: "l4", name: "OS", nodes: ["n-os"] },
    { id: "l5", name: "apps", nodes: ["n-app"] },
  ],
  nodes: [
    {
      id: "n-electricity",
      label: "electricity",
      layer: "l0",
      date: "600 BC",
      observed: true,
    },
    {
      id: "n-silicon",
      label: "silicon",
      layer: "l1",
      date: "1824",
      observed: false,
    },
    {
      id: "n-transistor",
      label: "transistor",
      layer: "l2",
      date: "1947",
      observed: true,
    },
    {
      id: "n-circuit",
      label: "circuit",
      layer: "l2",
      date: "1958",
      observed: true,
    },
    {
      id: "n-logic-gate",
      label: "logic gate",
      layer: "l3",
      date: "1847",
      observed: true,
    },
    {
      id: "n-bit",
      label: "bit",
      layer: "l3",
      date: "1937",
      observed: true,
    },
    {
      id: "n-os",
      label: "operating system",
      layer: "l4",
      date: "1956",
      observed: true,
    },
    {
      id: "n-app",
      label: "application",
      layer: "l5",
      date: "1979",
      observed: true,
    },
  ],
  edges: [
    { source: "n-silicon", target: "n-electricity", type: "depends-on" },
    { source: "n-silicon", target: "n-transistor", type: "part-of" },
    { source: "n-transistor", target: "n-silicon", type: "built-on" },
    { source: "n-circuit", target: "n-transistor", type: "built-on" },
    { source: "n-logic-gate", target: "n-circuit", type: "built-on" },
    { source: "n-bit", target: "n-logic-gate", type: "abstraction-of" },
    { source: "n-electricity", target: "n-transistor", type: "predicts" },
    { source: "n-os", target: "n-bit", type: "built-on" },
    { source: "n-app", target: "n-os", type: "depends-on" },
  ],
};

/**
 * LLM fixture: transformer is a convergence node (combines 3 fields) with
 * three layout parents. Extra parents sit as short ribs, not columns.
 */
export const llmRealityMap = {
  concept: "large language model",
  layers: [
    { id: "l0", name: "compute", nodes: ["n-turing"] },
    { id: "l1", name: "embeddings", nodes: ["n-embedding"] },
    { id: "l2", name: "attention", nodes: ["n-attention"] },
    { id: "l3", name: "sequence model", nodes: ["n-transformer"] },
    { id: "l4", name: "language model", nodes: ["n-llm"] },
  ],
  nodes: [
    {
      id: "n-turing",
      label: "computability",
      layer: "l0",
      date: "1936",
      observed: true,
    },
    {
      id: "n-embedding",
      label: "word embedding",
      layer: "l1",
      date: "2013",
      observed: true,
    },
    {
      id: "n-attention",
      label: "attention",
      layer: "l2",
      date: "2014",
      observed: true,
    },
    {
      id: "n-transformer",
      label: "transformer",
      layer: "l3",
      date: "2017",
      observed: true,
      combines: 3,
    },
    {
      id: "n-llm",
      label: "large language model",
      layer: "l4",
      date: "2020",
      observed: true,
    },
  ],
  edges: [
    { source: "n-embedding", target: "n-turing", type: "depends-on" },
    { source: "n-attention", target: "n-embedding", type: "built-on" },
    { source: "n-transformer", target: "n-attention", type: "built-on" },
    { source: "n-transformer", target: "n-embedding", type: "built-on" },
    { source: "n-transformer", target: "n-turing", type: "depends-on" },
    { source: "n-llm", target: "n-transformer", type: "built-on" },
  ],
};
