// Live API smoke: one real word must produce a Reality Map via OpenRouter.
// Prints no secrets. Tutor turns are out of scope for this ticket.
const LIVE = process.argv[2] || "https://first-principled.netlify.app";
const WORD = process.argv[3] || "bit";
const DEADLINE_MS = 480000;

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
console.log("WORD=" + WORD);
console.log("INIT_OK=" + init.ok);
console.log("INIT_HTTP=" + init.http);
console.log("INIT_MS=" + ms);
if (init.code) console.log("INIT_CODE=" + init.code);
if (init.message) console.log("INIT_MESSAGE=" + String(init.message).slice(0, 200));
if (init.text) console.log("INIT_TEXT=" + init.text);
const initBody = init.body || {};
const nodes = initBody.realityMap && Array.isArray(initBody.realityMap.nodes)
  ? initBody.realityMap.nodes.length
  : 0;
const layers = initBody.realityMap && Array.isArray(initBody.realityMap.layers)
  ? initBody.realityMap.layers.length
  : 0;
console.log("INIT_PHASE=" + (initBody.phase ?? ""));
console.log("INIT_NODES=" + nodes);
console.log("INIT_LAYERS=" + layers);
if (!init.ok || initBody.phase !== "active" || !initBody.realityMap || nodes < 2) {
  console.log("FAIL - live OpenRouter tree");
  process.exit(1);
}
console.log("PASS - live word produced a tree via OpenRouter");
