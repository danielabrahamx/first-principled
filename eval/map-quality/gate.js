/**
 * Automated Reality Map quality gate (v6 ticket 07).
 *
 * Structural checks catch lies the schema already almost allows: a chain
 * that never names the concept, a layer that skips the one below it, or a
 * tree with no dependence edges. Gold overlap is checkable similarity, not
 * a second schema. Followability is the written rubric, not this module.
 */

import { deriveCheck } from "../../src/lib/agent/realityMap.js";
import { validateRealityMap } from "../../src/lib/mmg/validator.js";

/** Edge types that draw the Tree's dependence path. */
export const DEPENDENCE_TYPES = Object.freeze([
  "built-on",
  "depends-on",
  "abstraction-of",
]);

/**
 * @typedef {object} GateChecks
 * @property {boolean} schemaValid
 * @property {boolean} contiguous
 * @property {boolean} deriveOk
 * @property {boolean} crownReached
 * @property {boolean} hasDependence
 * @property {boolean} noSkippedLayer
 */

/**
 * @typedef {object} OverlapScore
 * @property {number} labelsHit
 * @property {number} labelsTotal
 * @property {number} pairsHit
 * @property {number} pairsTotal
 * @property {number} labelRatio
 * @property {number} pairRatio
 * @property {string[]} missingLabels
 * @property {string[]} missingPairs
 */

/**
 * @typedef {object} MapQualityScore
 * @property {string} concept
 * @property {boolean} pass
 * @property {GateChecks} checks
 * @property {string[]} errors
 * @property {OverlapScore | null} overlap
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whole-phrase containment after normalize. Avoids "bit" matching "orbit"
 * by requiring a token boundary around the shorter phrase.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function labelsMatch(a, b) {
  const left = normalizeLabel(a);
  const right = normalizeLabel(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const padded = (s) => ` ${s} `;
  return padded(right).includes(padded(left)) || padded(left).includes(padded(right));
}

/**
 * Some node's label names the concept (same rule as the generator's crown
 * check: normalized containment either way).
 *
 * @param {string} concept
 * @param {any} map
 * @returns {boolean}
 */
export function crownReached(concept, map) {
  const target = normalizeLabel(concept);
  if (target.length === 0) return true;
  const nodes = Array.isArray(map && map.nodes) ? map.nodes : [];
  return nodes.some((node) => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return false;
    return labelsMatch(target, node.label);
  });
}

