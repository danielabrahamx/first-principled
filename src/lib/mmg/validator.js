/**
 * Validation for both sides of the Mental Model Graph.
 *
 * Every validator returns `{ ok, errors }` and is a pure function: same input,
 * same output, no state. Errors are human-readable strings; `errors` is empty
 * when `ok` is true.
 *
 * The layer-chain contiguity invariant (spec principle 12, "no skipped
 * intermediate steps"): every layer after the first has at least one edge
 * connecting it to a strictly lower layer - either endpoint in the layer, the
 * other in a lower one. This is what makes a chain with a gap invalid.
 */

import { EDGE_TYPES, NODE_STATES } from "./types.js";
import { observationProblems } from "./observation.js";

/**
 * Abuse-control caps (ticket 18): a reality map beyond these sizes is not
 * a concept map, it is an attacker inflating the prompt (and the bill).
 * Live sessions generate ~11 nodes; these caps are generous multiples.
 */
export const MAX_REALITY_NODES = 60;
export const MAX_REALITY_EDGES = 120;
export const MAX_REALITY_LAYERS = 12;

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 */

/** @returns {ValidationResult} */
function ok() {
  return { ok: true, errors: [] };
}

/** @param {string[]} errors @returns {ValidationResult} */
function bad(errors) {
  return { ok: false, errors };
}

/**
 * @param {unknown} value
 * @param {string} what
 * @returns {ValidationResult}
 */
function expectObject(value, what) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return bad([`${what} must be an object`]);
  }
  return ok();
}

/**
 * @param {unknown} value
 * @param {string} what
 * @returns {ValidationResult}
 */
function expectString(value, what) {
  if (typeof value !== "string" || value.length === 0) {
    return bad([`${what} must be a non-empty string`]);
  }
  return ok();
}

/**
 * @param {unknown} value
 * @param {string} what
 * @returns {ValidationResult}
 */
function expectNumberArray(value, what) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return bad([`${what} must be a finite number`]);
  }
  return ok();
}

/**
 * @param {unknown} value
 * @param {string} what
 * @param {readonly string[]} allowed
 * @returns {ValidationResult}
 */
function expectOneOf(value, what, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return bad([`${what} must be one of: ${allowed.join(", ")}`]);
  }
  return ok();
}

/**
 * @param {unknown} value
 * @param {string} what
 * @returns {ValidationResult}
 */
function expectStringArray(value, what) {
  if (!Array.isArray(value)) {
    return bad([`${what} must be an array`]);
  }
  const errors = value
    .map((item, i) => (typeof item === "string" ? null : `${what}[${i}] must be a string`))
    .filter(
      /** @param {string | null} item @returns {item is string} */
      (item) => item !== null
    );
  return errors.length === 0 ? ok() : bad(errors);
}

/**
 * Validates a reality map: structure, node and edge referential integrity,
 * and layer-chain contiguity.
 *
 * @param {unknown} input
 * @returns {ValidationResult}
 */
