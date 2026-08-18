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
const outDir = path.join(here, "06-diagnostics");
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
const llmUrl = pathToFileURL(path.join(root, "src/lib/agent/llm.js")).href;
const { generateRealityMap } = await import(realityMapUrl);

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
 * @param {{ ok: boolean; map: any; diagnostics: any; reason?: string | null }} result
 */
function writeSplit(concept, result) {
  fs.mkdirSync(outDir, { recursive: true });
  const learner = {
    concept,
    ok: result.ok,
    map: result.map,
  };
  const diagnostics = {
    concept,
    ok: result.ok,
    reason: result.reason ?? null,
    chronology: result.diagnostics?.chronology ?? null,
    epiphanies: result.diagnostics?.epiphanies ?? null,
    provenance: result.diagnostics?.provenance ?? null,
    discardedInputIds: result.diagnostics?.discardedInputIds ?? [],
    prompts: result.diagnostics?.prompts
      ? {
          chronology: Boolean(result.diagnostics.prompts.chronology),
          epiphanies: Boolean(result.diagnostics.prompts.epiphanies),
          arrange: Boolean(result.diagnostics.prompts.arrange),
        }
      : null,
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
    ],
  };
  const arrangement = {
    map: {
      concept: "battery",
      layers: [
        { id: "l0", name: "Foundation", nodes: ["n-charge"] },
        { id: "l1", name: "Stored current", nodes: ["n-battery"] },
      ],
      nodes: [
        {
          id: "n-charge",
          label: "charge separation",
          layer: "l0",
          description: "Separated charges create electrical potential.",
          role: "DOMAIN",
        },
        {
          id: "n-battery",
          label: "battery",
          layer: "l1",
          description: "A controlled reaction sustains current through a circuit.",
          role: "EPIPHANY",
          basis: {
            discoverer: { value: "invented", mark: "EXACT" },
            date: { value: "invented", mark: "EXACT" },
            keyObservation: { value: "invented", mark: "EXACT" },
            confidence: "high",
            note: "",
          },
        },
      ],
      edges: [
        {
          source: "n-battery",
          target: "n-charge",
          type: "depends-on",
          because: "A battery needs separated charge to drive electron flow.",
        },
      ],
      trunk: ["n-charge", "n-battery"],
    },
    provenance: {
      nodes: [
        { node_id: "n-charge", input_refs: ["c1"] },
        { node_id: "n-battery", input_refs: ["c2", "e1"] },
      ],
      edges: [{ source: "n-battery", target: "n-charge", input_refs: ["c1", "c2", "e1"] }],
      discarded_input_ids: [],
    },
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
  const words = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const concepts = words.length > 0 ? words : GOLD;
  for (const concept of concepts) {
    const result = await generateRealityMap({
      concept,
      callLLM: async (request) => {
        const reply = await callChatCompletion(request);
        return { content: reply.content };
      },
    });
    writeSplit(concept, {
      ok: result.ok,
      map: result.map,
      diagnostics: result.diagnostics,
      reason: result.reason,
    });
    if (!result.ok) {
      console.log(`LIVE_FAIL=${concept}`);
      console.log(`REASON=${String(result.reason || result.kind || "unknown").slice(0, 200)}`);
    }
  }
}
