/**
 * Run the gold-word acceptance set and print one table.
 *
 * Usage:
 *   node scripts/gold-words.mjs              # live run, needs a key in .env
 *   node scripts/gold-words.mjs --words laptop,battery
 *   node scripts/gold-words.mjs --json
 *   node scripts/gold-words.mjs --dump   # raw replies for failed batches
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
import { TARGET_ID, buildClosedWorld, enumeratePairs, partitionBatches } from "../src/lib/agent/pairwise/pairs.js";
import {
  buildPairBatchJsonSchema,
  buildPairBatchSystemPrompt,
  buildPairBatchUserPayload,
  normalizePairBatch,
  pairBatchProblems,
  parsePairBatchText,
} from "../src/lib/agent/pairwise/judgments.js";
import { selectTopology } from "../src/lib/agent/pairwise/topology.js";
import {
  buildRealizeJsonSchema,
  buildRealizeSystemPrompt,
  buildRealizeUserPayload,
  normalizeRealize,
  realizeProblems,
  realizeTree,
} from "../src/lib/agent/pairwise/realize.js";

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
 * @param {boolean} [dump] - print raw model replies for failed batches.
 * @returns {Promise<Record<string, unknown>>}
 */
async function attempt(concept, dump = false) {
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
  /** @type {string[]} */
  const batchReplies = [];

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
      if (dump) {
        // The raw text is what decides whether a failure is frame or
        // content. Guessing from the validator's error string is how a
        // content defect gets "coerced" away.
        batchReplies.push(`--- batch ${index + 1} raw ---\n${String(reply.raw).slice(0, 2000)}`);
      }
      return;
    }
    for (const item of normalized.value.judgments) {
      const pair = batch.find((entry) => entry.pair_id === item.pair_id);
      judgments.push({ ...item, a_id: pair.a_id, b_id: pair.b_id });
    }
  });
  if (batchErrors.length > 0) {
    return {
      word: concept,
      ok: false,
      stage: "pairs",
      calls,
      coercions,
      errors: batchErrors,
      dump: batchReplies,
    };
  }

  const selection = selectTopology({ concept, candidates: inventory.candidates, judgments });
  // Where do the nodes go? The 2026-09-29 record measured a 2-to-9 node
  // range on identical code, and named two candidate causes: the
  // inventory being too shallow, or the judgment being too sparse. The
  // histograms below separate them on a real run rather than by argument.
  const relations = tally(judgments, (item) => item.relation);
  const jumps = tally(judgments, (item) => (item.relation === "A_RESTS_ON_B" || item.relation === "B_RESTS_ON_A" ? item.jump : "n/a"));
  const targetPairs = judgments.filter(
    (item) => item.a_id === TARGET_ID || item.b_id === TARGET_ID
  );
  const targetRestsOn = targetPairs.filter(
    (item) =>
      (item.relation === "A_RESTS_ON_B" && item.a_id === TARGET_ID) ||
      (item.relation === "B_RESTS_ON_A" && item.b_id === TARGET_ID)
  );
  const walkable = targetRestsOn.filter((item) => item.jump === "SMALL");
  // Realization runs before the summary is built, because the summary
  // reports the call count and the realize call is one of them.
  const realized = selection.ok
    ? await realizeTreeFor(concept, selection, byId, callModel)
    : {};
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
    candidates: inventory.candidates.length,
    // The inventory verbatim. The 2026-09-29 hypothesis was that a flat
    // one-level candidate set is why no 4-node walk exists, and that can
    // only be checked by reading the labels, not a histogram.
    inventory: inventory.candidates.map((item) => item.label),
    relations,
    jumps,
    targetPrereqs: walkable.length,
    targetPairsTooLarge: targetRestsOn.length - walkable.length,
    droppedCandidates: selection.ok ? selection.droppedCandidates.length : 0,
    droppedJudgments: selection.ok ? selection.droppedJudgments.length : 0,
    // The full directional graph, so a run can be read rather than
    // summarised. Only the accepted edges and the refusals on target
    // pairs: everything else is NONE noise and drowns the signal.
    graph: [
      ...judgments
        .filter(
          (item) =>
            (item.relation === "A_RESTS_ON_B" || item.relation === "B_RESTS_ON_A") &&
            item.jump === "SMALL"
        )
        .map((item) => {
          const dependent =
            item.relation === "A_RESTS_ON_B" ? item.a_id : item.b_id;
          const prerequisite =
            item.relation === "A_RESTS_ON_B" ? item.b_id : item.a_id;
          return {
            on: labelOf(byId, dependent),
            needs: labelOf(byId, prerequisite),
            confidence: item.confidence,
            selected:
              selection.ok &&
              selection.edges.some(
                (edge) => edge.source === dependent && edge.target === prerequisite
              ),
          };
        }),
    ],
    refusals: targetRestsOn
      .filter((item) => item.jump !== "SMALL")
      .map((item) => ({
        on: "target",
        needs: labelOf(byId, item.a_id === TARGET_ID ? item.b_id : item.a_id),
        jump: item.jump,
        why: item.rationale,
      })),
    errors: selection.ok ? [] : [selection.reason],
    ...realized,
  };
}

