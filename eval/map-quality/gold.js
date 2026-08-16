/**
 * Gold Reality Maps for the v6 map-quality eval.
 *
 * Laptop is the canonical fixture. Recursion, photosynthesis, and battery
 * are the same four-concept set named in the v6 map, written here so this
 * effort owns them. Do not import the parked tutor harness (`eval/concepts.js`).
 */

import { laptopRealityMap } from "../../src/lib/mmg/fixtures.js";

/** @typedef {import("../../src/lib/mmg/types.js").RealityMap} RealityMap */
/** @typedef {import("../../src/lib/mmg/types.js").ObservationRecord} ObservationRecord */

/**
 * @param {{
 *   discoverer: string;
 *   discovererMark?: "EXACT" | "APPROXIMATE" | "UNKNOWN";
 *   date: string;
 *   dateMark?: "EXACT" | "APPROXIMATE" | "UNKNOWN";
 *   observation: string;
 *   observationMark?: "EXACT" | "APPROXIMATE" | "UNKNOWN";
 *   confidence?: "high" | "medium" | "low";
 *   note?: string;
 * }} fields
 * @returns {ObservationRecord}
 */
function record(fields) {
  return {
    discoverer: { value: fields.discoverer, mark: fields.discovererMark ?? "EXACT" },
    date: { value: fields.date, mark: fields.dateMark ?? "EXACT" },
    keyObservation: {
      value: fields.observation,
      mark: fields.observationMark ?? "EXACT",
    },
    confidence: fields.confidence ?? "high",
    note: fields.note ?? "",
  };
}

