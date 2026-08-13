/**
 * Observation-first tree viewmodels (ticket 04): pure functions that turn a
 * reality map's observation records (ticket 02, the crux) into the tree
 * UI's visual model.
 *
 * An observation is REAL discovery history - the record an abstraction
 * compresses (discoverer, date, key observation) with EXACT / APPROXIMATE /
 * UNKNOWN marks per the fail-honest contract (ticket 09, section 2). Since
 * ticket 03 the node's `basis` is the structured record on every node,
 * foundation included; legacy maps carry a plain string, and a node may
 * carry no basis at all (an honest gap).
 *
 * This module renders ALL of those states defensively, because the generator
 * change (ticket 03) may not have landed: a present record renders fully; a
 * missing or unknown record renders as an explicit gap - the node exists,
 * the layer chain is unbroken, the observation is unknown - never a blank.
 * Nothing here throws; any input shape normalizes to a view.
 *
 * Pure and DOM-free so node:test covers the shapes directly.
 */

/**
 * @typedef {"EXACT" | "APPROXIMATE" | "UNKNOWN"} ObservationMark
 * @typedef {"high" | "medium" | "low"} ObservationConfidence
 *
 * @typedef {object} ObservationViewField
 * @property {string | null} value - null when the record has no usable value
 *   for this field (absent, malformed, or marked UNKNOWN).
 * @property {ObservationMark | null} mark - null for legacy string records
 *   and absent fields.
 *
 * @typedef {object} ObservationView
 * @property {boolean} present - true when the record renders fully; false
 *   renders the explicit gap state.
 * @property {boolean} legacy - true when the source was a pre-record string
 *   basis (the old generator's shape).
 * @property {ObservationViewField | null} discoverer
 * @property {ObservationViewField | null} date
 * @property {ObservationViewField | null} keyObservation
 * @property {ObservationConfidence | null} confidence
 * @property {string | null} note - hedge context, shown on hover.
 */

/**
 * The honesty marks a UI card can show on a value. UNKNOWN is deliberately
 * absent: per the contract a value under an UNKNOWN mark is dropped, so the
 * card shows the gap state instead of a guessed value.
 *
 * @type {readonly ["EXACT", "APPROXIMATE"]}
 */
const DISPLAY_MARKS = Object.freeze(["EXACT", "APPROXIMATE"]);

/**
 * One usable field: value plus mark. Per the fail-honest contract a missing
 * field, an empty value, an unparseable mark, or a value under an UNKNOWN
 * mark all count as no answer and return null - never a guessed value.
 *
 * @param {unknown} raw
 * @returns {ObservationViewField | null}
 */
function fieldOf(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const field = /** @type {any} */ (raw);
  if (!DISPLAY_MARKS.includes(field.mark)) return null;
  if (typeof field.value !== "string" || field.value.trim().length === 0) return null;
  return { value: field.value.trim(), mark: field.mark };
}

/**
 * The explicit gap view: no usable record. The note survives when the
 * source record carried one (the Vulcan case: a note can document a claimed
 * observation that was later rejected, even when no field has a value).
 *
 * @param {string | null} note
 * @returns {ObservationView}
 */
function gapView(note) {
  return {
    present: false,
    legacy: false,
    discoverer: null,
    date: null,
    keyObservation: null,
    confidence: null,
    note,
  };
}

/**
 * Normalize one reality node's basis into an observation view (ticket 04).
 * Defensive on purpose: the generator (ticket 03) may not have landed, so
 * basis can be a record, a legacy string, absent, or malformed - every case
 * gets a renderable view, and a node without a usable record renders as the
 * explicit gap.
 *
 * @param {any} node - a reality node; null and garbage normalize to the gap.
 * @returns {ObservationView}
 */