/**
 * The fourth stage: write learner-facing copy for the shape topology
 * already chose. Returns the realized copy, or an honest failure naming
 * the gate's reason. It never alters the selection it was handed.
 *
 * @param {string} concept
 * @param {{ ok: true; nodes: string[]; edges: Array<{ edge_id: string; source: string; target: string }>; trunk: string[]; ranks: Record<string, number> }} selection
 * @param {Map<string, { id: string; label: string; gloss: string; kind: string }>} byId
 * @param {(system: string, user: unknown, schema: Record<string, any>) => Promise<{ raw: string }>} callModel
 * @returns {Promise<Record<string, unknown>>}
 */
async function realizeTreeFor(concept, selection, byId, callModel) {
  const nodeOf = (/** @type {string} */ id) => {
    const known = byId.get(id);
    return {
      id,
      label: known ? known.label : id,
      gloss: known ? known.gloss : "",
      kind: known ? known.kind : "concept",
    };
  };
  const nodes = selection.nodes.map(nodeOf);
  const edges = selection.edges.map((edge) => ({
    id: edge.edge_id,
    source: edge.source,
    target: edge.target,
  }));
  const reply = await callModel(
    buildRealizeSystemPrompt(),
    buildRealizeUserPayload(concept, nodes, edges),
    buildRealizeJsonSchema(nodes, edges)
  );
  const normalized = normalizeRealize(parseModelJson(reply.raw));
  const errors = realizeProblems(normalized.value, nodes, edges);
  if (errors.length > 0) {
    return {
      realized: false,
      realizeErrors: errors.slice(0, 3),
      realizeCoercions: normalized.coerced,
      // The raw reply, so a realization failure can be read rather than
      // guessed at. A duplicate id is a content question and the
      // DESIGN law forbids coercing it away, so the evidence matters.
      dump: [String(reply.raw).slice(0, 3000)],
    };
  }
  const tree = realizeTree(nodes, edges, normalized.value);
  const rankOf = (/** @type {string} */ id) => selection.ranks[id] ?? 0;
  return {
    realized: true,
    realizeCoercions: normalized.coerced,
    tree: tree.cards.map((card) => ({
      ...card,
      label: labelOf(byId, card.id),
      rank: rankOf(card.id),
      onTrunk: selection.trunk.includes(card.id),
    })),
    warrants: tree.warrants.map((warrant) => ({
      ...warrant,
      on: labelOf(byId, edges.find((edge) => edge.id === warrant.id)?.source ?? ""),
      needs: labelOf(byId, edges.find((edge) => edge.id === warrant.id)?.target ?? ""),
    })),
  };
}

/**
 * @param {Map<string, { label: string }>} byId
 * @param {string} id
 * @returns {string}
 */
