import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildArrangeJsonSchema,
  deterministicArrange,
  edgeSetProblems,
  listnessProblems,
  normalizeConnect,
  shuffleInventory,
} from "./arrange.js";
import { arrangeCheck } from "./realityMap.js";

const fixtures = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "arrange-fixtures.json"), "utf8")
);

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

const INVENTORY = new Set(["c1", "c2", "e1", "e2"]);
const EPIPHANY_IDS = new Set(["e1", "e2"]);

/**
 * Minimal validator for the OpenRouter strict JSON Schema subset used here
 * (type, enum, required, additionalProperties, properties, items). Test-only.
 *
 * @param {unknown} value
 * @param {any} schema
 * @returns {string[]}
 */
function conformsToSchema(value, schema) {
  const errors = /** @type {string[]} */ ([]);
  /** @param {unknown} value @param {any} schema @param {string} where */
  const check = (value, schema, where) => {
    if (schema.type === "string") {
      if (typeof value !== "string") {
        errors.push(`${where}: expected string`);
        return;
      }
      if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        errors.push(`${where}: "${value}" not in enum`);
      }
      return;
    }
    if (schema.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`${where}: expected array`);
        return;
      }
      value.forEach((item, index) => check(item, schema.items, `${where}[${index}]`));
      return;
    }
    if (schema.type === "object") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${where}: expected object`);
        return;
      }
      const record = /** @type {Record<string, unknown>} */ (value);
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in schema.properties)) errors.push(`${where}: unexpected key "${key}"`);
        }
      }
      for (const [key, sub] of Object.entries(schema.properties)) {
        check(record[key], sub, `${where}.${key}`);
      }
      for (const key of schema.required ?? []) {
        if (!(key in record)) errors.push(`${where}: missing required "${key}"`);
      }
    }
  };
  check(value, schema, "$");
  return errors;
}

test("listness flags the three captured Arrange outputs (flat lists, no layers)", () => {
  for (const key of ["capturedLaptop", "capturedBattery", "capturedRecursion"]) {
    const errors = listnessProblems(fixtures[key]);
    assert.match(errors.join(" "), /no layers/, key);
  }
});

test("listness flags the v6 one-shot maps (chronological layers)", () => {
  const laptop = listnessProblems(fixtures.v6Laptop);
  assert.ok(laptop.length > 0, "v6 laptop must be flagged");
  const battery = listnessProblems(fixtures.v6Battery);
  assert.ok(battery.length > 0, "v6 battery must be flagged");
});

test("listness passes the fixture arrangement (branching crown, 3 layers)", () => {
  const { map } = deterministicArrange({
    concept: "battery",
    chronologyItems: CHRONOLOGY.chronology,
    epiphanyItems: EPIPHANIES.epiphanies,
    edges: EDGE_SET.edges,
  });
  assert.deepEqual(listnessProblems(map), []);
});

test("listness flags a model chain edge-set after deterministic arrange", () => {
  const { map } = deterministicArrange({
    concept: "battery",
    chronologyItems: CHRONOLOGY.chronology,
    epiphanyItems: EPIPHANIES.epiphanies,
    edges: [
      { from: "e1", to: "c1", because: "a", evidence_ids: ["e1"] },
      { from: "c2", to: "e1", because: "b", evidence_ids: [] },
      { from: "e2", to: "c2", because: "c", evidence_ids: ["e2"] },
    ],
  });
  assert.match(listnessProblems(map).join(" "), /timeline|storybook/);
});

test("Arrange JSON Schema locks the edge-set contract", () => {
  const schema = buildArrangeJsonSchema("battery", INVENTORY, EPIPHANY_IDS);
  assert.equal(schema.name, "arrange");
  assert.equal(schema.strict, true);
  assert.deepEqual(schema.schema.properties.concept.enum, ["battery"]);
  const item = schema.schema.properties.edges.items;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.properties.from.enum, ["c1", "c2", "e1", "e2"]);
  assert.deepEqual(item.properties.to.enum, ["c1", "c2", "e1", "e2"]);
  assert.deepEqual(item.properties.evidence_ids.items.enum, ["e1", "e2"]);
  assert.deepEqual(item.required, ["from", "to", "because", "evidence_ids"]);
  assert.deepEqual(schema.schema.required, ["concept", "edges"]);
});

test("Arrange JSON Schema rejects the three captured arrangements", () => {
  const schema = buildArrangeJsonSchema("laptop", new Set(["c1", "c2"]), new Set(["e1"]));
  for (const key of ["capturedLaptop", "capturedBattery", "capturedRecursion"]) {
    const captured = {
      map: { nodes: fixtures[key].nodes, edges: fixtures[key].edges },
      provenance: { nodes: [], edges: [], discarded_input_ids: [] },
    };
    assert.ok(conformsToSchema(captured, schema.schema).length > 0, key);
  }
});

test("Arrange JSON Schema accepts the fixture edge-set", () => {
  const schema = buildArrangeJsonSchema("battery", INVENTORY, EPIPHANY_IDS);
  assert.deepEqual(conformsToSchema(EDGE_SET, schema.schema), []);
});

test("edgeSetProblems accepts a valid edge-set and rejects contract breaks", () => {
  assert.deepEqual(edgeSetProblems(EDGE_SET, "battery", INVENTORY, EPIPHANY_IDS), []);
  const bad = structuredClone(EDGE_SET);
  bad.concept = "phone";
  assert.match(edgeSetProblems(bad, "battery", INVENTORY, EPIPHANY_IDS).join(" "), /concept must match/);
  bad.edges[0].from = "c9";
  assert.match(edgeSetProblems(bad, "battery", INVENTORY, EPIPHANY_IDS).join(" "), /not an inventory id/);
  bad.edges[0].evidence_ids = ["c1"];
  assert.match(edgeSetProblems(bad, "battery", INVENTORY, EPIPHANY_IDS).join(" "), /not an epiphany id/);
  bad.edges[0].because = "";
  assert.match(edgeSetProblems(bad, "battery", INVENTORY, EPIPHANY_IDS).join(" "), /non-empty because/);
  bad.edges[0].to = "e1";
  bad.edges[0].from = "e1";
  assert.match(edgeSetProblems(bad, "battery", INVENTORY, EPIPHANY_IDS).join(" "), /self-loop/);
  assert.match(edgeSetProblems({ concept: "battery", edges: [] }, "battery", INVENTORY, EPIPHANY_IDS).join(" "), /must not be empty/);
});

test("normalizeConnect tolerates ragged model output", () => {
  const normalized = normalizeConnect({ concept: "battery", edges: [{ from: "c2", to: "c1" }, "junk"] });
  assert.equal(normalized.edges.length, 1);
  assert.equal(normalized.edges[0].because, "");
  assert.deepEqual(normalized.edges[0].evidence_ids, []);
});

test("deterministic Arrange emits a conformant map for the fixture", () => {
  const arrangement = deterministicArrange({
    concept: "battery",
    chronologyItems: CHRONOLOGY.chronology,
    epiphanyItems: EPIPHANIES.epiphanies,
    edges: EDGE_SET.edges,
  });
  const { map } = arrangement;
  const gate = arrangeCheck(arrangement, {
    concept: "battery",
    chronologyIds: new Set(["c1", "c2"]),
    epiphanyIds: new Set(["e1", "e2"]),
  });
  assert.deepEqual(gate, { ok: true, errors: [] });
  assert.deepEqual(
    map.nodes.map((node) => node.id),
    ["c1", "c2", "e1", "e2", "target"]
  );
  assert.deepEqual(map.layers.map((layer) => layer.id), ["l0", "l1", "l2"]);
  assert.deepEqual([...map.layers[0].nodes].sort(), ["c1", "c2"]);
  assert.deepEqual([...map.layers[1].nodes].sort(), ["e1", "e2"]);
  assert.deepEqual(map.layers[2].nodes, ["target"]);
  assert.equal(map.trunk?.[0], "c1");
  assert.equal(map.trunk?.[map.trunk.length - 1], "target");
  assert.deepEqual(map.trunk, ["c1", "e1", "target"]);
  const crown = /** @type {any} */ (map.nodes.find((node) => node.id === "target"));
  assert.equal(crown.label, "battery");
  const epiphany = /** @type {any} */ (map.nodes.find((node) => node.id === "e1"));
  assert.equal(epiphany.basis.discoverer.value, "Alessandro Volta");
  assert.equal(epiphany.basis.date.value, "1800");
  assert.equal(epiphany.basis.confidence, "high");
  const daniell = /** @type {any} */ (map.nodes.find((node) => node.id === "e2"));
  assert.equal(daniell.basis.discoverer.value, "John Frederic Daniell");
  assert.equal(
    (/** @type {any} */ (map.nodes.find((node) => node.id === "c1"))).role,
    "DOMAIN"
  );
  assert.equal(epiphany.role, "EPIPHANY");
});

test("deterministic Arrange breaks directed cycles by dropping the weakest edge", () => {
  const arrangement = deterministicArrange({
    concept: "battery",
    chronologyItems: CHRONOLOGY.chronology,
    epiphanyItems: EPIPHANIES.epiphanies,
    edges: [
      { from: "e1", to: "c1", because: "a", evidence_ids: ["e1"] },
      { from: "c2", to: "e1", because: "b", evidence_ids: [] },
      { from: "c1", to: "c2", because: "c", evidence_ids: [] },
    ],
  });
  const { map } = arrangement;
  const gate = arrangeCheck(arrangement, {
    concept: "battery",
    chronologyIds: new Set(["c1", "c2"]),
    epiphanyIds: new Set(["e1", "e2"]),
  });
  assert.deepEqual(gate, { ok: true, errors: [] });
  const modelEdges = map.edges.filter((edge) => edge.source !== "target");
  assert.equal(modelEdges.length, 2, "one cycle edge must be dropped");
});

test("deterministic Arrange emits a conformant map for the captured gold-word stages", () => {
  for (const word of ["laptop", "battery", "recursion"]) {
    const stages = fixtures[`stages${word[0].toUpperCase()}${word.slice(1)}`];
    const chronology = stages.chronology.chronology;
    const epiphanies = stages.epiphanies.epiphanies;
    const concept = stages.chronology.concept;
    const edges = [];
    for (const /** @type {any} */ item of chronology) {
      for (const ref of item.enabled_by_previous) {
        edges.push({ from: item.id, to: ref, because: "Regime is enabled by the earlier regime.", evidence_ids: [] });
      }
    }
    for (const /** @type {any} */ item of epiphanies) {
      for (const ref of item.from_regimes) {
        edges.push({ from: item.id, to: ref, because: "The joint rests on its source regime.", evidence_ids: [item.id] });
      }
      for (const ref of item.to_regimes) {
        edges.push({ from: ref, to: item.id, because: "The target regime rests on the joint.", evidence_ids: [item.id] });
      }
    }
    const arrangement = deterministicArrange({ concept, chronologyItems: chronology, epiphanyItems: epiphanies, edges });
    const gate = arrangeCheck(arrangement, {
      concept,
      chronologyIds: new Set(chronology.map((/** @type {any} */ item) => item.id)),
      epiphanyIds: new Set(epiphanies.map((/** @type {any} */ item) => item.id)),
    });
    assert.deepEqual(gate, { ok: true, errors: [] }, `${word} deterministic arrange must pass the gate`);
  }
});

test("shuffleInventory is a permutation of the input", () => {
  const items = [
    { id: "c1" },
    { id: "c2" },
    { id: "e1" },
    { id: "c3" },
    { id: "e2" },
  ];
  const shuffled = shuffleInventory(items);
  assert.equal(shuffled.length, items.length);
  assert.deepEqual(
    shuffled.map((item) => item.id).sort(),
    items.map((item) => item.id).sort()
  );
});