export function validateRealityMap(input) {
  const base = expectObject(input, "realityMap");
  if (!base.ok) return base;
  const map = /** @type {any} */ (input);
  const errors = /** @type {string[]} */ ([]);

  const concept = expectString(map.concept, "realityMap.concept");
  if (!concept.ok) errors.push(...concept.errors);

  const layers = Array.isArray(map.layers) ? /** @type {any[]} */ (map.layers) : null;
  const nodes = Array.isArray(map.nodes) ? /** @type {any[]} */ (map.nodes) : null;
  const edges = Array.isArray(map.edges) ? /** @type {any[]} */ (map.edges) : null;

  if (layers !== null && layers.length > MAX_REALITY_LAYERS) {
    errors.push(
      `realityMap.layers has ${layers.length} layers (max ${MAX_REALITY_LAYERS})`
    );
  }
  if (nodes !== null && nodes.length > MAX_REALITY_NODES) {
    errors.push(
      `realityMap.nodes has ${nodes.length} nodes (max ${MAX_REALITY_NODES})`
    );
  }
  if (edges !== null && edges.length > MAX_REALITY_EDGES) {
    errors.push(
      `realityMap.edges has ${edges.length} edges (max ${MAX_REALITY_EDGES})`
    );
  }

  if (layers === null) {
    errors.push("realityMap.layers must be an array");
  } else if (layers.length === 0) {
    errors.push("realityMap.layers must contain at least one layer");
  } else {
    const layerIds = new Set();
    layers.forEach((layer, i) => {
      if (!expectObject(layer, `realityMap.layers[${i}]`).ok) {
        errors.push(`realityMap.layers[${i}] must be an object`);
        return;
      }
      const id = expectString(layer.id, `realityMap.layers[${i}].id`);
      if (id.ok) {
        if (layerIds.has(layer.id)) {
          errors.push(`duplicate layer id: ${layer.id}`);
        }
        layerIds.add(layer.id);
      } else {
        errors.push(...id.errors);
      }
      const name = expectString(layer.name, `realityMap.layers[${i}].name`);
      if (!name.ok) errors.push(...name.errors);
      const listed = expectStringArray(layer.nodes, `realityMap.layers[${i}].nodes`);
      if (!listed.ok) errors.push(...listed.errors);
    });
  }

  const nodesById = new Map();
  if (nodes === null) {
    errors.push("realityMap.nodes must be an array");
  } else {
    nodes.forEach((node, i) => {
      const where = `realityMap.nodes[${i}]`;
      if (!expectObject(node, where).ok) {
        errors.push(`${where} must be an object`);
        return;
      }
      const id = expectString(node.id, `${where}.id`);
      if (!id.ok) {
        errors.push(...id.errors);
        return;
      }
      if (nodesById.has(node.id)) {
        errors.push(`duplicate node id: ${node.id}`);
      }
      nodesById.set(node.id, node);
      const label = expectString(node.label, `${where}.label`);
      if (!label.ok) errors.push(...label.errors);
      if (typeof node.description !== "string") {
        errors.push(`${where}.description must be a string`);
      }
      if (node.basis !== undefined) {
        // ticket 06: basis is the observation an abstraction compresses. Since
        // ticket 03 it is a real-history observation record (ticket 02), but
        // legacy maps and fixtures carry a plain string, so both forms stay
        // schema-valid here - the generator's deriveCheck enforces the record
        // for newly generated maps.
        const legacyString =
          typeof node.basis === "string" && node.basis.trim().length > 0;
        if (!legacyString && observationProblems(node.basis).length > 0) {
          errors.push(
            `${where}.basis must be a non-empty string or a valid observation record (ticket 02)`
          );
        }
      }
      if (typeof node.layer !== "string") {
        errors.push(`${where}.layer must be a string`);
      } else if (layers && !layers.some((l) => l.id === node.layer)) {
        errors.push(`${where}.layer references unknown layer: ${node.layer}`);
      }
    });
  }

  if (edges === null) {
    errors.push("realityMap.edges must be an array");
  } else {
    const seen = new Set();
    edges.forEach((edge, i) => {
      const where = `realityMap.edges[${i}]`;
      if (!expectObject(edge, where).ok) {
        errors.push(`${where} must be an object`);
        return;
      }
      const src = expectString(edge.source, `${where}.source`);
      const tgt = expectString(edge.target, `${where}.target`);
      if (!src.ok || !tgt.ok) {
        errors.push(...src.errors, ...tgt.errors);
        return;
      }
      if (edge.source === edge.target) {
        errors.push(`${where} is a self-loop (${edge.source})`);
      }
      if (!nodesById.has(edge.source)) {
        errors.push(`${where}.source references unknown node: ${edge.source}`);
      }
      if (!nodesById.has(edge.target)) {
        errors.push(`${where}.target references unknown node: ${edge.target}`);
      }
      const type = expectOneOf(edge.type, `${where}.type`, EDGE_TYPES);
      if (!type.ok) errors.push(...type.errors);
      const key = `${edge.source}|${edge.target}|${edge.type}`;
      if (seen.has(key)) {
        errors.push(`duplicate edge: ${edge.source} -${edge.type}-> ${edge.target}`);
      }
      seen.add(key);
    });
  }

  errors.push(...layerMirrorErrors(map, layers, nodes));

  if (layers && layers.length > 0 && nodesById.size > 0) {
    const layerIndex = new Map(layers.map((l, i) => [l.id, i]));
    const edgeList = edges || [];
    layers.forEach((layer, i) => {
      if (i === 0) return;
      const connectsBelow = edgeList.some((edge) => {
        const s = layerIndex.get(layerOf(map, edge.source));
        const t = layerIndex.get(layerOf(map, edge.target));
        if (s === undefined || t === undefined) return false;
        return (s === i && t < i) || (t === i && s < i);
      });
      if (!connectsBelow) {
        errors.push(
          `layer chain gap: layer "${layer.name}" (${layer.id}) has no edge connecting it to a lower layer`
        );
      }
    });
  }

  return errors.length === 0 ? ok() : bad(errors);
}

