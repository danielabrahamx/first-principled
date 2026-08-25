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
  stageThinking,
  steProblems,
} from "./realityMap.js";
import { deterministicArrange } from "./arrange.js";
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
    {
      id: "e2",
      from_regimes: ["c2"],
      to_regimes: ["c2"],
      result: "A stable cell delivers steady current for a long time.",
      joint_kind: "ENGINEERED_RESULT",
      history: {
        certainty: "EXACT",
        who: ["John Frederic Daniell"],
        when: "1836",
        observation: "Copper and zinc cells with a porous barrier kept current steady.",
        uncertainty_note: "",
      },
      candidate_node: "Daniell cell",
    },
  ],
};

const EDGE_SET = {
  concept: "battery",
  edges: [
    {
      from: "e1",
      to: "c1",
      because: "The voltaic pile needs separated charge to sustain a circuit.",
      evidence_ids: ["e1"],
    },
    {
      from: "c2",
      to: "c1",
      because: "A controlled redox reaction needs separated charge to drive electron flow.",
      evidence_ids: [],
    },
    {
      from: "e2",
      to: "c2",
      because: "The Daniell cell rests on a controlled redox reaction.",
      evidence_ids: ["e2"],
    },
  ],
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

test("ox-alpha-style Epiphanies histories normalize to pass the gate", async () => {
  const broken = {
    concept: "battery",
    epiphanies: [
      {
        id: "e1",
        from_regimes: ["c1"],
        to_regimes: ["c2"],
        result: "Two metals and an electrolyte sustain a circuit.",
        joint_kind: "experimental result",
        history: {
          who: "Alessandro Volta",
          when: "1800",
          observation: "Alternating metal discs separated by brine produced continuous current.",
        },
        candidate_node: "voltaic pile",
      },
      {
        id: "e2",
        from_regimes: ["c2"],
        to_regimes: ["c2"],
        result: "A stable cell delivers steady current for a long time.",
        joint_kind: "ENGINEERED_RESULT",
        history: null,
        candidate_node: "Daniell cell",
      },
    ],
  };
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, broken, EDGE_SET]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, true, `expected ok, got ${result.kind}: ${JSON.stringify(result.errors)}`);
  const e1 = /** @type {any} */ (result.diagnostics).epiphanies.epiphanies[0];
  assert.equal(e1.joint_kind, "EXPERIMENTAL_RESULT");
  assert.deepEqual(e1.history.who, ["Alessandro Volta"]);
  assert.equal(e1.history.certainty, "EXACT");
  assert.equal(e1.history.uncertainty_note, "");
  const e2 = /** @type {any} */ (result.diagnostics).epiphanies.epiphanies[1];
  assert.equal(e2.history.certainty, "UNKNOWN");
  assert.deepEqual(e2.history.who, []);
  assert.ok(e2.history.uncertainty_note.length > 0);
  assert.equal(requests.length, 3);
});

test("thinkingByStage can send thinking off, on, off", async () => {  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, EPIPHANIES, EDGE_SET]);
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
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, EPIPHANIES, EDGE_SET]);
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
  assert.match(prompts[2], /one followable Dependence Tree/);
  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /cognitive distance|around \d+ layers|simplified technical English/i);
  }
});

