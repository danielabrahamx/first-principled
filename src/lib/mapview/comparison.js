/**
 * Session-end comparison viewmodel (ticket 10): pure functions that turn the
 * frozen session state into the comparison view's visual model.
 *
 * The comparison unlocks ONLY at session end: the map page renders it only
 * when the store says the session ended (state.ended and a held reality
 * map). Unlike the mid-session map view (viewmodel.js), which is restricted
 * to the learner's own model, the comparison may use the full reality map -
 * layer names, descriptions, unengaged nodes, edge types - because the
 * session is over and ground truth is shown on purpose, side by side with
 * what the learner's model became.
 *
 * Pure and DOM-free so node:test covers the shapes directly.
 */

/**
 * @typedef {import("../mmg/types.js").RealityMap} RealityMap
 * @typedef {import("../mmg/types.js").NodeState} NodeState
 */

/**
 * The reality map as sections - one per layer, in layer order, each with
 * its nodes (label plus description). The layer chain is the reality
 * structure this view exists to show.
 *
 * @param {RealityMap | null | undefined} realityMap
 * @returns {Array<{ id: string; name: string; nodes: Array<{ id: string; label: string; description: string }> }>}
 */
export function realitySections(realityMap) {
  if (!realityMap || !Array.isArray(realityMap.layers) || !Array.isArray(realityMap.nodes)) {
    return [];
  }
  const byId = new Map(realityMap.nodes.map((node) => [node.id, node]));
  return realityMap.layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    nodes: (Array.isArray(layer.nodes) ? layer.nodes : []).map((id) => {
      const node = byId.get(id);
      return {
        id,
        label: node ? node.label : id,
        description: node ? node.description : "",
      };
    }),
  }));
}

/**
 * The reality edges as a readable list: source label, relation, target
 * label - the "how the parts relate" summary of the comparison.
 *
 * @param {RealityMap | null | undefined} realityMap
 * @returns {Array<{ source: string; target: string; type: string; sourceLabel: string; targetLabel: string }>}
 */
export function realityEdgeList(realityMap) {
  if (!realityMap || !Array.isArray(realityMap.edges) || !Array.isArray(realityMap.nodes)) {
    return [];
  }
  const labels = new Map(realityMap.nodes.map((node) => [node.id, node.label]));
  return realityMap.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    type: edge.type,
    sourceLabel: labels.get(edge.source) ?? edge.source,
    targetLabel: labels.get(edge.target) ?? edge.target,
  }));
}

/**
 * The comparison's metric summary (spec section 10): closeness score, gap
 * closures, and the transfer result. All read from the session store's own
 * recorded metrics - this view never recomputes from history, so the number
 * the learner sees is the number the store recorded.
 *
 * @param {object} state - the session store state.
 * @param {number | null} [state.closeness]
 * @param {number} [state.gapClosures]
 * @param {{ passed: boolean; assessment: string } | null} [state.transferResult]
 * @returns {{ closeness: number; gapClosures: number; transferPassed: boolean | null; transferAssessment: string }}
 */
export function comparisonMetrics(state) {
  return {
    closeness: typeof state.closeness === "number" ? state.closeness : 0,
    gapClosures: typeof state.gapClosures === "number" ? state.gapClosures : 0,
    transferPassed: state.transferResult ? state.transferResult.passed : null,
    transferAssessment: state.transferResult ? state.transferResult.assessment : "",
  };
}