/**
 * @param {any} map
 * @param {string} nodeId
 * @returns {string | undefined} layer id, or undefined when unknown
 */
function layerOf(map, nodeId) {
  const nodes = /** @type {any[]} */ (map.nodes || []);
  const node = nodes.find((n) => n.id === nodeId);
  return node && node.layer;
}

/**
 * The mirror invariant: every node is listed in exactly its own layer's
 * `nodes` array, and every listed id is a real node.
 *
 * @param {any} map
 * @param {any[] | null} layers
 * @param {any[] | null} nodes
 * @returns {string[]}
 */
function layerMirrorErrors(map, layers, nodes) {
  const errors = /** @type {string[]} */ ([]);
  const layerList = layers || [];
  const nodeList = nodes || [];
  if (layerList.length === 0 || nodeList.length === 0) return errors;
  const nodesById = new Map(nodeList.map((n) => [n.id, n]));
  for (const layer of layerList) {
    if (!Array.isArray(layer.nodes)) continue;
    for (const id of layer.nodes) {
      const node = nodesById.get(id);
      if (!node) {
        errors.push(`layer "${layer.id}" lists unknown node: ${id}`);
      } else if (node.layer !== layer.id) {
        errors.push(
          `node ${id} is listed in layer "${layer.id}" but its layer is "${node.layer}"`
        );
      }
    }
  }
  for (const node of nodeList) {
    const layer = layerList.find((l) => l.id === node.layer);
    if (layer && Array.isArray(layer.nodes) && !layer.nodes.includes(node.id)) {
      errors.push(`node ${node.id} is not listed in its layer "${layer.id}"`);
    }
  }
  return errors;
}

/**
 * Validates a learner mental model against its reality map. Learner nodes and
 * edges mirror reality node ids; the map can be empty at session start.
 *
 * @param {unknown} input
 * @param {import("./types.js").RealityMap} reality
 * @returns {ValidationResult}
 */
export function validateLearnerMap(input, reality) {
  const base = expectObject(input, "learnerMap");
  if (!base.ok) return base;
  const learner = /** @type {any} */ (input);
  const errors = /** @type {string[]} */ ([]);

  const realityIds = new Set(reality.nodes.map((n) => n.id));

  const learnerNodes = Array.isArray(learner.nodes)
    ? /** @type {any[]} */ (learner.nodes)
    : null;
  const learnerEdges = Array.isArray(learner.edges)
    ? /** @type {any[]} */ (learner.edges)
    : null;

  if (learnerNodes === null) {
    errors.push("learnerMap.nodes must be an array");
  } else {
    const ids = new Set();
    learnerNodes.forEach((node, i) => {
      const where = `learnerMap.nodes[${i}]`;
      if (!expectObject(node, where).ok) {
        errors.push(`${where} must be an object`);
        return;
      }
      const id = expectString(node.id, `${where}.id`);
      if (!id.ok) {
        errors.push(...id.errors);
        return;
      }
      if (ids.has(node.id)) {
        errors.push(`duplicate learner node id: ${node.id}`);
      }
      ids.add(node.id);
      if (!realityIds.has(node.id)) {
        errors.push(`${where}.id does not exist in the reality map: ${node.id}`);
      }
      const state = expectOneOf(node.state, `${where}.state`, NODE_STATES);
      if (!state.ok) errors.push(...state.errors);
      const conf = expectNumberArray(node.confidence, `${where}.confidence`);
      if (!conf.ok) {
        errors.push(...conf.errors);
      } else if (node.confidence < 0 || node.confidence > 1) {
        errors.push(`${where}.confidence must be within 0..1`);
      }
      const evidence = expectStringArray(node.evidence, `${where}.evidence`);
      if (!evidence.ok) errors.push(...evidence.errors);
    });
  }

  if (learnerEdges === null) {
    errors.push("learnerMap.edges must be an array");
  } else {
    const seen = new Set();
    learnerEdges.forEach((edge, i) => {
      const where = `learnerMap.edges[${i}]`;
      if (!expectObject(edge, where).ok) {
        errors.push(`${where} must be an object`);
        return;
      }
      const src = expectString(edge.source, `${where}.source`);
      const tgt = expectString(edge.target, `${where}.target`);
      if (!src.ok || !tgt.ok) {
        errors.push(...src.errors, ...tgt.errors);
        return;
      }
      if (edge.source === edge.target) {
        errors.push(`${where} is a self-loop (${edge.source})`);
      }
      if (!realityIds.has(edge.source)) {
        errors.push(`${where}.source does not exist in the reality map: ${edge.source}`);
      }
      if (!realityIds.has(edge.target)) {
        errors.push(`${where}.target does not exist in the reality map: ${edge.target}`);
      }
      const state = expectOneOf(edge.state, `${where}.state`, NODE_STATES);
      if (!state.ok) errors.push(...state.errors);
      const conf = expectNumberArray(edge.confidence, `${where}.confidence`);
      if (!conf.ok) {
        errors.push(...conf.errors);
      } else if (edge.confidence < 0 || edge.confidence > 1) {
        errors.push(`${where}.confidence must be within 0..1`);
      }
      const evidence = expectStringArray(edge.evidence, `${where}.evidence`);
      if (!evidence.ok) errors.push(...evidence.errors);
      const key = `${edge.source}|${edge.target}|${edge.state}`;
      if (seen.has(key)) {
        errors.push(`duplicate learner edge: ${edge.source} -> ${edge.target} (${edge.state})`);
      }
      seen.add(key);
    });
  }

  return errors.length === 0 ? ok() : bad(errors);
}

