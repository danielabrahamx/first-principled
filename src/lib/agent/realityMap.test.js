import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFoundationSystemPrompt,
  buildNextLayerSystemPrompt,
  deriveCheck,
  generateRealityMap,
  steProblems,
} from "./realityMap.js";
import { extractBalancedObject, parseModelJson } from "./jsonParse.js";
import { validateRealityMap } from "../mmg/validator.js";
import { observationProblems, dropUnknownValues } from "../mmg/observation.js";
import { laptopRealityMap, llmRealityMap } from "../mmg/fixtures.js";

/**
 * A stub transport that records every request and replays a scripted list of
 * replies. Returns null from the last call, so a test can over-script and
 * still fail loudly if the code makes an unexpected call.
 *
 * @param {string[]} replies
 * @returns {{ callLLM: (request: any) => Promise<{ content: string }>, requests: any[] }}
 */
function stubTransport(replies) {
  const queue = [...replies];
  const requests = /** @type {any[]} */ ([]);
  const callLLM = async (/** @type {any} */ request) => {
    requests.push(request);
    const content = queue.shift();
    if (content === undefined) {
      throw new Error("unexpected extra LLM call in test script");
    }
    return { content };
  };
  return { callLLM, requests };
}

/** The phase-A foundation reply built from the laptop fixture. */
const FOUNDATION_REPLY = JSON.stringify({
  isValidConcept: true,
  foundation: {
    layer: laptopRealityMap.layers[0],
    nodes: laptopRealityMap.nodes.filter(
      (node) => node.layer === laptopRealityMap.layers[0].id
    ),
  },
});

/** The reply that ends the chain: the concept is reached. */
const DONE_REPLY = JSON.stringify({ isValidConcept: true, done: true });

/**
 * The per-layer replies that rebuild the laptop fixture bottom-up: the reply
 * for layer l<k> carries the layer, its nodes, and the fixture edges whose
 * higher endpoint sits in l<k>. Assembled in order they reproduce the
 * fixture exactly - including the predicts edge from the foundation to the
 * electronics layer, which the script can emit because the merge accepts
 * edges to any already-built node.
 *
 * @returns {string[]}
 */
function layerReplies() {
  const layerIndex = new Map(
    laptopRealityMap.layers.map((layer, i) => [layer.id, i])
  );
  const nodeLayer = new Map(
    laptopRealityMap.nodes.map((node) => [node.id, layerIndex.get(node.layer)])
  );
  const replies = [];
  for (let k = 1; k < laptopRealityMap.layers.length; k++) {
    const layer = laptopRealityMap.layers[k];
    const nodes = laptopRealityMap.nodes.filter((node) => node.layer === layer.id);
    const edges = laptopRealityMap.edges.filter((edge) => {
      const s = nodeLayer.get(edge.source) ?? -1;
      const t = nodeLayer.get(edge.target) ?? -1;
      return Math.max(s, t) === k;
    });
    replies.push(
      JSON.stringify({
        isValidConcept: true,
        done: false,
        layer,
        nodes,
        edges,
        selfReview: { derivable: true, gaps: [] },
      })
    );
  }
  return replies;
}

/**
 * The scripted happy path: foundation plus five layer calls. The loop stops
 * at the soft cap (maxLayers 6, foundation included) once layer l5 lands, so
 * a 6-layer chain needs no done reply - done is for chains that end early.
 */
const HAPPY_SCRIPT = [FOUNDATION_REPLY, ...layerReplies()];

/**
 * Maps differ only in edge ORDER when rebuilt per-layer (an edge belongs to
 * the reply of its higher layer), so compare semantically: identical
 * concept, layers, nodes, and edge SET.
 *
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function semanticEqual(a, b) {
  if (!a || !b) return false;
  /** @param {any} map */
  const sortEdges = (map) =>
    [...map.edges].sort((x, y) =>
      `${x.source}|${x.target}|${x.type}`.localeCompare(`${y.source}|${y.target}|${y.type}`)
    );
  return (
    a.concept === b.concept &&
    JSON.stringify(a.layers) === JSON.stringify(b.layers) &&
    JSON.stringify(a.nodes) === JSON.stringify(b.nodes) &&
    JSON.stringify(sortEdges(a)) === JSON.stringify(sortEdges(b))
  );
}

/** @param {any} map @param {string} [message] */
function assertLaptopFixture(map, message) {
  assert.equal(
    semanticEqual(map, laptopRealityMap),
    true,
    `${message ?? "map matches the fixture"}: ${JSON.stringify(map && map.edges)}`
  );
}

/** A scripted reply that breaks a layer: the given layer has no down-edge.
 * @param {string} layerId */
function brokenLayerReply(layerId) {
  const layer = laptopRealityMap.layers.find((l) => l.id === layerId);
  const nodes = laptopRealityMap.nodes.filter((node) => node.layer === layerId);
  return JSON.stringify({
    isValidConcept: true,
    done: false,
    layer,
    nodes,
    edges: [],
    selfReview: { derivable: true, gaps: [] },
  });
}

// --- parseModelJson / extractBalancedObject --------------------------------

test("parseModelJson parses direct JSON", () => {
  assert.deepEqual(parseModelJson('{"a": 1}'), { a: 1 });
});

test("parseModelJson parses JSON inside markdown fences with commentary", () => {
  const content = "Here you go:\n```json\n{\"a\": [1, 2]}\n```\nHope that helps.";
  assert.deepEqual(parseModelJson(content), { a: [1, 2] });
});

