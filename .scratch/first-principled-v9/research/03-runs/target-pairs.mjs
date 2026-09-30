/**
 * Ticket 03 question 2: read the judgments the model actually made on the
 * TARGET's pairs, verbatim, across repeated runs.
 *
 * `scripts/gold-words.mjs --dump` prints only the refusals it has
 * (directional, non-SMALL). The 2026-10-01 generality runs showed several
 * words failing at `tgtOK` 0 with `tgtBig` 0, which means the model never
 * claimed a dependence on the target at all, so there is nothing in the
 * refusal list to read. This script prints every target pair with its
 * relation, confidence, jump and rationale, which is the only way to
 * answer whether the refusals name the same missing bridges across runs.
 *
 * It imports the same four modules `gold-words.mjs` does, unchanged. No
 * product code is modified or bypassed.
 *
 * Usage:
 *   node .scratch/first-principled-v9/research/03-runs/target-pairs.mjs --words justice --attempts 3
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { callChatCompletion } from "../../../../src/lib/agent/llm.js";
import { parseModelJson } from "../../../../src/lib/agent/jsonParse.js";
import {
  buildInventoryJsonSchema,
  buildInventorySystemPrompt,
  buildInventoryUserPayload,
  inventoryProblems,
} from "../../../../src/lib/agent/pairwise/inventory.js";
import { TARGET_ID, buildClosedWorld, enumeratePairs, partitionBatches } from "../../../../src/lib/agent/pairwise/pairs.js";
import {
  buildPairBatchJsonSchema,
  buildPairBatchSystemPrompt,
  buildPairBatchUserPayload,
  normalizePairBatch,
  pairBatchProblems,
  parsePairBatchText,
} from "../../../../src/lib/agent/pairwise/judgments.js";
import { selectTopology } from "../../../../src/lib/agent/pairwise/topology.js";

const PER_CALL_TIMEOUT_MS = 240000;
const PER_CALL_MAX_TOKENS = 4000;

function loadDotEnv() {
  const root = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
  let text = "";
  try {
    text = readFileSync(join(root, ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

async function callModel(system, user, jsonSchema) {
  /** @type {any} */
  const payload = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    jsonMode: true,
    thinking: false,
    reasoningEffort: "low",
    maxTokens: PER_CALL_MAX_TOKENS,
    timeoutMs: PER_CALL_TIMEOUT_MS,
  };
  if (jsonSchema) payload.jsonSchema = jsonSchema;
  return callChatCompletion(payload);
}

const parse = (/** @type {string} */ raw) => {
  const fromPairs = parsePairBatchText(raw);
  return fromPairs !== null ? fromPairs : parseModelJson(raw);
};

async function attempt(concept) {
  const inventoryReply = await callModel(
    buildInventorySystemPrompt(),
    buildInventoryUserPayload(concept),
    buildInventoryJsonSchema(concept)
  );
  const inventoryErrors = inventoryProblems(parse(inventoryReply.content), concept);
  if (inventoryErrors.length > 0) return { concept, stage: "inventory", errors: inventoryErrors.slice(0, 3) };
  const inventory = parse(inventoryReply.content);

  const { nodes, byId } = buildClosedWorld(concept, inventory.candidates);
  const pairs = enumeratePairs(nodes);
  const batches = partitionBatches(pairs);

  /** @type {any[]} */
  const judgments = [];
  /** @type {string[]} */
  const batchErrors = [];
  for (const [index, batch] of batches.entries()) {
    const reply = await callModel(
      buildPairBatchSystemPrompt(),
      buildPairBatchUserPayload(concept, batch, byId),
      buildPairBatchJsonSchema(concept, batch.map((pair) => pair.pair_id))
    );
    const expected = batch.map((pair) => pair.pair_id);
    const normalized = normalizePairBatch(parse(reply.content), expected);
    const errors = pairBatchProblems(normalized.value, expected);
    if (errors.length > 0) {
      batchErrors.push(`batch ${index + 1}: ${errors.slice(0, 2).join("; ")}`);
      continue;
    }
    for (const item of normalized.value.judgments) {
      const pair = batch.find((entry) => entry.pair_id === item.pair_id);
      judgments.push({ ...item, a_id: pair.a_id, b_id: pair.b_id });
    }
  }
  if (batchErrors.length > 0) return { concept, stage: "pairs", errors: batchErrors };

  const selection = selectTopology({ concept, candidates: inventory.candidates, judgments });
  const targetPairs = judgments
    .filter((item) => item.a_id === TARGET_ID || item.b_id === TARGET_ID)
    .map((item) => {
      const targetRestsOn =
        (item.relation === "A_RESTS_ON_B" && item.a_id === TARGET_ID) ||
        (item.relation === "B_RESTS_ON_A" && item.b_id === TARGET_ID);
      const other = item.a_id === TARGET_ID ? item.b_id : item.a_id;
      return {
        candidate: byId.get(other)?.label ?? other,
        relation: item.relation,
        targetRestsOn,
        confidence: item.confidence,
        jump: item.jump,
        rationale: item.rationale,
      };
    });
  return {
    concept,
    stage: "topology",
    ok: selection.ok,
    reason: selection.ok ? selection.trunk.join(" -> ") : selection.reason,
    nodes: selection.ok ? selection.nodes.length : 0,
    trunk: selection.ok ? selection.trunk.length : 0,
    inventory: inventory.candidates.map((item) => item.label),
    targetPairs,
  };
}

const args = process.argv.slice(2);
const wordsArg = args.indexOf("--words");
const words = (wordsArg >= 0 && args[wordsArg + 1] ? args[wordsArg + 1] : "justice")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);
const attemptsArg = args.indexOf("--attempts");
const attempts = attemptsArg >= 0 ? Number(args[attemptsArg + 1]) : 3;

loadDotEnv();
for (const word of words) {
  for (let index = 1; index <= attempts; index += 1) {
    const result = await attempt(word);
    console.log(`\n=== ${word} attempt ${index}/${attempts} stage ${result.stage}`);
    if (result.stage !== "topology") {
      console.log(`  errors: ${(result.errors || []).join("; ")}`);
      continue;
    }
    console.log(`  verdict: ${result.ok ? "PASS" : "FAIL"} nodes ${result.nodes} trunk ${result.trunk} | ${result.reason}`);
    console.log(`  inventory: ${result.inventory.join(" | ")}`);
    const restsOn = result.targetPairs.filter((pair) => pair.targetRestsOn);
    console.log(`  target pairs: ${result.targetPairs.length}, of which claim the target rests on them: ${restsOn.length}`);
    for (const pair of result.targetPairs) {
      const mark = pair.targetRestsOn ? (pair.jump === "SMALL" ? "OK " : "BIG") : "-- ";
      console.log(`   ${mark} ${pair.candidate} | ${pair.relation} ${pair.confidence} ${pair.jump} | ${pair.rationale}`);
    }
  }
}