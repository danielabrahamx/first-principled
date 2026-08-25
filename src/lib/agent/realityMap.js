/**
 * Three-stage Reality Map generation.
 *
 * Chronology identifies target-specific capability regimes. Epiphanies
 * identify the warranted joints between those regimes. Arrange turns both
 * inputs into the learner-facing Dependence Tree. Each stage runs once,
 * with one repair attempt when the mechanical gate rejects it: the gate's
 * own complaints and the prior reply are fed back so a formatting drift or
 * an over-linear edge set can be corrected instead of killing the build.
 * Code performs only mechanical validation and normalization. OpenRouter
 * keeps thinking off on every stage, bounded to explicit low effort on the
 * mandated-reasoning default model. DeepSeek defaults to thinking off too:
 * turning Epiphanies on dumped the reply into `reasoning_content` and
 * failed to parse. Callers can still pass `thinkingByStage` to try a mixed
 * pattern.
 */

import { callChatCompletion } from "./llm.js";
import { parseModelJson } from "./jsonParse.js";
import { chronologySnapshot, epiphaniesSnapshot } from "./stageSnapshot.js";
import { validateRealityMap } from "../mmg/validator.js";
import { observationProblems } from "../mmg/observation.js";
import {
  buildArrangeJsonSchema,
  deterministicArrange,
  edgeSetProblems,
  listnessProblems,
  normalizeConnect,
  shuffleInventory,
} from "./arrange.js";

/** @typedef {import("../mmg/types.js").RealityMap} RealityMap */

/**
 * @typedef {object} CallLLMRequest
 * @property {import("./llm.js").ChatMessage[]} messages
 * @property {boolean} jsonMode
 * @property {{ name: string; strict?: boolean; schema: Record<string, any> }} [jsonSchema]
 * @property {boolean} thinking
 * @property {"low" | "medium" | "high"} [reasoningEffort]
 * @property {number} maxTokens
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {(request: CallLLMRequest) => Promise<{ content: string }>} CallLLM
 */

/**
 * @typedef {object} GenerationDiagnostics
 * @property {any} chronology
 * @property {any} epiphanies
 * @property {any} provenance
 * @property {string[]} discardedInputIds
 * @property {{ chronology: string; epiphanies: string; arrange: string }} prompts
 */

/**
 * @typedef {object} MapResult
 * @property {boolean} ok
 * @property {RealityMap | null} map
 * @property {"refused" | "invalid" | "error" | null} kind
 * @property {string | null} reason
 * @property {string[]} errors
 * @property {number} latencyMs
 * @property {false} retried - kept for callers; repair attempts are
 *   internal to a stage and not counted as retries.
 * @property {GenerationDiagnostics | null} diagnostics
 */

const ANCESTRY_KINDS = new Set(["PHYSICAL", "TECHNICAL", "CONCEPTUAL"]);
const JOINT_KINDS = new Set([
  "OBSERVATION",
  "EXPERIMENTAL_RESULT",
  "ENGINEERED_RESULT",
  "FORMALIZATION",
  "PROOF",
  "GRADUAL_SYNTHESIS",
  "NO_SINGLE_JOINT",
]);
const CERTAINTIES = new Set(["EXACT", "APPROXIMATE", "UNKNOWN"]);
const NODE_ROLES = new Set(["DOMAIN", "EPIPHANY", "STRUCTURAL"]);

/**
 * JSON Schema for constrained Stage 2 decoding. Regime references are
 * restricted to the ids returned by the accepted Chronology call. The
 * shape is the OpenRouter strict subset: no `const`, `pattern`, or
 * `allOf`/`if`/`then`. Certainty rules stay in `epiphaniesProblems`.
 *
 * @param {string} concept
 * @param {Set<string>} chronologyIds
 * @returns {{ name: string; strict: true; schema: Record<string, any> }}
 */
export function buildEpiphaniesJsonSchema(concept, chronologyIds) {
  const regimeId = {
    type: "string",
    enum: [...chronologyIds],
  };
  return {
    name: "epiphanies",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concept: { type: "string", enum: [concept] },
        epiphanies: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              from_regimes: { type: "array", items: regimeId },
              to_regimes: { type: "array", items: regimeId },
              result: { type: "string" },
              joint_kind: { type: "string", enum: [...JOINT_KINDS] },
              history: {
                type: "object",
                additionalProperties: false,
                properties: {
                  certainty: { type: "string", enum: [...CERTAINTIES] },
                  who: { type: "array", items: { type: "string" } },
                  when: { type: ["string", "null"] },
                  observation: { type: ["string", "null"] },
                  uncertainty_note: { type: "string" },
                },
                required: [
                  "certainty",
                  "who",
                  "when",
                  "observation",
                  "uncertainty_note",
                ],
              },
              candidate_node: { type: ["string", "null"] },
            },
            required: [
              "id",
              "from_regimes",
              "to_regimes",
              "result",
              "joint_kind",
              "history",
              "candidate_node",
            ],
          },
        },
      },
      required: ["concept", "epiphanies"],
    },
  };
}

/**
 * Canonicalize a model enum to the contract token. Case and separators
 * are mechanical, not a new fact.
 *
 * @param {unknown} value
 * @param {Set<string>} allowed
 * @returns {unknown}
 */
function canonicalEnum(value, allowed) {
  if (typeof value !== "string") return value;
  const token = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return allowed.has(token) ? token : value;
}

/**
 * @param {any} value
 * @returns {any}
 */
