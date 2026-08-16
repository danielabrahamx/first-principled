/**
 * Live probe for ticket 01: OpenRouter Nemotron Reality Map contract.
 *
 * Run from repo root:
 *   node --env-file=.env .scratch/first-principled-v6/research/01-probe-openrouter-nemotron.mjs
 *
 * Prints no secrets. Overrides model and base URL in-process only.
 */
import { generateRealityMap, deriveCheck } from "../../../src/lib/agent/realityMap.js";
import { validateRealityMap } from "../../../src/lib/mmg/validator.js";
import { parseModelJson } from "../../../src/lib/agent/jsonParse.js";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const FREE_SLUG = "nvidia/nemotron-3-ultra-550b-a55b:free";
const PAID_SLUG = "nvidia/nemotron-3-ultra-550b-a55b";
const TINY_TIMEOUT_MS = 90000;
const REASONING_ON_TIMEOUT_MS = 120000;
const MAP_TIMEOUT_MS = 180000;

function sanitize(value) {
  return String(value ?? "").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}

function keyKind(key) {
  if (!key) return "missing";
  if (key.startsWith("sk-or-")) return "OpenRouter prefix";
  return "not OpenRouter prefix";
}

function summarizeEnv() {
  const key = process.env.LLM_API_KEY || "";
  return {
    hasKey: key.length > 0,
    keyKind: keyKind(key),
    envModel: process.env.LLM_MODEL || null,
    envBaseUrl: process.env.LLM_BASE_URL || null,
    probeModel: FREE_SLUG,
    probeBaseUrl: OPENROUTER_BASE,
  };
}