test("parseModelJson keeps braces inside strings balanced", () => {
  const content = '{"label": "a {b} c", "nested": {"x": 1}}';
  assert.deepEqual(parseModelJson(content), {
    label: "a {b} c",
    nested: { x: 1 },
  });
});

test("parseModelJson returns null for unparseable or empty content", () => {
  assert.equal(parseModelJson(""), null);
  assert.equal(parseModelJson("  "), null);
  assert.equal(parseModelJson("not json at all"), null);
  assert.equal(parseModelJson("unbalanced {{ object"), null);
  assert.equal(parseModelJson(JSON.stringify([1, 2])), null);
});

test("extractBalancedObject finds the first balanced span", () => {
  assert.equal(
    extractBalancedObject("prefix {\"a\": {\"b\": 2}} suffix"),
    '{"a": {"b": 2}}'
  );
  assert.equal(extractBalancedObject("no braces here"), null);
});

// --- prompts ----------------------------------------------------------------

test("the foundation prompt satisfies the JSON mode contract and the ticket asks", () => {
  const prompt = buildFoundationSystemPrompt();
  assert.match(prompt, /\bjson\b/i);
  assert.match(prompt, /FOUNDATION layer/i);
  assert.match(prompt, /observable/i);
  assert.match(prompt, /isValidConcept/);
  assert.match(prompt, /discoverer/, "foundation nodes carry observation records (ticket 03)");
  assert.match(prompt, /EXACT, APPROXIMATE, or UNKNOWN/, "the fail-honest marks (ticket 09)");
  assert.match(prompt, /NEVER invent/, "never invent a fact");
  assert.match(prompt, /simplified technical English/, "narratives follow the STE subset (ticket 05)");
});

test("the next-layer prompt satisfies the JSON mode contract and the ticket asks", () => {
  const prompt = buildNextLayerSystemPrompt(6);
  assert.match(prompt, /\bjson\b/i);
  assert.match(prompt, /layer by layer/i);
  assert.match(prompt, /CURRENT MAP/, "each layer call sees all lower layers (ticket 13)");
  assert.match(prompt, /at least one edge of the new layer must connect it to the layer immediately below/i, "adjacent down-edges stay the default (ticket 08, extended not replaced)");
  assert.match(prompt, /no intermediate step is ever skipped/i, "skipping is forbidden, not just checked");
  assert.match(prompt, /CONVERGENT/i, "real discovery history is convergent (ticket 13)");
  assert.match(prompt, /combines/i, "a convergence node carries a combines list (ticket 13)");
  assert.match(prompt, /cross-layer edges/i, "cross-layer combines edges are legal for true syntheses (ticket 13)");
  assert.match(prompt, /2\+ distinct layers/i, "a convergence node combines 2+ distinct layers (ticket 13)");
  assert.match(prompt, /basis/i, "every abstraction names the observation it compresses");
  assert.match(prompt, /predicts/i, "testable predictions are emitted (principle 2)");
  assert.match(prompt, /done/i, "the model can declare the concept reached");
  assert.match(prompt, /around 6 layers/i);
  assert.match(prompt, /built-on|depends-on|part-of|abstraction-of|predicts|contradicts/);
  assert.match(prompt, /discoverer/, "every node carries an observation record (ticket 03)");
  assert.match(prompt, /keyObservation/, "the key observation field (ticket 02)");
  assert.match(prompt, /confidence/, "the record carries a confidence");
  assert.match(prompt, /EXACT, APPROXIMATE, or UNKNOWN/, "the fail-honest marks (ticket 09)");
  assert.match(prompt, /NEVER invent/, "never invent a fact");
  assert.match(prompt, /UNKNOWN, leave its value empty/, "UNKNOWN drops the value (contract rule 5)");
  assert.match(prompt, /simplified technical English/, "narratives follow the STE subset (ticket 05)");
});

test("the next-layer prompt honors a custom layer cap", () => {
  assert.match(buildNextLayerSystemPrompt(4), /around 4 layers/i);
});

// --- deriveCheck -------------------------------------------------------------

test("deriveCheck accepts the fixture map (reachable, bases present)", () => {
  const check = deriveCheck(laptopRealityMap);
  assert.equal(check.ok, true, check.errors.join("; "));
});

test("deriveCheck flags a node that is not reachable from the foundation", () => {
  const broken = structuredClone(laptopRealityMap);
  broken.edges = broken.edges.filter(
    (edge) => !(edge.source === "n-os" || edge.target === "n-os")
  );
  const check = deriveCheck(broken);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /n-os/.test(error)));
  assert.match(check.errors[0], /invented gap/);
});

test("deriveCheck requires an observation record on every node, foundation included", () => {
  const noBasis = structuredClone(laptopRealityMap);
  noBasis.nodes = noBasis.nodes.map((node) => {
    if (node.id === "n-logic-gate") return { ...node, basis: undefined };
    return node;
  });
  const check = deriveCheck(noBasis);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /n-logic-gate/.test(error) && /basis/.test(error)));

  const noFoundationBasis = structuredClone(laptopRealityMap);
  noFoundationBasis.nodes = noFoundationBasis.nodes.map((node) => {
    if (node.layer === noFoundationBasis.layers[0].id) return { ...node, basis: undefined };
    return node;
  });
  const foundationCheck = deriveCheck(noFoundationBasis);
  assert.equal(foundationCheck.ok, false, "the foundation carries the first real observation (ticket 03)");
  assert.ok(
    foundationCheck.errors.some((error) => /n-electricity/.test(error) && /observation record/.test(error))
  );
});

