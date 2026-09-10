/**
 * Ticket v9-01: pair enumeration for the pairwise generator.
 *
 * Code adds the typed concept as a fixed target candidate, then enumerates
 * every unordered candidate pair exactly once. Pair batches receive explicit
 * independent pairs, never a list to rearrange, so there is no input order
 * to preserve. Pure and deterministic.
 */

export const TARGET_ID = "target";
export const MAX_PAIRS = 55;
export const MIN_BATCH = 12;
export const MAX_BATCH = 15;

/**
 * @typedef {object} PairNode
 * @property {string} id
 * @property {string} label
 * @property {string} gloss
 * @property {string} kind
 * @property {string} foundation_fit
 */

/**
 * @typedef {object} CandidatePair
 * @property {string} pair_id
 * @property {string} a_id
 * @property {string} b_id
 */

/**
 * Build the closed world: fixed target plus inventory candidates.
 * Relation enums in the judgment batches are relative to the pair's A
 * and B as assigned here (the lexicographically smaller id is A).
 *
 * @param {string} concept
 * @param {Array<{ id: string; label: string; gloss: string; kind: string; foundation_fit: string }>} candidates
 * @returns {{ target: PairNode; nodes: PairNode[]; byId: Map<string, PairNode> }}
 */
export function buildClosedWorld(concept, candidates) {
  const target = {
    id: TARGET_ID,
    label: concept,
    gloss: `The typed concept under study: ${concept}.`,
    kind: "typed target",
    foundation_fit: "ABSTRACT",
  };
  const nodes = [
    target,
    ...candidates.map((item) => ({
      id: item.id,
      label: item.label,
      gloss: item.gloss,
      kind: item.kind,
      foundation_fit: item.foundation_fit,
    })),
  ];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return { target, nodes, byId };
}

/**
 * Enumerate every unordered pair exactly once. Deterministic: node ids
 * sorted, pairs in lexicographic order, stable pair ids.
 *
 * @param {PairNode[]} nodes
 * @returns {CandidatePair[]}
 */
export function enumeratePairs(nodes) {
  const ids = [...new Set(nodes.map((node) => node.id))].sort();
  if ((ids.length * (ids.length - 1)) / 2 > MAX_PAIRS) {
    throw new Error(
      `pair enumeration exceeds the cap: ${ids.length} concepts need more than ${MAX_PAIRS} pairs`
    );
  }
  const pairs = [];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const a = ids[left];
      const b = ids[right];
      pairs.push({ pair_id: `p-${a}--${b}`, a_id: a, b_id: b });
    }
  }
  return pairs;
}

/**
 * Partition pairs into batches of 12 to 15 where possible. Small inputs
 * (unit tests) may yield one smaller batch; the live path with 36 to 55
 * pairs always yields batches within bounds.
 *
 * @param {CandidatePair[]} pairs
 * @returns {CandidatePair[][]}
 */
export function partitionBatches(pairs) {
  if (pairs.length === 0) return [];
  if (pairs.length <= MAX_BATCH) return [[...pairs]];
  const batchCount = Math.ceil(pairs.length / MAX_BATCH);
  const base = Math.floor(pairs.length / batchCount);
  const extra = pairs.length % batchCount;
  const batches = [];
  let cursor = 0;
  for (let index = 0; index < batchCount; index += 1) {
    const size = base + (index < extra ? 1 : 0);
    batches.push(pairs.slice(cursor, cursor + size));
    cursor += size;
  }
  return batches;
}
