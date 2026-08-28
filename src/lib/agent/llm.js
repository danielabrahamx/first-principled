/**
 * Minimal OpenAI-compatible chat completion transport.
 *
 * `LLM_PROVIDER=openrouter|deepseek` selects one env triple. Default
 * (unset or anything other than deepseek) is OpenRouter via `LLM_*`.
 * DeepSeek uses `DEEPSEEK_*` and must not inherit OpenRouter referer /
 * title / `reasoning` fields. On OpenRouter the default model
 * (`stealth/ox-alpha`) mandates reasoning and rejects
 * `reasoning: { effort: "none" }` with HTTP 400, so thinking-off maps
 * omit the `reasoning` field entirely and run on the provider's
 * mandatory thinking; content still parses defensively. On DeepSeek,
 * `thinking: { type: "disabled" }` is sent as before (thinking is on by
 * default at effort `high`; the OpenRouter `reasoning` field is ignored
 * and burns the `max_tokens` budget into `reasoning_content`). Mixed
 * thinking (`thinkingByStage`) exists but DeepSeek Epiphanies-on failed
 * to parse.
 *
 * Per the v6 ticket 01 findings (OpenRouter path):
 * - Base URL https://openrouter.ai/api/v1, Bearer auth via LLM_API_KEY.
 * - Model id from LLM_MODEL (stealth/ox-alpha). The
 *   `:free` slug cannot constrain Epiphanies JSON Schema.
 * - JSON object mode is best-effort. Callers may instead supply a JSON Schema
 *   for constrained decoding. Both paths still parse defensively - see
 *   jsonParse.js.
 * - Reasoning arrives in `message.reasoning` (and possibly
 *   `reasoning_details`), not DeepSeek `reasoning_content`. Thinking-off
 *   maps omit the OpenRouter `reasoning` field because the default model
 *   mandates reasoning (ticket 12 deploy leg).
 *
 * Zero dependencies: global fetch (Node 18+, browsers). The stateless Netlify
 * function and the static frontend both run this code.
 */

const DEFAULT_TIMEOUT_MS = 240000;
const OPENROUTER_REFERER = "https://first-principled.netlify.app";
const OPENROUTER_TITLE = "first-principled";
const OPENROUTER_DEFAULT_MODEL = "z-ai/glm-5.3-flash";
const OPENROUTER_DEFAULT_BASE = "https://openrouter.ai/api/v1";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";

/**
 * @typedef {object} ChatMessage
 * @property {"system" | "user" | "assistant"} role
 * @property {string} content
 */

/**
 * @typedef {object} ChatCompletionOptions
 * @property {ChatMessage[]} messages
 * @property {boolean} [jsonMode] - request response_format json_object (the
 *   prompt must then mention "json" and show an example - see realityMap.js).
 * @property {{ name: string; strict?: boolean; schema: Record<string, any> }} [jsonSchema]
 *   - request response_format json_schema. Takes precedence over jsonMode.
 * @property {boolean} [thinking] - false is best-effort. OpenRouter: the
 *   `reasoning` field is omitted because the default model mandates
 *   reasoning (`reasoning: { effort: "none" }` returns HTTP 400).
 *   DeepSeek: `thinking: { type: "disabled" }`. true turns it on
 *   (OpenRouter `reasoning: { enabled: true }`). Omit to leave the
 *   provider default.
 * @property {"low" | "medium" | "high"} [reasoningEffort] - OpenRouter only:
 *   an explicit reasoning effort, accepted by the default model where
 *   "none"/disabled are not. Bounds thinking time; takes precedence over
 *   `thinking`.
 * @property {number} [maxTokens] - headroom matters: a low cap truncates JSON.
 *   Default 4096.
 * @property {number} [timeoutMs] - abort the fetch after this long. Default
 *   240000 (covers OpenRouter Nemotron `:free` e2e P95 plus margin).
 */

/**
 * @typedef {object} ChatCompletionResult
 * @property {string} content - the reply text, JSON in json mode.
 * @property {string | null} reasoningContent - CoT, never parsed or persisted.
 * @property {object | null} usage - provider usage counts when present.
 */

/**
 * The live provider. `deepseek` is the only non-default; everything else
 * (unset, empty, `openrouter`, typos) is OpenRouter so prod stays put.
 *
 * @returns {"openrouter" | "deepseek"}
 */
export function llmProvider() {
  const raw = String(process.env.LLM_PROVIDER || "")
    .trim()
    .toLowerCase();
  return raw === "deepseek" ? "deepseek" : "openrouter";
}

/**
 * The configured base URL for the live provider.
 *
 * @returns {string}
 */
export function llmBaseUrl() {
  if (llmProvider() === "deepseek") {
    return process.env.DEEPSEEK_BASE_URL || DEEPSEEK_DEFAULT_BASE;
  }
  return process.env.LLM_BASE_URL || OPENROUTER_DEFAULT_BASE;
}

/**
 * The configured model id for the live provider.
 *
 * @returns {string}
 */
export function llmModel() {
  if (llmProvider() === "deepseek") {
    return process.env.DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL;
  }
  return process.env.LLM_MODEL || OPENROUTER_DEFAULT_MODEL;
}

/**
 * The live provider's API key, or empty when unset.
 *
 * @returns {string}
 */