test("deriveCheck rejects an invalid observation record (bad mark, missing field)", () => {
  const broken = structuredClone(laptopRealityMap);
  const bit = broken.nodes.find((node) => node.id === "n-bit");
  assert.ok(bit, "the fixture has a bit node");
  bit.basis = /** @type {any} */ ({
    discoverer: { value: "Claude Shannon", mark: "SOMETIMES" },
    date: undefined,
    keyObservation: {
      value: "Shannon names the bit as the basic unit of information.",
      mark: "EXACT",
    },
    confidence: "high",
    note: "",
  });
  const check = deriveCheck(broken);
  assert.equal(check.ok, false);
  assert.ok(
    check.errors.some((error) => /n-bit/.test(error) && /invalid observation record/.test(error))
  );
});

test("deriveCheck rejects a value under an UNKNOWN mark (an invented placeholder)", () => {
  const invented = structuredClone(laptopRealityMap);
  const bit = invented.nodes.find((node) => node.id === "n-bit");
  assert.ok(bit, "the fixture has a bit node");
  bit.basis = {
    discoverer: { value: "Claude Shannon", mark: "EXACT" },
    date: { value: "around 1900", mark: "UNKNOWN" },
    keyObservation: {
      value: "Shannon names the bit as the basic unit of information.",
      mark: "EXACT",
    },
    confidence: "high",
    note: "",
  };
  const check = deriveCheck(invented);
  assert.equal(check.ok, false);
  assert.ok(
    check.errors.some((error) => /never invent/.test(error)),
    check.errors.join("; ")
  );
});

test("deriveCheck accepts UNKNOWN marks with dropped values (legal first-class state)", () => {
  const honest = structuredClone(laptopRealityMap);
  const bit = honest.nodes.find((node) => node.id === "n-bit");
  assert.ok(bit, "the fixture has a bit node");
  bit.basis = {
    discoverer: { value: "", mark: "UNKNOWN" },
    date: { value: "", mark: "UNKNOWN" },
    keyObservation: {
      value: "Shannon names the bit as the basic unit of information.",
      mark: "EXACT",
    },
    confidence: "low",
    note: "The record of this discovery does not survive.",
  };
  const check = deriveCheck(honest);
  assert.equal(check.ok, true, check.errors.join("; "));
});

test("deriveCheck rejects a legacy string basis on a generated map", () => {
  const legacy = structuredClone(laptopRealityMap);
  legacy.nodes = legacy.nodes.map((node) => {
    if (node.id === "n-bit") return { ...node, basis: "a switch being on or off" };
    return node;
  });
  const check = deriveCheck(legacy);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /n-bit/.test(error) && /observation record/.test(error)));
});

test("deriveCheck is structural on garbage input", () => {
  const check = deriveCheck({});
  assert.equal(check.ok, false);
  assert.ok(check.errors.length > 0);
});

// --- convergence nodes (ticket 13) ------------------------------------------

test("deriveCheck accepts the convergence fixture (combines from 3 distinct layers)", () => {
  const check = deriveCheck(llmRealityMap);
  assert.equal(check.ok, true, check.errors.join("; "));
  const transformer = llmRealityMap.nodes.find((node) => node.id === "n-transformer");
  assert.ok(transformer && Array.isArray(transformer.combines));
  assert.equal(transformer.combines.length, 3);
});

test("deriveCheck rejects a convergence node whose combines come from only one distinct layer", () => {
  const broken = /** @type {any} */ (structuredClone(llmRealityMap));
  const transformer = broken.nodes.find(/** @param {any} node */ (node) => node.id === "n-transformer");
  assert.ok(transformer);
  transformer.combines = [
    { id: "n-attention", observation: transformer.combines[0].observation },
    { id: "n-attention", observation: transformer.combines[0].observation },
  ];
  const check = deriveCheck(broken);
  assert.equal(check.ok, false);
  assert.ok(
    check.errors.some((error) => /distinct layer/.test(error)),
    check.errors.join("; ")
  );
});

test("deriveCheck rejects a convergence node that combines an unknown node id", () => {
  const broken = /** @type {any} */ (structuredClone(llmRealityMap));
  const transformer = broken.nodes.find(/** @param {any} node */ (node) => node.id === "n-transformer");
  assert.ok(transformer);
  transformer.combines = [
    { id: "n-attention", observation: transformer.combines[0].observation },
    { id: "n-made-up", observation: transformer.combines[0].observation },
  ];
  const check = deriveCheck(broken);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /unknown node/.test(error)));
});

test("deriveCheck rejects a convergence node that combines a node in a non-lower layer", () => {
  const broken = /** @type {any} */ (structuredClone(llmRealityMap));
  const llm = broken.nodes.find(/** @param {any} node */ (node) => node.id === "n-llm");
  assert.ok(llm);
  const attention = broken.nodes.find(/** @param {any} node */ (node) => node.id === "n-attention");
  assert.ok(attention);
  // n-llm sits at l4. Combining itself (l4) is not "from a strictly lower
  // layer" - only n-transformer (l3) and lower qualify.
  llm.combines = [
    { id: "n-llm", observation: llm.basis },
    { id: "n-attention", observation: attention.basis },
  ];
  const check = deriveCheck(broken);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /not in a strictly lower layer/.test(error)));
});

