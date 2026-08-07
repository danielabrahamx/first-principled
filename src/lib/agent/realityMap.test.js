import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRealityMapSystemPrompt,
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

const ENVELOPED = JSON.stringify({
  isValidConcept: true,
  map: laptopRealityMap,
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

// --- prompt ----------------------------------------------------------------

test("prompt satisfies the JSON mode contract and the ticket asks", () => {
  const prompt = buildRealityMapSystemPrompt(6);
  assert.match(prompt, /\bjson\b/i);
  assert.match(prompt, /no skipped intermediate steps/);
  assert.match(prompt, /contiguous/);
  assert.match(prompt, /built-on/);
  assert.match(prompt, /part-of/);
  assert.match(prompt, /depends-on/);
  assert.match(prompt, /abstraction-of/);
  assert.match(prompt, /isValidConcept/);
  assert.match(prompt, /around 6 layers/i);
});

test("prompt honors a custom layer cap", () => {
  assert.match(buildRealityMapSystemPrompt(4), /around 4 layers/i);
});

// --- generation: happy paths ----------------------------------------------

test("an enveloped map is returned as-is", async () => {
  const { callLLM, requests } = stubTransport([ENVELOPED]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].jsonMode, true);
  assert.equal(requests[0].thinking, false);
});

test("a flat map without the envelope is accepted", async () => {
  const { callLLM } = stubTransport([JSON.stringify(laptopRealityMap)]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
});

test("a refusal is propagated without retry", async () => {
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

// --- generation: retry paths ----------------------------------------------

test("an unparseable first reply triggers repair attempts", async () => {
  const valid = JSON.stringify({ isValidConcept: true, map: laptopRealityMap });
  const { callLLM, requests } = stubTransport(["not json at all", "still not", valid]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.equal(requests.length, 3);
  assert.match(requests[1].messages[1].content, /did not meet the contract/);
});

test("a schema-invalid first map triggers a repair attempt that cites errors", async () => {
  const gapped = structuredClone(laptopRealityMap);
  gapped.edges = gapped.edges.filter(
    (e) => !(e.source === "n-logic-gate" && e.target === "n-circuit")
  );
  const { callLLM, requests } = stubTransport([
    JSON.stringify({ isValidConcept: true, map: gapped }),
    ENVELOPED,
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.match(requests[1].messages[1].content, /layer chain gap/);
});

test("a garbage edge is dropped by cleanup before validation", async () => {
  const dirty = structuredClone(laptopRealityMap);
  dirty.edges = [
    ...dirty.edges,
    { source: "n-app", target: "n-caption", type: "part-of" },
  ];
  const { callLLM, requests } = stubTransport([
    JSON.stringify({ isValidConcept: true, map: dirty }),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, false);
  assert.equal(requests.length, 1);
});

test("a third attempt narrows the repair instructions", async () => {
  const gapped = structuredClone(laptopRealityMap);
  gapped.edges = gapped.edges.filter(
    (e) => !(e.source === "n-logic-gate" && e.target === "n-circuit")
  );
  const bad = JSON.stringify({ isValidConcept: true, map: gapped });
  const { callLLM, requests } = stubTransport([bad, bad, ENVELOPED]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(result.map, laptopRealityMap);
  assert.equal(result.retried, true);
  assert.equal(requests.length, 3);
  assert.match(requests[2].messages[1].content, /final attempt/);
});

test("all attempts unparseable fails as invalid", async () => {
  const { callLLM } = stubTransport(["garbage", "more garbage", "still garbage"]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.equal(result.retried, true);
  assert.match(result.reason ?? "", /parseable JSON/);
});

test("all attempts schema-invalid fails with the validation errors", async () => {
  const gapped = structuredClone(laptopRealityMap);
  gapped.edges = gapped.edges.filter(
    (e) => !(e.source === "n-logic-gate" && e.target === "n-circuit")
  );
  const bad = JSON.stringify({ isValidConcept: true, map: gapped });
  const { callLLM } = stubTransport([bad, bad, bad]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.ok(result.errors.length > 0);
});

test("a refusal on a later attempt is honored", async () => {
  const gapped = structuredClone(laptopRealityMap);
  gapped.edges = gapped.edges.filter(
    (e) => !(e.source === "n-logic-gate" && e.target === "n-circuit")
  );
  const { callLLM, requests } = stubTransport([
    JSON.stringify({ isValidConcept: true, map: gapped }),
    JSON.stringify({ isValidConcept: false, reason: "not a concept after all" }),
  ]);
  const result = await generateRealityMap({ concept: "laptop", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "refused");
  assert.equal(result.reason, "not a concept after all");
  assert.equal(result.retried, true);
  assert.equal(requests.length, 2);
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

test("the default transport is wired when none is injected", async () => {
  const { callLLM } = stubTransport([ENVELOPED]);
  const result = await generateRealityMap(
    { concept: "laptop", callLLM },
    { thinking: false }
  );
  assert.equal(result.ok, true);
});

// --- live verification (opt-in: LIVE_LLM=1) --------------------------------

const live = process.env.LIVE_LLM === "1" ? test : test.skip;

/**
 * @param {string} concept
 * @returns {Promise<{ ok: boolean; latencyMs: number; layers: number; errors: string[]; kind: string | null }>}
 */
async function liveMap(concept) {
  const started = Date.now();
  const result = await generateRealityMap({ concept });
  const validation = result.ok ? validateRealityMap(result.map) : null;
  return {
    ok: result.ok,
    latencyMs: Date.now() - started,
    layers: result.ok ? /** @type {any} */ (result.map).layers.length : 0,
    errors: result.ok && validation ? validation.errors : result.errors,
    kind: result.kind,
  };
}

live("fixture word laptop: schema-valid, contiguous, under 30s", async () => {
  const got = await liveMap("laptop");
  assert.equal(got.ok, true);
  assert.deepEqual(got.errors, []);
  assert.ok(got.layers >= 3, `expected a real layer chain, got ${got.layers}`);
  assert.ok(got.layers <= 9, `layer chain too deep for the soft cap: ${got.layers}`);
  assert.ok(got.latencyMs < 30000, `latency ${got.latencyMs}ms exceeds 30s`);
});

live("fixture word recursion: schema-valid, contiguous, under 30s", async () => {
  const got = await liveMap("recursion");
  assert.equal(got.ok, true);
  assert.deepEqual(got.errors, []);
  assert.ok(got.layers <= 9, `layer chain too deep for the soft cap: ${got.layers}`);
  assert.ok(got.latencyMs < 30000, `latency ${got.latencyMs}ms exceeds 30s`);
});

live("fixture word photosynthesis: schema-valid, contiguous, under 30s", async () => {
  const got = await liveMap("photosynthesis");
  assert.equal(got.ok, true);
  assert.deepEqual(got.errors, []);
  assert.ok(got.layers <= 9, `layer chain too deep for the soft cap: ${got.layers}`);
  assert.ok(got.latencyMs < 30000, `latency ${got.latencyMs}ms exceeds 30s`);
});

live("gibberish input is refused, not mapped", async () => {
  const got = await liveMap("qwertyuiop");
  assert.equal(got.ok, false);
  assert.equal(got.kind, "refused");
});
