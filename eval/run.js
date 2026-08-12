/**
 * The eval harness runner (ticket 07): drives a full session through the
 * orchestrator with a scripted (stub) or live transport, scores it on the
 * deterministic dimensions, and can record the score table as the baseline.
 *
 * Usage:
 *   node eval/run.js              run the stub session, print scores
 *   node eval/run.js --baseline   run and write research/07-eval-baseline.md
 *   node eval/run.js --live       run against the real API (needs LLM_API_KEY;
 *                                 billing is currently 402, so this exits
 *                                 with a pending note)
 *   node eval/run.js --compare    print baseline vs current from the file
 *
 * The scripted session is written to dependency order (lowest layer first,
 * misconception before untested) so the gap-targeting dimension is
 * meaningful; ticket 01's nextGaps makes that order deterministic in code and
 * is unit-tested separately (src/lib/agent/gaps.test.js).
 *
 * Dimensions that need a real model (subjective question quality, transfer
 * grading agreement) are marked "pending live" - they cannot be scored
 * honestly against a scripted replay.
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { handleRequest, MAX_TURNS } from "../src/lib/agent/orchestrator.js";
import { computeDiff } from "../src/lib/agent/socratic.js";
import { validateLearnerMap, validateRealityMap } from "../src/lib/mmg/validator.js";
import { laptopRealityMap } from "../src/lib/mmg/fixtures.js";
import { CONCEPTS } from "./concepts.js";
import {
  referenceGap,
  rubricReply,
  rubricNoLeak,
  evidenceFidelity,
} from "./scorers.js";

/** @typedef {import("../src/lib/mmg/types.js").RealityMap} RealityMap */
/** @typedef {import("../src/lib/mmg/types.js").LearnerMentalModel} LearnerMentalModel */

const EFFORT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.scratch/first-principled-v2");
const BASELINE_FILE = path.join(EFFORT_DIR, "research", "07-eval-baseline.md");

/* ---------------------------------------------------------------------------
 * Version detection: does the reality map generator speak the per-layer
 * bottom-up flow (ticket 08), the two-phase foundation-first flow (ticket
 * 06), or the v1 one-shot flow? The transport routes map calls differently
 * per version so one script serves all three.
 * ------------------------------------------------------------------------- */

/** @type {"v1" | "two-phase" | "per-layer"} */
let GENERATOR = "v1";
try {
  const reality = await import("../src/lib/agent/realityMap.js");
  if (typeof reality.buildNextLayerSystemPrompt === "function") {
    GENERATOR = "per-layer";
  } else if (typeof reality.buildFoundationSystemPrompt === "function") {
    GENERATOR = "two-phase";
  }
} catch {
  GENERATOR = "v1";
}

/* ---------------------------------------------------------------------------
 * The scripted session (dependency order)
 * ------------------------------------------------------------------------- */

/**
 * Build the learner map for a scripted turn: previous map plus one update.
 *
 * @param {LearnerMentalModel} prev
 * @param {[string, string, number, string[]]} update - [id, state, confidence, evidence]
 * @returns {LearnerMentalModel}
 */
function applyUpdate(prev, update) {
  const [id, state, confidence, evidence] = update;
  const nodes = prev.nodes.some((node) => node.id === id)
    ? prev.nodes.map((node) => (node.id === id ? { id, state, confidence, evidence } : node))
    : [...prev.nodes, { id, state, confidence, evidence }];
  return { nodes, edges: [] };
}

/** @type {LearnerMentalModel} */
let map0 = { nodes: [], edges: [] };

/**
 * The opening turn is produced inside the init call (the learner's first
 * message is the concept word). It seeds n-app correct.
 */
const OPENING_TURN = {
  reply: "What have you noticed about how what you type becomes letters on the screen?",
  learnerMap: applyUpdate(map0, ["n-app", "correct", 0.7, ["I use a laptop every day"]]),
  probe: { nodeId: null, kind: "observe" },
};

