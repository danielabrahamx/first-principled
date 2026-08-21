// Split a three-stage generation into a learner map and a diagnostic bundle.
// Learner files must not contain chronology, raw epiphanies, provenance,
// discarded IDs, or prompts. Ticket 07 runs --live for the four gold words.
//
//   node .scratch/first-principled-v7/research/06-capture-diagnostics.mjs --fixture
//   node --env-file=.env .scratch/first-principled-v7/research/06-capture-diagnostics.mjs --live
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const outDirFlag = process.argv.indexOf("--out-dir");
const outDirArg =
  outDirFlag !== -1 && process.argv[outDirFlag + 1] && !process.argv[outDirFlag + 1].startsWith("--")
    ? process.argv[outDirFlag + 1]
    : null;
const outDir = outDirArg
  ? path.isAbsolute(outDirArg)
    ? outDirArg
    : path.resolve(root, outDirArg)
  : path.join(here, "06-diagnostics");
const GOLD = ["laptop", "battery", "photosynthesis", "recursion"];
const FORBIDDEN = [
  "provenance",
  "chronology",
  "epiphanies",
  "discardedInputIds",
  "discarded_input_ids",
  "prompts",
  "diagnostics",
];

const realityMapUrl = pathToFileURL(path.join(root, "src/lib/agent/realityMap.js")).href;
const jsonParseUrl = pathToFileURL(path.join(root, "src/lib/agent/jsonParse.js")).href;
const llmUrl = pathToFileURL(path.join(root, "src/lib/agent/llm.js")).href;
const { generateRealityMap } = await import(realityMapUrl);
const { parseModelJson } = await import(jsonParseUrl);

const wantLive = process.argv.includes("--live");
const wantFixture = process.argv.includes("--fixture") || !wantLive;

/**
 * @param {any} value
 * @param {string[]} found
 * @returns {string[]}
 */
function leakKeys(value, found = []) {
  if (!value || typeof value !== "object") return found;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.includes(key)) found.push(key);
    leakKeys(value[key], found);
  }
  return found;
}

/**
 * @param {string} concept
 * @param {{
 *   ok: boolean;
 *   map: any;
 *   diagnostics: any;
 *   reason?: string | null;
 *   kind?: string | null;
 *   errors?: string[];
 *   latencyMs?: number | null;
 *   stages?: Record<string, any>;
 * }} result
 */
