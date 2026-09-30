/**
 * Ticket 03: derive the acceptance thresholds in
 * `src/lib/agent/pairwise/topology.js` from the hand-written gold maps in
 * `eval/map-quality/gold.js`, not from the acceptance runs.
 *
 * Pure, offline, no model call. It measures each hand-written map on the
 * four properties the gate cares about, then prints the smallest value of
 * each property that every hand-written map satisfies. Those minima are
 * the derivations. Where a hand-written map fails a live threshold, the
 * threshold is named as disputed; nothing here changes a threshold.
 *
 * Usage: node .scratch/first-principled-v9/research/03-runs/derive-thresholds.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MAX_NODES,
  MAX_PATH_NODES,
  MIN_NODES,
  MIN_TRUNK_NODES,
} from "../../../../src/lib/agent/pairwise/topology.js";
import { GOLD_MAPS } from "../../../../eval/map-quality/gold.js";

const TOPOLOGY = fileURLToPath(import.meta.resolve("../../../../src/lib/agent/pairwise/topology.js"));

/**
 * The crown is the node the learner typed: the map's concept node. In
 * every hand-written map it is the one node that nothing rests on, which
 * is what the crown invariant asserts about generated trees too.
 *
 * @param {{ concept: string; nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> }} map
 * @returns {string}
 */
function crownOf(map) {
  const rested = new Set(map.edges.map((edge) => edge.target));
  const sources = map.nodes.map((node) => node.id).filter((id) => !rested.has(id));
  const byLabel = map.nodes.find((node) => node.label === map.concept);
  if (sources.length !== 1) {
    throw new Error(`${map.concept}: expected one crown, found ${sources.length} (${sources.join(", ")})`);
  }
  if (byLabel && byLabel.id !== sources[0]) {
    throw new Error(`${map.concept}: crown by label is ${byLabel.id}, by in-degree is ${sources[0]}`);
  }
  return sources[0];
}

/**
 * Longest simple directed walk from the crown to a leaf, following
 * dependent -> prerequisite. Same traversal shape topology.js walks.
 *
 * @param {{ nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> }} map
 * @param {string} crown
 * @returns {number}
 */
function longestTrunk(map, crown) {
  /** @type {Map<string, string[]>} */
  const prereqs = new Map();
  for (const edge of map.edges) {
    if (!prereqs.has(edge.source)) prereqs.set(edge.source, []);
    prereqs.get(edge.source)?.push(edge.target);
  }
  let longest = 0;
  /** @param {string[]} path */
  const walk = (path) => {
    if (path.length > longest) longest = path.length;
    if (path.length >= MAX_PATH_NODES) return;
    const nexts = prereqs.get(path[path.length - 1]) ?? [];
    for (const next of nexts) {
      if (path.includes(next)) continue;
      walk([...path, next]);
    }
  };
  walk([crown]);
  return longest;
}

/**
 * @param {{ nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> }} map
 * @param {string} crown
 * @returns {number}
 */
function directPrereqsOfCrown(map, crown) {
  return map.edges.filter((edge) => edge.source === crown).length;
}

/**
 * @param {{ nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> }} map
 * @returns {number}
 */
function maxFanIn(map) {
  /** @type {Map<string, number>} */
  const dependents = new Map();
  for (const edge of map.edges) {
    dependents.set(edge.target, (dependents.get(edge.target) ?? 0) + 1);
  }
  return Math.max(0, ...dependents.values());
}

const rows = GOLD_MAPS.map((map) => {
  const crown = crownOf(map);
  return {
    concept: map.concept,
    nodes: map.nodes.length,
    edges: map.edges.length,
    trunk: longestTrunk(map, crown),
    crownDirect: directPrereqsOfCrown(map, crown),
    maxFanIn: maxFanIn(map),
    // Nothing rests on the crown in any hand-written map. That is the
    // crown invariant, and here it is a property of the target rather
    // than of the acceptance runs.
    onCrown: map.edges.filter((edge) => edge.target === crown).length,
  };
});

const pad = (value, width) => String(value).padEnd(width);
console.log("Hand-written gold maps, measured on the four gate properties:");
console.log(
  pad("map", 16) + pad("nodes", 7) + pad("edges", 7) + pad("trunk", 7) + pad("crownDirect", 12) + pad("maxFanIn", 10) + "onCrown"
);
console.log("-".repeat(70));
for (const row of rows) {
  console.log(
    pad(row.concept, 16) + pad(row.nodes, 7) + pad(row.edges, 7) + pad(row.trunk, 7) + pad(row.crownDirect, 12) + pad(row.maxFanIn, 10) + row.onCrown
  );
}

const min = (/** @type {string} */ key) => Math.min(...rows.map((row) => Number(row[key])));
const max = (/** @type {string} */ key) => Math.max(...rows.map((row) => Number(row[key])));

console.log("\nDerived floors (the smallest value every hand-written map satisfies):");
console.log(`  MIN_NODES          floor ${min("nodes")}   observed ${min("nodes")} to ${max("nodes")}   live value ${MIN_NODES}`);
console.log(`  MIN_TRUNK_NODES    floor ${min("trunk")}   observed ${min("trunk")} to ${max("trunk")}   live value ${MIN_TRUNK_NODES}`);
console.log(`  MAX_NODES          cap   ${max("nodes")}   observed ${min("nodes")} to ${max("nodes")}   live value ${MAX_NODES}`);
console.log(`  MAX_PATH_NODES     cap   ${max("trunk")}   observed ${min("trunk")} to ${max("trunk")}   live value ${MAX_PATH_NODES}`);
console.log(`  crown fan-in cap   n/a   ${max("crownDirect")}   observed ${min("crownDirect")} to ${max("crownDirect")}   live value (none, crown invariant only)`);
// MAX_FANIN_PER_TRUNK_NODE is a module-private const in topology.js, so it
// cannot be read here. Measured against the hand-written maps it is 2
// against an observed range of min to max; that it is not exported is
// itself a finding, because no test can assert on it.
console.log(`  MAX_FANIN_PER_TRUNK_NODE  derived ${max("maxFanIn")}   observed ${min("maxFanIn")} to ${max("maxFanIn")}   live value 2 (not exported)`);

// TRUNK_MAX is also module-private, and it is a scoring preference rather
// than an acceptance rule, so it is read as a literal here with the line
// number it came from.
const trunkMax = Number(/^const TRUNK_MAX = ([0-9]+);/m.exec(readFileSync(TOPOLOGY, "utf8"))?.[1]);
console.log(`  TRUNK_MAX               cap   ${max("trunk")}   observed ${min("trunk")} to ${max("trunk")}   live value ${trunkMax} (not exported, scoring only)`);

console.log("\nVerdict against the live gate:");
for (const row of rows) {
  const fails = [];
  if (row.nodes < MIN_NODES) fails.push(`MIN_NODES (${row.nodes} < ${MIN_NODES})`);
  if (row.trunk < MIN_TRUNK_NODES) fails.push(`MIN_TRUNK_NODES (${row.trunk} < ${MIN_TRUNK_NODES})`);
  if (row.onCrown > 0) fails.push(`crown invariant (${row.onCrown} edges on crown)`);
  console.log(`  ${pad(row.concept, 16)} ${fails.length === 0 ? "passes" : "FAILS " + fails.join(" and ")}`);
}