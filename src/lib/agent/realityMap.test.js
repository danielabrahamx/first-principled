import { test } from "node:test";
import assert from "node:assert/strict";

import {
  arrangeCheck,
  buildArrangeSystemPrompt,
  buildChronologySystemPrompt,
  buildEpiphaniesJsonSchema,
  buildEpiphaniesSystemPrompt,
  chronologyProblems,
  deriveCheck,
  epiphaniesProblems,
  generateRealityMap,
  normalizeArrangement,
  stageThinking,
  steProblems,
} from "./realityMap.js";
import { laptopRealityMap } from "../mmg/fixtures.js";

const CHRONOLOGY = {
  concept: "battery",
  chronology: [
    {
      id: "c1",
      regime: "separated charge",
      new_capability: "stored electrical potential",
      enabled_by_previous: [],
      ancestry_kind: "PHYSICAL",
      target_relevance: "A battery needs charge separation.",
    },
    {
      id: "c2",
      regime: "controlled redox reaction",
      new_capability: "sustained electron flow",
      enabled_by_previous: ["c1"],
      ancestry_kind: "PHYSICAL",
      target_relevance: "A battery converts chemical potential into current.",
    },
  ],
};

const EPIPHANIES = {
  concept: "battery",
  epiphanies: [
    {
      id: "e1",
      from_regimes: ["c1"],
      to_regimes: ["c2"],
      result: "Two metals and an electrolyte sustain a circuit.",
      joint_kind: "EXPERIMENTAL_RESULT",
      history: {
        certainty: "EXACT",
        who: ["Alessandro Volta"],
        when: "1800",
        observation: "Alternating metal discs separated by brine produced continuous current.",
        uncertainty_note: "",
      },
      candidate_node: "voltaic pile",
    },
  ],
};

const ARRANGEMENT = {
  map: {
    concept: "battery",
    layers: [
      { id: "l0", name: "Foundation", nodes: ["n-charge"] },
      { id: "l1", name: "Stored current", nodes: ["n-battery"] },
    ],
    nodes: [
      {
        id: "n-charge",
        label: "charge separation",
        layer: "l0",
        description: "Separated charges create electrical potential.",
        role: "DOMAIN",
      },
      {
        id: "n-battery",
        label: "battery",
        layer: "l1",
        description: "A controlled reaction sustains current through a circuit.",
        role: "EPIPHANY",
        basis: {
          discoverer: { value: "invented", mark: "EXACT" },
          date: { value: "invented", mark: "EXACT" },
          keyObservation: { value: "invented", mark: "EXACT" },
          confidence: "high",
          note: "",
        },
      },
    ],
    edges: [
      {
        source: "n-battery",
        target: "n-charge",
        type: "depends-on",
        because: "A battery needs separated charge to drive electron flow.",
      },
    ],
    trunk: ["n-charge", "n-battery"],
  },
  provenance: {
    nodes: [
      { node_id: "n-charge", input_refs: ["c1"] },
      { node_id: "n-battery", input_refs: ["c2", "e1"] },
    ],
    edges: [
      { source: "n-battery", target: "n-charge", input_refs: ["c1", "c2", "e1"] },
    ],
    discarded_input_ids: [],
  },
};

/** @param {any[]} values */
function scriptedTransport(values) {
  const queue = values.map((value) => JSON.stringify(value));
  const requests = /** @type {any[]} */ ([]);
  return {
    requests,
    callLLM: async (/** @type {any} */ request) => {
      requests.push(request);
      const content = queue.shift();
      if (content === undefined) throw new Error("unexpected extra LLM call");
      return { content };
    },
  };
}

test("maps default to thinking off; thinkingByStage can turn one stage on", () => {
  assert.equal(stageThinking("chronology", {}), false);
  assert.equal(stageThinking("epiphanies", {}), false);
  assert.equal(stageThinking("arrange", {}), false);
  assert.equal(stageThinking("epiphanies", { thinking: false }), false);
  assert.equal(stageThinking("chronology", { thinking: true }), true);
  assert.equal(stageThinking("epiphanies", { thinkingByStage: { epiphanies: true } }), true);
  assert.equal(stageThinking("arrange", { thinkingByStage: { arrange: true } }), true);
});

