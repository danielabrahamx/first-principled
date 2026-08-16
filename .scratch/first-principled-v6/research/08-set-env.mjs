// Set Netlify LLM_* from gitignored .env. Never prints the key.
import { spawn } from "node:child_process";
import fs from "node:fs";

const vars = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m) continue;
  vars[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const wanted = {
  LLM_API_KEY: vars.LLM_API_KEY || "",
  LLM_MODEL: vars.LLM_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
  LLM_BASE_URL: vars.LLM_BASE_URL || "https://openrouter.ai/api/v1",
};

if (!wanted.LLM_API_KEY) {
  console.error("LLM_API_KEY missing in .env");
  process.exit(1);
}

const netlify = `${process.env.APPDATA}\\npm\\netlify.cmd`;

function run(args, redact) {
  return new Promise((resolve, reject) => {
    const child = spawn(netlify, args, { shell: true, windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      let text = out;
      for (const secret of redact) {
        if (secret) text = text.split(secret).join("[redacted]");
      }
      resolve({ code, text: text.trim() });
    });
  });
}

const redact = [wanted.LLM_API_KEY];

for (const [name, value] of Object.entries(wanted)) {
  const result = await run(["env:set", name, value], redact);
  console.log(`SET ${name} exit=${result.code}`);
  if (result.text) console.log(result.text.slice(0, 400));
  if (result.code !== 0) process.exit(result.code || 1);
}

const model = await run(["env:get", "LLM_MODEL"], redact);
const base = await run(["env:get", "LLM_BASE_URL"], redact);
const key = await run(["env:get", "LLM_API_KEY"], redact);
const turnstile = await run(["env:get", "TURNSTILE_SECRET_KEY"], redact);

const modelVal = model.text.split(/\r?\n/).filter(Boolean).pop() || "";
const baseVal = base.text.split(/\r?\n/).filter(Boolean).pop() || "";
const keyVal = key.text.split(/\r?\n/).filter(Boolean).pop() || "";
const turnstileVal = turnstile.text.split(/\r?\n/).filter(Boolean).pop() || "";

console.log("MODEL_MATCH=" + (modelVal === wanted.LLM_MODEL));
console.log("BASE_MATCH=" + (baseVal === wanted.LLM_BASE_URL));
console.log("KEY_MATCH=" + (keyVal === wanted.LLM_API_KEY));
console.log("TURNSTILE_SET=" + Boolean(turnstileVal && !/not set|empty|undefined/i.test(turnstileVal)));
console.log("MODEL=" + wanted.LLM_MODEL);
console.log("BASE=" + wanted.LLM_BASE_URL);
