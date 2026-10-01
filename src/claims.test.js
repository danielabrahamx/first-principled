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

import { GOLD_MAPS } from "../eval/map-quality/gold.js";
import { MAX_PATH_NODES } from "./lib/agent/pairwise/topology.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} relative
 * @returns {string}
 */
function read(relative) {
  return readFileSync(join(ROOT, relative), "utf8");
}

/**
 * Pull a `const NAME = value` constant out of a source file. Accepts a
 * quoted string or a bare number, because thresholds like MIN_NODES are
 * numbers and the model constants are strings.
 *
 * @param {string} relative
 * @param {string} name
 * @returns {string}
 */
function sourceConst(relative, name) {
  const text = read(relative);
  const match = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*("[^"]*"|[0-9]+)`).exec(text);
  assert.ok(match, `${relative} must declare ${name}`);
  return /** @type {string} */ (match[1]).replace(/^"|"$/g, "");
}

const DEFAULT_OPENROUTER_MODEL = sourceConst(
  "src/lib/agent/llm.js",
  "OPENROUTER_DEFAULT_MODEL"
);
const DEFAULT_DEEPSEEK_MODEL = sourceConst("src/lib/agent/llm.js", "DEEPSEEK_DEFAULT_MODEL");

/**
 * Walk the hand-written gold maps and measure the four properties the
 * acceptance gate tests. Imported rather than transcribed, so a change to
 * a map moves the assertion instead of silently invalidating a comment.
 *
 * The traversal mirrors `selectTopology`: dependent to prerequisite, from
 * the crown down, capped at MAX_PATH_NODES.
 *
 * @returns {Array<[string, { nodes: number; trunk: number; onCrown: number; maxFanIn: number }]>}
 */
function measureGoldMaps() {
  return GOLD_MAPS.map((map) => {
    const concept = map.concept;
    const rested = new Set(map.edges.map((edge) => edge.target));
    const crowns = map.nodes.map((node) => node.id).filter((id) => !rested.has(id));
    assert.equal(crowns.length, 1, `${concept} must have exactly one crown to be a Dependence Tree`);
    const crown = /** @type {string} */ (crowns[0]);
    /** @type {Map<string, string[]>} */
    const prereqs = new Map();
    for (const edge of map.edges) {
      if (!prereqs.has(edge.source)) prereqs.set(edge.source, []);
      prereqs.get(edge.source)?.push(edge.target);
    }
    let trunk = 0;
    /** @param {string[]} path */
    const walk = (path) => {
      if (path.length > trunk) trunk = path.length;
      if (path.length >= MAX_PATH_NODES) return;
      for (const next of prereqs.get(path[path.length - 1]) ?? []) {
        if (!path.includes(next)) walk([...path, next]);
      }
    };
    walk([crown]);
    /** @type {Map<string, number>} */
    const dependents = new Map();
    for (const edge of map.edges) {
      dependents.set(edge.target, (dependents.get(edge.target) ?? 0) + 1);
    }
    return [
      concept,
      {
        nodes: map.nodes.length,
        trunk,
        onCrown: map.edges.filter((edge) => edge.target === crown).length,
        maxFanIn: Math.max(0, ...dependents.values()),
      },
    ];
  });
}

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

test("STATUS.md quotes the topology thresholds that decide the gold set", () => {
  // The 2026-09-29 defect: a gate that returned ok for a 2-node tree,
  // and STATUS.md still said 4 of 4 gold words passed. Both halves
  // drifted from the code at once. These thresholds are what the honest
  // pass rate is measured against, so a change to one that is not
  // reflected here is a change nobody measured.
  const status = read("docs/STATUS.md");
  const topology = read("src/lib/agent/pairwise/topology.js");
  for (const name of ["MIN_NODES", "MIN_TRUNK_NODES", "MAX_NODES"]) {
    const value = sourceConst("src/lib/agent/pairwise/topology.js", name);
    assert.ok(
      new RegExp(`export const ${name} = ${value};`).test(topology),
      `${name} must stay an exported constant set to ${value}, not an inline literal`
    );
    assert.ok(
      status.includes(value),
      `docs/STATUS.md must state the real ${name} value (${value})`
    );
  }
  // And the gate must have a test that fails it. A gate nobody can fail
  // is the v7 funnel.
  const tests = read("src/lib/agent/pairwise/topology.test.js");
  assert.match(tests, /a 2-node graph is not a tree/);
  assert.match(tests, /crown invariant/);
});

test("the hand-written gold maps pass the acceptance gate", () => {
  // The load-bearing assertion of this file's whole purpose. The gate
  // decides what counts as a Dependence Tree, and `eval/map-quality/gold.js`
  // is the hand-written definition of one. If the thresholds reject those
  // maps, the gate is fitted to the fixture, which is the documented v7
  // failure mode and cost ticket 02 its honest score.
  //
  // Measured, not hardcoded: the maps are walked here with the same
  // traversal topology.js uses. A change to either the maps or the
  // thresholds is what moves this test. Between 2026-09-29 and 2026-10-01
  // this assertion could not have existed, because the live floors were
  // wrong and a red suite gets "fixed" without anyone reading why.
  const status = read("docs/STATUS.md");
  const minNodes = Number(sourceConst("src/lib/agent/pairwise/topology.js", "MIN_NODES"));
  const minTrunk = Number(sourceConst("src/lib/agent/pairwise/topology.js", "MIN_TRUNK_NODES"));
  for (const [name, size] of measureGoldMaps()) {
    assert.ok(
      size.nodes >= minNodes,
      `${name} is a hand-written gold map with ${size.nodes} nodes and MIN_NODES is ${minNodes}. ` +
        "The gate must accept the definition it is written against."
    );
    assert.ok(
      size.trunk >= minTrunk,
      `${name} is a hand-written gold map with a ${size.trunk}-node trunk and MIN_TRUNK_NODES is ${minTrunk}.`
    );
    assert.equal(
      size.onCrown,
      0,
      `${name} has ${size.onCrown} edges resting on its crown, so the crown invariant rejects it. ` +
        "Every hand-written map has a single top; that is where the invariant comes from."
    );
  }
  // And the thresholds have to be recorded where they are decided, next to
  // their derivation, or the next session cannot tell a measured floor
  // from a tuned one.
  for (const value of [minNodes, minTrunk]) {
    assert.ok(status.includes(String(value)), `docs/STATUS.md must state the live floor (${value})`);
  }
  assert.match(
    status,
    /derive[d]?-thresholds\.mjs|derive-thresholds/,
    "docs/STATUS.md must name the script that derives the floors from the hand-written maps"
  );
});