test("thinkingByStage can send thinking off, on, off", async () => {
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, EPIPHANIES, ARRANGEMENT]);
  const result = await generateRealityMap(
    { concept: "battery", callLLM },
    { thinkingByStage: { chronology: false, epiphanies: true, arrange: false } }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    requests.map((request) => request.thinking),
    [false, true, false]
  );
});

test("generator default sends thinking off on every stage", async () => {
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, EPIPHANIES, ARRANGEMENT]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, true);
  assert.deepEqual(
    requests.map((request) => request.thinking),
    [false, false, false]
  );
});

test("locked stage prompts contain no mission, layer count, or STE copy", () => {
  const prompts = [
    buildChronologySystemPrompt(),
    buildEpiphaniesSystemPrompt(),
    buildArrangeSystemPrompt(),
  ];
  assert.match(prompts[0], /target-specific capability regimes/);
  assert.match(prompts[1], /A result is the joint/);
  assert.match(prompts[2], /one followable\nDependence Tree/);
  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /cognitive distance|around \d+ layers|simplified technical English/i);
  }
});

test("Chronology contract requires ordered c ids and backward-only references", () => {
  assert.deepEqual(chronologyProblems(CHRONOLOGY, "battery"), []);
  const bad = structuredClone(CHRONOLOGY);
  bad.chronology[0].enabled_by_previous = ["c2"];
  assert.match(chronologyProblems(bad, "battery").join(" "), /non-earlier/);
});

test("generator accepts lowercase stage enums as the same contract tokens", async () => {
  const chronology = structuredClone(CHRONOLOGY);
  chronology.chronology[0].ancestry_kind = "physical";
  chronology.chronology[1].ancestry_kind = "conceptual";
  const epiphanies = structuredClone(EPIPHANIES);
  epiphanies.epiphanies[0].joint_kind = "experimental result";
  epiphanies.epiphanies[0].history.certainty = "exact";
  const arrangement = structuredClone(ARRANGEMENT);
  arrangement.map.nodes[0].role = "domain";
  arrangement.map.nodes[1].role = "epiphany";
  const { callLLM, requests } = scriptedTransport([chronology, epiphanies, arrangement]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.equal(requests.length, 3);
  assert.ok(result.diagnostics);
  assert.ok(result.map);
  assert.equal(result.diagnostics.chronology.chronology[1].ancestry_kind, "CONCEPTUAL");
  assert.equal(result.map.nodes[0].role, "DOMAIN");
  assert.equal(result.map.nodes[1].role, "EPIPHANY");
});

test("Epiphanies contract enforces honest history and Stage 1 references", () => {
  const ids = new Set(["c1", "c2"]);
  assert.deepEqual(epiphaniesProblems(EPIPHANIES, "battery", ids), []);
  const bad = structuredClone(EPIPHANIES);
  bad.epiphanies[0].history.certainty = "UNKNOWN";
  assert.match(epiphaniesProblems(bad, "battery", ids).join(" "), /UNKNOWN requires/);
});

test("Epiphanies schema locks the Stage 2 fields and live Chronology ids", () => {
  const responseFormat = buildEpiphaniesJsonSchema("battery", new Set(["c1", "c2"]));
  assert.equal(responseFormat.name, "epiphanies");
  assert.equal(responseFormat.strict, true);
  assert.equal(responseFormat.schema.properties.concept.const, "battery");
  const item = responseFormat.schema.properties.epiphanies.items;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.required, [
    "id",
    "from_regimes",
    "to_regimes",
    "result",
    "joint_kind",
    "history",
    "candidate_node",
  ]);
  assert.deepEqual(item.properties.from_regimes.items.enum, ["c1", "c2"]);
  assert.deepEqual(item.properties.to_regimes.items.enum, ["c1", "c2"]);
  assert.deepEqual(item.properties.joint_kind.enum, [
    "OBSERVATION",
    "EXPERIMENTAL_RESULT",
    "ENGINEERED_RESULT",
    "FORMALIZATION",
    "PROOF",
    "GRADUAL_SYNTHESIS",
    "NO_SINGLE_JOINT",
  ]);
  assert.deepEqual(item.properties.history.properties.certainty.enum, [
    "EXACT",
    "APPROXIMATE",
    "UNKNOWN",
  ]);
  assert.deepEqual(item.properties.history.properties.observation.type, ["string", "null"]);
});

