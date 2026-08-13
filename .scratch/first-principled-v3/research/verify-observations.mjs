// Live verification for ticket 03: the per-layer generator must produce
// gap-free maps whose every node carries a real-history observation record
// (ticket 02) written to the fail-honest contract (ticket 09) and the STE
// subset (ticket 05). Runs N concepts through generateRealityMap with the
// real transport (key from .env), gates every map five ways, and writes the
// evidence to 03-observations-verification.md.
//
// Usage: node --env-file=.env .scratch/first-principled-v3/research/verify-observations.mjs
//
// Exits 1 when any concept in the set fails, so a run is honest by
// construction. Prints one JSON line per concept. No secrets printed.
//
// The five gates:
//   1. validateRealityMap - contiguity + schema (v1 02).
//   2. deriveCheck - reachability from the foundation AND a valid
//      observation record on every node, foundation included (v2 06,
//      extended by ticket 03).
//   3. layerChainCheck - every layer beyond the foundation connects to the
//      layer immediately below it (ticket 08's structural invariant).
//   4. recordGate - every basis is a valid observation record per the
//      fail-honest contract (marks EXACT/APPROXIMATE/UNKNOWN; a value under
//      an UNKNOWN mark is an invented placeholder; UNKNOWN with a dropped
//      value is legal). Counts EXACT / APPROXIMATE / UNKNOWN per field.
//   5. steGate - every narrative (description, keyObservation value, note)
//      passes the mechanical STE subset check (no contractions, no filler,
//      no em/en dashes, no sentence over 25 words - the prompt carries the
//      "under 20 words" rule; the gate tolerates the boundary). Vague words
//      are reported as warnings, not failures.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateRealityMap, deriveCheck, steProblems } from "../../../src/lib/agent/realityMap.js";
import { validateRealityMap } from "../../../src/lib/mmg/validator.js";
import { observationProblems, OBSERVATION_MARKS } from "../../../src/lib/mmg/observation.js";

const EVIDENCE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "03-observations-verification.md"
);

/** The concept set: identical to the ticket 08 verification, so the crux
 * measurements are comparable to the pre-observation baseline. */
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
 * The ticket 08 structural invariant, checked independently of the
 * validator: every layer beyond the foundation connects to the layer
 * immediately below it - the only layer the derivation call could see.
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
 * The ticket 03 record gate: every node carries a valid observation record
 * (fail-honest contract section 2). Returns the per-field mark counts so the
 * evidence shows how often the model played honest.
 *
 * @param {any} map
 * @returns {{ ok: boolean; errors: string[]; marks: { EXACT: number; APPROXIMATE: number; UNKNOWN: number }; unknownNodes: string[] }}
 */
function recordGate(map) {
  const errors = /** @type {string[]} */ ([]);
  const marks = { EXACT: 0, APPROXIMATE: 0, UNKNOWN: 0 };
  const unknownNodes = /** @type {string[]} */ ([]);
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  for (const node of nodes) {
    const problems = observationProblems(node.basis);
    if (problems.length > 0) {
      errors.push(
        `node "${node.label ?? node.id}" basis: ${problems.join("; ")}`
      );
      continue;
    }
    const record = node.basis;
    for (const field of ["discoverer", "date", "keyObservation"]) {
      const mark = record && record[field] && record[field].mark;
      if (OBSERVATION_MARKS.includes(mark)) marks[mark] += 1;
    }
    if (record) {
      for (const field of ["discoverer", "date", "keyObservation"]) {
        if (record[field] && record[field].mark === "UNKNOWN") {
          unknownNodes.push(node.label ?? node.id);
          break;
        }
      }
    }
  }
  return { ok: errors.length === 0, errors, marks, unknownNodes };
}

/**
 * The ticket 03 STE gate: every narrative field of every node passes the
 * mechanical STE subset check. Vague words are warnings (the referent rule
 * is a judgment call); the mechanical rules gate the run.
 *
 * @param {any} map
 * @returns {{ ok: boolean; errors: string[]; warnings: string[] }}
 */