/** @type {{ learner: string; reply: string; update: [string, string, number, string[]] }[]} */
const ACTIVE_TURNS = [
  {
    learner: "It's the flow of electric charge - everything runs on it.",
    reply: "And what does that flow depend on reaching the chips?",
    update: ["n-electricity", "correct", 0.8, ["it's the flow of electric charge"]],
  },
  {
    learner: "Chips are made of silicon.",
    reply: "What is it about silicon that makes it the material of choice?",
    update: ["n-silicon", "correct", 0.8, ["chips are made of silicon"]],
  },
  {
    learner: "A transistor is a switch you flick by hand.",
    reply: "What could flip millions of times a second inside the laptop?",
    update: ["n-transistor", "misconception", 0.4, ["a transistor is a switch you flick by hand"]],
  },
  {
    learner: "Oh - so it's a voltage-controlled switch, and small signals flip it on and off!",
    reply: "Exactly. What do chains of those switches build?",
    update: ["n-transistor", "correct", 0.85, ["a voltage-controlled switch, and small signals flip it on and off"]],
  },
  {
    learner: "Circuits connect the components so current flows.",
    reply: "And what do circuits compute from voltages?",
    update: ["n-circuit", "correct", 0.8, ["circuits connect the components so current flows"]],
  },
  {
    learner: "I don't really know what a logic gate is.",
    reply: "Have you ever noticed how a password check either lets you in or stops you?",
    update: ["n-logic-gate", "missing", 0.1, []],
  },
  {
    learner: "Oh! A logic gate is a circuit that computes AND, OR or NOT from voltages.",
    reply: "Exactly - gates compute boolean functions from voltages. And what carries a gate's output?",
    update: ["n-logic-gate", "correct", 0.85, ["a logic gate is a circuit that computes AND, OR or NOT from voltages"]],
  },
  {
    learner: "A bit is a binary digit - the smallest unit of information.",
    reply: "And what manages all of this hardware?",
    update: ["n-bit", "correct", 0.85, ["a bit is a binary digit"]],
  },
  {
    learner: "The operating system runs the programs.",
    reply: "So where do the programs you use every day run?",
    update: ["n-os", "correct", 0.8, ["the operating system runs the programs"]],
  },
];

const TRANSFER_QUESTION = "Your friend's laptop stops working mid-day. Where would you start looking and why?";
const GRADE = JSON.stringify({ passed: true, assessment: "You traced the failure to the power path - exactly right." });

/**
 * The turn plan: each scripted turn plus the learner map before and after it.
 * The probe target is the update's node id; gap targeting is scored against
 * the reference oracle on the pre-turn map.
 *
 * @returns {{ learner: string; reply: string; update: [string, string, number, string[]]; learnerMap: LearnerMentalModel; prevLearner: LearnerMentalModel }[]}
 */
function buildTurnPlan() {
  // The opening seeded n-app correct; every later scripted map accumulates
  // from there (v1 never drops a known node).
  /** @type {LearnerMentalModel} */
  let prev = OPENING_TURN.learnerMap;
  const plan = [];
  for (const turn of ACTIVE_TURNS) {
    const next = applyUpdate(prev, turn.update);
    plan.push({ ...turn, learnerMap: next, prevLearner: prev });
    prev = next;
  }
  return plan;
}

/**
 * The per-layer map-generation script (ticket 08): the foundation reply,
 * then one reply per layer rebuilding the fixture bottom-up, then done. Each
 * layer reply carries the fixture layer, its nodes, and the fixture edges
 * whose higher endpoint sits in that layer, so the assembled map reproduces
 * the fixture exactly.
 *
 * @returns {string[]}
 */
function perLayerMapScript() {
  const layerIndex = new Map(
    laptopRealityMap.layers.map((layer, i) => [layer.id, i])
  );
  const nodeLayer = new Map(
    laptopRealityMap.nodes.map((node) => [node.id, layerIndex.get(node.layer)])
  );
  const script = [
    JSON.stringify({
      isValidConcept: true,
      foundation: {
        layer: laptopRealityMap.layers[0],
        nodes: laptopRealityMap.nodes.filter(
          (node) => node.layer === laptopRealityMap.layers[0].id
        ),
      },
    }),
  ];
  for (let k = 1; k < laptopRealityMap.layers.length; k++) {
    const layer = laptopRealityMap.layers[k];
    const nodes = laptopRealityMap.nodes.filter((node) => node.layer === layer.id);
    const edges = laptopRealityMap.edges.filter((edge) => {
      const s = nodeLayer.get(edge.source);
      const t = nodeLayer.get(edge.target);
      return Math.max(s, t) === k;
    });
    script.push(
      JSON.stringify({
        isValidConcept: true,
        done: false,
        layer,
        nodes,
        edges,
        selfReview: { derivable: true, gaps: [] },
      })
    );
  }
  script.push(JSON.stringify({ isValidConcept: true, done: true }));
  return script;
}

/**
 * The scripted transport: a compliant model that follows the plan. Map
 * generation replies are routed by prompt content so the script works
 * against the v1 one-shot generator, the v2 two-phase generator, and the v3
 * per-layer generator.
 *
 * @returns {{ callLLM: (request: any) => Promise<{ content: string }>, calls: any[] }}
 */
