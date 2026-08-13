// Live probe for ticket 14: the background transport against the deployed
// site. POSTs an init turn with a client-generated jobId to
// https://first-principled.netlify.app/api/agent - the Netlify background
// function answers an EMPTY 202 immediately (no job id in the response) and
// runs the generation out of band - then polls
// GET /api/agent-status?job=<id> until the tree lands, a stable error code
// collapses, or the probe deadline passes.
//
// Run AFTER the deploy:
//   node .scratch/first-principled-v3/research/14-live-probe.mjs
//
// Exit 0 when a full tree lands; exit 1 on a stable error (including a
// Turnstile captcha_required if the gate is on), a platform failure, or a
// deadline hit.
const BASE = "https://first-principled.netlify.app";
const POLL_MS = 2000;
const DEADLINE_MS = 4 * 60 * 1000;

function makeJobId() {
  if (
    typeof globalThis.crypto === "object" &&
    typeof /** @type {any} */ (globalThis.crypto).randomUUID === "function"
  ) {
    return /** @type {any} */ (globalThis.crypto).randomUUID();
  }
  const bytes = [];
  for (let i = 0; i < 16; i += 1) bytes.push(Math.floor(Math.random() * 256));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const started = Date.now();
  const jobId = makeJobId();
  const payload = {
    word: "microscope",
    history: [],
    phase: "init",
    jobId,
  };

  let post;
  try {
    post = await fetch(`${BASE}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log(`FAIL - POST network failure: ${e.message}`);
    process.exit(1);
  }

  console.log(`POST /api/agent -> ${post.status} (job ${jobId})`);

  if (post.status !== 202) {
    // A non-background deploy (or a proxy): the old synchronous behavior.
    let data;
    try {
      data = await post.json();
    } catch {
      console.log(`FAIL - POST returned a non-JSON body (platform HTML?), status ${post.status}`);
      process.exit(1);
    }
    if (!post.ok) {
      const code = data && data.error && typeof data.error.code === "string" ? data.error.code : "internal";
      console.log(`FAIL - POST returned the stable error envelope: ${code}`);
      process.exit(1);
    }
    const nodes = data.realityMap && data.realityMap.nodes ? data.realityMap.nodes.length : 0;
    console.log(`PASS - tree landed synchronously (non-background deploy): ${nodes} nodes`);
    process.exit(nodes > 0 ? 0 : 1);
  }

  const deadline = Date.now() + DEADLINE_MS;
  let polls = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    polls += 1;
    let resp;
    try {
      resp = await fetch(`${BASE}/api/agent-status?job=${encodeURIComponent(jobId)}`, {
        headers: { Accept: "application/json" },
      });
    } catch (e) {
      console.log(`FAIL - status poll ${polls} network failure: ${e.message}`);
      process.exit(1);
    }
    let data;
    try {
      data = await resp.json();
    } catch {
      console.log(`FAIL - status poll ${polls} returned a non-JSON body (status ${resp.status})`);
      process.exit(1);
    }
    if (data && data.status === "success") {
      const turn = data.body;
      const nodes = turn && turn.realityMap && turn.realityMap.nodes ? turn.realityMap.nodes.length : 0;
      const layers = turn && turn.realityMap && turn.realityMap.layers ? turn.realityMap.layers.length : 0;
      const elapsed = Math.round((Date.now() - started) / 1000);
      if (nodes > 0) {
        console.log(`PASS - full tree landed after ${polls} polls (~${elapsed}s): ${nodes} nodes, ${layers} layers`);
        process.exit(0);
      }
      console.log(`FAIL - turn succeeded but no tree (refusal?): ${turn && turn.reply}`);
      process.exit(1);
    }
    if (data && data.status === "error") {
      console.log(`FAIL - job ended with a stable error: ${data.code} (after ${polls} polls)`);
      process.exit(1);
    }
    if (data && data.status === "running") {
      console.log(`poll ${polls}: running`);
      continue;
    }
    if (!resp.ok && data && data.error && typeof data.error.code === "string") {
      console.log(`FAIL - status endpoint error envelope: ${data.error.code} (status ${resp.status})`);
      process.exit(1);
    }
    console.log(`FAIL - status poll ${polls} returned an unexpected body (status ${resp.status})`);
    process.exit(1);
  }

  console.log("FAIL - deadline exceeded while the job was still running");
  process.exit(1);
};

run().catch((e) => {
  console.log(`PROBE ERROR: ${e.message}`);
  process.exit(1);
});