export function llmApiKey() {
  const key =
    llmProvider() === "deepseek"
      ? process.env.DEEPSEEK_API_KEY
      : process.env.LLM_API_KEY;
  return key || "";
}

/**
 * Env var name of the live provider's API key.
 *
 * @returns {"LLM_API_KEY" | "DEEPSEEK_API_KEY"}
 */
export function llmApiKeyName() {
  return llmProvider() === "deepseek" ? "DEEPSEEK_API_KEY" : "LLM_API_KEY";
}

/**
 * Calls the chat completions endpoint with the given messages.
 *
 * @param {ChatCompletionOptions} options
 * @returns {Promise<ChatCompletionResult>}
 * @throws {Error} when the key is missing, the request fails, or the API
 *   returns an error status (message includes the provider error text).
 */
export async function callChatCompletion(options) {
  const provider = llmProvider();
  const apiKey = llmApiKey();
  if (!apiKey) {
    throw new Error(
      `${llmApiKeyName()} is not set. Put it in .env (gitignored) or set the platform secret.`
    );
  }

  /** @type {any} */
  const payload = {
    model: llmModel(),
    messages: options.messages,
    max_tokens: options.maxTokens ?? 4096,
  };
  if (options.jsonSchema && provider !== "deepseek") {
    payload.response_format = {
      type: "json_schema",
      json_schema: options.jsonSchema,
    };
  } else if (options.jsonMode) {
    // DeepSeek rejects response_format json_schema (ticket 10, HTTP 400
    // "This response_format type is unavailable now"). Downgrade to
    // json_object there: the mechanical gate (arrange.js, realityMap.js)
    // validates the shape defensively. OpenRouter keeps the strict schema.
    payload.response_format = { type: "json_object" };
  }
  if (provider === "openrouter") {
    if (options.reasoningEffort) {
      // Bounded reasoning: the default model mandates reasoning (effort
      // "none" and enabled:false both return HTTP 400), but an explicit
      // effort IS accepted. Without this field every stage runs on the
      // provider-default effort, which measured 116-131s per stage on
      // live calls - minutes of thinking to write half a page of JSON.
      payload.reasoning = { effort: options.reasoningEffort };
    } else if (options.thinking === true) {
      payload.reasoning = { enabled: true };
    }
    // thinking === false with no reasoningEffort: omit `reasoning`
    // entirely. The default model mandates reasoning, so such calls run
    // on unbounded provider-default thinking.
  } else if (options.thinking === false) {
    payload.thinking = { type: "disabled" };
  } else if (options.thinking === true) {
    payload.thinking = { type: "enabled" };
  }

  /** @type {Record<string, string>} */
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = OPENROUTER_REFERER;
    headers["X-OpenRouter-Title"] = OPENROUTER_TITLE;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  /**
   * The stealth provider rate-limits intermittently (HTTP 429 on identical
   * payloads that succeed seconds later). A single 429 must not kill a
   * whole build, so the transport retries with backoff. Retry-After wins
   * when the provider sends one.
   *
   * @param {number} attempt - 1-based.
   * @returns {number} milliseconds to wait before this attempt.
   */
  function backoffMs(attempt) {
    return 2000 * 2 ** (attempt - 1);
  }

  const MAX_ATTEMPTS = 4;
  let response;
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(`${llmBaseUrl()}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(
        `LLM request failed: ${err instanceof Error && err.name === "AbortError" ? `aborted after ${timeoutMs}ms` : err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }
    if (response.status !== 429 || attempt >= MAX_ATTEMPTS) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
    console.error(`LLM 429 on attempt ${attempt}; retrying in ${Math.round(waitMs / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body && body.error && body.error.message ? body.error.message : "";
    } catch {
      // keep the generic message when the error body is not JSON
    }
    throw new Error(
      `LLM API error ${response.status}${detail ? `: ${detail}` : ""}`
    );
  }

  /** @type {any} */
  const body = await response.json();
  const choice = body.choices && body.choices[0];
  if (!choice || !choice.message) {
    // Seen live on the stealth provider: HTTP 200 with an empty choices
    // array. Surface it as a transport failure so the caller's own retry
    // policy (or the stage repair) handles it instead of parsing garbage.
    throw new Error("LLM response had no choices");
  }
  const finishReason =
    typeof choice.finish_reason === "string" ? choice.finish_reason : null;
  if (finishReason && finishReason !== "stop") {
    // "length" means the completion budget truncated mid-JSON - without
    // this log, truncation is indistinguishable from a shape error.
    console.error(`LLM finish_reason=${finishReason} model=${llmModel()}`);
  }
  const reasoningContent =
    typeof choice.message.reasoning_content === "string"
      ? choice.message.reasoning_content
      : typeof choice.message.reasoning === "string"
        ? choice.message.reasoning
        : null;
  let content = typeof choice.message.content === "string" ? choice.message.content : "";
  // DeepSeek v4 often writes the JSON into reasoning_content and leaves
  // message.content empty. Use that channel as the parse source only when
  // content is blank. Do not treat reasoning as learner copy.
  if (!content.trim() && reasoningContent) {
    content = reasoningContent;
  }
  return {
    content,
    reasoningContent,
    usage: body.usage || null,
  };
}
