/**
 * Summarize one or more gold-words.mjs --json captures into one line per
 * word. Read-only, no model call. Ticket 03 research tool.
 *
 * Usage: node .scratch/first-principled-v9/research/03-runs/summarize.mjs phys.json comp.json
 */

import { readFileSync } from "node:fs";

const pad = (value, width) => String(value ?? "-").padEnd(width);
const files = process.argv.slice(2);
for (const file of files) {
  const data = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  console.log(`--- ${file}  route ${data.provider}/${data.model}`);
  for (const r of data.results) {
    console.log(
      pad(r.word, 20) +
        pad(r.ok ? "PASS" : "FAIL", 6) +
        pad(r.stage, 10) +
        pad(r.nodes, 6) +
        pad(r.trunk, 6) +
        pad(`inv${r.candidates}`, 6) +
        pad(`pairs${r.pairs}`, 8) +
        pad(`tgtOK${r.targetPrereqs}`, 9) +
        pad(`tgtBig${r.targetPairsTooLarge}`, 9) +
        pad(`copy${r.realized ?? "-"}`, 8) +
        (r.trunkPath || (r.errors && r.errors[0]) || "")
    );
  }
}