import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callChatCompletion, llmProvider } from "../../../src/lib/agent/llm.js";
import { generateRealityMap } from "../../../src/lib/agent/realityMap.js";
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
process.env.LLM_PROVIDER = "deepseek";

if (!process.env.DEEPSEEK_API_KEY) {
  console.log("MISSING=DEEPSEEK_API_KEY");
  process.exit(1);
}

const NAMES = ["chronology", "epiphanies", "arrange"];
let n = 0;
const started = Date.now();
try {
  const result = await generateRealityMap({
    concept: "battery",
    callLLM: async (request) => {
      const stage = NAMES[n] || String(n + 1);
      n += 1;
      const t0 = Date.now();
      console.log(`STAGE=${stage} thinking=${request.thinking} start`);
      const reply = await callChatCompletion(request);
      const parsed = parseModelJson(reply.content);
      const keys =
        parsed && typeof parsed === "object" ? Object.keys(parsed).join(",") : "null";
      console.log(
        `STAGE=${stage} ms=${Date.now() - t0} content=${reply.content.length} reason=${
          reply.reasoningContent ? reply.reasoningContent.length : 0
        } keys=${keys}`
      );
      if (stage === "epiphanies" && parsed && Array.isArray(parsed.epiphanies)) {
        for (const item of parsed.epiphanies) {
          const hist = item && item.history;
          console.log(
            `  ${item && item.id} joint=${item && item.joint_kind} hist=${
              hist && typeof hist === "object" ? Object.keys(hist).join(",") : "none"
            }`
          );
        }
      }
      return { content: reply.content };
    },
  });

  console.log("PROVIDER=" + llmProvider());
  console.log("TOTAL_MS=" + (Date.now() - started));
  console.log("OK=" + result.ok);
  console.log("KIND=" + result.kind);
  console.log("REASON=" + result.reason);
  console.log("ERRORS=" + (result.errors || []).join(" | "));
} catch (err) {
  console.log("PROVIDER=" + llmProvider());
  console.log("TOTAL_MS=" + (Date.now() - started));
  console.log("THREW=" + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
