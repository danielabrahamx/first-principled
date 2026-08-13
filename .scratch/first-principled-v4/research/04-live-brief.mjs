// Live DeepSeek check for ticket 04: init has no opening probe; one dock
// question gets a briefing. Loads .env (gitignored). Prints no secrets.
import { readFileSync, existsSync } from "node:fs";
import { handleRequest } from "../../../src/lib/agent/orchestrator.js";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

if (!process.env.LLM_API_KEY) {
  console.log("FAIL - no LLM_API_KEY");
  process.exit(1);
}

const init = await handleRequest({ word: "bit", history: [], phase: "init" });
console.log("init status", init.status);
console.log("init phase", init.body?.phase);
console.log("init has reply", typeof init.body?.reply === "string" && init.body.reply.length > 0);
console.log("init nodes", init.body?.realityMap?.nodes?.length ?? 0);
if (init.status !== 200 || init.body?.phase !== "active" || init.body?.reply) {
  console.log("FAIL - init should land a tree with no tutor reply");
  if (init.body?.error) console.log("error code", init.body.error.code);
  process.exit(1);
}

const question = "What is a bit?";
const active = await handleRequest({
  phase: "active",
  realityMap: init.body.realityMap,
  learnerMap: init.body.learnerMap,
  failedAttempts: {},
  history: [{ role: "user", content: question }],
});
const reply = typeof active.body?.reply === "string" ? active.body.reply : "";
console.log("active status", active.status);
console.log("active phase", active.body?.phase);
console.log("active reply chars", reply.length);
console.log("active ends with probe", /\?\s*$/.test(reply));
console.log("active reply head", reply.slice(0, 180).replace(/\s+/g, " "));
if (active.status !== 200 || active.body?.phase !== "active" || reply.length === 0 || /\?\s*$/.test(reply)) {
  console.log("FAIL - expected a briefing without a closing question");
  if (active.body?.error) console.log("error code", active.body.error.code);
  process.exit(1);
}
console.log("PASS - init silent, dock briefing landed");
