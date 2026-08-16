/**
 * Reality Map quality eval (v6 ticket 07).
 *
 * Usage (from repo root):
 *   node eval/map-quality/run.js
 *       Score the gold maps against themselves. No API key.
 *   node --env-file=.env eval/map-quality/run.js --live
 *       Generate live Nemotron maps (one-shot, no serial fallback) and
 *       score them against gold. Writes the baseline file.
 *   node --env-file=.env eval/map-quality/run.js --live --maps-dir DIR --baseline FILE
 *       Same live run. Writes each concept's full map JSON under DIR so a
 *       followability session can score every rubric line. Pass a new
 *       --baseline so the ticket 07 file is not overwritten.
 *
 * Tutor-question scorers are not used. Parked `eval/run.js` is a different
 * harness.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildOneShotSystemPrompt } from "../../src/lib/agent/realityMap.js";
import { parseModelJson } from "../../src/lib/agent/jsonParse.js";
import { callChatCompletion, llmModel } from "../../src/lib/agent/llm.js";
import { parseEvalArgs } from "./args.js";
import { GOLD_MAPS } from "./gold.js";
import { candidateFromOneShot, scoreMap } from "./gate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_BASELINE = path.join(
  ROOT,
  ".scratch/first-principled-v6/research/07-map-quality-baseline.md"
);

const parsedArgs = parseEvalArgs(process.argv.slice(2), {
  baselineFile: DEFAULT_BASELINE,
});
const wantLive = parsedArgs.wantLive;
const baselineFile = path.isAbsolute(parsedArgs.baselineFile)
  ? parsedArgs.baselineFile
  : path.join(ROOT, parsedArgs.baselineFile);
const mapsDir = parsedArgs.mapsDir
  ? path.isAbsolute(parsedArgs.mapsDir)
    ? parsedArgs.mapsDir
    : path.join(ROOT, parsedArgs.mapsDir)
  : null;

/**
 * @returns {{ rev: string; dirty: boolean }}
 */
