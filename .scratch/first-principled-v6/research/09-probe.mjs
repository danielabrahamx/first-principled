/**
 * Live probe for ticket 09: why prod init fails on Nemotron :free.
 *
 * Run from repo root (gitignored .env, never prints the key):
 *   node --env-file=.env .scratch/first-principled-v6/research/09-probe.mjs
 *
 * Optional args:
 *   --word photosynthesis
 *   --mode prod|prod-fast|local-oneshot|local-serial
 * Repeat --word / --mode to build a matrix. Defaults cover the ticket 08
 * prod words plus the ticket 07 local pair, on both prod paths and local
 * one-shot.
 *
 * Prints no secrets and no raw upstream text.
 */
import { generateRealityMap } from "../../../src/lib/agent/realityMap.js";
import { buildOneShotSystemPrompt } from "../../../src/lib/agent/realityMap.js";
import { callChatCompletion, llmModel } from "../../../src/lib/agent/llm.js";
import { parseModelJson } from "../../../src/lib/agent/jsonParse.js";
import { candidateFromOneShot } from "../../../eval/map-quality/gate.js";

const PROD = "https://first-principled.netlify.app";
const DEADLINE_MS = 480000;

function sanitize(value) {
  return String(value ?? "").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}

function parseArgs(argv) {
  const words = [];
  const modes = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--word" && argv[i + 1]) {
      words.push(argv[++i]);
    } else if (argv[i] === "--mode" && argv[i + 1]) {
      modes.push(argv[++i]);
    }
  }
  return {
    words: words.length > 0 ? words : ["bit", "photosynthesis", "recursion"],
    modes: modes.length > 0 ? modes : ["local-oneshot", "prod", "prod-fast"],
  };
}

function mapShape(map) {
  if (!map || typeof map !== "object") {
    return { nodes: 0, layers: 0 };
  }
  return {
    nodes: Array.isArray(map.nodes) ? map.nodes.length : 0,
    layers: Array.isArray(map.layers) ? map.layers.length : 0,
  };
}