test("Arrange normalization rebuilds EPIPHANY basis from cited Stage 2 history", () => {
  const normalized = normalizeArrangement(
    structuredClone(ARRANGEMENT),
    new Map([["e1", EPIPHANIES.epiphanies[0]]])
  );
  const crown = normalized.map.nodes.find((/** @type {any} */ node) => node.id === "n-battery");
  assert.equal(crown.basis.discoverer.value, "Alessandro Volta");
  assert.equal(crown.basis.date.value, "1800");
  assert.doesNotMatch(JSON.stringify(crown.basis), /invented/);
});

test("Arrange gate checks trunk, reasons, roles, provenance, and use-or-drop accounting", () => {
  const normalized = normalizeArrangement(
    structuredClone(ARRANGEMENT),
    new Map([["e1", EPIPHANIES.epiphanies[0]]])
  );
  const inputs = {
    concept: "battery",
    chronologyIds: new Set(["c1", "c2"]),
    epiphanyIds: new Set(["e1"]),
  };
  assert.deepEqual(arrangeCheck(normalized, inputs), { ok: true, errors: [] });

  const missingBecause = structuredClone(normalized);
  missingBecause.map.edges[0].because = "";
  assert.match(arrangeCheck(missingBecause, inputs).errors.join(" "), /non-empty because/);

  const unaccounted = structuredClone(normalized);
  unaccounted.provenance.nodes[1].input_refs = ["e1"];
  unaccounted.provenance.edges[0].input_refs = ["c1", "e1"];
  assert.match(arrangeCheck(unaccounted, inputs).errors.join(" "), /input "c2" is neither/);

  const badCombine = structuredClone(normalized);
  badCombine.map.nodes[1].combines = [{ id: "missing", observation: {} }];
  assert.match(arrangeCheck(badCombine, inputs).errors.join(" "), /invalid combines reference/);
});

test("generator makes exactly three serial calls and keeps diagnostics off the map", async () => {
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, EPIPHANIES, ARRANGEMENT]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 3);
  assert.match(requests[0].messages[0].content, /capability regimes/);
  assert.equal(requests[0].jsonSchema, undefined);
  assert.deepEqual(JSON.parse(requests[1].messages[1].content), CHRONOLOGY);
  assert.deepEqual(
    requests[1].jsonSchema.schema.properties.epiphanies.items.properties.from_regimes.items.enum,
    ["c1", "c2"]
  );
  assert.equal(JSON.parse(requests[2].messages[1].content).epiphanies[0].id, "e1");
  assert.equal(requests[2].jsonSchema, undefined);
  assert.equal(result.retried, false);
  assert.ok(result.diagnostics);
  assert.ok(result.map);
  assert.equal("provenance" in result.map, false);
  assert.equal("chronology" in result.map, false);
});

test("a failed stage is terminal with no retry or later call", async () => {
  const badChronology = { concept: "battery", chronology: [] };
  const { callLLM, requests } = scriptedTransport([badChronology, EPIPHANIES, ARRANGEMENT]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.equal(requests.length, 1);
  assert.equal(result.retried, false);
});

test("invalid Epiphanies are terminal with no retry or Arrange call", async () => {
  const badEpiphanies = structuredClone(EPIPHANIES);
  badEpiphanies.epiphanies[0].from_regimes = ["regime-name"];
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, badEpiphanies, ARRANGEMENT]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.match(result.errors.join(" "), /unknown id/);
  assert.equal(requests.length, 2);
  assert.equal(result.retried, false);
});

test("transport errors are terminal and do not leak into a map", async () => {
  let calls = 0;
  const result = await generateRealityMap({
    concept: "battery",
    callLLM: async () => {
      calls += 1;
      throw new Error("provider failed");
    },
  });
  assert.equal(result.kind, "error");
  assert.equal(result.map, null);
  assert.equal(calls, 1);
});

test("legacy derivability remains available for persisted v6 control maps", () => {
  assert.equal(deriveCheck(laptopRealityMap).ok, true);
});

test("STE audit remains available for legacy copy tests", () => {
  assert.deepEqual(steProblems("A short sentence.").errors, []);
  assert.match(steProblems("This isn't allowed.").errors.join(" "), /contraction/);
});
