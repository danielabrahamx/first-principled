/**
 * Minimal OpenAI-compatible chat completion transport.
 *
 * `LLM_PROVIDER=openrouter|deepseek` selects one env triple. Default
 * (unset or anything other than deepseek) is OpenRouter via `LLM_*`.
 * DeepSeek uses `DEEPSEEK_*` and must not inherit OpenRouter referer /
 * title / `reasoning` fields (v6: DeepSeek ignores `thinking: false`
 * mapped to OpenRouter `reasoning`).
 *
 * Per the v6 ticket 01 findings (OpenRouter path):
 * - Base URL https://openrouter.ai/api/v1, Bearer auth via LLM_API_KEY.
 * - Model id from LLM_MODEL (nvidia/nemotron-3-ultra-550b-a55b:free).
 * - JSON mode is best-effort (response_format json_object only; no server-side
 *   schema enforcement), so callers must parse defensively - see jsonParse.js.
 * - Reasoning arrives in `message.reasoning` (and possibly
 *   `reasoning_details`), not DeepSeek `reasoning_content`. Callers that pass
 *   `thinking: false` send OpenRouter `reasoning: { effort: "none" }`.
 *
 * Zero dependencies: global fetch (Node 18+, browsers). The stateless Netlify
 * function and the static frontend both run this code.
 */

const DEFAULT_TIMEOUT_MS = 240000;
const OPENROUTER_REFERER = "https://first-principled.netlify.app";
const OPENROUTER_TITLE = "first-principled";
const OPENROUTER_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
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
 * @property {boolean} [thinking] - OpenRouter only. false sends
 *   `{ effort: "none" }` (required for JSON maps). true sends
 *   `{ enabled: true }`. Omit to leave the provider default. Ignored on
 *   DeepSeek so that path never sends an OpenRouter `reasoning` payload.
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
  if (options.jsonMode) {
    payload.response_format = { type: "json_object" };
  }
  if (provider === "openrouter") {
    if (options.thinking === false) {
      payload.reasoning = { effort: "none" };
    } else if (options.thinking === true) {
      payload.reasoning = { enabled: true };
    }
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
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
    throw new Error("LLM response had no choices");
  }
  return {
    content: typeof choice.message.content === "string" ? choice.message.content : "",
    reasoningContent:
      typeof choice.message.reasoning_content === "string"
        ? choice.message.reasoning_content
        : typeof choice.message.reasoning === "string"
          ? choice.message.reasoning
          : null,
    usage: body.usage || null,
  };
}