async function postTurn(live, body) {
  const jobId = crypto.randomUUID();
  const post = await fetch(`${live.replace(/\/$/, "")}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, jobId }),
  });
  const postText = await post.text();
  if (post.status !== 202 && post.status !== 200) {
    return {
      ok: false,
      http: post.status,
      code: "http_error",
      message: `non-202/200 POST (${postText.length} chars)`,
    };
  }
  if (post.status === 200) {
    try {
      return { ok: true, http: 200, body: JSON.parse(postText), postStatus: 200 };
    } catch {
      return { ok: false, http: 200, code: "unparseable_sync_body" };
    }
  }
  const deadline = Date.now() + DEADLINE_MS;
  let polls = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    polls += 1;
    const s = await fetch(
      `${live.replace(/\/$/, "")}/api/agent-status?job=${encodeURIComponent(jobId)}`,
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
      return {
        ok: false,
        http: s.status,
        code: parsed.code,
        message: sanitize(parsed.message),
        postStatus: 202,
        polls,
      };
    }
    return {
      ok: true,
      http: s.status,
      body: parsed.body,
      postStatus: 202,
      polls,
    };
  }
  return { ok: false, http: 0, code: "poll_timeout", postStatus: 202, polls };
}

async function runProd(word, fastPath) {
  const started = Date.now();
  const init = await postTurn(PROD, {
    word,
    history: [],
    phase: "init",
    ...(fastPath ? { fastPath: true } : {}),
  });
  const ms = Date.now() - started;
  const body = init.body || {};
  const shape = mapShape(body.realityMap);
  const err = body.error;
  return {
    target: fastPath ? "prod-fast" : "prod",
    word,
    ok: Boolean(init.ok && body.phase === "active" && body.realityMap),
    http: init.http ?? null,
    postStatus: init.postStatus ?? null,
    code: init.code || (err && err.code) || null,
    message: sanitize(init.message || (err && err.message) || ""),
    phase: body.phase ?? null,
    generationPath: body.generationPath ?? null,
    nodes: shape.nodes,
    layers: shape.layers,
    ms,
    polls: init.polls ?? null,
    kind: null,
    reason: null,
  };
}

async function runLocalOneshot(word) {
  const started = Date.now();
  try {
    const reply = await callChatCompletion({
      messages: [
        { role: "system", content: buildOneShotSystemPrompt(6) },
        { role: "user", content: `Word or phrase: ${word}` },
      ],
      jsonMode: true,
      thinking: false,
      maxTokens: 8192,
    });
    const parsed = parseModelJson(reply.content);
    const map = candidateFromOneShot(word, parsed);
    const ms = Date.now() - started;
    if (!map) {
      const refused = parsed && parsed.isValidConcept === false;
      return {
        target: "local-oneshot",
        word,
        ok: false,
        http: 200,
        postStatus: null,
        code: refused ? "refused" : "unparseable_or_wrong_shape",
        message: refused ? "model refused the concept" : "one-shot reply was not valid JSON in the required shape",
        phase: null,
        generationPath: "oneshot",
        nodes: 0,
        layers: 0,
        ms,
        polls: null,
        kind: refused ? "refused" : "invalid",
        reason: refused ? "refused" : "unparseable_or_wrong_shape",
      };
    }
    const shape = mapShape(map);
    return {
      target: "local-oneshot",
      word,
      ok: true,
      http: 200,
      postStatus: null,
      code: null,
      message: "",
      phase: null,
      generationPath: "oneshot",
      nodes: shape.nodes,
      layers: shape.layers,
      ms,
      polls: null,
      kind: null,
      reason: null,
    };
  } catch (err) {
    const message = sanitize(err instanceof Error ? err.message : String(err));
    let code = "upstream_error";
    if (/no choices/.test(message)) code = "empty_choices";
    else if (/aborted after/.test(message)) code = "abort_timeout";
    return {
      target: "local-oneshot",
      word,
      ok: false,
      http: null,
      postStatus: null,
      code,
      message,
      phase: null,
      generationPath: "oneshot",
      nodes: 0,
      layers: 0,
      ms: Date.now() - started,
      polls: null,
      kind: "error",
      reason: code,
    };
  }
}

async function runLocalSerial(word) {
  const started = Date.now();
  try {
    const result = await generateRealityMap({ concept: word }, { fastPath: false });
    const shape = mapShape(result.map);
    return {
      target: "local-serial",
      word,
      ok: Boolean(result.ok && result.map),
      http: 200,
      postStatus: null,
      code: result.ok ? null : result.kind,
      message: sanitize(result.reason || ""),
      phase: result.ok ? "active" : null,
      generationPath: result.generationPath ?? "serial",
      nodes: shape.nodes,
      layers: shape.layers,
      ms: Date.now() - started,
      polls: null,
      kind: result.kind,
      reason: sanitize(result.reason || ""),
    };
  } catch (err) {
    const message = sanitize(err instanceof Error ? err.message : String(err));
    return {
      target: "local-serial",
      word,
      ok: false,
      http: null,
      postStatus: null,
      code: "throw",
      message,
      phase: null,
      generationPath: "serial",
      nodes: 0,
      layers: 0,
      ms: Date.now() - started,
      polls: null,
      kind: "error",
      reason: message,
    };
  }
}

function printRow(row) {
  const bits = [
    `TARGET=${row.target}`,
    `WORD=${row.word}`,
    `OK=${row.ok}`,
    `HTTP=${row.http ?? ""}`,
    `POST=${row.postStatus ?? ""}`,
    `CODE=${row.code ?? ""}`,
    `PHASE=${row.phase ?? ""}`,
    `PATH=${row.generationPath ?? ""}`,
    `NODES=${row.nodes}`,
    `LAYERS=${row.layers}`,
    `MS=${row.ms}`,
  ];
  if (row.polls != null) bits.push(`POLLS=${row.polls}`);
  if (row.kind) bits.push(`KIND=${row.kind}`);
  if (row.reason) bits.push(`REASON=${sanitize(row.reason).slice(0, 180)}`);
  if (row.message) bits.push(`MSG=${sanitize(row.message).slice(0, 180)}`);
  console.log(bits.join(" "));
}

const { words, modes } = parseArgs(process.argv.slice(2));
const key = process.env.LLM_API_KEY || "";
console.log("MODEL=" + (process.env.LLM_MODEL || llmModel()));
console.log("BASE=" + (process.env.LLM_BASE_URL || ""));
console.log("KEY_SET=" + (key.length > 0 ? "yes" : "no"));
console.log("KEY_KIND=" + (key.startsWith("sk-or-") ? "openrouter" : "other"));
console.log("WORDS=" + words.join(","));
console.log("MODES=" + modes.join(","));
console.log("");

const rows = [];
for (const mode of modes) {
  for (const word of words) {
    let row;
    if (mode === "prod") row = await runProd(word, false);
    else if (mode === "prod-fast") row = await runProd(word, true);
    else if (mode === "local-oneshot") row = await runLocalOneshot(word);
    else if (mode === "local-serial") row = await runLocalSerial(word);
    else {
      console.log("SKIP unknown mode " + mode);
      continue;
    }
    printRow(row);
    rows.push(row);
  }
}

console.log("");
console.log("ROWS=" + rows.length);
const followable = rows.filter((r) => r.ok && r.nodes >= 2 && r.layers >= 2);
console.log("FOLLOWABLE=" + followable.length);