test("deriveCheck rejects a convergence node whose combine entry carries an invalid observation", () => {
  const broken = /** @type {any} */ (structuredClone(llmRealityMap));
  const transformer = broken.nodes.find(/** @param {any} node */ (node) => node.id === "n-transformer");
  assert.ok(transformer);
  transformer.combines = transformer.combines.map(
    /** @param {any} entry @param {number} i */
    (entry, i) =>
      i === 0
        ? { ...entry, observation: { ...entry.observation, date: { value: "", mark: "EXACT" } } }
        : entry
  );
  const check = deriveCheck(broken);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /invalid observation record/.test(error)));
});

test("an ordinary node with no combines list is not a convergence node", () => {
  const check = deriveCheck(laptopRealityMap);
  assert.equal(check.ok, true, check.errors.join("; "));
});

test("the validator accepts the convergence fixture and rejects broken combines entries", () => {
  assert.equal(validateRealityMap(llmRealityMap).ok, true);
  const broken = /** @type {any} */ (structuredClone(llmRealityMap));
  const transformer = broken.nodes.find(/** @param {any} node */ (node) => node.id === "n-transformer");
  assert.ok(transformer);
  transformer.combines = [{ id: "n-ghost", observation: transformer.combines[0].observation }];
  const check = validateRealityMap(broken);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((error) => /unknown node/.test(error)));

  const notArray = /** @type {any} */ (structuredClone(llmRealityMap));
  notArray.nodes = notArray.nodes.map(
    /** @param {any} node */
    (node) =>
      node.id === "n-transformer" ? { ...node, combines: "attention" } : node
  );
  assert.equal(validateRealityMap(notArray).ok, false);
});

// --- observation records (ticket 02/03, fail-honest contract 09) ------------

test("observationProblems accepts a valid record with any honest marks", () => {
  const record = {
    discoverer: { value: "George Boole", mark: "EXACT" },
    date: { value: "1847", mark: "APPROXIMATE" },
    keyObservation: { value: "Boole links logical reasoning to the rules of algebra.", mark: "EXACT" },
    confidence: "medium",
    note: "Contested in some surveys.",
  };
  assert.deepEqual(observationProblems(record), []);
  assert.deepEqual(
    observationProblems({
      ...record,
      discoverer: { value: "", mark: "UNKNOWN" },
      date: { value: "", mark: "UNKNOWN" },
      keyObservation: { value: "", mark: "UNKNOWN" },
      confidence: "low",
      note: "",
    }),
    [],
    "a fully UNKNOWN record is legal - the node keeps its gap"
  );
});

test("observationProblems rejects structural breaks", () => {
  assert.ok(observationProblems(undefined).length > 0, "missing record");
  assert.ok(observationProblems("a plain string").length > 0, "legacy string is not a record");
  assert.ok(
    observationProblems({
      discoverer: { value: "x", mark: "EXACT" },
      date: { value: "1847", mark: "EXACT" },
      keyObservation: { value: "y", mark: "EXACT" },
      confidence: "certain",
      note: "",
    }).length > 0,
    "confidence outside the enum"
  );
  assert.ok(
    observationProblems({
      discoverer: { value: "x", mark: "EXACT" },
      date: { value: "1847", mark: "EXACT" },
      keyObservation: { value: "", mark: "EXACT" },
      confidence: "high",
      note: 42,
    }).length > 0,
    "empty EXACT value and non-string note"
  );
});

test("dropUnknownValues empties UNKNOWN-marked values but keeps the record valid", () => {
  const record = {
    discoverer: { value: "someone guessed", mark: "UNKNOWN" },
    date: { value: "about 1900", mark: "UNKNOWN" },
    keyObservation: { value: "A plausible observation that never happened.", mark: "UNKNOWN" },
    confidence: "low",
    note: "Claimed observation, never confirmed.",
  };
  const dropped = /** @type {any} */ (dropUnknownValues(record));
  assert.equal(dropped.discoverer.value, "", "the invented value is dropped");
  assert.equal(dropped.date.value, "");
  assert.equal(dropped.keyObservation.value, "");
  assert.equal(dropped.discoverer.mark, "UNKNOWN", "the mark survives into the gap state");
  assert.equal(dropped.note, "Claimed observation, never confirmed.");
  assert.deepEqual(observationProblems(dropped), [], "the dropped record is valid");
  assert.deepEqual(observationProblems(record).length > 0, true, "the raw record stays invalid");
  assert.equal(dropUnknownValues("not a record"), "not a record");
  assert.equal(dropUnknownValues(null), null);
});

test("a layer with UNKNOWN-marked values is normalized, not repaired", async () => {
  // The model hedges by writing a value under an UNKNOWN mark. Per the
  // contract rule 5 the value is DROPPED at validation - the node keeps its
  // visible gap and the layer lands without a repair.
  const hedged = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: laptopRealityMap.layers[1],
    nodes: laptopRealityMap.nodes
      .filter((node) => node.layer === "l1")
      .map((node) => ({
        ...node,
        basis: {
          .../** @type {any} */ (node.basis),
          date: { value: "around 1900", mark: "UNKNOWN" },
        },
      })),
    edges: [{ source: "n-silicon", target: "n-electricity", type: "depends-on" }],
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    hedged,
    ...HAPPY_SCRIPT.slice(2),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.equal(result.retried, false, "the dropped value is not a repair trigger");
  assert.equal(requests.length, laptopRealityMap.layers.length);
  const landed = /** @type {any} */ (result.map?.nodes.find((node) => node.id === "n-silicon"));
  assert.equal(landed.basis.date.value, "", "the value is dropped, the gap is visible");
  assert.equal(landed.basis.date.mark, "UNKNOWN");
});

