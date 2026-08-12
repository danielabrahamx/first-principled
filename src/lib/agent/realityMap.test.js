import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFoundationSystemPrompt,
  buildNextLayerSystemPrompt,
  deriveCheck,
  generateRealityMap,
} from "./realityMap.js";
import { extractBalancedObject, parseModelJson } from "./jsonParse.js";
import { validateRealityMap } from "../mmg/validator.js";
import { laptopRealityMap } from "../mmg/fixtures.js";

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
});

test("the next-layer prompt satisfies the JSON mode contract and the ticket asks", () => {
  const prompt = buildNextLayerSystemPrompt(6);
  assert.match(prompt, /\bjson\b/i);
  assert.match(prompt, /layer by layer/i);
  assert.match(prompt, /ONLY from the layer/i, "each layer derives only from the layer below");
  assert.match(prompt, /skip an intermediate step/i, "skipping is forbidden, not just checked");
  assert.match(prompt, /basis/i, "every abstraction names the observation it compresses");
  assert.match(prompt, /predicts/i, "testable predictions are emitted (principle 2)");
  assert.match(prompt, /done/i, "the model can declare the concept reached");
  assert.match(prompt, /around 6 layers/i);
  assert.match(prompt, /built-on|depends-on|part-of|abstraction-of|predicts|contradicts/);
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

test("deriveCheck requires a basis above the foundation but not on it", () => {
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
  assert.equal(deriveCheck(noFoundationBasis).ok, true, "foundation nodes need no basis");
});

test("deriveCheck is structural on garbage input", () => {
  const check = deriveCheck({});
  assert.equal(check.ok, false);
  assert.ok(check.errors.length > 0);
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

test("each layer call sees only the layer immediately below it", async () => {
  const { callLLM, requests } = stubTransport(HAPPY_SCRIPT);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  const l2Call = requests[2].messages[1].content;
  assert.match(l2Call, /Build layer l2/);
  assert.match(l2Call, /n-silicon/, "l2 sees the layer below (materials)");
  assert.ok(!l2Call.includes("n-transistor"), "l2 must not see its own nodes");
  assert.ok(!l2Call.includes("n-electricity"), "l2 must not see the foundation");
  const l4Call = requests[4].messages[1].content;
  assert.match(l4Call, /Build layer l4/);
  assert.match(l4Call, /n-bit/, "l4 sees the layer below (logic)");
  assert.ok(!l4Call.includes("n-electricity"), "l4 must not see the foundation");
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
    selfReview: { derivable: false, gaps: ["the layer skips the bit layer"] },
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
  assert.match(requests[2].messages[1].content, /skips the bit layer/);
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

test("a refusal on a later layer attempt is honored", async () => {
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    brokenLayerReply("l1"),
    JSON.stringify({ isValidConcept: false, reason: "not a concept after all" }),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "refused");
  assert.equal(result.reason, "not a concept after all");
  assert.equal(result.retried, true);
  assert.equal(requests.length, 3);
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
  const { callLLM } = stubTransport(["garbage", "more garbage"]);
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
