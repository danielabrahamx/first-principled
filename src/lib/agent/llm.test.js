import { test, mock } from "node:test";
import assert from "node:assert/strict";

import {
  callChatCompletion,
  llmApiKey,
  llmApiKeyName,
  llmBaseUrl,
  llmModel,
  llmProvider,
} from "./llm.js";

const ENV_KEYS = [
  "LLM_PROVIDER",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_BASE_URL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
];

const BOTH_TRIPLES = {
  LLM_API_KEY: "openrouter-key",
  LLM_MODEL: "openrouter-model",
  LLM_BASE_URL: "https://openrouter.example/v1",
  DEEPSEEK_API_KEY: "deepseek-key",
  DEEPSEEK_MODEL: "deepseek-model",
  DEEPSEEK_BASE_URL: "https://deepseek.example/v1",
};

/**
 * @returns {Record<string, string | undefined>}
 */
function snapshotEnv() {
  /** @type {Record<string, string | undefined>} */
  const snap = {};
  for (const key of ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

/**
 * @param {Record<string, string | undefined>} snap
 */
function restoreEnv(snap) {
  for (const key of ENV_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

/**
 * @param {Record<string, string | undefined>} patch
 * @param {() => void | Promise<void>} fn
 */
async function withEnv(patch, fn) {
  const snap = snapshotEnv();
  try {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fn();
  } finally {
    restoreEnv(snap);
  }
}

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

test("defaults to OpenRouter Nemotron :free", async () => {
  await withEnv({}, () => {
    assert.equal(llmProvider(), "openrouter");
    assert.equal(llmModel(), "nvidia/nemotron-3-ultra-550b-a55b:free");
    assert.equal(llmBaseUrl(), "https://openrouter.ai/api/v1");
    assert.equal(llmApiKeyName(), "LLM_API_KEY");
  });
});

test("LLM_PROVIDER=openrouter uses LLM_* even when DEEPSEEK_* is set", async () => {
  await withEnv({ ...BOTH_TRIPLES, LLM_PROVIDER: "openrouter" }, () => {
    assert.equal(llmProvider(), "openrouter");
    assert.equal(llmApiKey(), "openrouter-key");
    assert.equal(llmModel(), "openrouter-model");
    assert.equal(llmBaseUrl(), "https://openrouter.example/v1");
  });
});

test("LLM_PROVIDER=deepseek uses DEEPSEEK_* even when LLM_* is set", async () => {
  await withEnv({ ...BOTH_TRIPLES, LLM_PROVIDER: "deepseek" }, () => {
    assert.equal(llmProvider(), "deepseek");
    assert.equal(llmApiKey(), "deepseek-key");
    assert.equal(llmModel(), "deepseek-model");
    assert.equal(llmBaseUrl(), "https://deepseek.example/v1");
    assert.equal(llmApiKeyName(), "DEEPSEEK_API_KEY");
  });
});

test("sends OpenRouter attribution headers and no DeepSeek thinking field", async () => {
  await withEnv({ LLM_API_KEY: "test-key" }, async () => {
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
    }
  });
});

test("thinking true maps to OpenRouter reasoning enabled", async () => {
  await withEnv({ LLM_API_KEY: "test-key" }, async () => {
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
    }
  });
});

test("reads OpenRouter message.reasoning when reasoning_content is absent", async () => {
  await withEnv({ LLM_API_KEY: "test-key" }, async () => {
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
    }
  });
});

test("DeepSeek path uses the DeepSeek triple and omits OpenRouter headers and reasoning", async () => {
  await withEnv({ ...BOTH_TRIPLES, LLM_PROVIDER: "deepseek" }, async () => {
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
      assert.equal(captured.url, "https://deepseek.example/v1/chat/completions");
      const headers = captured.init.headers;
      assert.equal(headers.Authorization, "Bearer deepseek-key");
      assert.equal(headers["HTTP-Referer"], undefined);
      assert.equal(headers["X-OpenRouter-Title"], undefined);
      const payload = JSON.parse(captured.init.body);
      assert.equal(payload.model, "deepseek-model");
      assert.equal(payload.reasoning, undefined);
      assert.equal(payload.thinking, undefined);
      assert.deepEqual(payload.response_format, { type: "json_object" });
    } finally {
      mock.restoreAll();
    }
  });
});

test("DeepSeek missing key names DEEPSEEK_API_KEY even when LLM_API_KEY is set", async () => {
  await withEnv(
    {
      LLM_PROVIDER: "deepseek",
      LLM_API_KEY: "openrouter-key",
    },
    async () => {
      await assert.rejects(
        () =>
          callChatCompletion({
            messages: [{ role: "user", content: "hi" }],
          }),
        /DEEPSEEK_API_KEY is not set/
      );
    }
  );
});