function scriptedTransport() {
  const calls = /** @type {any[]} */ ([]);

  const turns = buildTurnPlan();
  /** @type {string[]} */
  const turnContents = turns.map((turn) =>
    JSON.stringify({
      reply: turn.reply,
      learnerMap: turn.learnerMap,
      probe: { nodeId: turn.update[0], kind: "probe" },
    })
  );
  /** @type {string[]} */
  const plan = [
    ...(GENERATOR === "per-layer"
      ? perLayerMapScript()
      : GENERATOR === "two-phase"
        ? [
            JSON.stringify({
              isValidConcept: true,
              foundation: {
                layer: laptopRealityMap.layers[0],
                nodes: laptopRealityMap.nodes.filter((node) => node.layer === laptopRealityMap.layers[0].id),
              },
            }),
            JSON.stringify({
              isValidConcept: true,
              map: laptopRealityMap,
              selfReview: { derivable: true, gaps: [] },
            }),
          ]
        : [JSON.stringify({ isValidConcept: true, map: laptopRealityMap })]),
    JSON.stringify(OPENING_TURN),
    ...turnContents,
    JSON.stringify({ question: TRANSFER_QUESTION }),
    GRADE,
  ];

  let next = 0;
  const callLLM = async (/** @type {any} */ request) => {
    calls.push(request);
    const user = request.messages && request.messages.length > 1 ? request.messages[1].content : "";
    const sys = request.messages && request.messages.length > 0 ? request.messages[0].content : "";
    let content;
    if (typeof user === "string" && user.startsWith("Word or phrase:")) {
      // map generation: phase A (per-layer / two-phase) or the one-shot call (v1)
      content = plan[next++];
    } else if (GENERATOR === "per-layer" && typeof user === "string" && user.includes("Build layer l")) {
      // per-layer derive calls (ticket 08): one reply per layer, then done
      content = plan[next++];
    } else if (GENERATOR === "two-phase" && typeof user === "string" && user.includes("Derive the remaining layers")) {
      content = plan[next++];
    } else if (typeof user === "string" && user.includes("Ask the transfer question now")) {
      content = plan[next++];
    } else if (typeof user === "string" && user.includes("The learner's answer:")) {
      content = plan[next++];
    } else if (typeof sys === "string" && sys.includes("Socratic tutor")) {
      content = plan[next++];
    } else {
      throw new Error(`eval transport could not route a call: ${String(user).slice(0, 80)}`);
    }
    return { content };
  };
  return { callLLM, calls };
}

/* ---------------------------------------------------------------------------
 * Running one concept through the orchestrator and scoring it
 * ------------------------------------------------------------------------- */

/**
 * @param {RealityMap} realityMap
 * @returns {Promise<any>}
 */