export function observationOf(node) {
  const raw =
    node !== null && typeof node === "object" && !Array.isArray(node)
      ? node.basis
      : undefined;

  // Legacy string basis: the old generator's shape. Rendered as the record
  // text with no marks - never a false gap, never a guessed mark.
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text.length === 0) return gapView(null);
    return {
      present: true,
      legacy: true,
      discoverer: null,
      date: null,
      keyObservation: { value: text, mark: null },
      confidence: null,
      note: null,
    };
  }

  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    let record = /** @type {any} */ (raw);
    // Tolerate the wrapped { observation: {...} } shape of the ticket 09
    // response schema; the generator emits the unwrapped record.
    if (
      record.observation !== null &&
      typeof record.observation === "object" &&
      !Array.isArray(record.observation)
    ) {
      record = record.observation;
    }
    const keyObservation = fieldOf(record.keyObservation);
    if (keyObservation === null) {
      // The crux is missing or unknown: the node renders as an explicit gap.
      const note =
        typeof record.note === "string" && record.note.trim().length > 0
          ? record.note.trim()
          : null;
      return gapView(note);
    }
    return {
      present: true,
      legacy: false,
      discoverer: fieldOf(record.discoverer),
      date: fieldOf(record.date),
      keyObservation,
      confidence:
        record.confidence === "high" ||
        record.confidence === "medium" ||
        record.confidence === "low"
          ? record.confidence
          : null,
      note:
        typeof record.note === "string" && record.note.trim().length > 0
          ? record.note.trim()
          : null,
    };
  }

  return gapView(null);
}

/**
 * Every node of a reality map as an observation view, keyed by node id.
 * Nodes with no usable record map to the gap view - the map page never
 * renders a blank card.
 *
 * @param {any} realityMap
 * @returns {Map<string, ObservationView>}
 */
export function observationByNodeId(realityMap) {
  const out = new Map();
  if (realityMap === null || typeof realityMap !== "object") return out;
  const nodes = realityMap.nodes;
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    if (node !== null && typeof node === "object" && typeof node.id === "string") {
      out.set(node.id, observationOf(node));
    }
  }
  return out;
}

/**
 * The first number in a date value, as a sort key - "1847" -> 1847,
 * "c. 1954" -> 1954, "1950s" -> 1950. Values with no number (unknown dates)
 * sort after known dates (Infinity), in their original order. Stable.
 *
 * @param {string | null} value
 * @returns {number}
 */
export function observationDateKey(value) {
  if (typeof value !== "string") return Infinity;
  const match = value.match(/\d{3,4}/);
  if (match === null) return Infinity;
  return Number(match[0]);
}

/**
 * A layer's observation story (ticket 04, extending the v2 layer story): the
 * observations recorded at that layer - what was discovered, by whom, and
 * when - which made the NEXT stage possible. Entries read chronologically,
 * oldest at the foundation; nodes without a usable record appear as gap
 * entries, never dropped, so the layer chain stays visibly unbroken.
 *
 * @param {any} realityMap
 * @param {string} layerId
 * @returns {{
 *   layerId: string;
 *   layerName: string;
 *   entries: Array<{
 *     nodeId: string;
 *     label: string;
 *     observation: ObservationView;
 *   }>;
 * }}
 */
export function layerObservationStory(realityMap, layerId) {
  if (
    realityMap === null ||
    typeof realityMap !== "object" ||
    !Array.isArray(realityMap.layers) ||
    !Array.isArray(realityMap.nodes)
  ) {
    return { layerId, layerName: layerId, entries: [] };
  }
  const layers = /** @type {any[]} */ (realityMap.layers);
  const layer = layers.find((candidate) => candidate && candidate.id === layerId);
  const layerName =
    layer !== undefined && typeof layer.name === "string" ? layer.name : layerId;
  const nodeIds = /** @type {string[]} */ (
    layer !== undefined && Array.isArray(layer.nodes) ? layer.nodes : []
  );
  const nodes = /** @type {any[]} */ (realityMap.nodes);
  const byId = new Map(nodes.map((node) => [node && node.id, node]));
  const entries = nodeIds.map((nodeId) => {
    const node = byId.get(nodeId);
    return {
      nodeId,
      label:
        node !== undefined && typeof node.label === "string" ? node.label : nodeId,
      observation: observationOf(node),
    };
  });

  // Chronological, oldest at the foundation: known dates first, ascending;
  // unknown dates after, in layer order (stable sort).
  const indexed = entries.map((entry, index) => ({
    entry,
    index,
    key: observationDateKey(entry.observation.date && entry.observation.date.value),
  }));
  indexed.sort((a, b) => (a.key - b.key) || (a.index - b.index));
  return { layerId, layerName, entries: indexed.map((x) => x.entry) };
}

