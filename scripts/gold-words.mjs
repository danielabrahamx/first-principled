/**
 * Run the gold-word acceptance set and print one table.
 *
 * Usage:
 *   node scripts/gold-words.mjs              # live run, needs a key in .env
 *   node scripts/gold-words.mjs --words laptop,battery
 *   node scripts/gold-words.mjs --json
 *
 * The four gold words are the acceptance set for the v9 generator. This
 * is the one command that answers "does the generator still work". Run it
 * after any change to the generator, the coercion layer, the judge
 * prompt, or the transport.
 *
 * Read `docs/STATUS.md` first. Compare against the recorded baseline in
 * `.scratch/first-principled-v9/research/01-spike-evidence.md`:
 * 4/4 pass, 5 calls per word, 8-9s, 4-8 nodes.
 *
 * Never prints secrets. Exit code 0 when every requested word produced
 * a tree, 1 otherwise, so it is usable as a gate.
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
import { buildClosedWorld, enumeratePairs, partitionBatches } from "../src/lib/agent/pairwise/pairs.js";
import {
  buildPairBatchJsonSchema,
  buildPairBatchSystemPrompt,
  buildPairBatchUserPayload,
  normalizePairBatch,
  pairBatchProblems,
  parsePairBatchText,
} from "../src/lib/agent/pairwise/judgments.js";
import { selectTopology } from "../src/lib/agent/pairwise/topology.js";

/** The acceptance set. Fixed; not configurable by default. */
const GOLD_WORDS = ["laptop", "battery", "photosynthesis", "recursion"];

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

/**
 * One full generation attempt for one word. Mirrors
 * `scripts/pairwise-spike.mjs` but structured for a set and a summary
 * rather than for one concept and a debug dump.
 *
 * @param {string} concept
 * @returns {Promise<Record<string, unknown>>}
 */
async function attempt(concept) {
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
    return { raw: reply.content };
  }

  /**
   * @param {string} raw
   * @returns {unknown}
   */
  const parse = (raw) => {
    const fromPairs = parsePairBatchText(raw);
    return fromPairs !== null ? fromPairs : parseModelJson(raw);
  };

  const inventoryReply = await callModel(
    buildInventorySystemPrompt(),
    buildInventoryUserPayload(concept),
    buildInventoryJsonSchema(concept)
  );
  const inventoryErrors = inventoryProblems(parse(inventoryReply.raw), concept);
  if (inventoryErrors.length > 0) {
    return { word: concept, ok: false, stage: "inventory", calls, errors: inventoryErrors.slice(0, 3) };
  }
  const inventory = parse(inventoryReply.raw);

  const { nodes, byId } = buildClosedWorld(concept, inventory.candidates);
  const pairs = enumeratePairs(nodes);
  const batches = partitionBatches(pairs);

  /** @type {any[]} */
  const judgments = [];
  /** @type {string[]} */
  const batchErrors = [];
  /** @type {string[]} */
  const coercions = [];

  await eachWithLimit(batches.length, async (index) => {
    const batch = batches[index];
    const reply = await callModel(
      buildPairBatchSystemPrompt(),
      buildPairBatchUserPayload(concept, batch, byId),
      buildPairBatchJsonSchema(concept, batch.map((pair) => pair.pair_id))
    );
    const expected = batch.map((pair) => pair.pair_id);
    const normalized = normalizePairBatch(parse(reply.raw), expected);
    for (const note of normalized.coerced) coercions.push(note);
    const errors = pairBatchProblems(normalized.value, expected);
    if (errors.length > 0) {
      batchErrors.push(`batch ${index + 1}: ${errors.slice(0, 2).join("; ")}`);
      return;
    }
    for (const item of normalized.value.judgments) {
      const pair = batch.find((entry) => entry.pair_id === item.pair_id);
      judgments.push({ ...item, a_id: pair.a_id, b_id: pair.b_id });
    }
  });
  if (batchErrors.length > 0) {
    return { word: concept, ok: false, stage: "pairs", calls, coercions, errors: batchErrors };
  }

  const selection = selectTopology({ concept, candidates: inventory.candidates, judgments });
  return {
    word: concept,
    ok: selection.ok,
    stage: "topology",
    calls,
    elapsedMs: Date.now() - started,
    promptTokens,
    completionTokens,
    pairs: pairs.length,
    batches: batches.length,
    coercions,
    nodes: selection.ok ? selection.nodes.length : 0,
    edges: selection.ok ? selection.edges.length : 0,
    trunk: selection.ok ? selection.trunk.length : 0,
    trunkPath: selection.ok ? selection.trunk.join(" -> ") : "",
    droppedCandidates: selection.ok ? selection.droppedCandidates.length : 0,
    droppedJudgments: selection.ok ? selection.droppedJudgments.length : 0,
    errors: selection.ok ? [] : [selection.reason],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const wordsArg = args.indexOf("--words");
  const words =
    wordsArg >= 0 && args[wordsArg + 1]
      ? args[wordsArg + 1].split(",").map((w) => w.trim()).filter(Boolean)
      : GOLD_WORDS;
  const asJson = args.includes("--json");

  loadDotEnv();
  const results = [];
  for (const word of words) {
    try {
      results.push(await attempt(word));
    } catch (error) {
      results.push({
        word,
        ok: false,
        stage: "transport",
        calls: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ provider: llmProvider(), model: llmModel(), results }, null, 2));
  } else {
    const pad = (value, width) => String(value).padEnd(width);
    console.log(`route: ${llmProvider()} / ${llmModel()}`);
    console.log(
      pad("word", 16) + pad("result", 9) + pad("stage", 11) +
      pad("nodes", 7) + pad("edges", 7) + pad("trunk", 7) +
      pad("ms", 7) + pad("coerce", 8) + "trunk path"
    );
    console.log("-".repeat(96));
    for (const r of results) {
      console.log(
        pad(r.word, 16) +
          pad(r.ok ? "PASS" : "FAIL", 9) +
          pad(r.stage, 11) +
          pad(r.ok ? r.nodes : "-", 7) +
          pad(r.ok ? r.edges : "-", 7) +
          pad(r.ok ? r.trunk : "-", 7) +
          pad(r.elapsedMs ?? "-", 7) +
          pad(r.coercions ? r.coercions.length : "-", 8) +
          (r.trunkPath || (r.errors && r.errors[0]) || "")
      );
    }
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n${passed}/${results.length} gold words produced a tree.`);
    if (passed < results.length) {
      console.log("Baseline for comparison: .scratch/first-principled-v9/research/01-spike-evidence.md");
    }
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
