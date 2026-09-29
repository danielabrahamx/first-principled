import { test } from "node:test";
import assert from "node:assert/strict";

import { laptopRealityMap, laptopLearnerMap } from "../src/lib/mmg/fixtures.js";
import { validateRealityMap } from "../src/lib/mmg/validator.js";
import { CONCEPTS } from "./concepts.js";
import {
  referenceGap,
  probesReferenceGap,
  rubricReply,
  rubricNoLeak,
  evidenceFidelity,
} from "./scorers.js";

test("every eval concept fixture is schema-valid", () => {
  for (const map of CONCEPTS) {
    const validation = validateRealityMap(map);
    assert.equal(validation.ok, true, `${map.concept}: ${validation.errors.join("; ")}`);
  }
});

test("referenceGap returns null when every node is correct", () => {
  const allCorrect = {
    nodes: laptopRealityMap.nodes.map((node) => ({
      id: node.id,
      state: "correct",
      confidence: 0.8,
      evidence: ["known"],
    })),
    edges: [],
  };
  assert.equal(referenceGap(laptopRealityMap, allCorrect), null);
});

test("referenceGap targets the lowest layer with a non-correct node", () => {
  const ref = referenceGap(laptopRealityMap, laptopLearnerMap);
  assert.ok(ref, "the fixture learner map has gaps");
  assert.equal(ref.nodeId, "n-silicon", "l0 is all correct in the fixture, so l1 is the lowest affected layer");
  assert.equal(ref.layerIndex, 1);
});

test("referenceGap prefers misconception over untested within the lowest layer", () => {
  // l2 has n-transistor (misconception) and n-circuit (untested); n-transistor wins
  const learner = {
    nodes: [
      { id: "n-electricity", state: "correct", confidence: 0.9, evidence: ["known"] },
      { id: "n-silicon", state: "correct", confidence: 0.9, evidence: ["known"] },
      {
        id: "n-transistor",
        state: "misconception",
        confidence: 0.4,
        evidence: ["a switch you flick by hand"],
      },
    ],
    edges: [],
  };
  const ref = referenceGap(laptopRealityMap, learner);
  assert.equal(ref.nodeId, "n-transistor");
});

test("probesReferenceGap compares a probe against the reference", () => {
  assert.equal(
    probesReferenceGap(laptopRealityMap, laptopLearnerMap, "n-silicon"),
    true
  );
  assert.equal(
    probesReferenceGap(laptopRealityMap, laptopLearnerMap, "n-transistor"),
    false,
    "transistor is in a higher layer than the lowest affected one"
  );
});

test("rubricReply passes a single short question for probe turns", () => {
  const result = rubricReply("What do you think controls that switch?", {
    kind: "probe",
  });
  assert.equal(result.score, 1);
  assert.deepEqual(
    result.rules.map((rule) => rule.name),
    ["asks a question", "single question", "short (<=5 sentences)"]
  );
});

test("rubricReply fails a lecture-style multi-question probe", () => {
  const result = rubricReply(
    "So first there is physics, then materials, then electronics, then logic. Do you see? Do you agree? What do you think?",
    { kind: "probe" }
  );
  assert.ok(result.score < 1, "three questions in one probe fails the single-question rule");
});

test("rubricReply demands a direct answer without a trailing question for explain turns", () => {
  const direct = rubricReply("A transistor is a tiny switch controlled by a voltage.", {
    kind: "explain",
  });
  assert.equal(direct.score, 1);
  const trailing = rubricReply("A transistor is a tiny switch controlled by a voltage. What do you think?", {
    kind: "explain",
  });
  assert.equal(trailing.rules[0].pass, false);
});

test("rubricNoLeak flags a verbatim description quote", () => {
  const clean = rubricNoLeak("What do you think controls that switch?", laptopRealityMap);
  assert.equal(clean.pass, true);
  const transistor = laptopRealityMap.nodes.find((node) => node.id === "n-transistor");
  assert.ok(transistor);
  const leaky = rubricNoLeak(`Some say ${transistor.description}`, laptopRealityMap);
  assert.equal(leaky.pass, false);
  assert.equal(leaky.leaked, "n-transistor");
});

test("evidenceFidelity is a strict substring check over the learner's words", () => {
  const utterances = ["I use a laptop every day", "a transistor is a switch you flick by hand"];
  const map = {
    nodes: [
      { id: "n-app", state: "correct", confidence: 0.7, evidence: ["I use a laptop every day"] },
      {
        id: "n-transistor",
        state: "misconception",
        confidence: 0.4,
        evidence: ["a transistor is a switch you flick by hand", "it amplifies audio (paraphrased)"],
      },
    ],
    edges: [],
  };
  const result = evidenceFidelity(map, utterances);
  assert.ok(result);
  assert.equal(result.total, 3);
  assert.equal(result.grounded, 2, "the paraphrase is not a verbatim substring");
  assert.equal(result.score, 2 / 3);
});

test("evidenceFidelity returns null when there is no evidence", () => {
  assert.equal(
    evidenceFidelity({ nodes: [{ id: "n-bit", state: "untested", confidence: 0, evidence: [] }], edges: [] }, []),
    null
  );
});