/**
 * The direct dependents of a node in strictly higher layers: the nodes whose
 * edges point up from this node's observation ("built-on" and friends), i.e.
 * what this node's observation made possible. Labels, in edge order.
 *
 * @param {any} realityMap
 * @param {string} nodeId
 * @returns {string[]}
 */
export function dependents(realityMap, nodeId) {
  if (
    realityMap === null ||
    typeof realityMap !== "object" ||
    !Array.isArray(realityMap.layers) ||
    !Array.isArray(realityMap.nodes) ||
    !Array.isArray(realityMap.edges)
  ) {
    return [];
  }
  const layers = /** @type {any[]} */ (realityMap.layers);
  const layerIndex = new Map(
    layers.map((layer, index) => [layer && layer.id, index])
  );
  const nodes = /** @type {any[]} */ (realityMap.nodes);
  const byId = new Map(nodes.map((node) => [node && node.id, node]));
  const node = byId.get(nodeId);
  if (node === undefined || typeof node.layer !== "string") return [];
  const ownIndex = layerIndex.get(node.layer);
  if (ownIndex === undefined) return [];

  /** @type {string[]} */
  const labels = [];
  const edges = /** @type {any[]} */ (realityMap.edges);
  for (const edge of edges) {
    if (edge === null || typeof edge !== "object" || edge.target !== nodeId) continue;
    const source = byId.get(edge.source);
    if (source === undefined || typeof source.layer !== "string") continue;
    const sourceIndex = layerIndex.get(source.layer);
    if (sourceIndex === undefined || sourceIndex <= ownIndex) continue;
    labels.push(typeof source.label === "string" ? source.label : edge.source);
  }
  return labels;
}

/**
 * The enabling observations a node COMBINES (ticket 13): the `combines`
 * list of a convergence node, each entry resolved against the map so the
 * panel can render the contributing observations from the other fields -
 * the source node's label and layer plus its observation view. Defensive:
 * a combine entry that references a missing node or carries an unusable
 * record renders as an explicit gap, never a blank and never a crash. A
 * node without a combines list yields an empty array.
 *
 * @param {any} realityMap
 * @param {string} nodeId
 * @returns {Array<{ sourceId: string; label: string; layer: string; layerName: string; observation: ObservationView }>}
 */
export function combinesOf(realityMap, nodeId) {
  if (
    realityMap === null ||
    typeof realityMap !== "object" ||
    !Array.isArray(realityMap.layers) ||
    !Array.isArray(realityMap.nodes)
  ) {
    return [];
  }
  const nodes = /** @type {any[]} */ (realityMap.nodes);
  const byId = new Map(nodes.map((node) => [node && node.id, node]));
  const node = byId.get(nodeId);
  if (node === undefined || !Array.isArray(node.combines)) return [];

  const layers = /** @type {any[]} */ (realityMap.layers);
  const layerName = new Map(
    layers.map((layer) => [layer && layer.id, layer && layer.name])
  );

  return node.combines
    .filter(
      /** @param {any} entry */
      (entry) => entry !== null && typeof entry === "object"
    )
    .map(
      /** @param {any} entry */
      (entry) => {
        const sourceId =
          typeof entry.id === "string" && entry.id.length > 0 ? entry.id : nodeId;
        const source = byId.get(sourceId);
        return {
          sourceId,
          label:
            source !== undefined && typeof source.label === "string"
              ? source.label
              : sourceId,
          layer:
            source !== undefined && typeof source.layer === "string"
              ? source.layer
              : "",
          layerName:
            source !== undefined &&
            typeof source.layer === "string" &&
            typeof layerName.get(source.layer) === "string"
              ? layerName.get(source.layer)
              : "",
          observation: observationOf(source),
        };
      }
    );
}
