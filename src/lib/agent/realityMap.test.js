import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFoundationSystemPrompt,
  buildRealityMapSystemPrompt,
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
  const requests = /** @type {any[]} */ ([]);
  const callLLM = async (/** @type {any} */ request) => {
    requests.push(request);
    const content = replies.shift();
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

/** The phase-B derive reply: the full laptop map, self-reviewed derivable. */
const DERIVE_REPLY = JSON.stringify({
  isValidConcept: true,
  map: laptopRealityMap,
  selfReview: { derivable: true, gaps: [] },
});

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

test("the derive prompt satisfies the JSON mode contract and the v2 asks", () => {
  const prompt = buildRealityMapSystemPrompt(6);
  assert.match(prompt, /\bjson\b/i);
  assert.match(prompt, /no skipped intermediate steps/);
  assert.match(prompt, /foundation/i);
  assert.match(prompt, /basis/i, "every abstraction names the observation it compresses");
  assert.match(prompt, /predicts/i, "testable predictions are emitted (principle 2)");
  assert.match(prompt, /self-review/i);
  assert.match(prompt, /built-on|depends-on|part-of|abstraction-of|predicts|contradicts/);
  assert.match(prompt, /around 6 layers/i);
});

test("the derive prompt honors a custom layer cap", () => {
  assert.match(buildRealityMapSystemPrompt(4), /around 4 layers/i);
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

test("a two-phase generation returns the map as-is with two calls", async () => {
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, false);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].jsonMode, true);
  assert.equal(requests[0].thinking, false);
  assert.match(requests[0].messages[1].content, /Word or phrase: laptop/);
  assert.match(requests[1].messages[1].content, /Derive the remaining layers/);
});

test("a refusal in phase A is propagated without a derive call", async () => {
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

// --- generation: retry paths -------------------------------------------------

test("an unparseable phase A triggers one foundation repair, then derives", async () => {
  const { callLLM, requests } = stubTransport(["not json at all", FOUNDATION_REPLY, DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.equal(requests.length, 3);
  assert.match(requests[1].messages[1].content, /did not meet the contract/);
});

test("an unparseable phase B triggers a repair attempt that cites JSON", async () => {
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, "not json", DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.equal(requests.length, 3);
  assert.match(requests[2].messages[1].content, /not valid JSON/);
});

test("a schema-invalid phase B triggers a repair citing the layer chain gap", async () => {
  const gapped = structuredClone(laptopRealityMap);
  gapped.edges = gapped.edges.filter(
    (edge) => !(edge.source === "n-logic-gate" && edge.target === "n-circuit")
  );
  const bad = JSON.stringify({
    isValidConcept: true,
    map: gapped,
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, bad, DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /layer chain gap/);
});

test("a missing basis triggers a repair citing principle 5", async () => {
  const noBasis = structuredClone(laptopRealityMap);
  noBasis.nodes = noBasis.nodes.map((node) =>
    node.id === "n-logic-gate" ? { ...node, basis: undefined } : node
  );
  const bad = JSON.stringify({
    isValidConcept: true,
    map: noBasis,
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, bad, DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /has no basis/);
});

test("a self-review that is not derivable triggers a repair", async () => {
  const bad = JSON.stringify({
    isValidConcept: true,
    map: laptopRealityMap,
    selfReview: { derivable: false, gaps: ["the OS layer skips the bit layer"] },
  });
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, bad, DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.match(requests[2].messages[1].content, /skips the bit layer/);
});

test("a garbage edge is dropped by cleanup before validation", async () => {
  const dirty = structuredClone(laptopRealityMap);
  dirty.edges = [...dirty.edges, { source: "n-app", target: "n-caption", type: "part-of" }];
  const dirtyReply = JSON.stringify({
    isValidConcept: true,
    map: dirty,
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([FOUNDATION_REPLY, dirtyReply]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, false);
  assert.equal(requests.length, 2);
});

test("a refusal on a later phase-B attempt is honored", async () => {
  const gapped = structuredClone(laptopRealityMap);
  gapped.edges = gapped.edges.filter(
    (edge) => !(edge.source === "n-logic-gate" && edge.target === "n-circuit")
  );
  const bad = JSON.stringify({
    isValidConcept: true,
    map: gapped,
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM, requests } = stubTransport([
    FOUNDATION_REPLY,
    bad,
    JSON.stringify({ isValidConcept: false, reason: "not a concept after all" }),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "refused");
  assert.equal(result.reason, "not a concept after all");
  assert.equal(result.retried, true);
  assert.equal(requests.length, 3);
});

test("all derive attempts invalid fails with the validation and derive errors", async () => {
  const noBasis = structuredClone(laptopRealityMap);
  noBasis.nodes = noBasis.nodes.map((node) =>
    node.id === "n-logic-gate" ? { ...node, basis: undefined } : node
  );
  const bad = JSON.stringify({
    isValidConcept: true,
    map: noBasis,
    selfReview: { derivable: true, gaps: [] },
  });
  const { callLLM } = stubTransport([FOUNDATION_REPLY, bad, bad, bad]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((error) => /has no basis/.test(error)));
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

test("generated maps pass validateRealityMap and deriveCheck together", async () => {
  const { callLLM } = stubTransport([FOUNDATION_REPLY, DERIVE_REPLY]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.equal(validateRealityMap(result.map).ok, true);
  assert.equal(deriveCheck(result.map).ok, true);
});
