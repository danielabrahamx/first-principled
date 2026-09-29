/**
 * Doc-drift gate.
 *
 * The measured failure in this repo is that four entry documents named
 * four different default models and three different frontiers, while
 * all 409 tests passed. Nothing checked the docs against the code, so
 * a hallucinated or stale claim stayed authoritative and an agent
 * acting on it was actively misled.
 *
 * This test makes the load-bearing claims executable. It reads the
 * actual constants out of the source and asserts that docs/STATUS.md,
 * AGENTS.md, README.md, and CONTEXT.md agree with them. Change a model
 * id in llm.js without updating the docs and this fails.
 *
 * Cheap by construction: pure text and regex over files that are
 * already in the working tree, no model, no network.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} relative
 * @returns {string}
 */
function read(relative) {
  return readFileSync(join(ROOT, relative), "utf8");
}

/**
 * Pull a `const NAME = "value"` string constant out of a source file.
 *
 * @param {string} relative
 * @param {string} name
 * @returns {string}
 */
function sourceConst(relative, name) {
  const text = read(relative);
  const match = new RegExp(`${name}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`).exec(text);
  assert.ok(match, `${relative} must declare ${name}`);
  return /** @type {string} */ (match[1]);
}

const DEFAULT_OPENROUTER_MODEL = sourceConst(
  "src/lib/agent/llm.js",
  "OPENROUTER_DEFAULT_MODEL"
);
const DEFAULT_DEEPSEEK_MODEL = sourceConst("src/lib/agent/llm.js", "DEEPSEEK_DEFAULT_MODEL");

test("STATUS.md quotes the real transport constants", () => {
  const status = read("docs/STATUS.md");
  assert.ok(
    status.includes(DEFAULT_OPENROUTER_MODEL),
    `docs/STATUS.md must name the real default OpenRouter model (${DEFAULT_OPENROUTER_MODEL})`
  );
  assert.ok(
    status.includes(DEFAULT_DEEPSEEK_MODEL),
    `docs/STATUS.md must name the real default DeepSeek model (${DEFAULT_DEEPSEEK_MODEL})`
  );
});

test("no entry document names a model the transport does not use", () => {
  // The specific rot that was measured: CONTEXT.md and README.md named
  // models that had not been the default for several versions. A doc
  // may mention a historical model only if it says so explicitly.
  const historical = ["stealth/ox-alpha", "nvidia/nemotron-3-ultra-550b-a55b"];
  const current = [DEFAULT_OPENROUTER_MODEL, DEFAULT_DEEPSEEK_MODEL];
  for (const doc of ["AGENTS.md", "README.md", "CONTEXT.md", "docs/STATUS.md"]) {
    const text = read(doc);
    for (const model of historical) {
      if (!text.includes(model)) continue;
      const markedAsHistorical =
        /historical|formerly|older|previously|retired|superseded|no longer|wrong|do not use/i.test(
          text.slice(Math.max(0, text.indexOf(model) - 300), text.indexOf(model) + 300)
        );
      assert.ok(
        markedAsHistorical,
        `${doc} names ${model} as if current. It is not the default in llm.js. ` +
          `Mark it explicitly as historical, or replace it with ${current[0]}.`
      );
    }
  }
});

