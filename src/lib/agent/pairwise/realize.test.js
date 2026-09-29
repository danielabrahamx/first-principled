import { test } from "node:test";
import assert from "node:assert/strict";

import { TARGET_ID } from "./pairs.js";
import {
  buildRealizeJsonSchema,
  buildRealizeSystemPrompt,
  buildRealizeUserPayload,
  normalizeRealize,
  realizeProblems,
  realizeTree,
} from "./realize.js";
import { selectTopology } from "./topology.js";

const NODES = [
  { id: TARGET_ID, label: "laptop", gloss: "The typed concept under study.", kind: "typed target" },
  { id: "k1", label: "central processing unit", gloss: "The chip that runs instructions.", kind: "hardware" },
  { id: "k2", label: "transistor", gloss: "A switch made from a semiconductor.", kind: "hardware" },
  { id: "k3", label: "binary number system", gloss: "Two symbols standing for any quantity.", kind: "rule" },
];

const EDGES = [
  { id: "e1", source: TARGET_ID, target: "k1" },
  { id: "e2", source: "k1", target: "k2" },
  { id: "e3", source: "k2", target: "k3" },
];

/**
 * @param {string} id
 * @param {string} heading
 * @param {string} gloss
 */
function card(id, heading, gloss) {
  return { id, heading, gloss };
}

/**
 * @param {string} id
 * @param {string} because
 */
function warrant(id, because) {
  return { id, because };
}

function validReply() {
  return {
    concept: "laptop",
    node_copy: [
      card(TARGET_ID, "laptop", "A laptop is a computer you carry and open on a desk to work."),
      card("k1", "the processor", "The processor is the chip that carries out each instruction a program asks for."),
      card("k2", "the transistor", "A transistor is a tiny switch that lets a chip control the flow of electricity."),
      card("k3", "binary", "Binary is the two-symbol number system a machine uses to hold every value it works with."),
    ],
    edge_copy: [
      warrant("e1", "A laptop cannot do anything useful without a processor to run its programs."),
      warrant("e2", "A processor is built out of transistors that switch electricity on and off for it."),
      warrant("e3", "A transistor switches between two states, so it needs a way to name those two states."),
    ],
  };
}

test("realize prompt asks for copy and forbids choosing the shape", () => {
  const prompt = buildRealizeSystemPrompt();
  assert.match(prompt, /Never add, drop, merge, or\s+reorder/);
  assert.match(prompt, /No contractions/);
});

test("user payload carries the selected ids and nothing structural", () => {
  const payload = buildRealizeUserPayload("laptop", NODES, EDGES);
  assert.equal(payload.concept, "laptop");
  assert.deepEqual(payload.nodes.map((node) => node.id), NODES.map((node) => node.id));
  assert.deepEqual(payload.edges.map((edge) => edge.id), EDGES.map((edge) => edge.id));
  // The model is shown labels and glosses, not ranks or trunk position.
  // Rank is a layout fact and layout is r5's business.
  assert.ok(!("ranks" in payload));
  assert.ok(!("trunk" in payload));
});

test("a complete reply passes the gate", () => {
  assert.deepEqual(realizeProblems(validReply(), NODES, EDGES), []);
});

test("schema restricts ids to the selected sets", () => {
  const schema = buildRealizeJsonSchema(NODES, EDGES);
  assert.equal(schema.strict, true);
  const nodeItems = schema.schema.properties.node_copy.items;
  const edgeItems = schema.schema.properties.edge_copy.items;
  assert.deepEqual(nodeItems.properties.id.enum, NODES.map((node) => node.id));
  assert.deepEqual(edgeItems.properties.id.enum, EDGES.map((edge) => edge.id));
});

test("a hallucinated node id is a gate failure, not a dropped row", () => {
  // The whole boundary. The model is writing copy for a shape code
  // already chose. If it names an id topology never selected it has
  // crossed into r2, and the honest answer is failure.
  const reply = validReply();
  reply.node_copy.push(card("k9", "the flux capacitor", "A device that stores flux in a field."));
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /names id "k9", which topology did not select/);
});

test("a hallucinated edge id is a gate failure", () => {
  const reply = validReply();
  reply.edge_copy.push(warrant("e9", "The target rests on a bridge that was never judged."));
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes('"e9"')));
});