test("a foundation with UNKNOWN-marked values is normalized, not repaired", async () => {
  const hedgedFoundation = JSON.stringify({
    isValidConcept: true,
    foundation: {
      layer: laptopRealityMap.layers[0],
      nodes: laptopRealityMap.nodes
        .filter((node) => node.layer === "l0")
        .map((node) => ({
          ...node,
          basis: {
            .../** @type {any} */ (node.basis),
            discoverer: { value: "a traditional attribution", mark: "UNKNOWN" },
          },
        })),
    },
  });
  const { callLLM, requests } = stubTransport([hedgedFoundation, ...HAPPY_SCRIPT.slice(1)]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.equal(result.retried, false);
  const landed = /** @type {any} */ (result.map?.nodes.find((node) => node.id === "n-electricity"));
  assert.equal(landed.basis.discoverer.value, "", "the invented attribution is dropped");
  assert.equal(landed.basis.discoverer.mark, "UNKNOWN");
  assert.equal(requests.length, laptopRealityMap.layers.length);
});

test("the layer repair message lists existing ids and offers the done reply", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    brokenLayerReply("l1"),
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  const repair = requests[2].messages[1].content;
  assert.match(repair, /never reuse any of these existing ids: n-electricity/, "the repair names every id the model must not reuse");
  assert.match(repair, /"done": true/, "the repair offers the done reply when the concept is reached");
});

// --- STE narratives (ticket 05, docs/ste.md) ---------------------------------

test("steProblems passes clean simplified English", () => {
  const check = steProblems("Boole links logical reasoning to the rules of algebra.");
  assert.deepEqual(check.errors, []);
  assert.deepEqual(check.warnings, []);
});

test("steProblems rejects contractions, long sentences, dashes, and filler", () => {
  assert.ok(steProblems("The team couldn't confirm the result.").errors.some((e) => /contraction/.test(e)));
  assert.ok(steProblems("This is a very long sentence that keeps going and going and going and going and going and going and going and going and going on.").errors.some((e) => /word sentence/.test(e)));
  assert.ok(steProblems("A discovery -- made in 1847 -- changed things.").errors.some((e) => /double hyphen/.test(e)));
  assert.ok(steProblems("A discovery \u2014 made in 1847 \u2014 changed things.").errors.some((e) => /dash/.test(e)));
  assert.ok(steProblems("Basically, the model invented stuff.").errors.some((e) => /non-STE word/.test(e)));
});

test("steProblems reports vague words as warnings, not failures", () => {
  const check = steProblems("It changed the way we think about this thing.");
  assert.deepEqual(check.errors, []);
  assert.ok(check.warnings.some((w) => /vague word "it"/.test(w)));
});

test("steProblems is quiet on non-strings", () => {
  assert.deepEqual(steProblems(undefined), { errors: [], warnings: [] });
  assert.deepEqual(steProblems(""), { errors: [], warnings: [] });
});

// --- generation: happy paths -------------------------------------------------

test("a per-layer generation returns the fixture map with one call per layer", async () => {
  const { callLLM, requests } = stubTransport(HAPPY_SCRIPT);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, false);
  assert.equal(requests.length, laptopRealityMap.layers.length);
  assert.equal(requests[0].jsonMode, true);
  assert.equal(requests[0].thinking, false);
  assert.match(requests[0].messages[1].content, /Word or phrase: laptop/);
  assert.match(requests[1].messages[1].content, /Build layer l1/);
  assert.match(requests[requests.length - 1].messages[1].content, /Build layer l5/);
});

test("each layer call sees all lower layers, not only the layer below (ticket 13)", async () => {
  const { callLLM, requests } = stubTransport(HAPPY_SCRIPT);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  const l2Call = requests[2].messages[1].content;
  assert.match(l2Call, /Build layer l2/);
  assert.match(l2Call, /n-silicon/, "l2 sees the layer below (materials)");
  assert.match(l2Call, /n-electricity/, "l2 sees the foundation too - a convergence node may reference any depth (ticket 13)");
  assert.ok(!l2Call.includes("n-transistor"), "l2 must not see its own nodes");
  const l4Call = requests[4].messages[1].content;
  assert.match(l4Call, /Build layer l4/);
  assert.match(l4Call, /n-bit/, "l4 sees the layer below (logic)");
  assert.match(l4Call, /n-electricity/, "l4 sees the foundation too");
});

test("a refusal in phase A is propagated without further calls", async () => {
  const { callLLM, requests } = stubTransport([
    JSON.stringify({ isValidConcept: false, reason: "keysmash is not a thing" }),
  ]);
  const result = await generateRealityMap({ concept: "asdfghjkl", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "refused");
  assert.equal(result.reason, "keysmash is not a thing");
  assert.equal(requests.length, 1);
});

test("empty input refuses without calling the LLM", async () => {
  const { callLLM, requests } = stubTransport([]);
  const result = await generateRealityMap({ concept: "   ", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "refused");
  assert.equal(requests.length, 0);
});

test("a done reply right after the foundation yields a single-layer map", async () => {
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, DONE_REPLY]);
  const result = await generateRealityMap({ concept: "electricity", callLLM });
  assert.equal(result.ok, true);
  assert.ok(result.map, "a single-layer map exists");
  assert.equal(result.map.layers.length, 1);
  assert.equal(result.map.layers[0].id, "l0", "the foundation id is normalized to l0");
  assert.equal(result.retried, false);
  assert.equal(requests.length, 2);
});

