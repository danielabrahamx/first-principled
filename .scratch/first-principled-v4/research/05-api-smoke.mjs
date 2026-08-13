// Live API smoke for ticket 05. Prints no secrets.
async function postTurn(body) {
  const jobId = crypto.randomUUID();
  const post = await fetch("https://first-principled.netlify.app/api/agent", {
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
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(
      "https://first-principled.netlify.app/api/agent-status?job=" + encodeURIComponent(jobId),
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

const init = await postTurn({ word: "bit", history: [], phase: "init" });
console.log("INIT_OK=" + init.ok);
console.log("INIT_HTTP=" + init.http);
if (init.code) console.log("INIT_CODE=" + init.code);
if (init.message) console.log("INIT_MESSAGE=" + String(init.message).slice(0, 200));
if (init.text) console.log("INIT_TEXT=" + init.text);
const initBody = init.body || {};
console.log("INIT_PHASE=" + (initBody.phase ?? ""));
console.log("INIT_HAS_REPLY=" + Boolean(initBody.reply));
console.log("INIT_NODES=" + (initBody.realityMap && initBody.realityMap.nodes ? initBody.realityMap.nodes.length : 0));
if (!init.ok || initBody.phase !== "active" || initBody.reply || !initBody.realityMap) {
  console.log("FAIL - init");
  process.exit(1);
}

const question = "What is a bit?";
const active = await postTurn({
  phase: "active",
  realityMap: initBody.realityMap,
  learnerMap: initBody.learnerMap,
  failedAttempts: initBody.failedAttempts || {},
  history: [{ role: "user", content: question }],
});
console.log("ACTIVE_OK=" + active.ok);
console.log("ACTIVE_HTTP=" + active.http);
if (active.code) console.log("ACTIVE_CODE=" + active.code);
if (active.message) console.log("ACTIVE_MESSAGE=" + String(active.message).slice(0, 200));
if (active.text) console.log("ACTIVE_TEXT=" + active.text);
const reply = typeof active.body?.reply === "string" ? active.body.reply : "";
console.log("ACTIVE_PHASE=" + (active.body?.phase ?? ""));
console.log("ACTIVE_CHARS=" + reply.length);
console.log("ACTIVE_ENDS_PROBE=" + /\?\s*$/.test(reply));
console.log("ACTIVE_HEAD=" + reply.slice(0, 180).replace(/\s+/g, " "));
if (!active.ok || active.body?.phase !== "active" || reply.length === 0 || /\?\s*$/.test(reply)) {
  console.log("FAIL - briefing");
  process.exit(1);
}
console.log("PASS - live init silent, live briefing landed");