test("missing copy for a selected node fails, because a blank card is a product change", () => {
  const reply = validReply();
  reply.node_copy = reply.node_copy.filter((entry) => entry.id !== "k3");
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes('missing copy for selected id "k3"')));
});

test("missing copy for a selected edge fails", () => {
  const reply = validReply();
  reply.edge_copy = reply.edge_copy.filter((entry) => entry.id !== "e2");
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes('missing copy for selected id "e2"')));
});

test("duplicate copy for one id fails", () => {
  const reply = validReply();
  reply.node_copy.push(card("k1", "the cpu", "A second heading for a node that already has copy written."));
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes('duplicate entry for id "k1"')));
});

test("copy is held to the shared sentence rules", () => {
  const reply = validReply();
  reply.node_copy[1].gloss = "It doesn't work without one, and it can't do much else.";
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(
    errors.some((error) => error.includes("contraction")),
    `expected a contraction error, got: ${errors.join("; ")}`
  );
});

test("an em dash in copy fails", () => {
  // Built in code so this repository never holds a literal em dash, which
  // is the rule the test is enforcing.
  const emDash = String.fromCharCode(0x2014);
  const reply = validReply();
  reply.edge_copy[0].because = `A laptop is useless without a processor ${emDash} it runs every instruction itself.`;
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes("dash")));
});

test("one-word copy is rejected as not learner-facing", () => {
  const reply = validReply();
  reply.node_copy[2].gloss = "A switch.";
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes("too short")));
});

test("caps are enforced", () => {
  const reply = validReply();
  reply.node_copy[1].gloss = "x".repeat(300);
  const errors = realizeProblems(reply, NODES, EDGES);
  assert.ok(errors.some((error) => error.includes("exceeds 240")));
});

test("coercion lifts the envelope and never writes content", () => {
  const cases = [
    { reply: { ...validReply(), type: "json_object" }, expect: "dropped the echoed type field" },
    {
      reply: { concept: "laptop", nodes: validReply().node_copy, edges: validReply().edge_copy },
      expect: 'renamed envelope key "nodes" to "node_copy"',
    },
    {
      reply: {
        concept: "laptop",
        node_copy: Object.fromEntries(validReply().node_copy.map((row) => [row.id, row])),
        edge_copy: Object.fromEntries(validReply().edge_copy.map((row) => [row.id, row])),
      },
      expect: "keyed-object envelope for node_copy lifted to an array",
    },
  ];
  for (const item of cases) {
    const normalized = normalizeRealize(item.reply);
    assert.ok(
      normalized.coerced.includes(item.expect),
      `expected coercion "${item.expect}", got: ${normalized.coerced.join("; ")}`
    );
    assert.deepEqual(realizeProblems(normalized.value, NODES, EDGES), []);
  }
});

test("coercion does not rescue a missing field", () => {
  // The line from docs/DESIGN.md: stage 3 may touch the frame, never the
  // content. A node with no gloss is still a node with no gloss.
  const reply = validReply();
  const withoutGloss = { ...reply.node_copy[2] };
  delete /** @type {Record<string, unknown>} */ (withoutGloss).gloss;
  reply.node_copy[2] = /** @type {any} */ (withoutGloss);
  const normalized = normalizeRealize(reply);
  assert.ok(
    realizeProblems(normalized.value, NODES, EDGES).some((error) => error.includes('is missing "gloss"')),
    "coercion must not fill a missing gloss"
  );
});

test("coercion collapses byte-identical repeats but not differing answers", () => {
  // Measured 2026-09-29: the model answered one edge id four times with
  // four rewordings of the same warrant. That is a repetition defect and
  // belongs in the frame. Two genuinely different answers to one id are
  // a content disagreement, and choosing between them is choosing the
  // model's judgment, so that must still fail.
  const repeated = validReply();
  const row = repeated.edge_copy[0];
  repeated.edge_copy.push({ ...row }, { ...row });
  const collapsed = normalizeRealize(repeated);
  assert.ok(
    collapsed.coerced.some((note) => note.includes("byte-identical repeats")),
    collapsed.coerced.join("; ")
  );
  assert.deepEqual(realizeProblems(collapsed.value, NODES, EDGES), []);

  const disagreeing = validReply();
  disagreeing.edge_copy.push({
    id: "e1",
    because: "A processor is what actually runs the programs a laptop starts.",
  });
  const kept = normalizeRealize(disagreeing);
  assert.ok(
    realizeProblems(kept.value, NODES, EDGES).some((error) => error.includes('duplicate entry for id "e1"')),
    "two different warrants for one edge must remain a gate failure"
  );
});