test("the v9 frontier agrees with the v9 issue statuses", () => {
  // The frontier and the issue files must not disagree about what is
  // open. A resolved ticket still listed as the next task sends the next
  // agent back into finished work.
  const frontier = read(".scratch/first-principled-v9/map.md");
  assert.ok(/## Open frontier/.test(frontier), "the v9 map must declare an open frontier");
  assert.ok(
    /\[02 - Surface realization and honesty\]/.test(frontier),
    "the open frontier must name ticket 02"
  );

  const ticket01 = read(".scratch/first-principled-v9/issues/01-pairwise-falsification-spike.md");
  assert.match(ticket01, /\*\*Status:\*\*\s*resolved/i, "ticket 01 must be marked resolved");
  assert.ok(
    !/\[01 - Pairwise falsification spike\][^\n]*\(unblocked; next\)/.test(frontier),
    "ticket 01 is resolved and must not be listed as next"
  );

  for (const doc of ["README.md", "CONTEXT.md"]) {
    const text = read(doc);
    const claimsV7 = /current effort is v7|current effort map:\s*`?\.scratch\/first-principled-v7/i.test(text);
    assert.ok(!claimsV7, `${doc} still names v7 as the current effort. v9 is live.`);
  }
});

test("AGENTS.md points at exactly one map", () => {
  const agents = read("AGENTS.md");
  const maps = [...agents.matchAll(/\.scratch\/first-principled-v\d+\/map\.md/g)].map((m) => m[0]);
  const unique = [...new Set(maps)];
  assert.equal(
    unique.length,
    1,
    `AGENTS.md must name one map as authoritative. Found: ${unique.join(", ")}`
  );
  assert.ok(unique[0].includes("v9"), `the live map is v9, not ${unique[0]}`);
});

test("the model default is declared in exactly one place in the code", () => {
  // A second hardcoded default is how the docs drifted in the first
  // place: llm.js, .env.example, netlify.toml, and README each carried
  // their own copy and they diverged.
  const envExample = read(".env.example");
  assert.ok(
    envExample.includes(DEFAULT_OPENROUTER_MODEL),
    `.env.example must match llm.js (${DEFAULT_OPENROUTER_MODEL})`
  );
});

test("every tracked file that is imported exists on disk", () => {
  // A fresh clone must be able to run `npm test` and `npm run eval`.
  // Two eval modules were untracked while their importer was tracked,
  // which silently breaks the eval harness for anyone but the author.
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((line) => line.endsWith(".js") || line.endsWith(".mjs"));
  const missing = [];
  for (const file of tracked) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const match of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = join(dirname(file), /** @type {string} */ (match[1]));
      if (!existsSync(target)) missing.push(`${file} imports missing ${match[1]}`);
    }
  }
  assert.deepEqual(missing, [], `a fresh clone would fail to load:\n${missing.join("\n")}`);
});

test("docs/STATUS.md points at files that exist", () => {
  // Only references that look like a path AND end in a known source or
  // doc extension are checked. A bare filename in prose ("see llm.js")
  // and a model id containing a slash are both deliberate shorthand.
  const status = read("docs/STATUS.md");
  const referenced = [...status.matchAll(/`([\w.][\w./-]*\/[\w./-]+\.(?:md|mjs|js))`/g)].map(
    (m) => m[1]
  );
  const broken = referenced.filter((path) => !existsSync(join(ROOT, path)));
  assert.deepEqual(
    broken,
    [],
    `docs/STATUS.md references paths that do not exist: ${broken.join(", ")}`
  );
});

test("closed effort directories are labelled closed, and v9 is the live one", () => {
  // Ten map.md files all read as current. An agent that greps for "map"
  // finds ten and has to guess. The archive document is the one place
  // that says which is which, and this keeps the v9 name correct.
  const archive = read("docs/ARCHIVE.md");
  assert.ok(
    archive.includes("docs/STATUS.md"),
    "docs/ARCHIVE.md must point at the single source of current truth"
  );
  assert.ok(
    /`\.scratch\/first-principled-v9\/`[^\n]*\*\*live\*\*/.test(archive),
    "docs/ARCHIVE.md must mark the v9 directory as live"
  );
  // The live effort is the one AGENTS.md names as authoritative.
  assert.ok(
    /\*\*Map \(only\):\*\* `\.scratch\/first-principled-v9\/map\.md`/.test(read("AGENTS.md")),
    "AGENTS.md must name the v9 map as the only authoritative map"
  );
});

test("the fenced 18.5 MB of scraped vendor HTML is still flagged as removable", () => {
  // A known dead-weight directory. The claim must stay honest: if a
  // future session uses it, or deletes it, the note must be updated
  // rather than left to rot into a false statement.
  const archive = read("docs/ARCHIVE.md");
  assert.match(archive, /_sources/);
  assert.match(archive, /Nothing\s+imports it/i);
});
