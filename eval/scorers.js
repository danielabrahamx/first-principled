/**
 * Deterministic scorers for the tutor quality eval harness (ticket 07).
 *
 * Everything here is a pure function over maps, turns and replies, so the
 * scores are CI-stable. LLM-judged dimensions (subjective question quality,
 * transfer grading agreement) are intentionally NOT scored here - the runner
 * marks them pending a live key (research/03: billing currently 402).
 *
 * Scoring dimensions:
 * - Gap targeting: does a probe hit the reference gap (lowest layer with a
 *   non-correct node; within it misconception > missing > untested)? In v1
 *   gap selection is model-driven, so this is only checkable once ticket 01
 *   makes it deterministic - the runner reports it as not-scorable for the
 *   v1 baseline.
 * - Question quality rubric: single question, short reply, question-ending
 *   for probing moves; direct answer, no trailing question for explain/brief.
 * - No-leak: a non-brief reply never quotes a reality description verbatim.
 * - Evidence fidelity: learner-map evidence quotes are grounded in the
 *   learner's actual words (strict substring check - a lower bound, since
 *   the model may paraphrase).
 */

/**
 * @typedef {import("../src/lib/mmg/types.js").RealityMap} RealityMap
 * @typedef {import("../src/lib/mmg/types.js").LearnerMentalModel} LearnerMentalModel
 */

/** Misconception outranks missing outranks untested. */
const STATE_PRIORITY = { misconception: 0, missing: 1, untested: 2 };

/**
 * @param {string} state
 * @returns {number}
 */
function statePriority(state) {
  return STATE_PRIORITY[state] ?? 3;
}

/**
 * The reference next gap: the lowest layer containing any non-correct node,
 * and within that layer the highest-priority state (misconception > missing
 * > untested). This is the dependency-order rule the prompt states in v1 and
 * nextGaps makes deterministic in ticket 01.
 *
 * @param {RealityMap} realityMap
 * @param {LearnerMentalModel} learnerMap
 * @returns {{ nodeId: string; label: string; state: string; layerIndex: number } | null}
 *   null when every node is already correct.
 */
export function referenceGap(realityMap, learnerMap) {
  const stateById = new Map(learnerMap.nodes.map((node) => [node.id, node.state]));
  const layerIndex = new Map(realityMap.layers.map((layer, i) => [layer.id, i]));
  /** @type {Map<number, { nodeId: string; label: string; state: string }[]>} */
  const byLayer = new Map();
  for (const node of realityMap.nodes) {
    const state = stateById.get(node.id) ?? "untested";
    if (state === "correct") continue;
    const li = layerIndex.get(node.layer);
    const list = byLayer.get(li) ?? [];
    list.push({ nodeId: node.id, label: node.label, state });
    byLayer.set(li, list);
  }
  const lowest = [...byLayer.keys()].sort((a, b) => a - b)[0];
  if (lowest === undefined) return null;
  const layerNodes = /** @type {any[]} */ (byLayer.get(lowest));
  layerNodes.sort((a, b) => statePriority(a.state) - statePriority(b.state));
  const top = layerNodes[0];
  return { nodeId: top.nodeId, label: top.label, state: top.state, layerIndex: lowest };
}

/**
 * Whether a probe target is the reference gap for the map as it was before
 * that turn.
 *
 * @param {RealityMap} realityMap
 * @param {LearnerMentalModel} learnerMap
 * @param {string} probeNodeId
 * @returns {boolean}
 */
export function probesReferenceGap(realityMap, learnerMap, probeNodeId) {
  const ref = referenceGap(realityMap, learnerMap);
  return ref !== null && ref.nodeId === probeNodeId;
}

/**
 * Question-quality rubric rules for one reply, applied deterministically.
 * Returns one pass/fail per rule; the score is the fraction passing.
 *
 * @param {string} reply
 * @param {{ kind: string }} probe
 * @returns {{ rules: { name: string; pass: boolean }[]; score: number }}
 */
export function rubricReply(reply, probe) {
  const text = reply.trim();
  const questionMarks = (text.match(/\?/g) || []).length;
  const endsWithQuestion = /[?？]\s*$/.test(text);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  /** @type {{ name: string; pass: boolean }[]} */
  const rules = [];
  if (probe.kind === "observe" || probe.kind === "probe" || probe.kind === "predict") {
    rules.push({ name: "asks a question", pass: questionMarks >= 1 });
    rules.push({ name: "single question", pass: questionMarks <= 2 && endsWithQuestion });
    rules.push({ name: "short (<=5 sentences)", pass: sentences <= 5 });
  } else {
    // explain / brief / converse deliver, they do not interrogate
    rules.push({ name: "direct answer, no trailing question", pass: !endsWithQuestion });
  }
  const passed = rules.filter((rule) => rule.pass).length;
  return { rules, score: rules.length === 0 ? 1 : passed / rules.length };
}

/**
 * The no-leak check: a reply must not quote any reality description verbatim.
 * Briefing turns are the sanctioned exception - the caller skips them.
 *
 * @param {string} reply
 * @param {RealityMap} realityMap
 * @returns {{ pass: boolean; leaked: string | null }}
 */
export function rubricNoLeak(reply, realityMap) {
  const description = realityMap.nodes.find((node) => reply.includes(node.description));
  return { pass: description === undefined, leaked: description ? description.id : null };
}

/**
 * Evidence fidelity: how many learner-map evidence quotes are verbatim
 * substrings of the learner's collected utterances. Strict (a paraphrase
 * fails), so it is a lower bound on true fidelity.
 *
 * @param {LearnerMentalModel} learnerMap
 * @param {string[]} utterances
 * @returns {{ grounded: number; total: number; score: number } | null}
 *   null when there is no evidence to check.
 */
export function evidenceFidelity(learnerMap, utterances) {
  const corpus = utterances.join("\n").toLowerCase();
  let grounded = 0;
  let total = 0;
  for (const node of learnerMap.nodes) {
    for (const quote of node.evidence) {
      total += 1;
      const normalized = quote.trim().toLowerCase();
      if (normalized.length > 0 && corpus.includes(normalized)) grounded += 1;
    }
  }
  return total === 0 ? null : { grounded, total, score: grounded / total };
}
