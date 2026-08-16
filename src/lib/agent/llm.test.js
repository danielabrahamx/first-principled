import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { callChatCompletion, llmBaseUrl, llmModel } from "./llm.js";

/**
 * @param {number} status
 * @param {any} body
 * @returns {Promise<Response>}
 */
function fakeResponse(status, body) {
  return /** @type {Promise<Response>} */ (
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

/**
 * @param {string} content
 * @param {{ reasoning?: string; reasoning_content?: string }} [message]
 */
function completionBody(content, message = {}) {
  return {
    choices: [
      {
        message: {
          content,
          ...message,
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  };
}

test("defaults to OpenRouter Nemotron :free", () => {
  const prevModel = process.env.LLM_MODEL;
  const prevBase = process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_BASE_URL;
  try {
    assert.equal(llmModel(), "nvidia/nemotron-3-ultra-550b-a55b:free");
    assert.equal(llmBaseUrl(), "https://openrouter.ai/api/v1");
  } finally {
    if (prevModel === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = prevModel;
    if (prevBase === undefined) delete process.env.LLM_BASE_URL;
    else process.env.LLM_BASE_URL = prevBase;
  }
});

test("sends OpenRouter attribution headers and no DeepSeek thinking field", async () => {
  const prevKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-key";
  /** @type {any} */
  let captured;
  mock.method(
    globalThis,
    "fetch",
    async (/** @type {string | URL} */ url, /** @type {RequestInit | undefined} */ init) => {
      captured = { url, init };
      return fakeResponse(200, completionBody('{"ok":true}'));
    }
  );
  try {
    await callChatCompletion({
      messages: [{ role: "user", content: "reply with json {\"ok\":true}" }],
      jsonMode: true,
      thinking: false,
    });
    assert.equal(captured.url, `${llmBaseUrl()}/chat/completions`);
    const headers = captured.init.headers;
    assert.equal(headers["HTTP-Referer"], "https://first-principled.netlify.app");
    assert.equal(headers["X-OpenRouter-Title"], "first-principled");
    assert.equal(headers.Authorization, "Bearer test-key");
    const payload = JSON.parse(captured.init.body);
    assert.deepEqual(payload.reasoning, { effort: "none" });
    assert.equal(payload.thinking, undefined);
    assert.deepEqual(payload.response_format, { type: "json_object" });
  } finally {
    mock.restoreAll();
    if (prevKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = prevKey;
  }
});

test("thinking true maps to OpenRouter reasoning enabled", async () => {
  const prevKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-key";
  /** @type {any} */
  let payload;
  mock.method(
    globalThis,
    "fetch",
    async (/** @type {string | URL} */ _url, /** @type {RequestInit | undefined} */ init) => {
      payload = JSON.parse(/** @type {string} */ (init && init.body));
      return fakeResponse(200, completionBody("hello"));
    }
  );
  try {
    await callChatCompletion({
      messages: [{ role: "user", content: "hi" }],
      thinking: true,
    });
    assert.deepEqual(payload.reasoning, { enabled: true });
    assert.equal(payload.thinking, undefined);
  } finally {
    mock.restoreAll();
    if (prevKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = prevKey;
  }
});

test("reads OpenRouter message.reasoning when reasoning_content is absent", async () => {
  const prevKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-key";
  mock.method(globalThis, "fetch", async () =>
    fakeResponse(200, completionBody("answer", { reasoning: "the chain" }))
  );
  try {
    const result = await callChatCompletion({
      messages: [{ role: "user", content: "hi" }],
    });
    assert.equal(result.content, "answer");
    assert.equal(result.reasoningContent, "the chain");
  } finally {
    mock.restoreAll();
    if (prevKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = prevKey;
  }
});