function fingerprint() {
  try {
    const rev = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
    const dirty = execSync("git status --porcelain", { cwd: ROOT }).toString().trim().length > 0;
    return { rev, dirty };
  } catch {
    return { rev: "unknown", dirty: true };
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function sanitize(value) {
  return String(value ?? "").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}

/**
 * @param {ReturnType<typeof scoreMap>} score
 * @returns {string}
 */
function formatChecks(score) {
  const flags = [
    score.checks.schemaValid ? "schema" : "SCHEMA",
    score.checks.deriveOk ? "derive" : "DERIVE",
    score.checks.crownReached ? "crown" : "CROWN",
    score.checks.hasDependence ? "dependence" : "DEPENDENCE",
    score.checks.noSkippedLayer ? "adjacent" : "SKIPPED",
  ];
  return flags.join(" ");
}

/**
 * @param {ReturnType<typeof scoreMap>["overlap"]} overlap
 * @returns {string}
 */
function formatOverlap(overlap) {
  if (!overlap) return "n/a";
  const labels = `${overlap.labelsHit}/${overlap.labelsTotal}`;
  const pairs = `${overlap.pairsHit}/${overlap.pairsTotal}`;
  return `labels ${labels} pairs ${pairs}`;
}

/**
 * @param {{ concept: string; score: ReturnType<typeof scoreMap>; live?: boolean; latencyMs?: number; path?: string; reason?: string | null }} row
 * @returns {string}
 */
function formatRow(row) {
  const gate = row.score.pass ? "PASS" : "FAIL";
  const live = row.live ? "LLM" : "gold";
  const extra = [
    formatChecks(row.score),
    formatOverlap(row.score.overlap),
    live,
    row.latencyMs !== undefined ? `${row.latencyMs}ms` : "",
    row.path ?? "",
    row.reason ? sanitize(row.reason) : "",
  ]
    .filter(Boolean)
    .join(" | ");
  return `${row.concept.padEnd(16)} ${gate}  ${extra}`;
}

/**
 * Live one-shot against the landed transport. Serial per-layer is not scored.
 *
 * @param {string} concept
 * @returns {Promise<{
 *   ok: boolean;
 *   map: any;
 *   latencyMs: number;
 *   generationPath: string;
 *   reason: string | null;
 *   llmCalls: number;
 * }>}
 */
async function generateLive(concept) {
  const started = Date.now();
  try {
    const reply = await callChatCompletion({
      messages: [
        { role: "system", content: buildOneShotSystemPrompt(6) },
        { role: "user", content: `Word or phrase: ${concept}` },
      ],
      jsonMode: true,
      thinking: false,
      maxTokens: 8192,
    });
    const parsed = parseModelJson(reply.content);
    const map = candidateFromOneShot(concept, parsed);
    if (!map) {
      return {
        ok: false,
        map: null,
        latencyMs: Date.now() - started,
        generationPath: "oneshot",
        reason: parsed && parsed.isValidConcept === false
          ? sanitize(typeof parsed.reason === "string" ? parsed.reason : "model refused the concept")
          : "one-shot reply was not valid JSON in the required shape",
        llmCalls: 1,
      };
    }
    return {
      ok: true,
      map,
      latencyMs: Date.now() - started,
      generationPath: "oneshot",
      reason: null,
      llmCalls: 1,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      map: null,
      latencyMs: Date.now() - started,
      generationPath: "oneshot",
      reason: sanitize(message),
      llmCalls: 0,
    };
  }
}

/**
 * @returns {{ concept: string; score: ReturnType<typeof scoreMap>; live: boolean }[]}
 */
function scoreGold() {
  return GOLD_MAPS.map((gold) => {
    const requireCrown = gold.concept !== "laptop";
    return {
      concept: gold.concept,
      score: scoreMap(gold, { gold, requireCrown }),
      live: false,
    };
  });
}

/**
 * Laptop gold is a chain to "application", not a node named laptop. Crown
 * is required of generated maps, not of that fixture.
 *
 * @param {{ concept: string; score: ReturnType<typeof scoreMap> }[]} rows
 * @returns {boolean}
 */
function goldRunPasses(rows) {
  return rows.every((row) => row.score.pass);
}

if (!wantLive) {
  const rows = scoreGold();
  console.log("Reality Map quality eval (deterministic gold self-score)");
  console.log("Rubric: eval/map-quality/rubric.md");
  console.log("");
  for (const row of rows) {
    console.log(formatRow(row));
    if (!row.score.pass) {
      for (const error of row.score.errors) console.log(`  - ${error}`);
    }
  }
  if (!goldRunPasses(rows)) {
    process.exitCode = 1;
  }
} else {
  if (!process.env.LLM_API_KEY) {
    console.error(
      "Live eval needs LLM_API_KEY. Run: node --env-file=.env eval/map-quality/run.js --live"
    );
    process.exit(1);
  }

  const fp = fingerprint();
  const model = llmModel();
  /** @type {{ concept: string; score: ReturnType<typeof scoreMap>; live: boolean; latencyMs: number; path: string; reason: string | null; llmCalls: number; labels: string; map: any }}[] */
  const rows = [];
  let blocker = "";

  console.log(`Reality Map quality eval (live ${model})`);
  console.log("LLM-dependent rows marked LLM. Rubric: eval/map-quality/rubric.md");
  console.log("");

  for (const gold of GOLD_MAPS) {
    const generated = await generateLive(gold.concept);
    const score = generated.map
      ? scoreMap(generated.map, { gold, concept: gold.concept, requireCrown: true })
      : scoreMap(
          { concept: gold.concept, layers: [], nodes: [], edges: [] },
          { gold, concept: gold.concept, requireCrown: true }
        );
    const labels = generated.map && Array.isArray(generated.map.nodes)
      ? generated.map.nodes
          .map((node) => (node && typeof node.label === "string" ? node.label : ""))
          .filter(Boolean)
          .join(", ")
      : "";
    const row = {
      concept: gold.concept,
      score,
      live: true,
      latencyMs: generated.latencyMs,
      path: generated.generationPath,
      reason: generated.reason,
      llmCalls: generated.llmCalls,
      labels,
      map: generated.map,
    };
    rows.push(row);
    console.log(formatRow(row));
    if (labels) console.log(`  nodes: ${labels}`);
    if (!score.pass) {
      for (const error of score.errors.slice(0, 8)) console.log(`  - ${error}`);
    }
    if (generated.reason && /LLM API error|no choices|aborted after/.test(generated.reason)) {
      blocker = generated.reason;
    }
  }

  const recorded = new Date().toISOString().slice(0, 10);
  const table = [
    "| Concept | Gate | Schema | Derive | Crown | Dependence | Adjacent | Gold labels | Gold pairs | Latency | Path | LLM |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const overlap = row.score.overlap;
      return `| ${row.concept} | ${row.score.pass ? "PASS" : "FAIL"} | ${row.score.checks.schemaValid ? "yes" : "no"} | ${row.score.checks.deriveOk ? "yes" : "no"} | ${row.score.checks.crownReached ? "yes" : "no"} | ${row.score.checks.hasDependence ? "yes" : "no"} | ${row.score.checks.noSkippedLayer ? "yes" : "no"} | ${overlap ? `${overlap.labelsHit}/${overlap.labelsTotal}` : "n/a"} | ${overlap ? `${overlap.pairsHit}/${overlap.pairsTotal}` : "n/a"} | ${row.latencyMs}ms | ${row.path} | yes |`;
    }),
  ];

  const nodeLines = rows
    .filter((row) => row.labels)
    .map((row) => `- ${row.concept}: ${row.labels}`);

  const errorLines = rows
    .filter((row) => !row.score.pass || row.reason)
    .map((row) => {
      const bits = [...row.score.errors.slice(0, 4)];
      if (row.reason) bits.unshift(row.reason);
      return `- ${row.concept}: ${bits.join("; ") || "failed"}`;
    });

  const body = [
    `# 07 - Reality Map quality baseline`,
    ``,
    `Recorded by \`node --env-file=.env eval/map-quality/run.js --live\` on ${recorded}.`,
    `Engine fingerprint: git ${fp.rev}${fp.dirty ? " (working tree dirty)" : ""}.`,
    `Model: \`${sanitize(model)}\` (LLM-dependent).`,
    `Generator: one-shot via \`buildOneShotSystemPrompt\` and the landed OpenRouter transport. Serial fallback is not scored.`,
    ``,
    `This is a Reality Map quality bar, not a tutor-question eval. Deterministic`,
    `self-score of the gold maps is \`node eval/map-quality/run.js\` (no key).`,
    `Danny followability scores use \`eval/map-quality/rubric.md\` and are not in this file.`,
    ``,
    `## Automated gate (live)`,
    ``,
    ...table,
    ``,
    `## Node labels (live)`,
    ``,
    ...(nodeLines.length > 0 ? nodeLines : ["- none (generation did not return maps)"]),
    ``,
    `## Failures and blockers`,
    ``,
    ...(errorLines.length > 0 ? errorLines : ["- none"]),
    ``,
    blocker
      ? `Exact blocker: ${sanitize(blocker)}`
      : rows.every((row) => row.score.pass)
        ? "No blocker. All four live maps passed the automated gate."
        : "No transport blocker. One or more live maps failed the automated gate (see rows above).",
    ``,
    `No secrets in this file. Key material is redacted if it ever appears in an error string.`,
    ``,
  ].join("\n");

  writeFileSync(baselineFile, body);
  console.log(`\nBaseline written: ${baselineFile}`);
  if (mapsDir) {
    mkdirSync(mapsDir, { recursive: true });
    for (const row of rows) {
      const payload = {
        concept: row.concept,
        ok: Boolean(row.map),
        pass: row.score.pass,
        reason: row.reason ? sanitize(row.reason) : null,
        latencyMs: row.latencyMs,
        generationPath: row.path,
        map: row.map,
      };
      const dest = path.join(mapsDir, `${row.concept}.json`);
      writeFileSync(dest, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(`Map written: ${dest}`);
    }
  }
  if (blocker) process.exitCode = 1;
}
