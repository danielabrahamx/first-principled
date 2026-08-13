/**
 * Fixtures for the Mental Model Graph: a full "laptop" reality map with a
 * contiguous layer chain (physics -> materials -> electronics -> logic -> OS
 * -> apps) and a partial learner map with one misconception and one missing
 * node. Used by the unit tests and by later tickets as a development sample.
 *
 * Since ticket 03 every node carries a `basis`: a real-history observation
 * record (ticket 02) - the actual discovery the node compresses, with honest
 * EXACT / APPROXIMATE / UNKNOWN marks (ticket 09). The fixture is the
 * canonical example of the crux: logic gates compress Boole's 1847 algebra,
 * the bit compresses Shannon's 1948 information theory, and so on.
 */

/**
 * The canonical "laptop" reality map. Every layer after physics has at least
 * one edge connecting it to a lower layer, so the chain is contiguous.
 *
 * @type {import("./types.js").RealityMap}
 */
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
      description:
        "Flow of electric charge; the physical foundation every electronic device exploits.",
      basis: {
        discoverer: { value: "Thales of Miletus", mark: "APPROXIMATE" },
        date: { value: "600 BC", mark: "APPROXIMATE" },
        keyObservation: {
          value: "Amber rubbed with fur attracts feathers and dry leaves.",
          mark: "EXACT",
        },
        confidence: "medium",
        note: "The attribution to Thales is traditional. No primary source survives.",
      },
    },
    {
      id: "n-silicon",
      label: "silicon",
      layer: "l1",
      description:
        "Semiconductor element whose manufacture depends on electricity; the material transistor junctions are built from.",
      basis: {
        discoverer: { value: "Jöns Jacob Berzelius", mark: "EXACT" },
        date: { value: "1824", mark: "EXACT" },
        keyObservation: {
          value: "Berzelius isolates silicon as a pure element.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "",
      },
    },
    {
      id: "n-transistor",
      label: "transistor",
      layer: "l2",
      description:
        "Semiconductor switch that controls current flow; the basic building block of digital circuits.",
      basis: {
        discoverer: {
          value: "John Bardeen, Walter Brattain, William Shockley",
          mark: "APPROXIMATE",
        },
        date: { value: "1947", mark: "EXACT" },
        keyObservation: {
          value: "A small voltage controls a larger current through a germanium crystal.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "Shared credit. The Bell Labs team shared the 1956 Nobel Prize.",
      },
    },
    {
      id: "n-circuit",
      label: "circuit",
      layer: "l2",
      description:
        "Interconnected transistors and components that together implement a function.",
      basis: {
        discoverer: { value: "Jack Kilby", mark: "EXACT" },
        date: { value: "1958", mark: "EXACT" },
        keyObservation: {
          value: "Kilby builds the first integrated circuit on one piece of germanium.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "Robert Noyce filed a similar patent months later.",
      },
    },
    {
      id: "n-logic-gate",
      label: "logic gate",
      layer: "l3",
      description:
        "A circuit computing a boolean function such as AND, OR or NOT from input voltages.",
      basis: {
        discoverer: { value: "George Boole", mark: "EXACT" },
        date: { value: "1847", mark: "EXACT" },
        keyObservation: {
          value: "Boole links logical reasoning to the rules of algebra.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "",
      },
    },
    {
      id: "n-bit",
      label: "bit",
      layer: "l3",
      description:
        "The smallest unit of information; a binary digit carried by a gate's output state.",
      basis: {
        discoverer: { value: "Claude Shannon", mark: "EXACT" },
        date: { value: "1948", mark: "EXACT" },
        keyObservation: {
          value: "Shannon names the bit as the basic unit of information.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "The 1948 paper A Mathematical Theory of Communication introduced the bit.",
      },
    },
    {
      id: "n-os",
      label: "operating system",
      layer: "l4",
      description:
        "Software layer that manages hardware resources and runs applications on top of it.",
      basis: {
        discoverer: {
          value: "Robert Patrick, Owen Mock, and the General Motors team",
          mark: "APPROXIMATE",
        },
        date: { value: "1956", mark: "EXACT" },
        keyObservation: {
          value: "A batch program starts and runs other programs on a computer.",
          mark: "EXACT",
        },
        confidence: "medium",
        note: "Credit for the first operating system is contested. GM-NAA I/O is the usual first.",
      },
    },
    {
      id: "n-app",
      label: "application",
      layer: "l5",
      description:
        "A program the user interacts with directly, running on the operating system.",
      basis: {
        discoverer: { value: "Dan Bricklin and Bob Frankston", mark: "EXACT" },
        date: { value: "1979", mark: "EXACT" },
        keyObservation: {
          value: "Bricklin and Frankston build VisiCalc, the program that sold the first personal computers.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "",
      },
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
 * A partial learner mental model for the laptop, mirroring reality node ids.
 * Contains at least one misconception (n-transistor, n-app) and one missing
 * node (n-logic-gate). Closeness: 3 correct of 6 known = 0.5.
 *
 * @type {import("./types.js").LearnerMentalModel}
 */
export const laptopLearnerMap = {  nodes: [
    {
      id: "n-electricity",
      state: "correct",
      confidence: 0.9,
      evidence: ["I know electricity is the flow of electric charge"],
    },
    { id: "n-silicon", state: "untested", confidence: 0, evidence: [] },
    {
      id: "n-transistor",
      state: "misconception",
      confidence: 0.4,
      evidence: [
        "a transistor is a switch you flick on and off by hand",
        "transistors mainly amplify audio",
      ],
    },
    {
      id: "n-circuit",
      state: "correct",
      confidence: 0.8,
      evidence: ["a circuit connects components so current flows"],
    },
    { id: "n-logic-gate", state: "missing", confidence: 0.1, evidence: [] },
    { id: "n-bit", state: "untested", confidence: 0, evidence: [] },
    {
      id: "n-os",
      state: "correct",
      confidence: 0.7,
      evidence: ["the operating system runs the programs"],
    },
    {
      id: "n-app",
      state: "misconception",
      confidence: 0.5,
      evidence: ["apps run directly on the machine's power, no middleman"],
    },
  ],
  edges: [
    {
      source: "n-silicon",
      target: "n-transistor",
      state: "correct",
      confidence: 0.6,
      evidence: ["chips are made of silicon"],
    },
    {
      source: "n-logic-gate",
      target: "n-circuit",
      state: "correct",
      confidence: 0.6,
      evidence: ["a logic gate is a small circuit"],
    },
    {
      source: "n-app",
      target: "n-electricity",
      state: "misconception",
      confidence: 0.5,
      evidence: ["apps just run on the power, no middleman"],
    },
  ],
};

/**
 * The canonical multi-stream convergence map (ticket 13): a "large language
 * model" reality map where one node - the transformer - is a CONVERGENCE
 * NODE built from discoveries in MULTIPLE different fields, at any depth,
 * not just the layer below. The transformer's crux is Vaswani 2017, and its
 * `combines` list carries the enabling observations from the fields that
 * made it possible: attention (Bahdanau 2014), embeddings (Mikolov 2013),
 * and compute (Turing 1936) - three distinct layers below the transformer.
 *
 * This is the fixture that exercises the ticket 13 contract end to end:
 * cross-layer edges (the transformer points directly at attention,
 * embeddings, and compute - skipping the adjacent layer), a convergence
 * node whose parents span 3 distinct layers, and the fan-in rendering.
 *
 * @type {import("./types.js").RealityMap}
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
      description:
        "The theory of what a machine can compute; the foundation every program relies on.",
      basis: {
        discoverer: { value: "Alan Turing", mark: "EXACT" },
        date: { value: "1936", mark: "EXACT" },
        keyObservation: {
          value: "Turing defines the universal machine that can compute anything computable.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "",
      },
    },
    {
      id: "n-embedding",
      label: "word embedding",
      layer: "l1",
      description:
        "A dense vector that maps a word to a point in a space where similar words sit close together.",
      basis: {
        discoverer: { value: "Tomas Mikolov", mark: "EXACT" },
        date: { value: "2013", mark: "EXACT" },
        keyObservation: {
          value: "Mikolov trains word2vec: words appear as vectors that capture meaning by context.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "",
      },
    },
    {
      id: "n-attention",
      label: "attention",
      layer: "l2",
      description:
        "A mechanism that weighs how much each input position matters when producing each output position.",
      basis: {
        discoverer: { value: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio", mark: "APPROXIMATE" },
        date: { value: "2014", mark: "EXACT" },
        keyObservation: {
          value: "Attention lets a translation model focus on the relevant parts of the source sentence.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "Attention as a learned weighting appears in several papers around 2014; Bahdanau is the usual first.",
      },
    },
    {
      id: "n-transformer",
      label: "transformer",
      layer: "l3",
      description:
        "A sequence model built on self-attention that processes all positions in parallel instead of one step at a time.",
      basis: {
        discoverer: { value: "Ashish Vaswani, Noam Shazeer, Niki Parmar et al.", mark: "EXACT" },
        date: { value: "2017", mark: "EXACT" },
        keyObservation: {
          value: "Attention Is All You Need: the transformer drops recurrence and uses self-attention alone.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "",
      },
      combines: [
        { id: "n-attention", observation: { discoverer: { value: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio", mark: "APPROXIMATE" }, date: { value: "2014", mark: "EXACT" }, keyObservation: { value: "Attention lets a translation model focus on the relevant parts of the source sentence.", mark: "EXACT" }, confidence: "high", note: "" } },
        { id: "n-embedding", observation: { discoverer: { value: "Tomas Mikolov", mark: "EXACT" }, date: { value: "2013", mark: "EXACT" }, keyObservation: { value: "Mikolov trains word2vec: words appear as vectors that capture meaning by context.", mark: "EXACT" }, confidence: "high", note: "" } },
        { id: "n-turing", observation: { discoverer: { value: "Alan Turing", mark: "EXACT" }, date: { value: "1936", mark: "EXACT" }, keyObservation: { value: "Turing defines the universal machine that can compute anything computable.", mark: "EXACT" }, confidence: "high", note: "" } },
      ],
    },
    {
      id: "n-llm",
      label: "large language model",
      layer: "l4",
      description:
        "A transformer scaled to billions of parameters and trained on a large corpus of text.",
      basis: {
        discoverer: { value: "OpenAI", mark: "APPROXIMATE" },
        date: { value: "2020", mark: "EXACT" },
        keyObservation: {
          value: "GPT-3 shows that scaling the transformer yields broad language abilities.",
          mark: "EXACT",
        },
        confidence: "high",
        note: "Scale as a path to capability is a shared result; GPT-3 is the canonical demonstration.",
      },
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