async function openRouterFetch(payload, { timeoutMs, extraHeaders = {} }) {
  const key = process.env.LLM_API_KEY;
  if (!key) {
    throw new Error("LLM_API_KEY is not set");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://first-principled.netlify.app",
        "X-Title": "first-principled",
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawText = await response.text();
    let body = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      body = null;
    }
    return {
      status: response.status,
      ok: response.ok,
      latencyMs: Date.now() - started,
      body,
      parseable: body !== null,
      errorMessage: body && body.error && body.error.message ? sanitize(body.error.message) : null,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      status: null,
      ok: false,
      latencyMs: Date.now() - started,
      body: null,
      parseable: false,
      errorMessage: aborted
        ? `aborted after ${timeoutMs}ms`
        : sanitize(err instanceof Error ? err.message : String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarizeCompletion(result) {
  const choice = result.body && result.body.choices && result.body.choices[0];
  const message = (choice && choice.message) || {};
  const content = typeof message.content === "string" ? message.content : "";
  const parsed = parseModelJson(content);
  const usage = (result.body && result.body.usage) || null;
  return {
    status: result.status,
    ok: result.ok,
    latencyMs: result.latencyMs,
    errorMessage: result.errorMessage,
    model: result.body && result.body.model ? result.body.model : null,
    contentLen: content.length,
    contentPreview: content.slice(0, 120),
    jsonParsed: parsed !== null,
    jsonKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : null,
    hasReasoningContent: typeof message.reasoning_content === "string",
    hasReasoning: typeof message.reasoning === "string" && message.reasoning.length > 0,
    hasReasoningDetails: Array.isArray(message.reasoning_details),
    finishReason: choice ? choice.finish_reason || null : null,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens ?? null,
          completionTokens: usage.completion_tokens ?? null,
          totalTokens: usage.total_tokens ?? null,
          reasoningTokens:
            (usage.completion_tokens_details &&
              usage.completion_tokens_details.reasoning_tokens) ??
            null,
        }
      : null,
  };
}

function tinyPayload(extra = {}) {
  return {
    model: FREE_SLUG,
    messages: [
      {
        role: "system",
        content: 'Reply with json only. Example: {"ok":true,"n":4}',
      },
      {
        role: "user",
        content: 'Return a json object with keys "ok" (boolean true) and "n" (number 2+2).',
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 64,
    ...extra,
  };
}

async function lookupModel(slug) {
  const key = process.env.LLM_API_KEY;
  if (!key) return { ok: false, errorMessage: "LLM_API_KEY is not set" };
  const started = Date.now();
  try {
    const response = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await response.json();
    const models = Array.isArray(body.data) ? body.data : [];
    const match = models.find((item) => item && item.id === slug);
    return {
      status: response.status,
      ok: response.ok,
      latencyMs: Date.now() - started,
      found: Boolean(match),
      id: match ? match.id : null,
      name: match ? match.name : null,
      contextLength: match ? match.context_length ?? null : null,
      supportedParameters: match ? match.supported_parameters ?? null : null,
      pricing: match ? match.pricing ?? null : null,
      architecture: match && match.architecture ? match.architecture : null,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      errorMessage: sanitize(err instanceof Error ? err.message : String(err)),
    };
  }
}

function crownReached(concept, map) {
  const target = String(concept).toLowerCase();
  const nodes = map && Array.isArray(map.nodes) ? map.nodes : [];
  return nodes.some(
    (node) =>
      node &&
      typeof node === "object" &&
      typeof node.label === "string" &&
      node.label.toLowerCase().includes(target)
  );
}

async function runTinyProbes() {
  const variants = [
    { label: "json-only", extra: {}, timeoutMs: TINY_TIMEOUT_MS },
    {
      label: "thinking-disabled",
      extra: { thinking: { type: "disabled" } },
      timeoutMs: TINY_TIMEOUT_MS,
    },
    {
      label: "reasoning-none",
      extra: { reasoning: { effort: "none" } },
      timeoutMs: TINY_TIMEOUT_MS,
    },
    {
      label: "reasoning-enabled",
      extra: { reasoning: { enabled: true } },
      timeoutMs: REASONING_ON_TIMEOUT_MS,
    },
  ];
  const results = [];
  for (const variant of variants) {
    const raw = await openRouterFetch(tinyPayload(variant.extra), {
      timeoutMs: variant.timeoutMs,
    });
    const summary = { label: variant.label, ...summarizeCompletion(raw) };
    results.push(summary);
    console.log(JSON.stringify({ phase: "tiny", ...summary }));
  }
  return results;
}

async function runOneShotMap(tinyResults) {
  const thinkingRejected = tinyResults.find(
    (row) => row.label === "thinking-disabled" && row.status >= 400
  );
  const jsonOk = tinyResults.some((row) => row.jsonParsed === true);
  if (!jsonOk) {
    return {
      skipped: true,
      reason: "no tiny JSON-mode call returned parseable JSON",
    };
  }

  process.env.LLM_BASE_URL = OPENROUTER_BASE;
  process.env.LLM_MODEL = FREE_SLUG;

  let llmCalls = 0;
  const callLLM = async (request) => {
    llmCalls += 1;
    if (llmCalls > 1) {
      throw new Error("PROBE_STOP_SERIAL");
    }
    const payload = {
      model: FREE_SLUG,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 8192,
      ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
      reasoning: { effort: "none" },
    };
    if (request.thinking === false && !thinkingRejected) {
      payload.thinking = { type: "disabled" };
    }
    const raw = await openRouterFetch(payload, { timeoutMs: MAP_TIMEOUT_MS });
    if (!raw.ok) {
      throw new Error(
        raw.errorMessage
          ? `LLM API error ${raw.status}: ${raw.errorMessage}`
          : `LLM request failed: ${raw.errorMessage || "unknown"}`
      );
    }
    const choice = raw.body && raw.body.choices && raw.body.choices[0];
    const content =
      choice && choice.message && typeof choice.message.content === "string"
        ? choice.message.content
        : "";
    return {
      content,
      latencyMs: raw.latencyMs,
      usage: raw.body && raw.body.usage ? raw.body.usage : null,
      model: raw.body && raw.body.model ? raw.body.model : null,
    };
  };

  const started = Date.now();
  const result = await generateRealityMap({ concept: "laptop", callLLM }, { fastPath: true });
  const map = result.map;
  const gate = map ? validateRealityMap(map) : { ok: false, errors: ["no map"] };
  const derive = map ? deriveCheck(map) : { ok: false, errors: ["no map"] };
  const stoppedSerial = Boolean(
    result.kind === "error" &&
      typeof result.reason === "string" &&
      result.reason.includes("PROBE_STOP_SERIAL")
  );
  const summary = {
    skipped: false,
    ok: result.ok,
    kind: result.kind,
    reason: result.reason ? sanitize(result.reason) : null,
    generationPath: result.generationPath || null,
    retried: result.retried,
    repairCount: result.retried ? "at-least-one" : 0,
    latencyMs: Date.now() - started,
    generateRealityMapLatencyMs: result.latencyMs,
    llmCalls,
    stoppedSerial,
    validateOk: gate.ok,
    validateErrors: gate.ok ? [] : (gate.errors || []).slice(0, 12),
    deriveOk: derive.ok,
    deriveErrors: derive.ok ? [] : (derive.errors || []).slice(0, 12),
    crownReached: map ? crownReached("laptop", map) : false,
    layerCount: map && Array.isArray(map.layers) ? map.layers.length : 0,
    nodeCount: map && Array.isArray(map.nodes) ? map.nodes.length : 0,
    edgeCount: map && Array.isArray(map.edges) ? map.edges.length : 0,
    nodeLabels: map && Array.isArray(map.nodes) ? map.nodes.map((n) => n.label).slice(0, 20) : [],
  };
  console.log(JSON.stringify({ phase: "oneshot-map", ...summary }));
  return summary;
}

const run = async () => {
  const env = summarizeEnv();
  console.log(JSON.stringify({ phase: "env", ...env }));

  if (!env.hasKey) {
    console.log(
      JSON.stringify({
        phase: "blocker",
        reason: "LLM_API_KEY missing from .env",
      })
    );
    return;
  }

  const freeLookup = await lookupModel(FREE_SLUG);
  const paidLookup = await lookupModel(PAID_SLUG);
  console.log(JSON.stringify({ phase: "models-free", ...freeLookup }));
  console.log(JSON.stringify({ phase: "models-paid", ...paidLookup }));

  const tiny = await runTinyProbes();
  await runOneShotMap(tiny);
};

run().catch((err) => {
  console.log(JSON.stringify({ phase: "fatal", error: sanitize(err instanceof Error ? err.message : String(err)) }));
  process.exitCode = 1;
});