test("a per-layer generation reproduces the convergence fixture (combines list + cross-layer edges)", async () => {
  // The llmRealityMap rebuilt bottom-up: foundation l0, then one reply per
  // layer carrying its nodes and the fixture edges whose higher endpoint
  // sits in that layer. The transformer reply carries its combines list and
  // the cross-layer edges to attention, embeddings, and compute.
  const layerIndex = new Map(llmRealityMap.layers.map((layer, i) => [layer.id, i]));
  const nodeLayer = new Map(
    llmRealityMap.nodes.map((node) => [node.id, layerIndex.get(node.layer)])
  );
  const script = [
    JSON.stringify({
      isValidConcept: true,
      foundation: {
        layer: llmRealityMap.layers[0],
        nodes: llmRealityMap.nodes.filter((node) => node.layer === "l0"),
      },
    }),
  ];
  for (let k = 1; k < llmRealityMap.layers.length; k++) {
    const layer = llmRealityMap.layers[k];
    const nodes = llmRealityMap.nodes.filter((node) => node.layer === layer.id);
    const edges = llmRealityMap.edges.filter((edge) => {
      const s = nodeLayer.get(edge.source) ?? -1;
      const t = nodeLayer.get(edge.target) ?? -1;
      return Math.max(s, t) === k;
    });
    script.push(
      JSON.stringify({
        isValidConcept: true,
        done: false,
        layer,
        nodes,
        edges,
        selfReview: { derivable: true, gaps: [] },
      })
    );
  }

  const { callLLM, requests } = stubTransport(script);
  const result = await generateRealityMap({ concept: "large language model", callLLM }, { maxLayers: llmRealityMap.layers.length });
  assert.equal(result.ok, true, (result.errors || []).join("; "));
  assert.ok(result.map, "a generated map exists");
  assert.equal(result.retried, false);
  assert.equal(requests.length, llmRealityMap.layers.length);
  assert.equal(deriveCheck(result.map).ok, true, deriveCheck(result.map).errors.join("; "));
  assert.equal(validateRealityMap(result.map).ok, true);

  const transformer = /** @type {any} */ (
    result.map?.nodes.find((node) => node.id === "n-transformer")
  );
  assert.ok(transformer, "the transformer node landed");
  assert.ok(Array.isArray(transformer.combines) && transformer.combines.length === 3,
    "the convergence node keeps its combines list");
  // The cross-layer combines edges survive.
  const crossLayer = result.map?.edges.filter(
    (edge) => edge.source === "n-transformer" && edge.target === "n-turing"
  );
  assert.equal(crossLayer.length, 1, "the cross-layer edge to the foundation survives");
  assert.equal(
    result.map?.edges.some((edge) => edge.source === "n-transformer" && edge.target === "n-embedding"),
    true
  );
});

test("each convergence-generating layer call receives all lower layers", async () => {
  const layerIndex = new Map(llmRealityMap.layers.map((layer, i) => [layer.id, i]));
  const nodeLayer = new Map(
    llmRealityMap.nodes.map((node) => [node.id, layerIndex.get(node.layer)])
  );
  const script = [
    JSON.stringify({
      isValidConcept: true,
      foundation: {
        layer: llmRealityMap.layers[0],
        nodes: llmRealityMap.nodes.filter((node) => node.layer === "l0"),
      },
    }),
  ];
  for (let k = 1; k < llmRealityMap.layers.length; k++) {
    const layer = llmRealityMap.layers[k];
    const nodes = llmRealityMap.nodes.filter((node) => node.layer === layer.id);
    const edges = llmRealityMap.edges.filter((edge) => {
      const s = nodeLayer.get(edge.source) ?? -1;
      const t = nodeLayer.get(edge.target) ?? -1;
      return Math.max(s, t) === k;
    });
    script.push(
      JSON.stringify({ isValidConcept: true, done: false, layer, nodes, edges, selfReview: { derivable: true, gaps: [] } })
    );
  }
  const { callLLM, requests } = stubTransport(script);
  await generateRealityMap({ concept: "large language model", callLLM }, { maxLayers: llmRealityMap.layers.length });
  // The l3 call (transformer) must see the foundation (l0) so it can point
  // the transformer directly at compute - the ticket 13 contract.
  const l3Call = requests[3].messages[1].content;
  assert.match(l3Call, /Build layer l3/);
  assert.match(l3Call, /n-turing/, "l3 sees the foundation (compute)");
  assert.match(l3Call, /n-embedding/, "l3 sees embeddings too");
});

// --- generation: retry paths -------------------------------------------------

test("an unparseable phase A triggers one foundation repair, then builds layers", async () => {
  const { callLLM, requests } = stubTransport(["not json at all", ...HAPPY_SCRIPT]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[1].messages[1].content, /did not meet the contract/);
});

test("a malformed foundation layer triggers a foundation repair", async () => {
  const malformed = JSON.stringify({
    isValidConcept: true,
    foundation: {
      layer: { id: "l0", name: "physics", nodes: [] },
      nodes: [],
    },
  });
  const { callLLM, requests } = stubTransport([malformed, ...HAPPY_SCRIPT]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[1].messages[1].content, /foundation/i);
});

