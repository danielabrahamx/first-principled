// Swap LLM_* onto DeepSeek and run the map-quality live eval.
// Does not overwrite the Nemotron 12-live-maps path. No secrets printed.
process.env.LLM_API_KEY = process.env.DEEPSEEK_API_KEY;
process.env.LLM_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
process.env.LLM_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

if (!process.env.LLM_API_KEY) {
  console.error("missing DEEPSEEK_API_KEY");
  process.exit(1);
}

process.argv = [
  process.argv[0],
  "eval/map-quality/run.js",
  "--live",
  "--maps-dir",
  ".scratch/first-principled-v6/research/12-deepseek-maps",
  "--baseline",
  ".scratch/first-principled-v6/research/12-deepseek-gate.md",
];

await import("../../../eval/map-quality/run.js");
