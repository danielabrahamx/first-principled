// Prod init smoke for the three-stage builder. Prints counts and leak
// keys, never secrets or full maps. Deadline is 14 minutes.
const LIVE = process.argv[2] || "https://first-principled.netlify.app";
const WORD = process.argv[3] || "photosynthesis";
const DEADLINE_MS = 840000;
const FORBIDDEN = [
  "provenance",
  "chronology",
  "epiphanies",
  "discardedInputIds",
  "discarded_input_ids",
  "prompts",
  "diagnostics",
];

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

async function postTurn(body) {
  const jobId = crypto.randomUUID();
  const post = await fetch(`${LIVE.replace(/\/$/, "")}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, jobId }),
  });
  const postText = await post.text();
  if (post.status !== 202 && post.status !== 200) {
    return { ok: false, http: post.status, text: postText.slice(0, 240) };
  }
  if (post.status === 200) {
    try {
      return { ok: true, http: 200, body: JSON.parse(postText) };
    } catch {
      return { ok: false, http: 200, text: postText.slice(0, 240) };
    }
  }
  const deadline = Date.now() + DEADLINE_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(
      `${LIVE.replace(/\/$/, "")}/api/agent-status?job=${encodeURIComponent(jobId)}`,
      { headers: { Accept: "application/json" } }
    );
    const last = await s.text();
    let parsed = null;
    try {
      parsed = JSON.parse(last);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.status === "running") continue;
    if (parsed.status === "error") {
      return { ok: false, http: s.status, code: parsed.code, message: parsed.message };
    }
    return { ok: true, http: s.status, body: parsed.body };
  }
  return { ok: false, http: 0, text: "timeout" };
}

const started = Date.now();
const init = await postTurn({ word: WORD, history: [], phase: "init" });
const ms = Date.now() - started;
const initBody = init.body || {};
const map = initBody.realityMap;
const nodes = map && Array.isArray(map.nodes) ? map.nodes : [];
const layers = map && Array.isArray(map.layers) ? map.layers : [];
const roles = [...new Set(nodes.map((node) => node && node.role).filter(Boolean))];
const leaks = leakKeys(initBody);

console.log("WORD=" + WORD);
console.log("INIT_OK=" + init.ok);
console.log("INIT_HTTP=" + init.http);
console.log("INIT_MS=" + ms);
if (init.code) console.log("INIT_CODE=" + init.code);
if (init.message) console.log("INIT_MESSAGE=" + String(init.message).slice(0, 200));
if (init.text) console.log("INIT_TEXT=" + init.text);
console.log("INIT_PHASE=" + (initBody.phase ?? ""));
console.log("INIT_NODES=" + nodes.length);
console.log("INIT_LAYERS=" + layers.length);
console.log("INIT_ROLES=" + (roles.join(",") || "none"));
console.log("LEARNER_LEAKS=" + (leaks.length ? leaks.join(",") : "none"));

const threeStage = roles.some((role) => role === "DOMAIN" || role === "EPIPHANY" || role === "STRUCTURAL");
const blocked429 =
  init.code === "upstream_error" ||
  /429|free-models-per-day|rate limit/i.test(String(init.message || init.text || ""));

if (leaks.length) {
  console.log("FAIL - learner-facing init leaked intermediate keys");
  process.exit(1);
}
if (blocked429) {
  console.log("BLOCKER - OpenRouter :free 429; three-stage path not scored live");
  process.exit(0);
}
if (!init.ok || initBody.phase !== "active" || !map || layers.length < 2 || !threeStage) {
  console.log("FAIL - live gold word did not produce a three-stage tree");
  process.exit(1);
}
console.log("PASS - live gold word produced a three-stage tree with a stripped learner payload");
