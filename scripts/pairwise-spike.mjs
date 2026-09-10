/**
 * Ticket v9-01 diagnostic CLI: inventory plus exhaustive local pair
 * judgments plus pure topology selection for one concept.
 *
 * Usage: node scripts/pairwise-spike.mjs <concept> [--live]
 *
 * Without --live it validates the module wiring offline (enumeration and
 * batching only, no model calls). With --live it loads .env locally,
 * runs one inventory call plus pair batches (max three concurrent) plus
 * topology selection, and prints selected nodes, edges, trunk, dropped
 * candidates, call count, latency, and token usage. No repair prompts,
 * no realization, no history, no Chapel, no production switch.
 *
 * Never prints secrets. Usage counts and diagnostics only.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { callChatCompletion, llmModel, llmProvider } from "../src/lib/agent/llm.js";
import { parseModelJson } from "../src/lib/agent/jsonParse.js";
import {
  buildInventoryJsonSchema,
  buildInventorySystemPrompt,
  buildInventoryUserPayload,
  inventoryProblems,
} from "../src/lib/agent/pairwise/inventory.js";
import {
  buildClosedWorld,
  enumeratePairs,
  partitionBatches,
} from "../src/lib/agent/pairwise/pairs.js";
import {
  buildPairBatchJsonSchema,
  buildPairBatchSystemPrompt,
  buildPairBatchUserPayload,
  pairBatchProblems,
} from "../src/lib/agent/pairwise/judgments.js";
import { selectTopology } from "../src/lib/agent/pairwise/topology.js";

const PER_CALL_TIMEOUT_MS = 240000;
const PER_CALL_MAX_TOKENS = 4000;
const MAX_CONCURRENT_BATCHES = 3;

function loadDotEnv() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
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

/**
 * @param {number} total
 * @param {(index: number) => Promise<void>} run
 */
async function eachWithLimit(total, run) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_BATCHES, total) }, async () => {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      await run(index);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const concept = (process.argv[2] || "").trim();
  const live = process.argv.includes("--live");
  if (!concept) {
    console.error("usage: node scripts/pairwise-spike.mjs <concept> [--live]");
    process.exit(2);
  }
  if (!live) {
    const { nodes } = buildClosedWorld(concept, []);
    void nodes;
    console.log(JSON.stringify({ concept, mode: "offline", note: "wiring ok; pass --live for model calls" }));
    return;
  }
  loadDotEnv();
  const started = Date.now();
  let calls = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  /**
   * @param {string} system
   * @param {unknown} user
   * @param {{ name: string; strict?: boolean; schema: Record<string, any> }} [jsonSchema]
   */
  async function callModel(system, user, jsonSchema = undefined) {
    /** @type {any} */
    const payload = {
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      jsonMode: true,
      thinking: false,
      // The default OpenRouter route mandates reasoning and burns the
      // completion budget into hidden thinking when the effort is left
      // unbounded; an explicit low effort is accepted where off is not.
      reasoningEffort: "low",
      maxTokens: PER_CALL_MAX_TOKENS,
      timeoutMs: PER_CALL_TIMEOUT_MS,
    };
    if (jsonSchema) payload.jsonSchema = jsonSchema;
    const reply = await callChatCompletion(payload);
    calls += 1;
    if (reply.usage) {
      promptTokens += Number(reply.usage.prompt_tokens || 0);
      completionTokens += Number(reply.usage.completion_tokens || 0);
    }
    return { parsed: parseModelJson(reply.content), raw: reply.content };
  }

  // Wave 1: inventory.
  const inventoryReply = await callModel(
    buildInventorySystemPrompt(),
    buildInventoryUserPayload(concept),
    buildInventoryJsonSchema(concept)
  );
  const inventory = inventoryReply.parsed;
  const inventoryErrors = inventoryProblems(inventory, concept);
  if (inventoryErrors.length > 0) {
    console.log(JSON.stringify({ ok: false, stage: "inventory", errors: inventoryErrors.slice(0, 8), calls }, null, 2));
    process.exit(1);
  }

  // Wave 2: exhaustive pair judgments, bounded parallelism.
  const { nodes, byId } = buildClosedWorld(concept, inventory.candidates);
  const pairs = enumeratePairs(nodes);
  const batches = partitionBatches(pairs);
  /** @type {Array<{ pair_id: string; a_id: string; b_id: string; relation: string; confidence: string; jump: string; rationale: string }>} */
  const judgments = [];
  /** @type {string[]} */
  const batchErrors = [];
  await eachWithLimit(batches.length, async (index) => {
    const batch = batches[index];
    const reply = await callModel(
      buildPairBatchSystemPrompt(),
      buildPairBatchUserPayload(concept, batch, byId),
      buildPairBatchJsonSchema(concept, batch.map((pair) => pair.pair_id))
    );
    const expected = batch.map((pair) => pair.pair_id);
    const errors = pairBatchProblems(reply.parsed, expected);
    if (errors.length > 0) {
      // Truncated preview only (model output, never secrets) to tell
      // shape drift apart from a parser artifact.
      const preview = String(reply.raw || "").slice(0, 300);
      batchErrors.push(`batch ${index + 1}: ${errors.slice(0, 3).join("; ")} || preview: ${preview}`);
      return;
    }
    for (const item of reply.parsed.judgments) {
      const pair = batch.find((entry) => entry.pair_id === item.pair_id);
      judgments.push({ ...item, a_id: pair.a_id, b_id: pair.b_id });
    }
  });
  if (batchErrors.length > 0) {
    console.log(JSON.stringify({ ok: false, stage: "pairs", errors: batchErrors, calls }, null, 2));
    process.exit(1);
  }

  // Wave 3 (code): topology selection. No model call.
  const selection = selectTopology({ concept, candidates: inventory.candidates, judgments });
  console.log(
    JSON.stringify(
      {
        ok: selection.ok,
        concept,
        provider: llmProvider(),
        model: llmModel(),
        calls,
        pairCount: pairs.length,
        batchCount: batches.length,
        elapsedMs: Date.now() - started,
        promptTokens,
        completionTokens,
        selection,
      },
      null,
      2
    )
  );
  if (!selection.ok) process.exit(1);
}

await main().catch((error) => {
  // Transport failure (key, credits, abort): terminal, never a throw
  // past the caller. No secrets in the message.
  console.log(JSON.stringify({ ok: false, stage: "transport", error: error instanceof Error ? error.message : String(error) }));
  process.exit(2);
});
