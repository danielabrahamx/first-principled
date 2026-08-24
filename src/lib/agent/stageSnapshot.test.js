import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chronologySnapshot,
  epiphaniesSnapshot,
  pollJson,
} from "./stageSnapshot.js";

const CHRONOLOGY = {
  concept: "battery",
  prompts: { system: "secret prompt" },
  diagnostics: { inner: "talk" },
  chronology: [
    {
      id: "c1",
      regime: "separated charge",
      new_capability: "stored electrical potential",
      enabled_by_previous: [],
      ancestry_kind: "PHYSICAL",
      target_relevance: "A battery needs charge separation.",
      provenance: "hidden",
      reasoning: "inner talk",
    },
  ],
};

const EPIPHANIES = {
  concept: "battery",
  discarded_input_ids: ["x"],
  epiphanies: [
    {
      id: "e1",
      from_regimes: ["c1"],
      to_regimes: ["c1"],
      result: "Charge can be stored.",
      joint_kind: "EXPERIMENTAL_RESULT",
      candidate_node: "leyden jar",
      provenance: "hidden",
      history: {
        certainty: "EXACT",
        who: ["Pieter van Musschenbroek"],
        when: "1746",
        observation: "A glass jar held charge.",
        uncertainty_note: "",
        notes_for_model: "do not leak",
      },
    },
  ],
};

test("chronology snapshot keeps the Stage 1 contract and drops hidden fields", () => {
  const snapshot = chronologySnapshot("battery", CHRONOLOGY);
  assert.deepEqual(snapshot, {
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
    ],
  });
  assert.equal("prompts" in snapshot, false);
  assert.equal("diagnostics" in snapshot, false);
  assert.equal("provenance" in snapshot.chronology[0], false);
  assert.equal("reasoning" in snapshot.chronology[0], false);
});

test("epiphanies snapshot adds joints without provenance or discarded ids", () => {
  const snapshot = epiphaniesSnapshot("battery", CHRONOLOGY, EPIPHANIES);
  assert.equal(snapshot.concept, "battery");
  assert.equal(snapshot.chronology.length, 1);
  assert.equal("discarded_input_ids" in snapshot, false);
  assert.deepEqual(snapshot.epiphanies[0], {
    id: "e1",
    from_regimes: ["c1"],
    to_regimes: ["c1"],
    result: "Charge can be stored.",
    joint_kind: "EXPERIMENTAL_RESULT",
    candidate_node: "leyden jar",
    history: {
      certainty: "EXACT",
      who: ["Pieter van Musschenbroek"],
      when: "1746",
      observation: "A glass jar held charge.",
      uncertainty_note: "",
    },
  });
  assert.equal("provenance" in snapshot.epiphanies[0], false);
  assert.equal("notes_for_model" in snapshot.epiphanies[0].history, false);
});

test("missing blob stays running with no snapshot", () => {
  const body = pollJson(null);
  assert.equal(body.status, "running");
  assert.equal("snapshot" in body, false);
  assert.equal("stage" in body, false);
});

test("running blob forwards stage and sanitized snapshot", () => {
  const body = pollJson({
    status: "running",
    stage: "chronology",
    snapshot: chronologySnapshot("battery", CHRONOLOGY),
    diagnostics: { leak: true },
  });
  assert.equal(body.status, "running");
  if (body.status !== "running") throw new Error("expected running");
  assert.equal(body.stage, "chronology");
  assert.equal(body.snapshot && body.snapshot.chronology[0].id, "c1");
  assert.equal("diagnostics" in body, false);
});

test("poll JSON still treats success and error as terminal", () => {
  assert.deepEqual(
    pollJson({ status: "success", httpStatus: 200, body: { phase: "active" } }),
    { status: "success", body: { phase: "active" } }
  );
  assert.deepEqual(
    pollJson({ status: "error", code: "upstream_error", message: "secret" }),
    { status: "error", code: "upstream_error", message: "secret" }
  );
});

test("unrecognized blob shape stays a bare running status", () => {
  assert.deepEqual(pollJson({ status: "snapshot", snapshot: { concept: "x" } }), {
    status: "running",
  });
});
