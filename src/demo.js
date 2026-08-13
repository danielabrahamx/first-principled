/**
 * Demo session loader: seeds a scripted laptop session into the shared
 * store so the map-first UI (tickets 09-12) is reviewable without the API
 * key. The DeepSeek key is currently 402 (research/03), so ?demo=1 is how
 * Danny and the tests see the node panel, hover history, layer stories and
 * timeline replay end to end.
 *
 * The script mirrors the eval harness's compliant session: an opening
 * observe turn, then a series of gap probes that rotate n-transistor
 * through misconception -> correct, add n-logic-gate and n-bit, and finish
 * with a transfer result. Every applyResponse carries a diff, a probe, and
 * a reply so the ledger (and everything derived from it) is fully populated.
 */

import { laptopRealityMap, laptopLearnerMap } from "./lib/mmg/fixtures.js";

/** @typedef {import("./state/session.js").SessionStore} SessionStore */

/**
 * One scripted turn response.
 *
 * @param {object} turn
 * @param {string} turn.reply
 * @param {import("./lib/mmg/types.js").LearnerMentalModel} turn.learnerMap
 * @param {import("./lib/mmg/types.js").Diff} turn.diff
 * @param {{ nodeId: string | null; kind: import("./lib/agent/socratic.js").ProbeKind }} turn.probe
 * @param {boolean} [ended]
 * @returns {any}
 */
function turnResponse(turn, ended = false) {
  /** @type {any} */
  const body = {
    reply: turn.reply,
    learnerMap: turn.learnerMap,
    diff: turn.diff,
    phase: ended ? "end" : "active",
    failedAttempts: {},
    probe: turn.probe,
  };
  if (ended) {
    body.sessionEnded = true;
    body.transferResult = {
      passed: true,
      assessment: "You found the fault in the power path. That is right.",
    };
  }
  return body;
}

/**
 * Seed a full scripted session into the store. Returns true on success.
 *
 * @param {SessionStore} store
 * @returns {boolean}
 */