function labelOf(byId, id) {
  return byId.get(id)?.label ?? id;
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {(row: Record<string, any>) => string} key
 * @returns {Record<string, number>}
 */
function tally(rows, key) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const row of rows) {
    const token = key(row);
    counts[token] = (counts[token] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const args = process.argv.slice(2);
  const wordsArg = args.indexOf("--words");
  const words =
    wordsArg >= 0 && args[wordsArg + 1]
      ? args[wordsArg + 1].split(",").map((w) => w.trim()).filter(Boolean)
      : GOLD_WORDS;
  const asJson = args.includes("--json");
  const dump = args.includes("--dump");

  loadDotEnv();
  const results = [];
  for (const word of words) {
    try {
      results.push(await attempt(word, dump));
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
      pad("ms", 7) + pad("coerce", 8) + pad("copy", 6) + "trunk path"
    );
    console.log("-".repeat(102));
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
          pad(r.realized === true ? "ok" : r.realized === false ? "FAIL" : "-", 6) +
          (r.trunkPath || (r.errors && r.errors[0]) || "")
      );
    }
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n${passed}/${results.length} gold words produced a tree.`);
    console.log("");
    console.log("Where the nodes go (diagnostics, not the gate):");
    console.log(
      pad("word", 16) +
        pad("inv", 5) +
        pad("pairs", 7) +
        pad("tgtOK", 7) +
        pad("tgtBig", 8) +
        pad("dep", 6) +
        pad("NONE", 6) +
        pad("same", 6) +
        "reason"
    );
    console.log("-".repeat(96));
    for (const r of results) {
      if (r.stage !== "topology" || !r.relations) {
        console.log(pad(r.word, 16) + pad(r.stage, 10) + ((r.errors && r.errors[0]) || ""));
        for (const chunk of r.dump || []) console.log(chunk);
        continue;
      }
      const directional =
        (r.relations.A_RESTS_ON_B ?? 0) + (r.relations.B_RESTS_ON_A ?? 0);
      console.log(
        pad(r.word, 16) +
          pad(r.candidates, 5) +
          pad(r.pairs, 7) +
          pad(r.targetPrereqs, 7) +
          pad(r.targetPairsTooLarge, 8) +
          pad(directional, 6) +
          pad(r.relations.NONE ?? 0, 6) +
          pad(r.relations.SAME_CONCEPT ?? 0, 6) +
          (r.trunkPath || (r.errors && r.errors[0]) || "")
      );
    }
    if (dump) {
      for (const r of results) {
        if (!r.inventory) continue;
        console.log(`\n${r.word}: inventory (${r.candidates} candidates)`);
        for (const label of r.inventory) console.log(`  - ${label}`);
        if (!r.graph) continue;
        console.log(`\n${r.word}: accepted dependence edges (selected marked *)`);
        for (const edge of r.graph) {
          console.log(
            `  ${edge.selected ? "*" : " "} ${edge.on} <- rests on -> ${edge.needs} (${edge.confidence})`
          );
        }
        for (const refusal of r.refusals || []) {
          console.log(`  x target refused ${refusal.needs}: ${refusal.jump} - ${refusal.why}`);
        }
        if (r.realized === false) {
          console.log(`  realization FAILED: ${(r.realizeErrors || []).join("; ")}`);
          for (const chunk of r.dump || []) console.log(chunk);
        } else if (r.tree) {
          console.log(`\n${r.word}: realized copy (${r.tree.length} cards, ${r.warrants.length} warrants)`);
          for (const card of r.tree) {
            const mark = card.onTrunk ? "T" : " ";
            console.log(`  ${mark} [rank ${card.rank}] ${card.heading}  (${card.label})`);
            console.log(`      ${card.gloss}`);
          }
          for (const warrant of r.warrants) {
            console.log(`  -> ${warrant.on} needs ${warrant.needs}: ${warrant.because}`);
          }
        }
      }
    }
    if (passed < results.length) {
      console.log("\nBaseline for comparison: .scratch/first-principled-v9/research/01-spike-evidence.md");
    }
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