async function runSession(realityMap) {
  const { callLLM, calls } = scriptedTransport();
  /** @type {any[]} */
  const invariantErrors = [];
  /** @type {{ nodeId: string; hit: boolean; turn: number }[]} */
  const gapChecks = [];
  /** @type {{ turn: number; rules: { name: string; pass: boolean }[]; score: number; promptChars: number }[]} */
  const qualityChecks = [];
  /** @type {string[]} */
  const utterances = [];

  /** @type {LearnerMentalModel} */
  let learnerMap = { nodes: [], edges: [] };
  /** @type {any} */
  let response;
  let turnNumber = 0;

  const step = async (/** @type {any} */ request, isInit = false) => {
    const prevLearner = learnerMap;
    const result = await handleRequest(request, { callLLM });
    if (result.status !== 200) {
      invariantErrors.push(`turn ${turnNumber}: status ${result.status}`);
      return result;
    }
    const body = result.body;
    turnNumber += 1;
    if (!isInit) {
      const validation = validateLearnerMap(body.learnerMap, realityMap);
      if (!validation.ok) invariantErrors.push(`turn ${turnNumber}: invalid learner map: ${validation.errors.join("; ")}`);
      const computed = computeDiff(prevLearner, body.learnerMap);
      if (JSON.stringify(computed) !== JSON.stringify(body.diff)) {
        invariantErrors.push(`turn ${turnNumber}: diff mismatch`);
      }
      if (body.reply && typeof body.reply === "string") {
        const leak = rubricNoLeak(body.reply, realityMap);
        if (!leak.pass) invariantErrors.push(`turn ${turnNumber}: leak of reality description (node ${leak.leaked})`);
      }
      if (body.learnerMap && typeof body.learnerMap === "object") learnerMap = body.learnerMap;
    }
    return result;
  };

  const init = await step({ word: realityMap.concept, history: [], phase: "init" }, true);
  if (init.status !== 200 || init.body.phase !== "active") {
    invariantErrors.push(`init failed: ${init.status} ${JSON.stringify(init.body).slice(0, 120)}`);
    return { invariantErrors, gapChecks, qualityChecks, utterances, calls };
  }
  learnerMap = init.body.learnerMap;

  const history = [
    { role: "assistant", content: init.body.reply },
    { role: "user", content: "" }, // replaced each turn
  ];

  // The learner's answer to the opening question, recorded for evidence
  // fidelity (the init response already adopted the n-app update).
  utterances.push("I use a laptop every day for email and spreadsheets.");

  for (const turn of ACTIVE_TURNS) {
    history[history.length - 1] = { role: "user", content: turn.learner };
    utterances.push(turn.learner);
    const request = {
      realityMap,
      learnerMap,
      failedAttempts: init.body.failedAttempts ?? {},
      history,
      phase: "active",
    };
    const result = await step(request);
    if (result.status !== 200) break;
    learnerMap = result.body.learnerMap;
    history.push({ role: "assistant", content: result.body.reply });
  }

  // Every node is now known: one more active request triggers the transfer
  // question (sessionEndDue), then the learner's answer is graded in phase end.
  history.push({ role: "user", content: "I think I've got the whole chain now." });
  const transferStep = await step(
    { realityMap, learnerMap, failedAttempts: {}, history, phase: "active" }
  );
  if (transferStep.status !== 200 || transferStep.body.phase !== "end") {
    invariantErrors.push(`transfer question did not fire: ${transferStep.status} ${JSON.stringify(transferStep.body).slice(0, 120)}`);
  }
  const answer = "I'd check the power path first - the battery and charger - because the whole chain depends on electricity flowing.";
  utterances.push(answer);
  history.push({ role: "user", content: answer });
  const end = await step(
    { realityMap, learnerMap, failedAttempts: {}, history, phase: "end" }
  );
  if (end.status !== 200 || end.body.sessionEnded !== true) {
    invariantErrors.push(`session did not end cleanly: ${end.status} ${JSON.stringify(end.body).slice(0, 120)}`);
  }

  // Score the scripted turns (the response contract does not carry probe):
  // gap targeting against the reference oracle on the pre-turn map, the
  // question rubric on the reply, and the probe prompt size from the calls
  // the transport recorded (calls[0] is map generation, calls[1] the opening,
  // calls[2..] the active turns).
  const plan = buildTurnPlan();
  plan.forEach((turn, i) => {
    const ref = referenceGap(realityMap, turn.prevLearner);
    gapChecks.push({
      nodeId: turn.update[0],
      hit: ref !== null && ref.nodeId === turn.update[0],
      turn: i + 1,
    });
    const rubric = rubricReply(turn.reply, { kind: "probe" });
    const call = calls[i + 2];
    qualityChecks.push({
      turn: i + 1,
      ...rubric,
      promptChars: call ? callChars(call) : 0,
    });
  });

  const fidelity = evidenceFidelity(learnerMap, utterances);
  return { invariantErrors, gapChecks, qualityChecks, fidelity, calls };
}

/**
 * @param {any} request
 * @returns {number} the user prompt length for the call, or 0
 */
function callChars(request) {
  const user = request.messages && request.messages.length > 1 ? request.messages[1].content : "";
  return typeof user === "string" ? user.length : 0;
}

/* ---------------------------------------------------------------------------
 * Engine fingerprint for the baseline record
 * ------------------------------------------------------------------------- */

/**
 * @returns {Promise<{ rev: string; dirty: boolean; generator: string }>}
 */
async function fingerprint() {
  let rev = "unknown";
  let dirty = true;
  try {
    const { execSync } = await import("node:child_process");
    rev = execSync("git rev-parse --short HEAD").toString().trim();
    dirty = execSync("git status --porcelain").toString().trim().length > 0;
  } catch {
    // not a git repo context - report unknown
  }
  return { rev, dirty, generator: GENERATOR };
}

/* ---------------------------------------------------------------------------
 * CLI
 * ------------------------------------------------------------------------- */

/**
 * @param {any} scores
 * @param {string} generator
 * @returns {string}
 */
function formatTable(scores, generator) {
  const rows = [];
  for (const [name, value] of Object.entries(scores)) {
    rows.push({ name, value });
  }
  const width = Math.max(...rows.map((row) => row.name.length)) + 2;
  const lines = rows.map((row) => `${row.name.padEnd(width)} ${row.value}`);
  return [
    `Concept set: ${CONCEPTS.map((c) => c.concept).join(", ")}`,
    `Generator: ${
      generator === "per-layer"
        ? "per-layer bottom-up (ticket 08)"
        : generator === "two-phase"
          ? "two-phase foundation-first (ticket 06)"
          : "one-shot (v1)"
    }`,
    "",
    ...lines,
  ].join("\n");
}

