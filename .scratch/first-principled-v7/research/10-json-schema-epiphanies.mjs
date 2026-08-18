import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callChatCompletion, llmModel, llmProvider } from "../../../src/lib/agent/llm.js";
import {
  epiphaniesProblems,
  generateRealityMap,
} from "../../../src/lib/agent/realityMap.js";
import { parseModelJson } from "../../../src/lib/agent/jsonParse.js";

function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(resolve(".env"));
process.env.LLM_PROVIDER = "openrouter";

if (!process.env.LLM_API_KEY) {
  console.log("MISSING=LLM_API_KEY");
  process.exit(1);
}

console.log("PROVIDER=" + llmProvider());
console.log("MODEL=" + llmModel());

const NAMES = ["chronology", "epiphanies", "arrange"];
let callIndex = 0;
let chronologyIds = new Set();
let arrangeRan = false;
const started = Date.now();

try {
  const result = await generateRealityMap({
    concept: "battery",
    callLLM: async (request) => {
      const stage = NAMES[callIndex] || String(callIndex + 1);
      callIndex += 1;
      arrangeRan ||= stage === "arrange";
      const stageStarted = Date.now();
      console.log(
        `STAGE=${stage} thinking=${request.thinking} response_format=${
          request.jsonSchema ? "json_schema" : "json_object"
        } start`
      );
      const reply = await callChatCompletion(request);
      const parsed = parseModelJson(reply.content);
      const keys =
        parsed && typeof parsed === "object" ? Object.keys(parsed).join(",") : "null";
      console.log(
        `STAGE=${stage} ms=${Date.now() - stageStarted} content=${
          reply.content.length
        } reason=${reply.reasoningContent ? reply.reasoningContent.length : 0} keys=${keys}`
      );
      if (stage === "chronology" && parsed && Array.isArray(parsed.chronology)) {
        chronologyIds = new Set(parsed.chronology.map((item) => item && item.id));
      }
      if (stage === "epiphanies") {
        const problems = epiphaniesProblems(parsed, "battery", chronologyIds);
        console.log("EPIPHANIES_ERRORS=" + problems.join(" | "));
        if (parsed && Array.isArray(parsed.epiphanies)) {
          for (const item of parsed.epiphanies) {
            const history = item && item.history;
            console.log(
              `EPIPHANY=${item && item.id} joint=${item && item.joint_kind} history=${
                history && typeof history === "object"
                  ? Object.keys(history).join(",")
                  : "none"
              } from=${Array.isArray(item && item.from_regimes) ? item.from_regimes.join(",") : "none"} to=${
                Array.isArray(item && item.to_regimes) ? item.to_regimes.join(",") : "none"
              }`
            );
          }
        }
      }
      return { content: reply.content };
    },
  });

  console.log("PROVIDER=" + llmProvider());
  console.log("MODEL=" + llmModel());
  console.log("TOTAL_MS=" + (Date.now() - started));
  console.log("ARRANGE_RAN=" + arrangeRan);
  console.log("OK=" + result.ok);
  console.log("KIND=" + result.kind);
  console.log("REASON=" + result.reason);
  console.log("ERRORS=" + (result.errors || []).join(" | "));
} catch (error) {
  console.log("PROVIDER=" + llmProvider());
  console.log("MODEL=" + llmModel());
  console.log("TOTAL_MS=" + (Date.now() - started));
  console.log("ARRANGE_RAN=" + arrangeRan);
  console.log("THREW=" + (error && error.message ? error.message : String(error)));
  process.exit(1);
}
