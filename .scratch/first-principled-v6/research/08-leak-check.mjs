// Key-leak grep. Prints hit counts and paths, never the key.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const vars = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m) continue;
  vars[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const key = vars.LLM_API_KEY || "";
if (!key) {
  console.error("no key");
  process.exit(1);
}

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function hitsIn(files) {
  const hits = [];
  for (const file of files) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes(key)) hits.push(file.replaceAll("\\", "/"));
  }
  return hits;
}

const trackedHits = hitsIn(tracked);
const srcHits = hitsIn(walk("src"));
const fnHits = hitsIn(walk("netlify"));
const skHits = [];
for (const file of tracked) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (/(?:sk-or-v1-|sk-)[A-Za-z0-9]{16,}/.test(text) && !file.endsWith(".env.example")) {
    skHits.push(file.replaceAll("\\", "/"));
  }
}

console.log("TRACKED_KEY_HITS=" + trackedHits.length);
if (trackedHits.length) console.log(trackedHits.join("\n"));
console.log("SRC_KEY_HITS=" + srcHits.length);
if (srcHits.length) console.log(srcHits.join("\n"));
console.log("NETLIFY_KEY_HITS=" + fnHits.length);
if (fnHits.length) console.log(fnHits.join("\n"));
console.log("TRACKED_SK_HITS=" + skHits.length);
if (skHits.length) console.log(skHits.join("\n"));
console.log("ENV_GITIGNORED=" + !tracked.includes(".env"));

const failed =
  trackedHits.length + srcHits.length + fnHits.length + skHits.length > 0 ||
  tracked.includes(".env");
process.exit(failed ? 1 : 0);
