// Live verification for ticket 08: the per-layer bottom-up generator must
// produce gap-free maps over the v1 reliability bar (30/30 real DeepSeek
// calls). Runs N concepts through generateRealityMap with the real transport
// (key from .env), gates every map through validateRealityMap + deriveCheck
// plus the ticket's structural invariant (every layer beyond the foundation
// has at least one edge to the layer immediately below it - the layer it was
// derived from), and writes the evidence to 08-gapfree-verification.md.
//
// Usage: node --env-file=.env .scratch/first-principled-v3/research/verify-gapfree.mjs
//
// Exits 1 when any concept in the set fails, so a run is honest by
// construction. Prints one JSON line per concept. No secrets printed.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateRealityMap, deriveCheck } from "../../../src/lib/agent/realityMap.js";
import { validateRealityMap } from "../../../src/lib/mmg/validator.js";

const EVIDENCE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "08-gapfree-verification.md"
);

/** The concept set: the four eval concepts plus a spread of concrete and
 * abstract things, so the run covers shallow and deep chains. */
const CONCEPTS = [
  "laptop",
  "recursion",
  "photosynthesis",
  "battery",
  "water",
  "glass",
  "concrete",
  "bread",
  "soap",
  "bicycle",
  "sailboat",
  "clock",
  "compass",
  "combustion engine",
  "radio",
  "book",
  "seed",
  "fire",
  "vaccination",
  "probability",
  "database",
  "browser",
  "encryption",
  "DNA",
  "memory",
  "telescope",
  "microscope",
  "thermometer",
  "money",
  "electricity",
];

/** Refusal probes - run alongside, reported, but not counted in the 30. */
const REFUSALS = ["qwertyuiop", "zzzzzzzz"];

/**
 * The ticket's structural invariant, checked independently of the validator:
 * every layer beyond the foundation connects to the layer immediately below
 * it - the only layer the derivation call could see. A skipped step cannot
 * produce a chain that passes this.
 *
 * @param {any} map
 * @returns {{ ok: boolean; gaps: string[] }}
 */
function layerChainCheck(map) {
  const gaps = /** @type {string[]} */ ([]);
  if (!map || !Array.isArray(map.layers) || map.layers.length === 0) {
    return { ok: false, gaps: ["map has no layers"] };
  }
  const layerIndex = new Map(map.layers.map((layer, i) => [layer.id, i]));
  const layerOf = new Map(
    map.nodes.map((node) => [node.id, layerIndex.get(node.layer)])
  );
  for (let i = 1; i < map.layers.length; i++) {
    const layer = map.layers[i];
    const below = map.layers[i - 1];
    const connectsDown = map.edges.some((edge) => {
      const s = layerOf.get(edge.source);
      const t = layerOf.get(edge.target);
      if (s === undefined || t === undefined) return false;
      return (s === i && t === i - 1) || (t === i && s === i - 1);
    });
    if (!connectsDown) {
      gaps.push(
        `layer "${layer.name}" (${layer.id}) has no edge to the layer below (${below.id})`
      );
    }
  }
  return { ok: gaps.length === 0, gaps };
}

/**
 * @param {string} concept
 * @returns {Promise<any>} the recorded result row
 */
async function runConcept(concept) {
  const start = Date.now();
  const result = await generateRealityMap({ concept });
  const latencyMs = Date.now() - start;
  const row = {
    concept,
    ok: result.ok,
    kind: result.kind,
    latencyMs,
    retried: result.retried,
    layers: result.map ? result.map.layers.length : 0,
    nodes: result.map ? result.map.nodes.length : 0,
    edges: result.map ? result.map.edges.length : 0,
  };
  if (result.map) {
    const validation = validateRealityMap(result.map);
    const derive = deriveCheck(result.map);
    const chain = layerChainCheck(result.map);
    row.validatorOk = validation.ok;
    row.deriveOk = derive.ok;
    row.chainOk = chain.ok;
    row.errors = [
      ...(validation.ok ? [] : validation.errors),
      ...(derive.ok ? [] : derive.errors),
      ...(chain.ok ? [] : chain.gaps),
    ];
  } else {
    row.validatorOk = null;
    row.deriveOk = null;
    row.chainOk = null;
    row.errors = [
      result.reason ?? result.kind ?? "unknown failure",
      ...(Array.isArray(result.errors) ? result.errors : []),
    ];
  }
  return row;
}

