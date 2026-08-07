import { test } from "node:test";
import assert from "node:assert/strict";

import { callAgent } from "./agent.js";

/**
 * A fake Response-like object for the injected fetch, cast so it satisfies
 * the `typeof fetch` type without needing the full Response surface.
 *
 * @param {number} status
 * @param {any} body - the JSON body the response returns.
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

test("a 200 turn returns the response data", async () => {
  const body = {
    reply: "What have you noticed about electricity?",
    learnerMap: { nodes: [], edges: [] },
    diff: { added: [], flipped: [], updated: [] },
    phase: "active",
    failedAttempts: {},
  };
  const result = await callAgent({ word: "laptop", history: [], phase: "init" }, {
    fetchImpl: async (url, init) => {
      assert.equal(url, "/api/agent");
      const options = /** @type {RequestInit} */ (init ?? {});
      assert.equal(options.method, "POST");
      const headers = /** @type {Record<string, string>} */ (options.headers ?? {});
      assert.equal(headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(/** @type {string} */ (options.body)), {
        word: "laptop",
        history: [],
        phase: "init",
      });
      return fakeResponse(200, body);
    },
  });
  assert.deepEqual(result, { ok: true, data: body });
});

test("envelope error codes pass through untouched", async () => {
  for (const code of ["bad_request", "config_error", "internal", "upstream_error", "invalid_model_output"]) {
    const result = await callAgent({}, {
      fetchImpl: async () => fakeResponse(502, { error: { code, message: "secret provider detail" } }),
    });
    assert.deepEqual(result, { ok: false, code });
  }
});

test("a network failure collapses to the network code", async () => {
  const result = await callAgent({}, {
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.deepEqual(result, { ok: false, code: "network" });
});

test("an error response without a JSON envelope collapses to internal", async () => {
  const result = await callAgent({}, {
    fetchImpl: async () => fakeResponse(500, { unexpected: true }),
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("a non-JSON body collapses to internal, never raw text", async () => {
  const result = await callAgent({}, {
    fetchImpl: async () =>
      /** @type {Promise<Response>} */ (
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new SyntaxError("Unexpected token")),
        })
      ),
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("an unexpected status with a valid envelope still yields its code", async () => {
  const result = await callAgent({}, {
    fetchImpl: async () => fakeResponse(418, { error: { code: "internal", message: "teapot" } }),
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("the endpoint can be overridden", async () => {
  const result = await callAgent({}, {
    endpoint: "/.netlify/functions/agent",
    fetchImpl: async (url) => {
      assert.equal(url, "/.netlify/functions/agent");
      return fakeResponse(200, { reply: "ok" });
    },
  });
  assert.deepEqual(result, { ok: true, data: { reply: "ok" } });
});