function normalizeChronology(value) {
  if (!isRecord(value) || !Array.isArray(value.chronology)) return value;
  return {
    ...value,
    chronology: value.chronology.map((item) => {
      if (!isRecord(item)) return item;
      return {
        ...item,
        ancestry_kind: canonicalEnum(item.ancestry_kind, ANCESTRY_KINDS),
      };
    }),
  };
}

/** Note used when the contract wants one and the model gave none. */
const FALLBACK_UNCERTAINTY_NOTE = "Partly recorded.";

/**
 * Coerce one model history record into a gate-consistent shape. The
 * OpenRouter default model (stealth/ox-alpha) systematically omits
 * certainty / uncertainty_note and writes who as a string, and OpenRouter
 * passes JSON Schema as a hint rather than an enforcement, so the strict
 * mechanical gate would reject every reply (ticket 12 deploy leg).
 * Derivation follows the Stage 2 prompt's own rule: EXACT needs who, when,
 * and observation; APPROXIMATE needs an observation; anything else is
 * UNKNOWN with empty facts.
 *
 * @param {any} history
 * @returns {any}
 */
function normalizeHistory(history) {
  const rawWho = history ? history.who : undefined;
  let who = Array.isArray(rawWho)
    ? rawWho.filter((name) => nonEmptyString(name))
    : nonEmptyString(rawWho)
      ? String(rawWho)
          .split(/[;,]/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
      : [];
  const observation = history && nonEmptyString(history.observation) ? history.observation : null;
  const when = history && nonEmptyString(history.when) ? history.when : null;
  const note = history && nonEmptyString(history.uncertainty_note) ? history.uncertainty_note : "";
  let certainty = /** @type {any} */ (canonicalEnum(history ? history.certainty : undefined, CERTAINTIES));
  if (!CERTAINTIES.has(certainty)) {
    certainty =
      who.length > 0 && when !== null && observation !== null
        ? "EXACT"
        : observation !== null
          ? "APPROXIMATE"
          : "UNKNOWN";
  }
  if (certainty === "EXACT" && (who.length === 0 || when === null || observation === null)) {
    certainty = observation !== null ? "APPROXIMATE" : "UNKNOWN";
  }
  if (certainty === "APPROXIMATE" && observation === null) {
    certainty = "UNKNOWN";
  }
  if (certainty === "UNKNOWN") {
    who = [];
    return {
      certainty,
      who: [],
      when: null,
      observation: null,
      uncertainty_note: note !== "" ? note : FALLBACK_UNCERTAINTY_NOTE,
    };
  }
  return {
    certainty,
    who,
    when,
    observation,
    uncertainty_note: certainty === "APPROXIMATE" && note === "" ? FALLBACK_UNCERTAINTY_NOTE : note,
  };
}

/**
 * @param {any} value
 * @returns {any}
 */
/**
 * Canonicalize one epiphany reference list. Models drift between ids and
 * regime names ("c3" vs "Charge separation"): the Stage 2 prompt shows both.
 * A name that uniquely matches exactly one chronology item is rewritten to
 * its id; anything ambiguous or unknown is left for the gate to reject.
 *
 * @param {any} refs
 * @param {Map<string, string>} nameToId - lowercase trimmed regime name -> id.
 * @returns {any}
 */
function canonicalizeRefs(refs, nameToId) {
  if (!Array.isArray(refs)) return refs;
  return refs.map((ref) => {
    if (typeof ref !== "string") return ref;
    const key = ref.trim().toLowerCase();
    return nameToId.has(key) ? nameToId.get(key) : ref;
  });
}

/**
 * Coerce the model's Stage 2 reply into a gate-consistent shape. Ids are
 * renumbered by position, joint kinds fall back to OBSERVATION, histories
 * are derived per the prompt's own rule, and from/to references written as
 * regime names are resolved to chronology ids where unambiguous.
 *
 * @param {any} value
 * @param {Array<{id: any; regime: any}>} [chronologyItems] - accepted Stage 1 items.
 * @returns {any}
 */
function normalizeEpiphanies(value, chronologyItems = []) {
  const nameToId = new Map(
    chronologyItems
      .filter((item) => nonEmptyString(item.id) && nonEmptyString(item.regime))
      .map((item) => [String(item.regime).trim().toLowerCase(), String(item.id)])
  );
  if (!isRecord(value) || !Array.isArray(value.epiphanies)) return value;
  return {
    ...value,
    epiphanies: value.epiphanies.map((item, index) => {
      if (!isRecord(item)) return item;
      const jointKind = /** @type {any} */ (canonicalEnum(item.joint_kind, JOINT_KINDS));
      // Models drift on candidate_node: they omit the field or send ""
      // where the contract says null. All three states mean the same
      // thing downstream (label falls back to result), so coerce to null.
      const candidateNode =
        typeof item.candidate_node === "string" && item.candidate_node.trim().length === 0
          ? null
          : item.candidate_node === undefined
            ? null
            : item.candidate_node;
      const normalized = {
        ...item,
        // The Stage 2 prompt never pins the id format, so models drift
        // (ep1, joint-1, prose). Ids are opaque keys: everything downstream
        // (Arrange inventory, evidence_ids) reads this normalized list, so
        // renumbering by position is safe and beats rejecting the stage.
        id: `e${index + 1}`,
        joint_kind: JOINT_KINDS.has(jointKind) ? jointKind : "OBSERVATION",
        history: normalizeHistory(item.history),
        candidate_node: candidateNode,
      };
      if (nameToId.size > 0) {
        normalized.from_regimes = canonicalizeRefs(item.from_regimes, nameToId);
        normalized.to_regimes = canonicalizeRefs(item.to_regimes, nameToId);
      }
      return normalized;
    }),
  };
}

/** Locked ticket 04 Stage 1 system prompt. */
export function buildChronologySystemPrompt() {
  return `Identify a short ordered chain of target-specific capability regimes that
made the requested target possible.

Each regime must introduce a capability needed by a later regime and by the
target. Physical ancestry is the default spine. Use technical ancestry for
constructed capabilities and conceptual ancestry for abstract ideas. Include
a regime only when removing it would break a reasonably direct account of the
target.

Return JSON only with concept and chronology. Each chronology item has id,
regime, new_capability, enabled_by_previous, ancestry_kind, and
target_relevance. IDs are c1, c2, and so on. enabled_by_previous may name
multiple earlier IDs but never a later ID.

Do not give discovery history, a Tree, or universal ancestry. Do not list
discoverers, dates, inventions, layers, cards, or Dependence edges. Do not
start from the Big Bang, stars, civilization, or a generic field sequence.
Do not teach the topic, personalize it, reward breadth, or promise that every
item will appear in the final Tree.`;
}

/** Locked ticket 04 Stage 2 system prompt. */
export function buildEpiphaniesSystemPrompt() {
  return `Identify the results that warrant transitions between the supplied capability
regimes. A result is the joint. Human history documents how that result was
established; a person's private insight is not the joint.

Return JSON only with concept and epiphanies. Each item has id, from_regimes,
to_regimes, result, joint_kind, history, and candidate_node. Name the result
first. Then record who, when, and the observation, proof, formalization, or
engineered result that established it.

Set certainty to EXACT only when who, when, and the observation are all known.
Set certainty to APPROXIMATE when the record is roughly known. Set certainty
to UNKNOWN when history does not support a precise record; then leave who,
when, and observation empty and write the reason in uncertainty_note. Use
UNKNOWN or NO_SINGLE_JOINT when history does not support a precise event.

Do not arrange a Tree, rewrite the Chronology, or force one item for every
transition. Do not force one hero or date, confuse first observation with
accepted explanation, apply laboratory language to mathematics, add famous
names for decoration, or invent facts to avoid UNKNOWN.`;
}

/** Locked ticket 04 Stage 3 system prompt (ticket 11: edge-set contract). */
export function buildArrangeSystemPrompt() {
  return `The inventory lists the capability regimes and the results that connect them.
The order of the inventory is meaningless: it was shuffled. Choose the edges
that form one followable Dependence Tree for a curious adult who opens rabbit
holes.

Return JSON only with concept and edges. Each edge has from, to, because, and
evidence_ids. from is the item that rests on to. to is the item that must
exist or be understood first. The because text must complete: "The from item
rests on the to item because without the to item..." Keep because to one
line. evidence_ids lists the epiphany ids whose records justify the edge; it
may be empty. Reference items only by their ids. Every inventory item appears
in the tree; you choose the edges only.

You do not emit nodes, layers, trunk, or crown: the code computes them from
your edges. Do not emit a timeline, do not copy the inventory order, do not
connect an item only to its neighbor in the list, do not use "related to",
"came before", or "helped lead to" as Dependence, and do not add physics,
chemistry, biology, or computer science as items unless that abstraction is
itself a useful rabbit hole.`;
}

/**
 * Validate the Stage 1 contract.
 *
 * @param {unknown} value
 * @param {string} concept
 * @returns {string[]}
 */
export function chronologyProblems(value, concept) {
  const errors = [];
  if (!isRecord(value) || !Array.isArray(value.chronology)) {
    return ["chronology reply must contain a chronology array"];
  }
  if (value.concept !== concept) errors.push("chronology concept must match the request");
  if (value.chronology.length === 0) errors.push("chronology must not be empty");
  const seen = new Set();
  value.chronology.forEach((item, index) => {
    const expectedId = `c${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`chronology item ${index + 1} must be an object`);
      return;
    }
    if (item.id !== expectedId) errors.push(`chronology item ${index + 1} id must be ${expectedId}`);
    for (const field of ["regime", "new_capability", "target_relevance"]) {
      if (!nonEmptyString(item[field])) errors.push(`${expectedId}.${field} must be non-empty`);
    }
    if (!ANCESTRY_KINDS.has(item.ancestry_kind)) {
      errors.push(`${expectedId}.ancestry_kind is invalid`);
    }
    if (!Array.isArray(item.enabled_by_previous)) {
      errors.push(`${expectedId}.enabled_by_previous must be an array`);
    } else {
      for (const ref of item.enabled_by_previous) {
        if (!seen.has(ref)) errors.push(`${expectedId} references non-earlier chronology id "${ref}"`);
      }
    }
    seen.add(item.id);
  });
  return errors;
}

/**
 * Validate the Stage 2 contract.
 *
 * @param {unknown} value
 * @param {string} concept
 * @param {Set<string>} chronologyIds
 * @returns {string[]}
 */
export function epiphaniesProblems(value, concept, chronologyIds) {
  const errors = [];
  if (!isRecord(value) || !Array.isArray(value.epiphanies)) {
    return ["epiphanies reply must contain an epiphanies array"];
  }
  if (value.concept !== concept) errors.push("epiphanies concept must match the request");
  value.epiphanies.forEach((item, index) => {
    const expectedId = `e${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`epiphany item ${index + 1} must be an object`);
      return;
    }
    if (item.id !== expectedId) errors.push(`epiphany item ${index + 1} id must be ${expectedId}`);
    for (const field of ["from_regimes", "to_regimes"]) {
      if (!Array.isArray(item[field])) {
        errors.push(`${expectedId}.${field} must be an array`);
      } else {
        for (const ref of item[field]) {
          if (!chronologyIds.has(ref)) errors.push(`${expectedId}.${field} has unknown id "${ref}"`);
        }
      }
    }
    if (!nonEmptyString(item.result)) errors.push(`${expectedId}.result must be non-empty`);
    if (!JOINT_KINDS.has(item.joint_kind)) errors.push(`${expectedId}.joint_kind is invalid`);
    if (!(item.candidate_node === null || typeof item.candidate_node === "string")) {
      errors.push(`${expectedId}.candidate_node must be a string or null`);
    }
    errors.push(...historyProblems(item.history).map((problem) => `${expectedId}.history ${problem}`));
  });
  return errors;
}