export function loadDemoSession(store) {
  if (!store.startSession("laptop")) return false;

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const openingMap = {
    nodes: [
      {
        id: "n-app",
        state: "correct",
        confidence: 0.7,
        evidence: ["I use a laptop every day for email and spreadsheets"],
      },
    ],
    edges: [],
  };

  const t1 = turnResponse({
    reply: "What have you noticed about how what you type becomes letters on the screen?",
    learnerMap: openingMap,
    diff: { added: ["n-app"], flipped: [], updated: [] },
    probe: { nodeId: null, kind: "observe" },
  });
  store.applyResponse({
    ...t1,
    realityMap: laptopRealityMap,
  });

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t2map = {
    nodes: [
      openingMap.nodes[0],
      {
        id: "n-electricity",
        state: "correct",
        confidence: 0.8,
        evidence: ["it's the flow of electric charge - everything runs on it"],
      },
    ],
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "And what does that flow depend on reaching the chips?",
      learnerMap: t2map,
      diff: { added: ["n-electricity"], flipped: [], updated: [] },
      probe: { nodeId: "n-electricity", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t3map = {
    nodes: [
      ...t2map.nodes,
      {
        id: "n-transistor",
        state: "misconception",
        confidence: 0.4,
        evidence: ["a transistor is a switch you flick on and off by hand"],
      },
    ],
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "You said a transistor is a switch you flick by hand. What could possibly flip it millions of times a second?",
      learnerMap: t3map,
      diff: { added: ["n-transistor"], flipped: [], updated: [] },
      probe: { nodeId: "n-transistor", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t4map = {
    nodes: t3map.nodes.map((node) =>
      node.id === "n-transistor"
        ? {
            ...node,
            confidence: 0.35,
            evidence: [
              "a transistor is a switch you flick on and off by hand",
              "transistors mainly amplify audio, like in guitar amps",
            ],
          }
        : node
    ),
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "If transistors were mainly audio parts, what in the laptop flips millions of times a second to do arithmetic?",
      learnerMap: t4map,
      diff: { added: [], flipped: [], updated: ["n-transistor"] },
      probe: { nodeId: "n-transistor", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t5map = {
    nodes: t4map.nodes.map((node) =>
      node.id === "n-transistor"
        ? {
            ...node,
            state: "correct",
            confidence: 0.85,
            evidence: ["so it's a tiny switch a voltage signal flips, and chaining them does arithmetic"],
          }
        : node
    ),
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "Exactly - a tiny switch a signal controls. And what do chains of those switches build?",
      learnerMap: t5map,
      diff: {
        added: [],
        flipped: [{ id: "n-transistor", from: "misconception", to: "correct" }],
        updated: [],
      },
      probe: { nodeId: "n-transistor", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t6map = {
    nodes: [
      ...t5map.nodes,
      { id: "n-logic-gate", state: "missing", confidence: 0.1, evidence: [] },
    ],
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "Have you ever noticed how a password check either lets you in or stops you?",
      learnerMap: t6map,
      diff: { added: ["n-logic-gate"], flipped: [], updated: [] },
      probe: { nodeId: "n-logic-gate", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t7map = {
    nodes: t6map.nodes.map((node) =>
      node.id === "n-logic-gate"
        ? {
            ...node,
            state: "correct",
            confidence: 0.85,
            evidence: ["a logic gate is a circuit that computes AND, OR and NOT from voltages"],
          }
        : node
    ),
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "Exactly - gates compute boolean functions from voltages. And what carries a gate's output?",
      learnerMap: t7map,
      diff: {
        added: [],
        flipped: [{ id: "n-logic-gate", from: "missing", to: "correct" }],
        updated: [],
      },
      probe: { nodeId: "n-logic-gate", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t8map = {
    nodes: [
      ...t7map.nodes,
      { id: "n-bit", state: "correct", confidence: 0.85, evidence: ["a bit is a binary digit"] },
    ],
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "And what manages all of this hardware?",
      learnerMap: t8map,
      diff: { added: ["n-bit"], flipped: [], updated: [] },
      probe: { nodeId: "n-bit", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t9map = {
    nodes: [
      ...t8map.nodes,
      { id: "n-os", state: "correct", confidence: 0.8, evidence: ["the operating system runs the programs"] },
    ],
    edges: [],
  };
  store.applyResponse(
    turnResponse({
      reply: "So where do the programs you use every day run?",
      learnerMap: t9map,
      diff: { added: ["n-os"], flipped: [], updated: [] },
      probe: { nodeId: "n-os", kind: "probe" },
    })
  );

  /** @type {import("./lib/mmg/types.js").LearnerMentalModel} */
  const t10map = {
    nodes: [
      ...t9map.nodes,
      { id: "n-app", state: "correct", confidence: 0.85, evidence: ["apps run on the operating system"] },
    ],
    edges: [],
  };
  store.applyResponse(
    turnResponse(
      {
        reply: "Your friend's laptop stops working mid-day. Where would you start looking and why?",
        learnerMap: t10map,
        diff: { added: [], flipped: [], updated: ["n-app"] },
        probe: { nodeId: "n-app", kind: "probe" },
      },
      true
    )
  );

  return true;
}

/**
 * Whether the URL asks for the demo session (?demo=1).
 *
 * @returns {boolean}
 */
export function wantsDemo() {
  if (typeof globalThis.location === "undefined") return false;
  const params = new URLSearchParams(globalThis.location.search);
  return params.get("demo") === "1";
}

/**
 * A self-contained demo entry: seed the store and navigate to the map.
 * Used by app.js when ?demo=1 is present.
 *
 * @param {SessionStore} store
 * @returns {void}
 */
export function runDemo(store) {
  if (loadDemoSession(store)) {
    const location = /** @type {any} */ (globalThis.location);
    if (location && typeof location.hash === "string") {
      location.hash = "#map";
    }
  }
}