test("an unparseable layer reply triggers a repair that cites JSON", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    "not json",
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /not valid JSON/);
});

test("an empty layer reply triggers a repair that re-states the honesty rule", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    "   \n  ",
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /mark it UNKNOWN/, "contract rule 3: the repair re-states the honesty rule");
  assert.match(requests[2].messages[1].content, /never invent/);
});

test("a foundation node without an observation record triggers a phase A repair", async () => {
  const noRecord = JSON.stringify({
    isValidConcept: true,
    foundation: {
      layer: laptopRealityMap.layers[0],
      nodes: laptopRealityMap.nodes
        .filter((node) => node.layer === "l0")
        .map((node) => {
          const { basis, ...rest } = node;
          return rest;
        }),
    },
  });
  const { callLLM, requests } = stubTransport([noRecord, ...HAPPY_SCRIPT]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[1].messages[1].content, /basis/);
});

test("a layer with the wrong id triggers a repair citing the expected id", async () => {
  const wrongId = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: { id: "l7", name: "materials", nodes: ["n-silicon"] },
    nodes: laptopRealityMap.nodes.filter((node) => node.layer === "l1"),
    edges: [],
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    wrongId,
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /layer id must be l1/);
});

test("a layer with no edge to the layer below triggers a repair citing the rule", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    brokenLayerReply("l1"),
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /layer below/);
});

test("a missing basis triggers a repair citing principle 5", async () => {
  const noBasis = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: laptopRealityMap.layers[1],
    nodes: laptopRealityMap.nodes
      .filter((node) => node.layer === "l1")
      .map((node) => ({ ...node, basis: undefined })),
    edges: [
      { source: "n-silicon", target: "n-electricity", type: "depends-on" },
    ],
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    noBasis,
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /has no basis/);
});

test("a disconnected node triggers a repair citing the invented gap", async () => {
  const stray = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: laptopRealityMap.layers[1],
    nodes: [
      ...laptopRealityMap.nodes.filter((node) => node.layer === "l1"),
      {
        id: "n-stray",
        label: "stray",
        layer: "l1",
        description: "A node with no edges at all.",
        basis: "nothing",
      },
    ],
    edges: [{ source: "n-silicon", target: "n-electricity", type: "depends-on" }],
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    stray,
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /invented gap/);
});

test("a self-review that is not derivable triggers a repair", async () => {
  const bad = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: laptopRealityMap.layers[1],
    nodes: laptopRealityMap.nodes.filter((node) => node.layer === "l1"),
    edges: [{ source: "n-silicon", target: "n-electricity", type: "depends-on" }],
    selfReview: { derivable: false, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    bad,
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /not derivable/);
});

test("self-review gap notes do not gate a structurally sound layer", async () => {
  // The model files honesty notes in gaps (for example an UNKNOWN
  // observation record) - that is legal, not a failure. Only the structural
  // gates may reject a layer.
  const withNote = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: laptopRealityMap.layers[1],
    nodes: laptopRealityMap.nodes.filter((node) => node.layer === "l1"),
    edges: [{ source: "n-silicon", target: "n-electricity", type: "depends-on" }],
    selfReview: {
      derivable: true,
      gaps: ["The observation record for both nodes is UNKNOWN because no single documented discovery exists."],
    },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    withNote,
    ...HAPPY_SCRIPT.slice(2),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, false, "an honest UNKNOWN note is not a repair trigger");
  assert.equal(requests.length, laptopRealityMap.layers.length);
});

test("a garbage edge is dropped by cleanup before validation", async () => {
  const dirty = JSON.stringify({
    isValidConcept: true,
    done: false,
    layer: laptopRealityMap.layers[1],
    nodes: laptopRealityMap.nodes.filter((node) => node.layer === "l1"),
    edges: [
      { source: "n-silicon", target: "n-electricity", type: "depends-on" },
      { source: "n-silicon", target: "n-caption", type: "part-of" },
    ],
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, dirty, ...HAPPY_SCRIPT.slice(2)]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, false);
  assert.equal(requests.length, laptopRealityMap.layers.length);
});

test("a mid-chain refusal is retried and only honored on the final attempt", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    brokenLayerReply("l1"),
    JSON.stringify({ isValidConcept: false, reason: "not a concept after all" }),
    JSON.stringify({ isValidConcept: false, reason: "not a concept after all" }),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "refused");
  assert.equal(result.reason, "not a concept after all");
  assert.equal(result.retried, true);
  assert.equal(requests.length, 4);
  assert.match(requests[3].messages[1].content, /refused to derive this layer/, "the retry cites the refusal");
});

test("a mid-chain refusal is retried and a good repair lands the layer", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    JSON.stringify({ isValidConcept: false, reason: "money is not derivable from exchange" }),
    ...HAPPY_SCRIPT.slice(1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assertLaptopFixture(result.map);
  assert.equal(result.retried, true);
  assert.equal(requests.length, laptopRealityMap.layers.length + 1, "one retry call, then the chain");
});

