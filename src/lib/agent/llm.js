/**
 * Minimal OpenAI-compatible chat completion transport for OpenRouter.
 *
 * Per the v6 ticket 01 findings:
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
 * @property {boolean} [thinking] - maps to OpenRouter `reasoning`. false sends
 *   `{ effort: "none" }` (required for JSON maps). true sends
 *   `{ enabled: true }`. Omit to leave the provider default.
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
 * The configured base URL. Environment override, defaults to the documented
 * OpenAI-compatible endpoint.
 *
 * @returns {string}
 */
export function llmBaseUrl() {
  return process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
}

/**
 * The configured model id.
 *
 * @returns {string}
 */
export function llmModel() {
  return process.env.LLM_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
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
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Put it in .env (gitignored) or set the platform secret."
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
  if (options.thinking === false) {
    payload.reasoning = { effort: "none" };
  } else if (options.thinking === true) {
    payload.reasoning = { enabled: true };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${llmBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-OpenRouter-Title": OPENROUTER_TITLE,
      },
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