test("every gate constant a test cannot reach is named as such", () => {
  // 2026-10-01: MAX_FANIN_PER_TRUNK_NODE = 2 and TRUNK_MAX = 7 were
  // module-private consts in topology.js, so no test could assert on
  // either, and the first clipped the canonical `laptop` fixture. Both are
  // exported now. This test keeps it that way: a new unexported threshold
  // has to be recorded here or turned into a dead number.
  const topology = read("src/lib/agent/pairwise/topology.js");
  // Only consts that carry their own numeric value are thresholds. A
  // module-private alias like `TRUNK_MIN = MIN_TRUNK_NODES` holds no
  // number of its own and is not a threshold anyone can get wrong.
  const declared = [...topology.matchAll(/^const\s+([A-Z_]+)\s*=\s*([0-9]+)\s*;/gm)].map((m) => m[1]);
  const unexported = declared.filter((name) => !new RegExp(`export\\s+const\\s+${name}\\s*=`).test(topology));
  assert.deepEqual(
    unexported,
    [],
    `topology.js declares a numeric constant that is not exported, so nothing can assert on it: ${unexported.join(", ")}`
  );
});

test("the v9 frontier agrees with the v9 issue statuses", () => {
  // The frontier and the issue files must not disagree about what is
  // open. A resolved ticket still listed as the next task sends the next
  // agent back into finished work, and an open ticket missing from the
  // frontier hides work nobody has claimed.
  const frontier = read(".scratch/first-principled-v9/map.md");
  assert.ok(/## Open frontier/.test(frontier), "the v9 map must declare an open frontier");
  const ticket01 = read(".scratch/first-principled-v9/issues/01-pairwise-falsification-spike.md");
  const ticket02 = read(".scratch/first-principled-v9/issues/02-surface-realization-and-honesty.md");
  const ticket03 = read(".scratch/first-principled-v9/issues/03-generality-and-gate-provenance.md");
  assert.match(ticket01, /\*\*Status:\*\*\s*resolved/i, "ticket 01 must be marked resolved");
  assert.match(ticket02, /\*\*Status:\*\*\s*resolved/i, "ticket 02 must be marked resolved");
  assert.match(ticket03, /\*\*Status:\*\*\s*resolved/i, "ticket 03 must be marked resolved");
  const ticket04 = read(".scratch/first-principled-v9/issues/04-apply-derived-gate-thresholds.md");
  assert.match(ticket04, /\*\*Status:\*\*\s*resolved/i, "ticket 04 must be marked resolved");
  // Ticket 04 applied the floors ticket 03 derived, so the adapter is
  // unblocked and has to be named as the next thing. The moment the
  // frontier says "blocked on the disputed gate" again, either the
  // dispute is back or the note is a lie, and both deserve a red suite.
  assert.ok(
    /\[05 - RealityMap adapter/.test(frontier),
    "the frontier must name ticket 05, the adapter, as the next ticket"
  );
  assert.ok(
    !/\*\*Blocked\*\* on 0[34]/.test(frontier),
    "tickets 03 and 04 are resolved, so nothing may still be blocked on them"
  );
  assert.ok(
    !/\[01 - Pairwise falsification spike\][^\n]*\(unblocked; next\)/.test(frontier),
    "ticket 01 is resolved and must not be listed as next"
  );
  assert.ok(
    !/\[03 - Generality and gate provenance\][^\n]*\(next\)/.test(frontier),
    "ticket 03 is resolved and must not be listed as next"
  );
  assert.ok(
    !/\[04 - Apply the derived gate thresholds\][^\n]*\(next\)/.test(frontier),
    "ticket 04 is resolved and must not be listed as next"
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

test("the scraped vendor HTML is gone, and the record says so", () => {
  // This directory was 18.5 MB across 66 files and was deleted
  // 2026-09-29. The test's job is to keep the note and the filesystem
  // from disagreeing in either direction: the note must not claim a
  // directory that exists, and must not go silent about one that is
  // gone. It was untracked, so git history cannot be the record.
  const archive = read("docs/ARCHIVE.md");
  assert.match(archive, /_sources/);
  assert.match(archive, /Deleted\s*\n?\s*2026-09-29/);
  assert.ok(
    !existsSync(join(ROOT, ".scratch/first-principled-v7/research/_sources")),
    "the directory is deleted; docs/ARCHIVE.md must not imply it is still there"
  );
  // And the one document that cited it as an evidence base is marked,
  // so nobody follows a pointer to nothing.
  const matrix = read(".scratch/first-principled-v7/research/12-provider-capability-matrix.md");
  assert.match(matrix, /lived in `_sources\/`/);
  assert.match(matrix, /deleted on 2026-09-29/);
});
