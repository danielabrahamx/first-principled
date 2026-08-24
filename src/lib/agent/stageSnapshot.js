/**
 * Learner-safe mid-job snapshots for the background poll.
 *
 * Chronology and Epiphanies products may ride GET /api/agent-status while
 * status stays "running". Provenance, prompts, diagnostics, and inner talk
 * stay off this payload. Ticket 09.
 */

const CHRONOLOGY_ITEM_KEYS = [
  "id",
  "regime",
  "new_capability",
  "enabled_by_previous",
  "ancestry_kind",
  "target_relevance",
];

const EPIPHANY_ITEM_KEYS = [
  "id",
  "from_regimes",
  "to_regimes",
  "result",
  "joint_kind",
  "candidate_node",
];

const HISTORY_KEYS = ["certainty", "who", "when", "observation", "uncertainty_note"];

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Record<string, any>} object
 * @param {string[]} keys
 * @returns {Record<string, any>}
 */
function pick(object, keys) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) out[key] = object[key];
  }
  return out;
}

/**
 * @param {unknown} item
 * @returns {Record<string, any> | null}
 */
function chronologyItem(item) {
  if (!isRecord(item)) return null;
  return pick(item, CHRONOLOGY_ITEM_KEYS);
}

/**
 * @param {unknown} item
 * @returns {Record<string, any> | null}
 */
function epiphanyItem(item) {
  if (!isRecord(item)) return null;
  const picked = pick(item, EPIPHANY_ITEM_KEYS);
  if (isRecord(item.history)) picked.history = pick(item.history, HISTORY_KEYS);
  return picked;
}

/**
 * @param {unknown} items
 * @param {(item: unknown) => Record<string, any> | null} mapItem
 * @returns {Record<string, any>[]}
 */
function mapItems(items, mapItem) {
  if (!Array.isArray(items)) return [];
  return items.map(mapItem).filter(/** @type {(item: Record<string, any> | null) => item is Record<string, any>} */ ((item) => item !== null));
}

/**
 * Snapshot after accepted Chronology.
 *
 * @param {string} concept
 * @param {any} chronology
 * @returns {{ concept: string, chronology: Record<string, any>[] }}
 */
export function chronologySnapshot(concept, chronology) {
  return {
    concept,
    chronology: mapItems(chronology && chronology.chronology, chronologyItem),
  };
}

/**
 * Snapshot after accepted Epiphanies.
 *
 * @param {string} concept
 * @param {any} chronology
 * @param {any} epiphanies
 * @returns {{ concept: string, chronology: Record<string, any>[], epiphanies: Record<string, any>[] }}
 */
export function epiphaniesSnapshot(concept, chronology, epiphanies) {
  return {
    concept,
    chronology: mapItems(chronology && chronology.chronology, chronologyItem),
    epiphanies: mapItems(epiphanies && epiphanies.epiphanies, epiphanyItem),
  };
}

/**
 * Drop anything that is not the published snapshot shape.
 *
 * @param {unknown} snapshot
 * @returns {Record<string, any> | undefined}
 */
export function sanitizeSnapshot(snapshot) {
  if (!isRecord(snapshot)) return undefined;
  /** @type {Record<string, any>} */
  const out = {};
  if (typeof snapshot.concept === "string") out.concept = snapshot.concept;
  if (Array.isArray(snapshot.chronology)) {
    out.chronology = mapItems(snapshot.chronology, chronologyItem);
  }
  if (Array.isArray(snapshot.epiphanies)) {
    out.epiphanies = mapItems(snapshot.epiphanies, epiphanyItem);
  }
  return out;
}

/**
 * JSON the status GET returns for a job blob. Missing blob stays running
 * with no snapshot. A running blob forwards stage and snapshot. Terminal
 * success and error shapes stay as they were.
 *
 * @param {any} record
 * @returns {{ status: "running", stage?: string, snapshot?: Record<string, any> } | { status: "success", body: any } | { status: "error", code: string, message: string }}
 */
export function pollJson(record) {
  if (record == null) return { status: "running" };
  if (record.status === "success" && record.httpStatus === 200) {
    return { status: "success", body: record.body };
  }
  if (record.status === "error" && typeof record.code === "string") {
    return {
      status: "error",
      code: record.code,
      message: typeof record.message === "string" ? record.message : "",
    };
  }
  if (record.status === "running") {
    /** @type {{ status: "running", stage?: string, snapshot?: Record<string, any> }} */
    const body = { status: "running" };
    if (typeof record.stage === "string") body.stage = record.stage;
    const snapshot = sanitizeSnapshot(record.snapshot);
    if (snapshot !== undefined) body.snapshot = snapshot;
    return body;
  }
  return { status: "running" };
}
