/**
 * Closeness score: the fraction of known learner nodes whose state is
 * correct. A node is known when its state is not untested; a correct node
 * matches the reality map. Pure and deterministic: same input, same output.
 */

/**
 * @param {import("./types.js").LearnerMentalModel} learnerMap
 * @returns {number} 0..1
 */
export function closenessScore(learnerMap) {
  const known = learnerMap.nodes.filter((node) => node.state !== "untested");
  if (known.length === 0) return 0;
  const correct = known.filter((node) => node.state === "correct").length;
  return correct / known.length;
}