const args = process.argv.slice(2);
const wantBaseline = args.includes("--baseline");
const wantCompare = args.includes("--compare");
const wantLive = args.includes("--live");

if (wantLive) {
  console.log(
    "Live eval needs LLM_API_KEY with balance (research/03: the .env key returns 402 Insufficient Balance).\nPending billing top-up. Run: node eval/run.js"
  );
  process.exit(0);
}

if (wantCompare) {
  if (!existsSync(BASELINE_FILE)) {
    console.log(`No baseline file at ${BASELINE_FILE}. Run: node eval/run.js --baseline`);
    process.exit(1);
  }
  console.log(`Baseline: ${BASELINE_FILE}\n`);
  console.log(readFileSync(BASELINE_FILE, "utf8"));
  console.log("\nCurrent run (re-run after changes):\n");
  const current = await runAndScore();
  console.log(current.table);
  process.exit(0);
}

/**
 * @returns {Promise<{ scores: Record<string, string | number>; table: string; invariantErrors: string[] }>}
 */
async function runAndScore() {
  const realityMap = laptopRealityMap;
  const session = await runSession(realityMap);
  const validity = validateRealityMap(realityMap);
  const gapHits = session.gapChecks.filter((check) => check.hit).length;
  const gapTotal = session.gapChecks.length;
  const rubricAvg =
    session.qualityChecks.length === 0
      ? 0
      : session.qualityChecks.reduce((sum, check) => sum + check.score, 0) / session.qualityChecks.length;
  const promptAvg =
    session.qualityChecks.length === 0
      ? 0
      : Math.round(session.qualityChecks.reduce((sum, check) => sum + check.promptChars, 0) / session.qualityChecks.length);
  const fidelity = session.fidelity ? session.fidelity.score : "no evidence";
  const promptMax = Math.max(0, ...session.qualityChecks.map((check) => check.promptChars));
  const llmCalls = session.calls.length;

  const scores = {
    "concept fixture valid": validity.ok ? "yes" : `no (${validity.errors.join("; ")})`,
    "session invariants (errors)": session.invariantErrors.length,
    "gap targeting (dependency order)": `${gapHits}/${gapTotal}`,
    "question rubric avg": rubricAvg.toFixed(2),
    "evidence fidelity": typeof fidelity === "number" ? fidelity.toFixed(2) : fidelity,
    "probe prompt chars (avg)": promptAvg,
    "probe prompt chars (max)": promptMax,
    "llm calls per session": llmCalls,
    "transfer graded": "pending live (scripted pass; real grading needs a live key)",
  };
  return { scores, table: formatTable(scores, GENERATOR), invariantErrors: session.invariantErrors };
}

const current = await runAndScore();
console.log(current.table);
if (current.invariantErrors.length > 0) {
  console.log("\nInvariant errors:");
  for (const error of current.invariantErrors) console.log(`  - ${error}`);
  process.exitCode = 1;
}

if (wantBaseline) {
  const fp = await fingerprint();
  const body = [
    `# 07 - Eval harness: baseline scores`,
    ``,
    `Recorded by \`node eval/run.js --baseline\` on 2026-08-10.`,
    `Engine fingerprint: git ${fp.rev}${fp.dirty ? " (working tree dirty)" : ""}; generator: ${fp.generator}.`,
    ``,
    `All deterministic dimensions are scored offline with a scripted (compliant) transport.`,
    `LLM-judged dimensions - subjective question quality and transfer grading - are marked`,
    `pending live: the .env key returns 402 Insufficient Balance (research/03). Re-run live`,
    `after a top-up: \`node eval/run.js --live\`.`,
    ``,
    "```",
    current.table,
    "```",
    ``,
    `Notes:`,
    `- Gap targeting is scored against the dependency-order reference (lowest layer first,`,
    `  misconception > missing > untested). The script is written to that order, so a high`,
    `  score means the session follows it. Ticket 01 moves this rule into deterministic`,
    `  code (nextGaps, unit-tested in gaps.test.js) and shrinks the probe prompt from a full`,
    `  map dump to a gap report - the prompt-chars row measures that reduction.`,
    `- A v1 engine that dumps both full maps scores ~$promptAvg+ chars per probe prompt; the`,
    `  post-01 gap report should cut it substantially.`,
  ].join("\n");
  writeFileSync(BASELINE_FILE, body);
  console.log(`\nBaseline written: ${BASELINE_FILE}`);
}