test("coercion does not rescue a hallucinated id", () => {
  const reply = validReply();
  reply.node_copy.push(card("k9", "the flux capacitor", "A device that stores flux in a magnetic field."));
  const normalized = normalizeRealize(reply);
  assert.ok(
    realizeProblems(normalized.value, NODES, EDGES).some((error) => error.includes('"k9"')),
    "coercion must not drop the invented row to make the reply pass"
  );
});

test("realizeTree keeps the selected order and adds nothing", () => {
  const tree = realizeTree(NODES, EDGES, validReply());
  assert.deepEqual(tree.cards.map((entry) => entry.id), NODES.map((node) => node.id));
  assert.deepEqual(tree.warrants.map((entry) => entry.id), EDGES.map((edge) => edge.id));
  assert.equal(tree.cards[1].heading, "the processor");
  assert.equal(tree.warrants[0].because, "A laptop cannot do anything useful without a processor to run its programs.");
});

test("realization cannot change the shape a real selection produced", () => {
  // End to end over the real selector: build a tree, realize it, and
  // check the ids are identical on both sides. This is the property the
  // design depends on and it is cheap to state as a test.
  const candidates = ["k1", "k2", "k3", "k4"].map((id) => ({
    id,
    label: `label ${id}`,
    gloss: `Gloss for ${id}.`,
    kind: "mechanism",
    foundation_fit: "DEMONSTRABLE",
  }));
  /**
   * @param {string} first
   * @param {string} second
   * @param {string} relation
   * @param {Record<string, any>} [override]
   */
  const judgment = (first, second, relation, override = {}) => {
    const [a, b] = first < second ? [first, second] : [second, first];
    return {
      pair_id: `p-${a}--${b}`,
      a_id: a,
      b_id: b,
      relation,
      confidence: "HIGH",
      jump: relation === "NONE" || relation === "SAME_CONCEPT" ? "NOT_APPLICABLE" : "SMALL",
      rationale: "Local dependence verdict.",
      ...override,
    };
  };
  const selection = selectTopology({
    concept: "laptop",
    candidates,
    judgments: [
      judgment("k1", TARGET_ID, "B_RESTS_ON_A"),
      judgment("k1", "k2", "A_RESTS_ON_B"),
      judgment("k2", "k3", "A_RESTS_ON_B"),
      judgment("k2", "k4", "B_RESTS_ON_A"),
    ],
  });
  assert.ok(selection.ok, "the fixture must clear the gate");
  assert.ok(selection.ok);

  /** @param {string} id */
  const labelOf = (id) => (id === TARGET_ID ? "laptop" : `label ${id}`);
  /** @param {string} id */
  const kindOf = (id) => (id === TARGET_ID ? "typed target" : "mechanism");
  const nodes = selection.nodes.map((id) => ({
    id,
    label: labelOf(id),
    gloss: `Gloss for ${id}.`,
    kind: kindOf(id),
  }));
  const edges = selection.edges.map((edge) => ({
    id: edge.edge_id,
    source: edge.source,
    target: edge.target,
  }));

  const reply = {
    concept: "laptop",
    node_copy: nodes.map((node) =>
      card(node.id, `heading ${node.id}`, `A plain sentence about ${node.id} for the learner to read.`)
    ),
    edge_copy: edges.map((edge) =>
      warrant(edge.id, `The source needs the target before it can work at all.`)
    ),
  };
  assert.deepEqual(realizeProblems(reply, nodes, edges), []);

  const tree = realizeTree(nodes, edges, reply);
  assert.deepEqual(tree.cards.map((entry) => entry.id), selection.nodes);
  assert.deepEqual(tree.warrants.map((entry) => entry.id), selection.edges.map((edge) => edge.edge_id));
  assert.equal(tree.cards.length, selection.nodes.length);
  assert.equal(tree.warrants.length, selection.edges.length);
});