function writeSplit(concept, result) {
  fs.mkdirSync(outDir, { recursive: true });
  const stages = result.stages ?? {};
  const arrange = stages.arrange && typeof stages.arrange === "object" ? stages.arrange : null;
  const learner = {
    concept,
    ok: result.ok,
    map: result.map,
  };
  const diagnostics = {
    concept,
    ok: result.ok,
    reason: result.reason ?? null,
    kind: result.kind ?? null,
    latencyMs: result.latencyMs ?? null,
    errors: Array.isArray(result.errors) ? result.errors : [],
    chronology: result.diagnostics?.chronology ?? stages.chronology ?? null,
    epiphanies: result.diagnostics?.epiphanies ?? stages.epiphanies ?? null,
    provenance:
      result.diagnostics?.provenance ??
      (arrange && arrange.provenance ? arrange.provenance : null),
    discardedInputIds: result.diagnostics?.discardedInputIds ?? [],
    arrange: result.ok ? null : arrange,
    prompts: result.diagnostics?.prompts
      ? {
          chronology: Boolean(result.diagnostics.prompts.chronology),
          epiphanies: Boolean(result.diagnostics.prompts.epiphanies),
          arrange: Boolean(result.diagnostics.prompts.arrange),
        }
      : {
          chronology: Boolean(stages.chronology),
          epiphanies: Boolean(stages.epiphanies),
          arrange: Boolean(stages.arrange),
        },
  };
  const learnerPath = path.join(outDir, `${concept}-learner.json`);
  const diagPath = path.join(outDir, `${concept}-diagnostics.json`);
  fs.writeFileSync(learnerPath, `${JSON.stringify(learner, null, 2)}\n`);
  fs.writeFileSync(diagPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
  const leaks = leakKeys(learner);
  console.log(`CONCEPT=${concept}`);
  console.log(`LEARNER=${path.relative(root, learnerPath).replaceAll("\\", "/")}`);
  console.log(`DIAGNOSTICS=${path.relative(root, diagPath).replaceAll("\\", "/")}`);
  console.log(`LEARNER_LEAKS=${leaks.length ? leaks.join(",") : "none"}`);
  console.log(`HAS_CHRONOLOGY=${Boolean(diagnostics.chronology)}`);
  console.log(`HAS_PROVENANCE=${Boolean(diagnostics.provenance)}`);
  console.log(`ERROR_COUNT=${diagnostics.errors.length}`);
  console.log(`HAS_PROMPTS=${Boolean(diagnostics.prompts)}`);
  if (leaks.length) {
    throw new Error(`${concept} learner file leaked ${leaks.join(",")}`);
  }
}

if (wantFixture) {
  const chronology = {
    concept: "battery",
    chronology: [
      {
        id: "c1",
        regime: "separated charge",
        new_capability: "stored electrical potential",
        enabled_by_previous: [],
        ancestry_kind: "PHYSICAL",
        target_relevance: "A battery needs charge separation.",
      },
      {
        id: "c2",
        regime: "controlled redox reaction",
        new_capability: "sustained electron flow",
        enabled_by_previous: ["c1"],
        ancestry_kind: "PHYSICAL",
        target_relevance: "A battery converts chemical potential into current.",
      },
    ],
  };
  const epiphanies = {
    concept: "battery",
    epiphanies: [
      {
        id: "e1",
        from_regimes: ["c1"],
        to_regimes: ["c2"],
        result: "Two metals and an electrolyte sustain a circuit.",
        joint_kind: "EXPERIMENTAL_RESULT",
        history: {
          certainty: "EXACT",
          who: ["Alessandro Volta"],
          when: "1800",
          observation: "Alternating metal discs separated by brine produced continuous current.",
          uncertainty_note: "",
        },
        candidate_node: "voltaic pile",
      },
      {
        id: "e2",
        from_regimes: ["c2"],
        to_regimes: ["c2"],
        result: "A stable cell delivers steady current for a long time.",
        joint_kind: "ENGINEERED_RESULT",
        history: {
          certainty: "EXACT",
          who: ["John Frederic Daniell"],
          when: "1836",
          observation: "Copper and zinc cells with a porous barrier kept current steady.",
          uncertainty_note: "",
        },
        candidate_node: "Daniell cell",
      },
    ],
  };
  const arrangement = {
    concept: "battery",
    edges: [
      {
        from: "e1",
        to: "c1",
        because: "The voltaic pile needs separated charge to sustain a circuit.",
        evidence_ids: ["e1"],
      },
      {
        from: "c2",
        to: "c1",
        because: "A controlled redox reaction needs separated charge to drive electron flow.",
        evidence_ids: [],
      },
      {
        from: "e2",
        to: "c2",
        because: "The Daniell cell rests on a controlled redox reaction.",
        evidence_ids: ["e2"],
      },
    ],
  };
  const queue = [chronology, epiphanies, arrangement].map((value) => JSON.stringify(value));
  const result = await generateRealityMap({
    concept: "battery",
    callLLM: async () => {
      const content = queue.shift();
      if (content === undefined) throw new Error("unexpected extra LLM call");
      return { content };
    },
  });
  writeSplit("battery", result);
  console.log("PASS - fixture learner map is stripped; diagnostics remain capturable");
}

if (wantLive) {
  const { callChatCompletion, llmApiKey, llmApiKeyName, llmModel, llmProvider } = await import(llmUrl);
  if (!llmApiKey()) {
    console.error(`Live capture needs ${llmApiKeyName()}`);
    process.exit(1);
  }
  console.log(`PROVIDER=${llmProvider()}`);
  console.log(`MODEL=${llmModel()}`);
  const words = process.argv.slice(2).filter((arg, index, args) => {
    if (arg.startsWith("--")) return false;
    if (args[index - 1] === "--out-dir") return false;
    return true;
  });
  const concepts = words.length > 0 ? words : GOLD;
  const stageOrder = ["chronology", "epiphanies", "arrange"];
  for (const concept of concepts) {
    /** @type {Record<string, any>} */
    const stages = {};
    let callIndex = 0;
    const result = await generateRealityMap({
      concept,
      callLLM: async (request) => {
        const stage = stageOrder[callIndex] || `call-${callIndex + 1}`;
        callIndex += 1;
        const reply = await callChatCompletion(request);
        const parsed = parseModelJson(reply.content);
        stages[stage] =
          parsed ?? { parseError: true, contentChars: String(reply.content || "").length };
        return { content: reply.content };
      },
    });
    writeSplit(concept, {
      ok: result.ok,
      map: result.map,
      diagnostics: result.diagnostics,
      reason: result.reason,
      kind: result.kind,
      errors: result.errors,
      latencyMs: result.latencyMs,
      stages,
    });
    if (!result.ok) {
      console.log(`LIVE_FAIL=${concept}`);
      console.log(`REASON=${String(result.reason || result.kind || "unknown").slice(0, 200)}`);
    }
  }
}