/**
 * Validate a Stage 2 history record.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function historyProblems(value) {
  if (!isRecord(value) || !CERTAINTIES.has(value.certainty)) {
    return ["must have a valid certainty"];
  }
  const who = value.who;
  const when = value.when;
  const observation = value.observation;
  const note = value.uncertainty_note;
  if (!Array.isArray(who) || who.some((name) => !nonEmptyString(name))) {
    return ["who must be an array of non-empty names"];
  }
  const errors = [];
  if (value.certainty === "EXACT") {
    if (who.length === 0 || !nonEmptyString(when) || !nonEmptyString(observation)) {
      errors.push("EXACT requires who, when, and observation");
    }
  } else if (value.certainty === "APPROXIMATE") {
    if (!(when === null || nonEmptyString(when))) errors.push("APPROXIMATE when must be a value or null");
    if (!nonEmptyString(observation) || !nonEmptyString(note)) {
      errors.push("APPROXIMATE requires observation and uncertainty_note");
    }
  } else {
    if (who.length > 0 || when !== null || observation !== null || !nonEmptyString(note)) {
      errors.push("UNKNOWN requires empty facts and a non-empty uncertainty_note");
    }
  }
  return errors;
}

/**
 * Strict mechanical gate for the Arrange output and its hidden provenance.
 *
 * @param {unknown} value
 * @param {{ concept: string; chronologyIds: Set<string>; epiphanyIds: Set<string> }} inputs
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function arrangeCheck(value, inputs) {
  const errors = [];
  if (!isRecord(value) || !isRecord(value.map) || !isRecord(value.provenance)) {
    return { ok: false, errors: ["arrange reply must contain map and provenance objects"] };
  }
  const map = value.map;
  const provenance = value.provenance;
  const structural = validateRealityMap(map);
  errors.push(...structural.errors);
  if (map.concept !== inputs.concept) errors.push("map concept must match the request");

  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const edges = Array.isArray(map.edges) ? map.edges : [];
  const layers = Array.isArray(map.layers) ? map.layers : [];
  const byId = new Map(nodes.filter(isRecord).map((node) => [node.id, node]));
  const layerIndex = new Map(
    layers.filter(isRecord).map((layer, index) => [layer.id, index])
  );

  for (const node of nodes) {
    if (!isRecord(node)) continue;
    if (!NODE_ROLES.has(node.role)) errors.push(`node "${node.id}" has an invalid role`);
    const hasBasis = node.basis !== undefined && node.basis !== null;
    const hasCombines = Array.isArray(node.combines) && node.combines.length > 0;
    if (node.role === "EPIPHANY") {
      const basisErrors = observationProblems(node.basis);
      if (basisErrors.length > 0) {
        errors.push(`EPIPHANY node "${node.id}" basis: ${basisErrors.join("; ")}`);
      }
      if (Array.isArray(node.combines)) {
        for (const entry of node.combines) {
          if (!isRecord(entry) || !nonEmptyString(entry.id) || !byId.has(entry.id)) {
            errors.push(`EPIPHANY node "${node.id}" has an invalid combines reference`);
            continue;
          }
          const combinedNode = byId.get(entry.id);
          if (
            !combinedNode ||
            (layerIndex.get(combinedNode.layer) ?? Infinity) >=
              (layerIndex.get(node.layer) ?? -Infinity)
          ) {
            errors.push(`EPIPHANY node "${node.id}" combines a node that is not below it`);
          }
          const combinedErrors = observationProblems(entry.observation);
          if (combinedErrors.length > 0) {
            errors.push(
              `EPIPHANY node "${node.id}" combine "${entry.id}": ${combinedErrors.join("; ")}`
            );
          }
        }
      }
    } else if (hasBasis || hasCombines) {
      errors.push(`node "${node.id}" may carry history only with role EPIPHANY`);
    }
  }

  for (const edge of edges) {
    if (isRecord(edge) && !nonEmptyString(edge.because)) {
      errors.push(`edge "${edge.source}" to "${edge.target}" needs a non-empty because`);
    }
  }

  /** @type {Map<string, string[]>} */
  const adjacency = new Map(nodes.filter(isRecord).map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!isRecord(edge)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  if (hasUndirectedCycle(adjacency)) errors.push("map graph must be acyclic");
  if (adjacency.size > 0 && reachableCount(adjacency) !== adjacency.size) {
    errors.push("map graph must be connected");
  }

  const incoming = new Set(edges.filter(isRecord).map((edge) => edge.target));
  const crowns = nodes.filter((node) => isRecord(node) && !incoming.has(node.id));
  if (crowns.length !== 1) errors.push("map must have exactly one crown");
  const crown = crowns.length === 1 ? crowns[0] : null;
  if (crown && !sameConcept(crown.label, inputs.concept)) {
    errors.push("the single crown must name the requested target");
  }

  if (!Array.isArray(map.trunk) || map.trunk.length === 0) {
    errors.push("map must declare a non-empty trunk");
  } else {
    const foundationIds = new Set(
      layers.length > 0 && Array.isArray(layers[0].nodes) ? layers[0].nodes : []
    );
    if (!foundationIds.has(map.trunk[0])) errors.push("trunk must start in the Foundation layer");
    if (crown && map.trunk[map.trunk.length - 1] !== crown.id) {
      errors.push("trunk must end at the crown");
    }
    for (const id of map.trunk) {
      if (!byId.has(id)) errors.push(`trunk references unknown node "${id}"`);
    }
    for (let index = 1; index < map.trunk.length; index += 1) {
      const lower = map.trunk[index - 1];
      const upper = map.trunk[index];
      if (!edges.some((edge) => isRecord(edge) && edge.source === upper && edge.target === lower)) {
        errors.push(`trunk step "${lower}" to "${upper}" has no matching dependence edge`);
      }
    }
  }

  errors.push(...provenanceProblems(provenance, nodes, edges, inputs));
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/**
 * @param {any} provenance
 * @param {any[]} nodes
 * @param {any[]} edges
 * @param {{ chronologyIds: Set<string>; epiphanyIds: Set<string> }} inputs
 * @returns {string[]}
 */
function provenanceProblems(provenance, nodes, edges, inputs) {
  const errors = [];
  const validInputs = new Set([...inputs.chronologyIds, ...inputs.epiphanyIds]);
  const used = new Set();
  const discarded = new Set();
  const nodeProvenance = Array.isArray(provenance.nodes) ? provenance.nodes : [];
  const edgeProvenance = Array.isArray(provenance.edges) ? provenance.edges : [];
  const discardedInputs = Array.isArray(provenance.discarded_input_ids)
    ? provenance.discarded_input_ids
    : [];
  const nodeById = new Map(nodes.filter(isRecord).map((node) => [node.id, node]));

  if (!Array.isArray(provenance.nodes)) errors.push("provenance.nodes must be an array");
  if (!Array.isArray(provenance.edges)) errors.push("provenance.edges must be an array");
  if (!Array.isArray(provenance.discarded_input_ids)) {
    errors.push("provenance.discarded_input_ids must be an array");
  }

  const citedNodes = new Set();
  for (const entry of nodeProvenance) {
    if (!isRecord(entry) || !nodeById.has(entry.node_id) || !Array.isArray(entry.input_refs)) {
      errors.push("each node provenance entry must name a map node and input_refs array");
      continue;
    }
    citedNodes.add(entry.node_id);
    const node = nodeById.get(entry.node_id);
    if (!node) continue;
    if (node.role !== "STRUCTURAL" && entry.input_refs.length === 0) {
      errors.push(`node "${entry.node_id}" needs at least one provenance input`);
    }
    recordInputRefs(entry.input_refs, validInputs, used, errors);
    if (node.role === "EPIPHANY" && !entry.input_refs.some((id) => inputs.epiphanyIds.has(id))) {
      errors.push(`EPIPHANY node "${entry.node_id}" must cite a Stage 2 input`);
    }
  }
  for (const node of nodes) {
    if (isRecord(node) && !citedNodes.has(node.id)) {
      errors.push(`node "${node.id}" has no provenance entry`);
    }
  }

  const citedEdges = new Set();
  for (const entry of edgeProvenance) {
    if (!isRecord(entry) || !Array.isArray(entry.input_refs)) {
      errors.push("each edge provenance entry must contain source, target, and input_refs");
      continue;
    }
    const key = `${entry.source}\u0000${entry.target}`;
    if (!edges.some((edge) => isRecord(edge) && edge.source === entry.source && edge.target === entry.target)) {
      errors.push(`edge provenance "${entry.source}" to "${entry.target}" has no map edge`);
    }
    if (entry.input_refs.length === 0) errors.push(`edge "${entry.source}" to "${entry.target}" needs provenance`);
    citedEdges.add(key);
    recordInputRefs(entry.input_refs, validInputs, used, errors);
  }
  for (const edge of edges) {
    if (isRecord(edge) && !citedEdges.has(`${edge.source}\u0000${edge.target}`)) {
      errors.push(`edge "${edge.source}" to "${edge.target}" has no provenance entry`);
    }
  }

  for (const entry of discardedInputs) {
    if (!isRecord(entry) || !validInputs.has(entry.id) || !nonEmptyString(entry.reason)) {
      errors.push("each discarded input must have a valid id and non-empty reason");
      continue;
    }
    discarded.add(entry.id);
  }
  for (const id of validInputs) {
    if (!used.has(id) && !discarded.has(id)) errors.push(`input "${id}" is neither used nor discarded`);
    if (used.has(id) && discarded.has(id)) errors.push(`input "${id}" is both used and discarded`);
  }
  return errors;
}

/**
 * @param {any[]} refs
 * @param {Set<string>} validInputs
 * @param {Set<string>} used
 * @param {string[]} errors
 */
function recordInputRefs(refs, validInputs, used, errors) {
  for (const id of refs) {
    if (!validInputs.has(id)) errors.push(`provenance references unknown input "${id}"`);
    else used.add(id);
  }
}

/**
 * Thinking flag for one generation stage. Default is off. Explicit
 * `thinking` or `thinkingByStage` wins.
 *
 * @param {"chronology" | "epiphanies" | "arrange"} stage
 * @param {{ thinking?: boolean; thinkingByStage?: Partial<Record<"chronology" | "epiphanies" | "arrange", boolean>> }} [options]
 * @returns {boolean}
 */
export function stageThinking(stage, options = {}) {
  const override = options.thinkingByStage?.[stage];
  if (typeof override === "boolean") return override;
  return options.thinking === true;
}

/**
 * Generate one map through exactly three serial model calls.
 *
 * @param {{ concept: string; callLLM?: CallLLM }} input
 * @param {{ thinking?: boolean; thinkingByStage?: Partial<Record<"chronology" | "epiphanies" | "arrange", boolean>>; maxTokens?: number; timeoutMs?: number; onStageSnapshot?: (stage: "chronology" | "epiphanies", snapshot: { concept: string; chronology: any[]; epiphanies?: any[] }) => void | Promise<void> }} [options]
 * @returns {Promise<MapResult>}
 */
export async function generateRealityMap({ concept, callLLM }, options = {}) {
  const trimmed = concept.trim();
  if (trimmed.length === 0) {
    return failure("refused", "Use a word or phrase that names a concept you want to learn.", [], 0);
  }
  const started = Date.now();
  const transport =
    callLLM ??
    /** @type {CallLLM} */ (async (request) => {
      const response = await callChatCompletion(request);
      return { content: response.content };
    });
  const prompts = {
    chronology: buildChronologySystemPrompt(),
    epiphanies: buildEpiphaniesSystemPrompt(),
    arrange: buildArrangeSystemPrompt(),
  };
  const request = async (
    /** @type {"chronology" | "epiphanies" | "arrange"} */ stage,
    /** @type {any} */ payload,
    /** @type {{ name: string; strict: true; schema: Record<string, any> } | undefined} */ jsonSchema = undefined,
    /** @type {{ priorReply?: any } | undefined} */ callOptions = undefined
  ) => {
    const userContent =
      callOptions && callOptions.priorReply !== undefined
        ? `${JSON.stringify(payload)}\n\nYour previous reply (shown below) failed validation. Return the full corrected JSON object only.\n\nPrevious reply:\n${JSON.stringify(callOptions.priorReply)}`
        : JSON.stringify(payload);
    /** @type {CallLLMRequest} */
    const transportRequest = {
      messages: [
        { role: "system", content: prompts[stage] },
        { role: "user", content: userContent },
      ],
      jsonMode: true,
      thinking: stageThinking(stage, options),
      // Bound reasoning on the mandated-thinking default model. Measured
      // 2026-08-25: provider-default effort took 116-131s per stage; an
      // explicit effort is accepted where "none"/enabled:false are not.
      reasoningEffort: "low",
      // The OpenRouter default model mandates reasoning, which burns the
      // completion budget before the JSON: at 8192 the Epiphanies schema
      // call spent every token on thinking and truncated (ticket 12).
      // 65536 gives thinking plus the JSON room; a low cap truncates.
      maxTokens: options.maxTokens ?? 65536,
      timeoutMs: options.timeoutMs ?? 600000,
    };
    if (jsonSchema) transportRequest.jsonSchema = jsonSchema;
    const response = await transport(transportRequest);
    return parseModelJson(response.content);
  };

  try {
    const rawChronology = await request("chronology", { concept: trimmed });
    let chronology = normalizeChronology(rawChronology);
    let chronologyErrors = chronologyProblems(chronology, trimmed);
    if (chronologyErrors.length > 0) {
      // One repair attempt per stage (the generateJson policy): feed the
      // gate's own complaints back. A formatting drift after minutes of
      // thinking otherwise kills the whole build with no recourse.
      const repair = await request(
        "chronology",
        {
          concept: trimmed,
          previous_reply_failed_because: chronologyErrors.slice(0, 8),
          instruction:
            "Return the full corrected chronology JSON object in exactly the required shape.",
        },
        undefined,
        { priorReply: rawChronology }
      );
      const repaired = normalizeChronology(repair);
      const repairedErrors = chronologyProblems(repaired, trimmed);
      if (repairedErrors.length === 0 || repairedErrors.length < chronologyErrors.length) {
        chronology = repaired;
        chronologyErrors = repairedErrors;
      }
    }
    if (chronologyErrors.length > 0) {
      return failure("invalid", "The Chronology stage failed its contract.", chronologyErrors, Date.now() - started);
    }
    const chronologyItems = /** @type {any} */ (chronology).chronology;
    const chronologyIds = new Set(chronologyItems.map((/** @type {any} */ item) => item.id));
    await publishStageSnapshot(
      options.onStageSnapshot,
      "chronology",
      chronologySnapshot(trimmed, chronology)
    );

    const epiphanies = normalizeEpiphanies(
      await request(
        "epiphanies",
        chronology,
        buildEpiphaniesJsonSchema(trimmed, chronologyIds)
      ),
      chronologyItems
    );
    const epiphanyErrors = epiphaniesProblems(epiphanies, trimmed, chronologyIds);
    if (epiphanyErrors.length > 0) {
      return failure("invalid", "The Epiphanies stage failed its contract.", epiphanyErrors, Date.now() - started);
    }
    const epiphanyItems = /** @type {any} */ (epiphanies).epiphanies;
    const epiphanyIds = new Set(epiphanyItems.map((/** @type {any} */ item) => item.id));
    await publishStageSnapshot(
      options.onStageSnapshot,
      "epiphanies",
      epiphaniesSnapshot(trimmed, chronology, epiphanies)
    );

    const inventoryIds = new Set([...chronologyIds, ...epiphanyIds]);
    const arrangeInventory = () =>
      shuffleInventory([
        ...chronologyItems.map((/** @type {any} */ item) => ({
          kind: "regime",
          id: item.id,
          name: item.regime,
          capability: item.new_capability,
          enabled_by: item.enabled_by_previous,
        })),
        ...epiphanyItems.map((/** @type {any} */ item) => ({
          kind: "joint",
          id: item.id,
          result: item.result,
          from: item.from_regimes,
          to: item.to_regimes,
          joint_kind: item.joint_kind,
          history: {
            certainty: item.history?.certainty,
            who: item.history?.who,
            when: item.history?.when,
            observation: item.history?.observation,
          },
          candidate_node: item.candidate_node,
        })),
      ]);

    /**
     * Run the full Arrange evaluation chain on a raw reply. Every rejection
     * reason lands in errors so the repair attempt (and any failure record)
     * cites exactly what the gates demanded.
     *
     * @param {any} rawEdges
     * @returns {{ connect: any; arrangement: any; errors: string[] }}
     */
    const evaluateArrange = (rawEdges) => {
      const connect = normalizeConnect(rawEdges);
      let errors = edgeSetProblems(connect, trimmed, inventoryIds, epiphanyIds);
      if (errors.length > 0) {
        return { connect, arrangement: null, errors };
      }
      const arrangement = deterministicArrange({
        concept: trimmed,
        chronologyItems,
        epiphanyItems,
        edges: connect.edges,
      });
      const gate = arrangeCheck(arrangement, { concept: trimmed, chronologyIds, epiphanyIds });
      if (!gate.ok) {
        errors = gate.errors;
      } else {
        // The listness heuristic is part of the same quality bar: a
        // stepwise stack passes the mechanical gate yet is still a
        // timeline copy, so its complaint joins the same repair loop.
        errors = listnessProblems(arrangement.map);
      }
      return { connect, arrangement, errors };
    };

    let rawEdges = await request(
      "arrange",
      { concept: trimmed, inventory: arrangeInventory() },
      buildArrangeJsonSchema(trimmed, inventoryIds, epiphanyIds)
    );
    let evaluated = evaluateArrange(rawEdges);
    if (evaluated.errors.length > 0) {
      console.error(
        `generateRealityMap arrange rejected; repairing once. errors: ${evaluated.errors.slice(0, 3).join("; ")}`
      );
      // One repair attempt fed the exact gate complaints - the same policy
      // as the Chronology stage. The instruction names the concrete fix:
      // a stepwise stack needs at least one edge that skips a layer below
      // the crown, so the next tree up is not built only on its neighbor.
      const repairedRaw = await request(
        "arrange",
        {
          concept: trimmed,
          previous_reply_failed_because: evaluated.errors.slice(0, 8),
          how_to_fix: evaluated.errors.some((e) => /stepwise|unbranching path/.test(e))
            ? "Do not connect items only to adjacent layers. Add at least one edge where an item rests on something two or more levels deeper (a foundation), and branch at least one item so it supports two later items. Then return the full corrected edge-set JSON object."
            : "Return the full corrected edge-set JSON object in exactly the required shape.",
        },
        buildArrangeJsonSchema(trimmed, inventoryIds, epiphanyIds),
        { priorReply: rawEdges }
      );
      const repaired = evaluateArrange(repairedRaw);
      console.error(
        `generateRealityMap arrange repair: ${repaired.errors.length === 0 ? "accepted" : `still failing (${repaired.errors.slice(0, 2).join("; ")})`}`
      );
      // Accept the repair when it is clean or strictly closer to valid.
      if (repaired.errors.length === 0 || repaired.errors.length < evaluated.errors.length) {
        rawEdges = repairedRaw;
        evaluated = repaired;
      }
    }
    if (evaluated.errors.length > 0 || !evaluated.arrangement) {
      return failure("invalid", "The Arrange stage failed.", evaluated.errors, Date.now() - started);
    }
    const arrangement = evaluated.arrangement;

    const discardedInputIds = /** @type {string[]} */ ([]);
    return {
      ok: true,
      map: /** @type {RealityMap} */ (arrangement.map),
      kind: null,
      reason: null,
      errors: [],
      latencyMs: Date.now() - started,
      retried: false,
      diagnostics: {
        chronology,
        epiphanies,
        provenance: arrangement.provenance,
        discardedInputIds,
        prompts,
      },
    };
  } catch (error) {
    return failure(
      "error",
      error instanceof Error ? error.message : String(error),
      [],
      Date.now() - started
    );
  }
}

/**
 * Legacy derivability check used by persisted v6 controls. The three-stage
 * generator uses arrangeCheck because its role and provenance contract is
 * intentionally stricter.
 *
 * @param {any} map
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function deriveCheck(map) {
  const errors = [];
  if (!isRecord(map) || !Array.isArray(map.layers) || !Array.isArray(map.nodes) || !Array.isArray(map.edges)) {
    return { ok: false, errors: ["map must have layers, nodes and edges"] };
  }
  const foundationId = map.layers[0]?.id;
  /** @type {Map<string, string[]>} */
  const adjacency = new Map(map.nodes.filter(isRecord).map((node) => [node.id, []]));
  for (const edge of map.edges) {
    if (!isRecord(edge)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  const foundationNodes = map.nodes.filter((node) => isRecord(node) && node.layer === foundationId);
  const seen = reachable(adjacency, foundationNodes.map((node) => node.id));
  const hasExplicitRoles = map.nodes.some(
    (node) => isRecord(node) && NODE_ROLES.has(node.role)
  );
  for (const node of map.nodes) {
    if (!isRecord(node)) continue;
    if (!seen.has(node.id)) errors.push(`node "${node.id}" is not reachable from the foundation layer`);
    if (!hasExplicitRoles || node.role === "EPIPHANY") {
      const basisErrors = observationProblems(node.basis);
      if (basisErrors.length > 0) {
        errors.push(`node "${node.id}" has an invalid observation record: ${basisErrors.join("; ")}`);
      }
    } else if (node.basis !== undefined || node.combines !== undefined) {
      errors.push(`node "${node.id}" may carry history only with role EPIPHANY`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Mid-job snapshots must never fail the generator. A blob write that throws
 * after 202 would otherwise look like a stage failure and skip Arrange.
 *
 * @param {((stage: "chronology" | "epiphanies", snapshot: any) => void | Promise<void>) | undefined} publish
 * @param {"chronology" | "epiphanies"} stage
 * @param {any} snapshot
 * @returns {Promise<void>}
 */
async function publishStageSnapshot(publish, stage, snapshot) {
  if (typeof publish !== "function") return;
  try {
    await publish(stage, snapshot);
  } catch (error) {
    console.error(
      "onStageSnapshot failed:",
      error instanceof Error ? error.message : error,
      "stage:",
      stage
    );
  }
}

/**
 * @param {"refused" | "invalid" | "error"} kind
 * @param {string} reason
 * @param {string[]} errors
 * @param {number} latencyMs
 * @returns {MapResult}
 */
function failure(kind, reason, errors, latencyMs) {
  if (errors.length > 0) {
    console.error(`generateRealityMap ${kind}: ${reason}; ${errors.slice(0, 5).join("; ")}`);
  }
  return {
    ok: false,
    map: null,
    kind,
    reason,
    errors,
    latencyMs,
    retried: false,
    diagnostics: null,
  };
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string} */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {unknown} left @param {unknown} right */
function sameConcept(left, right) {
  const normalize = (/** @type {unknown} */ value) =>
    String(value).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.includes(b) || b.includes(a);
}

/** @param {Map<any, any[]>} adjacency */
function reachableCount(adjacency) {
  const first = adjacency.keys().next().value;
  return first === undefined ? 0 : reachable(adjacency, [first]).size;
}

/** @param {Map<any, any[]>} adjacency @param {any[]} starts */
function reachable(adjacency, starts) {
  const seen = new Set(starts);
  const queue = [...starts];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** @param {Map<any, any[]>} adjacency */
function hasUndirectedCycle(adjacency) {
  const seen = new Set();
  /**
   * @param {any} node
   * @param {any} parent
   * @returns {boolean}
   */
  const visit = (node, parent) => {
    seen.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!seen.has(next)) {
        if (visit(next, node)) return true;
      } else if (next !== parent) {
        return true;
      }
    }
    return false;
  };
  for (const node of adjacency.keys()) {
    if (!seen.has(node) && visit(node, null)) return true;
  }
  return false;
}

/* ---------------------------------------------------------------------------
 * Legacy STE checker retained for the existing copy audit.
 * ------------------------------------------------------------------------- */

const STE_CONTRACTIONS = new Set([
  "can't", "won't", "don't", "didn't", "doesn't", "isn't", "aren't",
  "wasn't", "weren't", "couldn't", "wouldn't", "shouldn't", "mustn't",
  "it's", "that's", "there's", "here's", "what's", "who's", "let's",
  "i'm", "you're", "we're", "they're", "i've", "you've", "we've",
  "they've", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
  "would've", "should've", "could've",
]);

const STE_BANNED = new Set([
  "basically", "literally", "kinda", "sorta", "gonna", "wanna",
  "stuff", "kind of", "sort of", "pretty much", "super", "a lot of",
  "e.g.", "i.e.", "etc.",
]);

const STE_VAGUE = new Set(["it", "this", "that", "thing", "things", "something"]);

/**
 * @param {unknown} text
 * @returns {{ errors: string[]; warnings: string[] }}
 */
export function steProblems(text) {
  const errors = /** @type {string[]} */ ([]);
  const warnings = /** @type {string[]} */ ([]);
  if (typeof text !== "string" || text.trim().length === 0) return { errors, warnings };
  const lower = text.toLowerCase();
  for (const word of STE_CONTRACTIONS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) errors.push(`contraction "${word}"`);
  }
  for (const word of STE_BANNED) {
    if (lower.includes(word)) errors.push(`non-STE word "${word}"`);
  }
  if (/[\u2014\u2013]/.test(text)) errors.push("em dash or en dash");
  if (/--/.test(text)) errors.push("double hyphen");
  for (const sentence of text.split(/[.!?]+(?:\s+|$)/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (words.length > 25) {
      errors.push(`${words.length}-word sentence: "${sentence.trim().slice(0, 40)}..."`);
    }
  }
  for (const word of STE_VAGUE) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) warnings.push(`vague word "${word}"`);
  }
  return { errors, warnings };
}
