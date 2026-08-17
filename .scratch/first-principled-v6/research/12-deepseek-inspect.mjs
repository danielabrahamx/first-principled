// One-concept DeepSeek inspect. Writes a shape note, not the raw map.
// No secrets. Laptop only, so we do not burn four more calls.
process.env.LLM_API_KEY = process.env.DEEPSEEK_API_KEY;
process.env.LLM_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
process.env.LLM_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

import { writeFileSync } from "node:fs";
import { buildOneShotSystemPrompt } from "../../../src/lib/agent/realityMap.js";
import { parseModelJson } from "../../../src/lib/agent/jsonParse.js";
import { callChatCompletion, llmModel } from "../../../src/lib/agent/llm.js";
import { candidateFromOneShot } from "../../../eval/map-quality/gate.js";

const concept = "laptop";
const started = Date.now();
const reply = await callChatCompletion({
  messages: [
    { role: "system", content: buildOneShotSystemPrompt(6) },
    { role: "user", content: `Word or phrase: ${concept}` },
  ],
  jsonMode: true,
  thinking: false,
  maxTokens: 8192,
});

const content = typeof reply.content === "string" ? reply.content : "";
const reasoning =
  typeof reply.reasoningContent === "string" ? reply.reasoningContent : "";
const parsed = parseModelJson(content);
const parsedFromReasoning = reasoning ? parseModelJson(reasoning) : null;
const candidate = candidateFromOneShot(concept, parsed);
const candidateFromCoT = candidateFromOneShot(concept, parsedFromReasoning);
const keys =
  parsedFromReasoning && typeof parsedFromReasoning === "object"
    ? Object.keys(parsedFromReasoning).slice(0, 20)
    : [];
const firstBrace = reasoning.indexOf("{");
const lastBrace = reasoning.lastIndexOf("}");
const preview = content.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 240);
const reasonPreview = reasoning
  .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
  .slice(0, 240);

const lines = [
  `# 12 - DeepSeek one-shot shape (${concept})`,
  ``,
  `Model: \`${llmModel()}\`. Latency: ${Date.now() - started}ms.`,
  `Not the Nemotron ticket 12 bar. No secrets.`,
  ``,
  `- content length: ${content.length}`,
  `- reasoning length: ${reasoning.length}`,
  `- parseModelJson(content): ${parsed ? "object" : "null"}`,
  `- parseModelJson(reasoning): ${parsedFromReasoning ? "object" : "null"}`,
  `- reasoning first/last brace: ${firstBrace}/${lastBrace}`,
  `- parsed keys (reasoning): ${keys.join(", ") || "(none)"}`,
  `- isValidConcept (reasoning): ${parsedFromReasoning && typeof parsedFromReasoning === "object" ? String(parsedFromReasoning.isValidConcept) : "n/a"}`,
  `- layers is array (reasoning): ${Boolean(parsedFromReasoning && Array.isArray(parsedFromReasoning.layers))} (n=${parsedFromReasoning && Array.isArray(parsedFromReasoning.layers) ? parsedFromReasoning.layers.length : 0})`,
  `- nodes is array (reasoning): ${Boolean(parsedFromReasoning && Array.isArray(parsedFromReasoning.nodes))} (n=${parsedFromReasoning && Array.isArray(parsedFromReasoning.nodes) ? parsedFromReasoning.nodes.length : 0})`,
  `- edges is array (reasoning): ${Boolean(parsedFromReasoning && Array.isArray(parsedFromReasoning.edges))} (n=${parsedFromReasoning && Array.isArray(parsedFromReasoning.edges) ? parsedFromReasoning.edges.length : 0})`,
  `- candidateFromOneShot(content): ${candidate ? "map" : "null"}`,
  `- candidateFromOneShot(reasoning): ${candidateFromCoT ? "map" : "null"}`,
  ``,
  `## content preview`,
  ``,
  "```",
  preview || "(empty)",
  "```",
  ``,
  `## reasoning preview`,
  ``,
  "```",
  reasonPreview || "(empty)",
  "```",
  ``,
];

writeFileSync(
  new URL("./12-deepseek-shape.md", import.meta.url),
  lines.join("\n")
);
console.log(lines.filter((line) => line.startsWith("- ") || line.startsWith("Model")).join("\n"));