test("prompt texts lock the honesty and edge-set contracts (ticket 11)", () => {
  const epiphanies = buildEpiphaniesSystemPrompt();
  assert.match(epiphanies, /Set certainty to EXACT only when/);
  assert.match(epiphanies, /Set certainty\s+to UNKNOWN when/);
  assert.match(epiphanies, /leave who,\s*when, and observation empty/);
  const arrange = buildArrangeSystemPrompt();
  assert.match(arrange, /the order of the inventory is meaningless|it was shuffled/i);
  assert.match(arrange, /edge-set|edges only|edges/i);
  assert.match(arrange, /layers/);
  assert.match(arrange, /trunk/);
  assert.match(arrange, /do not emit a timeline/i);
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
  const { callLLM, requests } = scriptedTransport([chronology, epiphanies, EDGE_SET]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.equal(requests.length, 3);
  assert.ok(result.diagnostics);
  assert.ok(result.map);
  assert.equal(result.diagnostics.chronology.chronology[1].ancestry_kind, "CONCEPTUAL");
  assert.equal(
    result.map?.nodes.find((/** @type {any} */ node) => node.id === "c1")?.role,
    "DOMAIN"
  );
  assert.equal(
    result.map?.nodes.find((/** @type {any} */ node) => node.id === "e1")?.role,
    "EPIPHANY"
  );
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
  assert.deepEqual(responseFormat.schema.properties.concept.enum, ["battery"]);
  const item = responseFormat.schema.properties.epiphanies.items;
  assert.equal(item.additionalProperties, false);
  assert.equal(item.properties.history.allOf, undefined);
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

test("Arrange gate checks trunk, reasons, roles, provenance, and use-or-drop accounting", () => {
  const normalized = deterministicArrange({
    concept: "battery",
    chronologyItems: CHRONOLOGY.chronology,
    epiphanyItems: EPIPHANIES.epiphanies,
    edges: EDGE_SET.edges,
  });
  const inputs = {
    concept: "battery",
    chronologyIds: new Set(["c1", "c2"]),
    epiphanyIds: new Set(["e1", "e2"]),
  };
  assert.deepEqual(arrangeCheck(normalized, inputs), { ok: true, errors: [] });

  const missingBecause = structuredClone(normalized);
  missingBecause.map.edges[0].because = "";
  assert.match(arrangeCheck(missingBecause, inputs).errors.join(" "), /non-empty because/);

  const unaccounted = structuredClone(normalized);
  unaccounted.provenance.nodes[1].input_refs = ["e1"];
  unaccounted.provenance.edges[1].input_refs = ["c1"];
  assert.match(arrangeCheck(unaccounted, inputs).errors.join(" "), /input "c2" is neither/);

  const badCombine = structuredClone(normalized);
  const epiphanyNode = /** @type {any} */ (
    badCombine.map.nodes.find((/** @type {any} */ node) => node.id === "e1")
  );
  epiphanyNode.combines = [{ id: "missing", observation: {} }];
  assert.match(arrangeCheck(badCombine, inputs).errors.join(" "), /invalid combines reference/);
});

test("generator makes exactly three serial calls and keeps diagnostics off the map", async () => {
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, EPIPHANIES, EDGE_SET]);
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
  const arrangePayload = JSON.parse(requests[2].messages[1].content);
  assert.equal(arrangePayload.concept, "battery");
  const inventoryItems = /** @type {any[]} */ (arrangePayload.inventory);
  assert.deepEqual(
    inventoryItems.map((/** @type {any} */ item) => item.id).sort(),
    ["c1", "c2", "e1", "e2"]
  );
  assert.deepEqual(
    inventoryItems.map((/** @type {any} */ item) => item.kind).sort(),
    ["joint", "joint", "regime", "regime"]
  );
  assert.equal(requests[2].jsonSchema.name, "arrange");
  assert.deepEqual(requests[2].jsonSchema.schema.properties.edges.items.required, [
    "from",
    "to",
    "because",
    "evidence_ids",
  ]);
  assert.equal(result.retried, false);
  assert.ok(result.diagnostics);
  assert.ok(result.map);
  assert.equal("provenance" in result.map, false);
  assert.equal("chronology" in result.map, false);
});

test("a failed stage repairs once with the gate errors fed back, then is terminal", async () => {
  const badChronology = { concept: "battery", chronology: [] };
  const { callLLM, requests } = scriptedTransport([badChronology, badChronology]);
  const result = await generateRealityMap({ concept: "battery", callLLM });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  // First attempt plus one repair attempt; the repair also fails, so no
  // later stage runs.
  assert.equal(requests.length, 2);
});

test("accepted stages publish learner-safe snapshots; a throwing publisher does not fail the map", async () => {
  const dirtyChronology = /** @type {any} */ (structuredClone(CHRONOLOGY));
  dirtyChronology.prompts = { system: "secret" };
  dirtyChronology.chronology[0].provenance = "hidden";
  const dirtyEpiphanies = /** @type {any} */ (structuredClone(EPIPHANIES));
  dirtyEpiphanies.discarded_input_ids = ["x"];
  dirtyEpiphanies.epiphanies[0].reasoning = "inner talk";

  /** @type {any[]} */
  const published = [];
  const { callLLM } = scriptedTransport([dirtyChronology, dirtyEpiphanies, EDGE_SET]);
  const result = await generateRealityMap(
    { concept: "battery", callLLM },
    {
      onStageSnapshot: async (stage, snapshot) => {
        published.push({ stage, snapshot });
        throw new Error("blob write failed");
      },
    }
  );
  assert.equal(result.ok, true, result.errors && result.errors.join(" | "));
  assert.equal(published.length, 2);
  assert.equal(published[0].stage, "chronology");
  assert.equal(published[0].snapshot.concept, "battery");
  assert.equal("prompts" in published[0].snapshot, false);
  assert.equal("provenance" in published[0].snapshot.chronology[0], false);
  assert.equal(published[1].stage, "epiphanies");
  assert.equal("discarded_input_ids" in published[1].snapshot, false);
  assert.equal("reasoning" in published[1].snapshot.epiphanies[0], false);
});

test("invalid Chronology does not publish a snapshot", async () => {
  const badChronology = { concept: "battery", chronology: [] };
  /** @type {any[]} */
  const published = [];
  const { callLLM } = scriptedTransport([badChronology]);
  const result = await generateRealityMap(
    { concept: "battery", callLLM },
    { onStageSnapshot: (stage, snapshot) => { published.push({ stage, snapshot }); } }
  );
  assert.equal(result.ok, false);
  assert.equal(published.length, 0);
});

test("invalid Epiphanies are terminal with no retry or Arrange call", async () => {
  const badEpiphanies = structuredClone(EPIPHANIES);
  badEpiphanies.epiphanies[0].from_regimes = ["regime-name"];
  const { callLLM, requests } = scriptedTransport([CHRONOLOGY, badEpiphanies, EDGE_SET]);
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