async function main() {
  const countArg = process.argv.indexOf("--concepts");
  const count =
    countArg !== -1 && process.argv[countArg + 1]
      ? Number(process.argv[countArg + 1])
      : CONCEPTS.length;
  const set = CONCEPTS.slice(0, count);

  console.log(`Concepts: ${set.length} (limit ${count})`);
  console.log(`Refusals: ${REFUSALS.length}`);
  console.log("");

  /** @type {any[]} */
  const rows = [];
  for (const concept of set) {
    const row = await runConcept(concept);
    rows.push(row);
    console.log(JSON.stringify(row));
  }

  /** @type {any[]} */
  const refusalRows = [];
  for (const concept of REFUSALS) {
    const row = await runConcept(concept);
    refusalRows.push(row);
    console.log(JSON.stringify({ ...row, refusalProbe: true }));
  }

  const passed = rows.filter((row) => row.ok && row.validatorOk && row.deriveOk && row.chainOk);
  const failed = rows.filter((row) => !passed.includes(row));
  const totalLatency = rows.reduce((sum, row) => sum + row.latencyMs, 0);

  console.log("");
  console.log(
    `Result: ${passed.length}/${rows.length} gap-free valid maps; refusals ${refusalRows.filter((r) => !r.ok && r.kind === "refused").length}/${refusalRows.length}`
  );
  console.log(`Total latency: ${(totalLatency / 1000).toFixed(1)}s; mean ${(totalLatency / rows.length / 1000).toFixed(1)}s per concept`);

  for (const row of failed) {
    console.log(`FAILED ${row.concept}: ${JSON.stringify(row.errors ?? row)}`);
  }

  let rev = "unknown";
  let dirty = true;
  try {
    const { execSync } = await import("node:child_process");
    rev = execSync("git rev-parse --short HEAD").toString().trim();
    dirty = execSync("git status --porcelain").toString().trim().length > 0;
  } catch {
    // not a git repo context - report unknown
  }

  const table = [
    "| concept | ok | layers | nodes | edges | retried | latency (s) | validator | derive | chain |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.concept} | ${row.ok} | ${row.layers} | ${row.nodes} | ${row.edges} | ${row.retried} | ${(row.latencyMs / 1000).toFixed(1)} | ${row.validatorOk} | ${row.deriveOk} | ${row.chainOk} |`
    ),
  ];
  const body = [
    `# 08 - Gap-free layer-chain: live verification evidence`,
    ``,
    `Generated by \`node --env-file=.env .scratch/first-principled-v3/research/verify-gapfree.mjs\` on ${new Date().toISOString()}.`,
    `Engine fingerprint: git ${rev}${dirty ? " (working tree dirty)" : ""}; generator: per-layer bottom-up (ticket 08), thinking off, default maxLayers.`,
    ``,
    `Every map is gated three ways before being accepted: \`validateRealityMap\` (contiguity + schema), \`deriveCheck\` (reachability from the foundation, basis presence), and the ticket's structural chain check (every layer beyond the foundation connects to the layer immediately below it - the only layer the derivation call could see). A skipped intermediate step cannot pass the chain check, because the layer it skipped is the one the next step must connect to.`,
    ``,
    `Result: **${passed.length}/${rows.length}** gap-free valid maps (v1 bar: 30/30). Refusal probes: ${refusalRows.filter((r) => !r.ok && r.kind === "refused").length}/${refusalRows.length} refused cleanly.`,
    ``,
    "```",
    ...table,
    "```",
    ``,
    `Total latency: ${(totalLatency / 1000).toFixed(1)}s for ${rows.length} concepts (mean ${(totalLatency / rows.length / 1000).toFixed(1)}s each), including repairs.`,
    rows.some((row) => row.retried)
      ? `Repairs were needed on: ${rows.filter((row) => row.retried).map((row) => row.concept).join(", ")}.`
      : `No repair attempts were needed on any concept.`,
    ``,
    `Failures: ${failed.length === 0 ? "none" : failed.map((row) => `${row.concept} (${JSON.stringify(row.errors)})`).join("; ")}`,
    ``,
  ].join("\n");
  writeFileSync(EVIDENCE_FILE, body);
  console.log(`\nEvidence written: ${EVIDENCE_FILE}`);

  process.exit(failed.length === 0 ? 0 : 1);
}

await main();
