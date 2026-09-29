/**
 * Replay the four envelope failures recorded in v9 research 01 through the
 * coercion, offline. No model calls, no secrets. Confirms that the shapes
 * that killed the live runs now survive validation.
 */

import {
  normalizePairBatch,
  pairBatchProblems,
  parsePairBatchText,
} from "../../../src/lib/agent/pairwise/judgments.js";

const judgment = (id, over = {}) => ({
  pair_id: id,
  relation: "A_RESTS_ON_B",
  confidence: "HIGH",
  jump: "SMALL",
  rationale: "A needs the mechanism B provides.",
  ...over,
});

const jsonl = [
  JSON.stringify(judgment("p-k1--k2")),
  JSON.stringify(judgment("p-k1--k3", { relation: "NONE", jump: "SMALL" })),
].join("\n");

const cases = [
  ["recursion batch 1: JSONL, SMALL on a NONE row", jsonl, ["p-k1--k2", "p-k1--k3"]],
  ["recursion batch 3: echoed type field", { type: "json_object", judgments: [judgment("p-k1--k2")] }, ["p-k1--k2"]],
  [
    "laptop batch 2: keyed-object envelope",
    { "p-k1--k2": { relation: "A_RESTS_ON_B", confidence: "HIGH", jump: "SMALL", rationale: "r" } },
    ["p-k1--k2"],
  ],
  ["bare array, no wrapper", [judgment("p-k1--k2")], ["p-k1--k2"]],
];

let failed = 0;
for (const [name, raw, expected] of cases) {
  const parsed = typeof raw === "string" ? parsePairBatchText(raw) : raw;
  const normalized = normalizePairBatch(parsed, expected);
  const errors = pairBatchProblems(normalized.value, expected);
  if (errors.length > 0) failed += 1;
  const verdict = errors.length === 0 ? "PASS" : "FAIL";
  const notes = normalized.coerced.length > 0 ? normalized.coerced.join("; ") : "(none)";
  console.log(`${verdict}  ${name}`);
  console.log(`      coerced: ${notes}`);
  if (errors.length > 0) console.log(`      errors: ${errors.join("; ")}`);
}
console.log(`\n${cases.length - failed}/${cases.length} recorded failures now survive validation.`);
process.exit(failed === 0 ? 0 : 1);
