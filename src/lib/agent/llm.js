/**
 * Minimal OpenAI-compatible chat completion transport for the DeepSeek API.
 *
 * Per the ticket 03 findings:
 * - Base URL https://api.deepseek.com/v1, Bearer auth via LLM_API_KEY.
 * - Model id from LLM_MODEL (deepseek-v4-flash).
 * - JSON mode is best-effort (response_format json_object only; no server-side
 *   schema enforcement), so callers must parse defensively - see jsonParse.js.
 * - v4 models think by default; reasoning arrives in `reasoning_content` and
 *   is never passed back or parsed as JSON.
 *
 * Zero dependencies: global fetch (Node 18+, browsers). The stateless Netlify
 * function and the static frontend both run this code.
 */

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
 * @property {boolean} [thinking] - default true: let the model think (better
 *   structure, more tokens, no temperature effect). false disables thinking
 *   per call by sending the top-level `thinking` parameter (verified live in
 *   ticket 04; the OpenAI-SDK style `extra_body` nesting is ignored by this
 *   API).
 * @property {number} [maxTokens] - headroom matters: a low cap truncates JSON.
 *   Default 4096.
 * @property {number} [timeoutMs] - abort the fetch after this long. Default
 *   45000; the app-level latency budget for one call is 30s (ticket 04 AC).
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
  return process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
}

/**
 * The configured model id.
 *
 * @returns {string}
 */
export function llmModel() {
  return process.env.LLM_MODEL || "deepseek-v4-flash";
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
    payload.thinking = { type: "disabled" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);

  let response;
  try {
    response = await fetch(`${llmBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      `LLM request failed: ${err instanceof Error && err.name === "AbortError" ? `aborted after ${options.timeoutMs ?? 45000}ms` : err instanceof Error ? err.message : String(err)}`
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
        : null,
    usage: body.usage || null,
  };
}