/**
 * Recursion as a foundation-first chain: the runtime stack, the two parts
 * that use it, then the pattern. Crown node is recursion (McCarthy 1960).
 *
 * @type {RealityMap}
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
        "The runtime structure that records every function call; a self-call pushes a new frame on top of the old one.",
      basis: record({
        discoverer: "Friedrich L. Bauer",
        discovererMark: "APPROXIMATE",
        date: "1957",
        dateMark: "APPROXIMATE",
        observation:
          "Bauer describes the stack (Kellerprinzip) as last-in first-out storage for nested computation.",
        confidence: "medium",
        note: "Stack as a named device has several independent statements in the 1950s. Bauer is the usual European attribution.",
      }),
    },
    {
      id: "n-base-case",
      label: "base case",
      layer: "l1",
      description:
        "The condition under which a recursive definition returns without calling itself; without it the stack grows without end.",
      basis: record({
        discoverer: "Giuseppe Peano",
        discovererMark: "APPROXIMATE",
        date: "1889",
        dateMark: "APPROXIMATE",
        observation:
          "Peano's axioms include a base number and a successor step; induction stops at the base.",
        confidence: "medium",
        note: "The programming base case is the same stopping shape as mathematical induction, not a single invention.",
      }),
    },
    {
      id: "n-recursive-call",
      label: "recursive call",
      layer: "l1",
      description:
        "The call a recursive definition makes to itself with a smaller or simpler input.",
      basis: record({
        discoverer: "John McCarthy",
        date: "1960",
        observation:
          "McCarthy's LISP eval applies a function to a reduced argument, then to that result, until a terminating clause fires.",
        note: "",
      }),
    },
    {
      id: "n-recursion",
      label: "recursion",
      layer: "l2",
      description:
        "Defining a problem in terms of smaller versions of itself until a base case stops the chain.",
      basis: record({
        discoverer: "John McCarthy",
        date: "1960",
        observation:
          "McCarthy introduces recursive function definitions as a working programming construct in LISP.",
        note: "Recursive mathematics is older; this node is the programming pattern the Tree is mapping.",
      }),
    },
  ],
  edges: [
    { source: "n-base-case", target: "n-stack", type: "built-on" },
    { source: "n-recursive-call", target: "n-stack", type: "built-on" },
    { source: "n-recursion", target: "n-base-case", type: "depends-on" },
    { source: "n-recursion", target: "n-recursive-call", type: "depends-on" },
    { source: "n-recursion", target: "n-stack", type: "abstraction-of" },
  ],
};

/**
 * Photosynthesis: light and matter at the foundation, the chemical step,
 * then the named process.
 *
 * @type {RealityMap}
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
      basis: record({
        discoverer: "Jan Ingenhousz",
        date: "1779",
        observation:
          "Ingenhousz shows that plants restore air only in light, and only in the green parts.",
        note: "",
      }),
    },
    {
      id: "n-water-co2",
      label: "water and carbon dioxide",
      layer: "l0",
      description: "The raw matter a plant takes in from its roots and the air.",
      basis: record({
        discoverer: "Joseph Priestley",
        date: "1771",
        dateMark: "APPROXIMATE",
        observation:
          "Priestley finds that a plant can restore air that a candle or animal has spoiled.",
        confidence: "medium",
        note: "The carbon-dioxide identity of that air comes later (Lavoisier). Priestley is the plant-and-air observation.",
      }),
    },
    {
      id: "n-chlorophyll",
      label: "chlorophyll",
      layer: "l1",
      description:
        "The green pigment in leaves that absorbs light energy and starts the chemical conversion.",
      basis: record({
        discoverer: "Joseph Pelletier and Joseph Caventou",
        date: "1817",
        observation:
          "Pelletier and Caventou isolate the green leaf pigment and name it chlorophyll.",
        note: "",
      }),
    },
    {
      id: "n-glucose",
      label: "glucose",
      layer: "l1",
      description:
        "The sugar a plant builds from water and carbon dioxide using light energy; its fuel and building material.",
      basis: record({
        discoverer: "Julius von Sachs",
        date: "1864",
        dateMark: "APPROXIMATE",
        observation:
          "Sachs shows starch appearing in illuminated chloroplasts, the stored form of the sugar the leaf builds.",
        confidence: "medium",
        note: "Glucose as the first stable product is later Calvin-cycle work. Sachs is the leaf-sugar observation.",
      }),
    },
    {
      id: "n-photosynthesis",
      label: "photosynthesis",
      layer: "l2",
      description:
        "The process by which a plant converts light energy into chemical energy, building glucose from water and carbon dioxide.",
      basis: record({
        discoverer: "Jan Ingenhousz",
        discovererMark: "APPROXIMATE",
        date: "1779",
        observation:
          "Ingenhousz states that light on green plant tissue produces the air animals need, the first full statement of the process.",
        confidence: "medium",
        note: "The word photosynthesis is later (Barnes, 1893). The process node is Ingenhousz's finding, not the coinage.",
      }),
    },
  ],
  edges: [
    { source: "n-chlorophyll", target: "n-light", type: "depends-on" },
    { source: "n-glucose", target: "n-water-co2", type: "built-on" },
    { source: "n-glucose", target: "n-chlorophyll", type: "depends-on" },
    { source: "n-photosynthesis", target: "n-glucose", type: "depends-on" },
    { source: "n-photosynthesis", target: "n-chlorophyll", type: "depends-on" },
    { source: "n-photosynthesis", target: "n-light", type: "abstraction-of" },
  ],
};

/**
 * Battery: ion chemistry at the foundation, the cell, then the product.
 *
 * @type {RealityMap}
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
      basis: record({
        discoverer: "Michael Faraday",
        date: "1834",
        observation:
          "Faraday names ions as the moving charged particles that carry current through a decomposing solution.",
        note: "",
      }),
    },
    {
      id: "n-electrodes",
      label: "electrodes",
      layer: "l0",
      description:
        "The two terminals where chemical reactions release or accept electrons.",
      basis: record({
        discoverer: "Michael Faraday",
        date: "1834",
        observation:
          "Faraday names electrodes as the terminals where the current enters and leaves an electrolytic cell.",
        note: "Volta's 1800 pile already had two metal plates; Faraday names the roles.",
      }),
    },
    {
      id: "n-electrolyte",
      label: "electrolyte",
      layer: "l1",
      description:
        "The medium between the electrodes that lets ions flow while forcing electrons through the external circuit.",
      basis: record({
        discoverer: "Michael Faraday",
        date: "1834",
        observation:
          "Faraday names the electrolyte as the decomposable body that conducts by the motion of its parts.",
        note: "",
      }),
    },
    {
      id: "n-battery",
      label: "battery",
      layer: "l2",
      description:
        "One or more cells that convert stored chemical energy into a steady flow of electrical energy at its terminals.",
      basis: record({
        discoverer: "Alessandro Volta",
        date: "1800",
        observation:
          "Volta stacks silver and zinc discs separated by brine-soaked cloth and draws a continuous current from the pile.",
        note: "",
      }),
    },
  ],
  edges: [
    { source: "n-electrolyte", target: "n-ions", type: "depends-on" },
    { source: "n-electrolyte", target: "n-electrodes", type: "depends-on" },
    { source: "n-battery", target: "n-electrolyte", type: "built-on" },
    { source: "n-battery", target: "n-ions", type: "abstraction-of" },
  ],
};

export { laptopRealityMap };

/**
 * The concept set this harness scores, in eval order.
 *
 * @type {RealityMap[]}
 */
export const GOLD_MAPS = [
  laptopRealityMap,
  recursionRealityMap,
  photosynthesisRealityMap,
  batteryRealityMap,
];