/**
 * Every layer after the foundation has at least one edge to the layer
 * immediately below it. Contiguity (any lower layer) is weaker and lives
 * in validateRealityMap; this is the no-skipped-layer rule.
 *
 * @param {any} map
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function adjacentDownEdges(map) {
  const errors = /** @type {string[]} */ ([]);
  if (!map || !Array.isArray(map.layers) || !Array.isArray(map.nodes) || !Array.isArray(map.edges)) {
    return { ok: false, errors: ["map must have layers, nodes and edges"] };
  }
  const layerIndex = new Map(map.layers.map((layer, i) => [layer.id, i]));
  const nodeLayer = new Map(map.nodes.map((node) => [node.id, layerIndex.get(node.layer)]));
  for (let i = 1; i < map.layers.length; i++) {
    const layer = map.layers[i];
    const connects = map.edges.some((edge) => {
      const s = nodeLayer.get(edge.source);
      const t = nodeLayer.get(edge.target);
      if (s === undefined || t === undefined) return false;
      return (s === i && t === i - 1) || (t === i && s === i - 1);
    });
    if (!connects) {
      errors.push(
        `layer "${layer.name}" (${layer.id}) has no edge to the layer immediately below`
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {any} map
 * @returns {boolean}
 */
export function hasDependenceEdges(map) {
  const edges = Array.isArray(map && map.edges) ? map.edges : [];
  return edges.some((edge) => DEPENDENCE_TYPES.includes(edge.type));
}

/**
 * @param {any} map
 * @returns {{ id: string; label: string }[]}
 */
function labeledNodes(map) {
  const nodes = Array.isArray(map && map.nodes) ? map.nodes : [];
  return nodes
    .filter((node) => node && typeof node === "object" && typeof node.label === "string")
    .map((node) => ({ id: String(node.id), label: normalizeLabel(node.label) }));
}

/**
 * Dependence pairs as "sourceLabel -> targetLabel (type)", matched by
 * label not id so a live map can hit gold without sharing ids.
 *
 * @param {any} map
 * @returns {{ key: string; source: string; target: string; type: string }[]}
 */
export function dependencePairs(map) {
  const nodes = labeledNodes(map);
  const byId = new Map(nodes.map((node) => [node.id, node.label]));
  const edges = Array.isArray(map && map.edges) ? map.edges : [];
  const pairs = [];
  for (const edge of edges) {
    if (!DEPENDENCE_TYPES.includes(edge.type)) continue;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    pairs.push({
      key: `${source} -> ${target} (${edge.type})`,
      source,
      target,
      type: edge.type,
    });
  }
  return pairs;
}

/**
 * @param {any} candidate
 * @param {any} gold
 * @returns {OverlapScore}
 */
export function goldOverlap(candidate, gold) {
  const goldLabels = labeledNodes(gold).map((node) => node.label);
  const candidateLabels = labeledNodes(candidate).map((node) => node.label);
  const missingLabels = goldLabels.filter(
    (label) => !candidateLabels.some((candidate) => labelsMatch(label, candidate))
  );
  const goldPairs = dependencePairs(gold);
  const candidatePairs = dependencePairs(candidate);
  const missingPairs = goldPairs
    .filter(
      (goldPair) =>
        !candidatePairs.some(
          (candidatePair) =>
            candidatePair.type === goldPair.type &&
            labelsMatch(goldPair.source, candidatePair.source) &&
            labelsMatch(goldPair.target, candidatePair.target)
        )
    )
    .map((pair) => pair.key);
  const labelsHit = goldLabels.length - missingLabels.length;
  const pairsHit = goldPairs.length - missingPairs.length;
  return {
    labelsHit,
    labelsTotal: goldLabels.length,
    pairsHit,
    pairsTotal: goldPairs.length,
    labelRatio: goldLabels.length === 0 ? 1 : labelsHit / goldLabels.length,
    pairRatio: goldPairs.length === 0 ? 1 : pairsHit / goldPairs.length,
    missingLabels,
    missingPairs,
  };
}

/**
 * Score a candidate map. Pass is the automated gate only (schema, derive,
 * crown, dependence, no skipped layer). Overlap is reported beside it.
 *
 * @param {any} candidate
 * @param {{ gold?: any; concept?: string; requireCrown?: boolean }} [options]
 * @returns {MapQualityScore}
 */
export function scoreMap(candidate, options = {}) {
  const gold = options.gold ?? null;
  const concept =
    typeof options.concept === "string"
      ? options.concept
      : gold && typeof gold.concept === "string"
        ? gold.concept
        : candidate && typeof candidate.concept === "string"
          ? candidate.concept
          : "";
  const requireCrown = options.requireCrown !== false;

  const schema = validateRealityMap(candidate);
  const derive = deriveCheck(candidate);
  const adjacent = adjacentDownEdges(candidate);
  const crown = crownReached(concept, candidate);
  const dependence = hasDependenceEdges(candidate);
  const contiguous = schema.ok || !schema.errors.some((error) => /layer chain gap/.test(error));

  const errors = [
    ...(schema.ok ? [] : schema.errors.map((error) => `schema: ${error}`)),
    ...(derive.ok ? [] : derive.errors.map((error) => `derive: ${error}`)),
    ...(adjacent.ok ? [] : adjacent.errors.map((error) => `skipped-layer: ${error}`)),
    ...(dependence ? [] : ["dependence: no built-on / depends-on / abstraction-of edge"]),
    ...(requireCrown && !crown ? [`crown: no node label names "${concept}"`] : []),
  ];

  const checks = {
    schemaValid: schema.ok,
    contiguous,
    deriveOk: derive.ok,
    crownReached: crown,
    hasDependence: dependence,
    noSkippedLayer: adjacent.ok,
  };

  const pass =
    checks.schemaValid &&
    checks.deriveOk &&
    checks.hasDependence &&
    checks.noSkippedLayer &&
    (!requireCrown || checks.crownReached);

  return {
    concept,
    pass,
    checks,
    errors,
    overlap: gold ? goldOverlap(candidate, gold) : null,
  };
}

/**
 * Rebuild a one-shot model reply into a scorable map. Layer ids become
 * l0..ln in reply order; nodes rebind by the id or name the model used;
 * each layer's node list is rewritten from node.layer.
 *
 * @param {string} concept
 * @param {any} parsed
 * @returns {any | null}
 */
export function candidateFromOneShot(concept, parsed) {
  if (!parsed || typeof parsed !== "object" || parsed.isValidConcept === false) return null;
  if (!Array.isArray(parsed.layers) || !Array.isArray(parsed.nodes)) return null;
  const byOriginal = new Map();
  const layers = parsed.layers.map((layer, i) => {
    const id = `l${i}`;
    const name =
      layer !== null && typeof layer === "object" && typeof layer.name === "string"
        ? layer.name
        : "";
    const original =
      layer !== null && typeof layer === "object" && typeof layer.id === "string"
        ? layer.id
        : "";
    if (original) byOriginal.set(original, id);
    if (name) byOriginal.set(name, id);
    return { id, name, nodes: [] };
  });
  const nodes = parsed.nodes
    .filter((node) => node !== null && typeof node === "object")
    .map((node) => {
      const original = String(node.layer ?? "");
      return { ...node, layer: byOriginal.get(original) ?? String(node.layer ?? "") };
    });
  for (const node of nodes) {
    const layer = layers.find((item) => item.id === node.layer);
    if (layer) layer.nodes.push(node.id);
  }
  return {
    concept,
    layers,
    nodes,
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
  };
}
