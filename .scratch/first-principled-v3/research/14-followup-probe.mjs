// Follow-up turn probe for ticket 14: verifies a chat follow-up (phase
// "active") rides the SAME background transport as tree generation.
// POSTs an init turn first to get a tree, then POSTs a follow-up turn
// carrying the tree, polling both the same way.
const BASE = "https://first-principled.netlify.app";
const POLL_MS = 2000;
const DEADLINE_MS = 3 * 60 * 1000;

function makeJobId() {
  if (typeof globalThis.crypto === "object" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `fp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postAndPoll(payload, label) {
  const started = Date.now();
  const post = await fetch(`${BASE}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`${label}: POST -> ${post.status}`);
  if (post.status !== 202) {
    console.log(`${label}: FAIL - expected 202, got ${post.status}`);
    process.exit(1);
  }
  const deadline = Date.now() + DEADLINE_MS;
  let polls = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    polls += 1;
    const resp = await fetch(`${BASE}/api/agent-status?job=${encodeURIComponent(payload.jobId)}`, {
      headers: { Accept: "application/json" },
    });
    const data = await resp.json();
    if (data && data.status === "success") {
      console.log(`${label}: success after ${polls} polls (~${Math.round((Date.now() - started) / 1000)}s)`);
      return data.body;
    }
    if (data && data.status === "error") {
      console.log(`${label}: FAIL - job error ${data.code}`);
      process.exit(1);
    }
    if (data && data.status !== "running") {
      console.log(`${label}: FAIL - unexpected body`, JSON.stringify(data).slice(0, 200));
      process.exit(1);
    }
  }
  console.log(`${label}: FAIL - deadline`);
  process.exit(1);
}

const run = async () => {
  // 1. Init turn (tree generation)
  const initPayload = { word: "laptop", history: [], phase: "init", jobId: makeJobId() };
  const initBody = await postAndPoll(initPayload, "init");
  const nodes = initBody.realityMap && initBody.realityMap.nodes ? initBody.realityMap.nodes.length : 0;
  if (nodes === 0) {
    console.log("init: FAIL - no tree");
    process.exit(1);
  }
  console.log(`init: tree has ${nodes} nodes`);

  // 2. Follow-up turn (phase active) carrying the tree + one learner reply
  const followPayload = {
    realityMap: initBody.realityMap,
    learnerMap: initBody.learnerMap,
    failedAttempts: initBody.failedAttempts || {},
    history: [
      { role: "user", content: initPayload.word },
      { role: "assistant", content: initBody.reply },
      { role: "user", content: "Tell me more about the top layer." },
    ],
    phase: "active",
    jobId: makeJobId(),
  };
  const followBody = await postAndPoll(followPayload, "follow-up");
  if (typeof followBody.reply === "string" && followBody.reply.length > 0) {
    console.log(`follow-up: PASS - reply "${followBody.reply.slice(0, 60)}..."`);
    console.log("FOLLOW-UP OK");
    process.exit(0);
  }
  console.log("follow-up: FAIL - no reply");
  process.exit(1);
};

run().catch((e) => {
  console.log("PROBE ERROR:", e.message);
  process.exit(1);
});