/**
 * Validates a per-turn diff against the learner map it was computed from.
 *
 * @param {unknown} input
 * @param {import("./types.js").LearnerMentalModel} learner
 * @returns {ValidationResult}
 */
export function validateDiff(input, learner) {
  const base = expectObject(input, "diff");
  if (!base.ok) return base;
  const diff = /** @type {any} */ (input);
  const errors = /** @type {string[]} */ ([]);

  const learnerIds = new Set(learner.nodes.map((n) => n.id));

  const added = Array.isArray(diff.added) ? /** @type {any[]} */ (diff.added) : null;
  const flipped = Array.isArray(diff.flipped) ? /** @type {any[]} */ (diff.flipped) : null;
  const updated = Array.isArray(diff.updated) ? /** @type {any[]} */ (diff.updated) : null;

  if (added === null) {
    errors.push("diff.added must be an array");
  } else {
    added.forEach((id, i) => {
      const idOk = expectString(id, `diff.added[${i}]`);
      if (!idOk.ok) errors.push(...idOk.errors);
      else if (!learnerIds.has(id)) errors.push(`diff.added[${i}] is not in the learner map: ${id}`);
    });
  }

  if (flipped === null) {
    errors.push("diff.flipped must be an array");
  } else {
    flipped.forEach((flip, i) => {
      const where = `diff.flipped[${i}]`;
      if (!expectObject(flip, where).ok) {
        errors.push(`${where} must be an object`);
        return;
      }
      const idOk = expectString(flip.id, `${where}.id`);
      if (!idOk.ok) {
        errors.push(...idOk.errors);
        return;
      }
      if (!learnerIds.has(flip.id)) {
        errors.push(`${where}.id is not in the learner map: ${flip.id}`);
      }
      const from = expectOneOf(flip.from, `${where}.from`, NODE_STATES);
      if (!from.ok) errors.push(...from.errors);
      const to = expectOneOf(flip.to, `${where}.to`, NODE_STATES);
      if (!to.ok) errors.push(...to.errors);
      if (from.ok && to.ok && flip.from === flip.to) {
        errors.push(`${where} flips ${flip.id} to the same state: ${flip.from}`);
      }
    });
  }

  if (updated === null) {
    errors.push("diff.updated must be an array");
  } else {
    updated.forEach((id, i) => {
      const idOk = expectString(id, `diff.updated[${i}]`);
      if (!idOk.ok) errors.push(...idOk.errors);
      else if (!learnerIds.has(id)) errors.push(`diff.updated[${i}] is not in the learner map: ${id}`);
    });
  }

  return errors.length === 0 ? ok() : bad(errors);
}