function steGate(map) {
  const errors = /** @type {string[]} */ ([]);
  const warnings = /** @type {string[]} */ ([]);
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  for (const node of nodes) {
    const label = node.label ?? node.id;
    const description = steProblems(node.description);
    for (const error of description.errors) {
      errors.push(`node "${label}" description: ${error}`);
    }
    warnings.push(...description.warnings.map((w) => `node "${label}" description: ${w}`));
    const record = node.basis;
    if (record && typeof record === "object" && record.keyObservation) {
      const key = steProblems(record.keyObservation.value);
      for (const error of key.errors) {
        errors.push(`node "${label}" keyObservation: ${error}`);
      }
      warnings.push(...key.warnings.map((w) => `node "${label}" keyObservation: ${w}`));
    }
    if (record && typeof record === "object" && typeof record.note === "string") {
      const note = steProblems(record.note);
      for (const error of note.errors) {
        errors.push(`node "${label}" note: ${error}`);
      }
      warnings.push(...note.warnings.map((w) => `node "${label}" note: ${w}`));
    }
  }
  return { ok: errors.length === 0, errors, warnings };
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
    const records = recordGate(result.map);
    const ste = steGate(result.map);
    row.validatorOk = validation.ok;
    row.deriveOk = derive.ok;
    row.chainOk = chain.ok;
    row.recordsOk = records.ok;
    row.steOk = ste.ok;
    row.exact = records.marks.EXACT;
    row.approximate = records.marks.APPROXIMATE;
    row.unknown = records.marks.UNKNOWN;
    row.unknownNodes = records.unknownNodes;
    row.steWarnings = ste.warnings.length;
    row.errors = [
      ...(validation.ok ? [] : validation.errors),
      ...(derive.ok ? [] : derive.errors),
      ...(chain.ok ? [] : chain.gaps),
      ...(records.ok ? [] : records.errors),
      ...(ste.ok ? [] : ste.errors),
    ];
    row.steWarningsList = ste.warnings.slice(0, 5);
  } else {
    row.validatorOk = null;
    row.deriveOk = null;
    row.chainOk = null;
    row.recordsOk = null;
    row.steOk = null;
    row.exact = 0;
    row.approximate = 0;
    row.unknown = 0;
    row.unknownNodes = [];
    row.steWarnings = 0;
    row.steWarningsList = [];
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

  const passed = rows.filter(
    (row) => row.ok && row.validatorOk && row.deriveOk && row.chainOk && row.recordsOk && row.steOk
  );
  const failed = rows.filter((row) => !passed.includes(row));
  const totalLatency = rows.reduce((sum, row) => sum + row.latencyMs, 0);
  const markTotals = rows.reduce(
    (sum, row) => ({
      EXACT: sum.EXACT + row.exact,
      APPROXIMATE: sum.APPROXIMATE + row.approximate,
      UNKNOWN: sum.UNKNOWN + row.unknown,
    }),
    { EXACT: 0, APPROXIMATE: 0, UNKNOWN: 0 }
  );
  const warningTotal = rows.reduce((sum, row) => sum + row.steWarnings, 0);

  console.log("");
  console.log(
    `Result: ${passed.length}/${rows.length} valid maps with observation records and STE-clean narratives; refusals ${refusalRows.filter((r) => !r.ok && r.kind === "refused").length}/${refusalRows.length}`
  );
  console.log(
    `Total latency: ${(totalLatency / 1000).toFixed(1)}s; mean ${(totalLatency / rows.length / 1000).toFixed(1)}s per concept`
  );
  console.log(
    `Marks: EXACT ${markTotals.EXACT}, APPROXIMATE ${markTotals.APPROXIMATE}, UNKNOWN ${markTotals.UNKNOWN}; STE warnings ${warningTotal}`
  );

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
    "| concept | ok | layers | nodes | retried | latency (s) | validator | derive | chain | records | ste | exact | approx | unknown |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.concept} | ${row.ok} | ${row.layers} | ${row.nodes} | ${row.retried} | ${(row.latencyMs / 1000).toFixed(1)} | ${row.validatorOk} | ${row.deriveOk} | ${row.chainOk} | ${row.recordsOk} | ${row.steOk} | ${row.exact} | ${row.approximate} | ${row.unknown} |`
    ),
  ];
  const body = [
    `# 03 - Concept tree generation with observations: live verification evidence`,
    ``,
    `Generated by \`node --env-file=.env .scratch/first-principled-v3/research/verify-observations.mjs\` on ${new Date().toISOString()}.`,
    `Engine fingerprint: git ${rev}${dirty ? " (working tree dirty)" : ""}; generator: per-layer bottom-up (ticket 08) with observation records (ticket 03), thinking off, default maxLayers, default maxTokens 4096 (inside the fail-honest contract's 3000-5000 band).`,
    ``,
    `Every map is gated five ways before being accepted: \`validateRealityMap\` (contiguity + schema), \`deriveCheck\` (reachability from the foundation AND a valid observation record on every node, foundation included), the ticket 08 structural chain check (every layer beyond the foundation connects to the layer immediately below it), the record gate (every basis is a valid observation record per the fail-honest contract - marks EXACT / APPROXIMATE / UNKNOWN, a value under an UNKNOWN mark is an invented placeholder and fails, UNKNOWN with a dropped value is legal), and the STE gate (description, keyObservation and note pass the mechanical STE subset check: no contractions, no filler, no em/en dashes, no sentence over 25 words - the prompt carries the "under 20 words" rule and the gate tolerates the boundary).`,
    ``,
    `Result: **${passed.length}/${rows.length}** valid maps with observation records and STE-clean narratives (v1 bar: 30/30). Refusal probes: ${refusalRows.filter((r) => !r.ok && r.kind === "refused").length}/${refusalRows.length} refused cleanly.`,
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
    `Fail-honest usage: EXACT ${markTotals.EXACT}, APPROXIMATE ${markTotals.APPROXIMATE}, UNKNOWN ${markTotals.UNKNOWN} across all ${rows.reduce((sum, row) => sum + row.nodes, 0)} nodes (${rows.reduce((sum, row) => sum + row.nodes, 0) * 3} fields). Nodes with at least one UNKNOWN field: ${[...new Set(rows.flatMap((row) => row.unknownNodes))].join(", ") || "none"}.`,
    ``,
    `STE warnings (vague words - reported, not gated): ${warningTotal} across the run.`,
    ``,
    `Failures: ${failed.length === 0 ? "none" : failed.map((row) => `${row.concept} (${JSON.stringify(row.errors)})`).join("; ")}`,
    ``,
  ].join("\n");
  writeFileSync(EVIDENCE_FILE, body);
  console.log(`\nEvidence written: ${EVIDENCE_FILE}`);

  process.exit(failed.length === 0 ? 0 : 1);
}

await main();
