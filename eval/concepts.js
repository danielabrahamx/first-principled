/**
 * The fixed concept set for the tutor quality eval harness (ticket 07):
 * reality maps the eval can run a stubbed or live LLM against, plus the
 * transfer-question answers a session is scored on.
 *
 * Maps are schema-valid per validateRealityMap. Nodes that abstract a lower
 * layer carry a `basis` field - the observation the abstraction compresses
 * (principle 5, ticket 06). The field is optional in the schema, so these
 * fixtures are valid against the v1 validator too.
 */

import { laptopRealityMap } from "../src/lib/mmg/fixtures.js";

/**
 * Recursion, as a foundation-first chain: the observable call stack, then
 * the base case and recursive call it is built on, then recursion itself.
 *
 * @type {import("../src/lib/mmg/types.js").RealityMap}
 */
export const recursionRealityMap = {
  concept: "recursion",
  layers: [
    { id: "l0", name: "execution", nodes: ["n-stack"] },
    { id: "l1", name: "the two parts", nodes: ["n-base-case", "n-recursive-call"] },
    { id: "l2", name: "the pattern", nodes: ["n-recursion"] },
  ],
  nodes: [
    {
      id: "n-stack",
      label: "call stack",
      layer: "l0",
      description:
        "The runtime structure that records every function call; when a function calls itself, a new frame stacks on top of the old one.",
    },
    {
      id: "n-base-case",
      label: "base case",
      layer: "l1",
      description:
        "The condition under which a recursive function returns without calling itself; without it the stack grows without end.",
      basis: "a countdown that stops when the number reaches zero",
    },
    {
      id: "n-recursive-call",
      label: "recursive call",
      layer: "l1",
      description:
        "The call a recursive function makes to itself with a smaller or simpler input.",
      basis: "a countdown that calls itself with one less",
    },
    {
      id: "n-recursion",
      label: "recursion",
      layer: "l2",
      description:
        "Defining a problem in terms of smaller versions of itself until a base case stops the chain.",
      basis: "nested folders and nesting dolls have the same shape",
    },
  ],
  edges: [
    { source: "n-base-case", target: "n-stack", type: "built-on" },
    { source: "n-recursive-call", target: "n-stack", type: "built-on" },
    { source: "n-recursion", target: "n-base-case", type: "depends-on" },
    { source: "n-recursion", target: "n-recursive-call", type: "depends-on" },
    { source: "n-recursion", target: "n-stack", type: "abstraction-of" },
    { source: "n-recursion", target: "n-stack", type: "predicts" },
  ],
};

/**
 * Photosynthesis: light and matter are observable; the chemical step
 * abstracts them; photosynthesis abstracts the step.
 *
 * @type {import("../src/lib/mmg/types.js").RealityMap}
 */
export const photosynthesisRealityMap = {
  concept: "photosynthesis",
  layers: [
    { id: "l0", name: "light and matter", nodes: ["n-light", "n-water-co2"] },
    { id: "l1", name: "the chemical step", nodes: ["n-chlorophyll", "n-glucose"] },
    { id: "l2", name: "the process", nodes: ["n-photosynthesis"] },
  ],
  nodes: [
    {
      id: "n-light",
      label: "sunlight",
      layer: "l0",
      description: "The energy input a plant's leaves receive from the sun.",
    },
    {
      id: "n-water-co2",
      label: "water and carbon dioxide",
      layer: "l0",
      description: "The raw matter a plant takes in from its roots and the air.",
    },
    {
      id: "n-chlorophyll",
      label: "chlorophyll",
      layer: "l1",
      description:
        "The green pigment in leaves that absorbs light energy and starts the chemical conversion.",
      basis: "leaves are green because chlorophyll absorbs red and blue light",
    },
    {
      id: "n-glucose",
      label: "glucose",
      layer: "l1",
      description:
        "The sugar a plant builds from water and carbon dioxide using light energy; its fuel and building material.",
      basis: "plants taste sweet where they store sugar",
    },
    {
      id: "n-photosynthesis",
      label: "photosynthesis",
      layer: "l2",
      description:
        "The process by which a plant converts light energy into chemical energy, building glucose from water and carbon dioxide.",
      basis: "a plant in a sunny window grows faster than one in a dark room",
    },
  ],
  edges: [
    { source: "n-chlorophyll", target: "n-light", type: "depends-on" },
    { source: "n-glucose", target: "n-water-co2", type: "built-on" },
    { source: "n-glucose", target: "n-chlorophyll", type: "depends-on" },
    { source: "n-photosynthesis", target: "n-glucose", type: "depends-on" },
    { source: "n-photosynthesis", target: "n-chlorophyll", type: "depends-on" },
    { source: "n-photosynthesis", target: "n-light", type: "predicts" },
  ],
};

/**
 * Battery: ion chemistry is observable at the foundation, the cell abstracts
 * it, the battery abstracts the cell.
 *
 * @type {import("../src/lib/mmg/types.js").RealityMap}
 */
export const batteryRealityMap = {
  concept: "battery",
  layers: [
    { id: "l0", name: "chemistry", nodes: ["n-ions", "n-electrodes"] },
    { id: "l1", name: "the cell", nodes: ["n-electrolyte"] },
    { id: "l2", name: "the product", nodes: ["n-battery"] },
  ],
  nodes: [
    {
      id: "n-ions",
      label: "ions",
      layer: "l0",
      description:
        "Charged particles whose movement carries electrical energy inside a chemical cell.",
    },
    {
      id: "n-electrodes",
      label: "electrodes",
      layer: "l0",
      description:
        "The two terminals where chemical reactions release or accept electrons.",
    },
    {
      id: "n-electrolyte",
      label: "electrolyte",
      layer: "l1",
      description:
        "The medium between the electrodes that lets ions flow while forcing electrons through the external circuit.",
      basis: "a wet cell's liquid conducts the charge between the plates",
    },
    {
      id: "n-battery",
      label: "battery",
      layer: "l2",
      description:
        "One or more cells that convert stored chemical energy into a steady flow of electrical energy at its terminals.",
      basis: "a torch dims as the chemical energy inside it is used up",
    },
  ],
  edges: [
    { source: "n-electrolyte", target: "n-ions", type: "depends-on" },
    { source: "n-electrolyte", target: "n-electrodes", type: "depends-on" },
    { source: "n-battery", target: "n-electrolyte", type: "built-on" },
    { source: "n-battery", target: "n-ions", type: "predicts" },
  ],
};

/**
 * The concept set the harness runs, in eval order.
 *
 * @type {import("../src/lib/mmg/types.js").RealityMap[]}
 */
export const CONCEPTS = [
  laptopRealityMap,
  recursionRealityMap,
  photosynthesisRealityMap,
  batteryRealityMap,
];