test("all attempts for a layer invalid fails as invalid with the problems", async () => {
  const { callLLM } = stubTransport([
    FOUNDATION_REPLY,
    brokenLayerReply("l1"),
    brokenLayerReply("l1"),
    brokenLayerReply("l1"),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((error) => /layer below/.test(error)));
  assert.match(result.reason ?? "", /two repair attempts/);
});

test("all foundation attempts unparseable fails as invalid", async () => {
  const { callLLM } = stubTransport(["garbage", "more garbage", "still garbage"]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.match(result.reason ?? "", /foundation layer/);
});

test("a transport failure surfaces as an error result", async () => {
  const callLLM = async () => {
    throw new Error("LLM API error 401: bad key");
  };
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "error");
  assert.match(result.reason ?? "", /401/);
});

// --- generation: structure and caps ------------------------------------------

test("the soft layer cap stops the loop without a done reply", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    ...layerReplies().slice(0, 1),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM }, { maxLayers: 2 });
  assert.equal(result.ok, true);
  assert.ok(result.map, "a capped map exists");
  assert.equal(result.map.layers.length, 2);
  assert.deepEqual(result.map.layers.map((layer) => layer.id), ["l0", "l1"]);
  assert.equal(requests.length, 2);
});

test("the layer cap is clamped to the validator's structural max", async () => {
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, DONE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM }, { maxLayers: 99 });
  assert.equal(result.ok, true);
  assert.ok(result.map, "a clamped map exists");
  assert.equal(result.map.layers.length, 1);
  assert.equal(requests.length, 2, "a huge cap must not explode the loop");
});

test("generated maps pass validateRealityMap and deriveCheck together", async () => {
  const { callLLM } = stubTransport(HAPPY_SCRIPT);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.ok(result.map, "a generated map exists");
  assert.equal(validateRealityMap(result.map).ok, true);
  assert.equal(deriveCheck(result.map).ok, true);
});

test("a skipped intermediate step is structurally impossible at the prompt level", async () => {
  const { callLLM, requests } = stubTransport(HAPPY_SCRIPT);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  for (let i = 1; i <= 5; i++) {
    const content = requests[i].messages[1].content;
    assert.match(content, new RegExp(`Build layer l${i}`), `call ${i} builds layer l${i}`);
    if (i > 1) {
      const below = laptopRealityMap.layers[i - 1].id;
      const belowNode = laptopRealityMap.nodes.find((node) => node.layer === below);
      assert.ok(belowNode && content.includes(belowNode.id), `call ${i} sees the layer below (${below})`);
    }
  }
});

/** A valid one-shot reply: a 2-layer chain that passes both gates. */
const ONE_SHOT_REPLY = JSON.stringify({
  isValidConcept: true,
  layers: [
    { id: "l0", name: "optics", nodes: ["n-lens"] },
    { id: "l1", name: "microscope", nodes: ["n-microscope"] },
  ],
  nodes: [
    {
      id: "n-lens",
      label: "lens",
      layer: "l0",
      description: "A piece of glass that bends light.",
      basis: {
        discoverer: { value: "Ibn al-Haytham", mark: "EXACT" },
        date: { value: "1011", mark: "APPROXIMATE" },
        keyObservation: { value: "Light bends when it passes from air into glass.", mark: "EXACT" },
        confidence: "high",
        note: "",
      },
    },
    {
      id: "n-microscope",
      label: "microscope",
      layer: "l1",
      description: "An instrument that magnifies small things.",
      basis: {
        discoverer: { value: "Zacharias Janssen", mark: "APPROXIMATE" },
        date: { value: "1595", mark: "APPROXIMATE" },
        keyObservation: { value: "Two lenses in a tube magnify a small object.", mark: "EXACT" },
        confidence: "medium",
        note: "",
      },
    },
  ],
  edges: [{ source: "n-microscope", target: "n-lens", type: "built-on" }],
});

/** A one-shot reply that fails the gates: a node with no observation record. */
const ONE_SHOT_BAD = JSON.stringify({
  isValidConcept: true,
  layers: [{ id: "l0", name: "optics", nodes: ["n-lens"] }],
  nodes: [{ id: "n-lens", label: "lens", layer: "l0", description: "A piece of glass." }],
  edges: [],
});

test("the one-shot fast path returns a valid map in a single call", async () => {
  const { callLLM, requests } = stubTransport([ONE_SHOT_REPLY]);
  const result = await generateRealityMap(
    { concept: "microscope", callLLM },
    { fastPath: true }
  );
  assert.equal(result.ok, true);
  assert.ok(result.map, "a one-shot map exists");
  assert.equal(result.generationPath, "oneshot");
  assert.equal(requests.length, 1, "one call, not one per layer");
  assert.equal(result.map.layers.length, 2);
  assert.equal(result.map.nodes.length, 2);
  assert.equal(result.map.layers[0].id, "l0");
  assert.equal(result.map.layers[1].id, "l1");
  assert.equal(validateRealityMap(result.map).ok, true);
  assert.equal(deriveCheck(result.map).ok, true);
});

test("the one-shot fast path falls back to the serial path when the map fails the gates", async () => {
  const { callLLM, requests } = stubTransport([ONE_SHOT_BAD, ...HAPPY_SCRIPT]);
  const result = await generateRealityMap(
    { concept: "laptop", callLLM },
    { fastPath: true }
  );
  assert.equal(result.ok, true);
  assert.equal(result.generationPath, "serial");
  assert.ok(requests.length > 1, "the serial path re-ran after the one-shot failed");
});

test("without fastPath the one-shot prompt is never sent", async () => {
  const { callLLM, requests } = stubTransport(HAPPY_SCRIPT);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.equal(result.generationPath, "serial");
  assert.ok(requests.every((request) => !request.messages[0].content.includes("complete Reality Map in ONE reply")));
});
