import { test } from "node:test";
import assert from "node:assert/strict";

import { callAgent, DEFAULT_AGENT_DEADLINE_MS } from "./agent.js";

test("background polling allows fourteen minutes for three serial calls", () => {
  assert.equal(DEFAULT_AGENT_DEADLINE_MS, 840000);
});

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
      const sent = JSON.parse(/** @type {string} */ (options.body));
      assert.equal(sent.word, "laptop");
      assert.deepEqual(sent.history, []);
      assert.equal(sent.phase, "init");
      assert.equal(typeof sent.jobId, "string");
      assert.ok(sent.jobId.length > 0);
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

// ---------------------------------------------------------------------------
// Background transport (ticket 14): the POST answers with an empty 202, so
// callAgent polls the status endpoint with the client-generated job id.
// ---------------------------------------------------------------------------

/**
 * A fake fetch that answers the POST /api/agent with an empty 202 and routes
 * status polls through a per-poll responder, recording every call.
 *
 * @param {(pollUrl: string, pollCount: number) => Promise<Response>} statusResponder
 * @returns {{ fetchImpl: typeof fetch, postedBody: () => any, pollUrls: () => string[] }}
 */
function backgroundFetch(statusResponder) {
  /** @type {string[]} */
  const pollUrls = [];
  /** @type {any} */
  let posted = null;
  const fetchImpl = async (
    /** @type {string | URL | Request} */ url,
    /** @type {RequestInit | undefined} */ init
  ) => {
    const method = (init && init.method) || "GET";
    if (method === "POST") {
      posted = JSON.parse(/** @type {string} */ (init && init.body));
      return fakeResponse(202, {});
    }
    pollUrls.push(String(url));
    return statusResponder(String(url), pollUrls.length);
  };
  return {
    fetchImpl,
    postedBody: () => posted,
    pollUrls: () => pollUrls,
  };
}

test("a 202 with an immediate success job returns the same shape as a 200", async () => {
  const turn = { reply: "What have you noticed about electricity?", phase: "active" };
  const { fetchImpl, postedBody, pollUrls } = backgroundFetch(async () =>
    fakeResponse(200, { status: "success", body: turn })
  );
  const result = await callAgent({ word: "laptop", history: [], phase: "init" }, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: true, data: turn });
  const jobId = postedBody().jobId;
  assert.equal(typeof jobId, "string");
  assert.ok(jobId.length > 0);
  assert.equal(pollUrls().length, 1);
  assert.ok(pollUrls()[0].startsWith("/api/agent-status?job="));
  assert.ok(pollUrls()[0].includes(encodeURIComponent(jobId)));
});

test("a 202 polls through running until the success record lands", async () => {
  let polls = 0;
  const { fetchImpl } = backgroundFetch(async () => {
    polls += 1;
    return polls === 1
      ? fakeResponse(200, { status: "running" })
      : fakeResponse(200, { status: "success", body: { reply: "done" } });
  });
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: true, data: { reply: "done" } });
  assert.equal(polls, 2);
});

test("a running poll with stage and snapshot keeps polling until success", async () => {
  let polls = 0;
  const { fetchImpl } = backgroundFetch(async () => {
    polls += 1;
    if (polls === 1) {
      return fakeResponse(200, {
        status: "running",
        stage: "chronology",
        snapshot: { concept: "battery", chronology: [] },
      });
    }
    if (polls === 2) {
      return fakeResponse(200, {
        status: "running",
        stage: "epiphanies",
        snapshot: { concept: "battery", chronology: [], epiphanies: [] },
      });
    }
    return fakeResponse(200, { status: "success", body: { reply: "done" } });
  });
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: true, data: { reply: "done" } });
  assert.equal(polls, 3);
});

test("a 202 job that ends in an error record returns its stable code", async () => {
  const { fetchImpl } = backgroundFetch(async () =>
    fakeResponse(200, { status: "error", code: "upstream_error", message: "secret provider detail" })
  );
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: false, code: "upstream_error" });
});

test("a non-JSON status body collapses to internal, never raw text", async () => {
  const { fetchImpl } = backgroundFetch(async () =>
    /** @type {Promise<Response>} */ (
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      })
    )
  );
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("a status-poll network failure collapses to the network code", async () => {
  const { fetchImpl } = backgroundFetch(async () => {
    throw new TypeError("fetch failed");
  });
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: false, code: "network" });
});

test("the status endpoint's own envelope error code passes through", async () => {
  const { fetchImpl } = backgroundFetch(async () =>
    fakeResponse(500, { error: { code: "internal", message: "store failure" } })
  );
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("a 202 that exceeds the client deadline collapses to internal", async () => {
  const { fetchImpl } = backgroundFetch(async () =>
    fakeResponse(200, { status: "running" })
  );
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 5,
    deadlineMs: 15,
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("a 202 success record without a body collapses to internal", async () => {
  const { fetchImpl } = backgroundFetch(async () =>
    fakeResponse(200, { status: "success" })
  );
  const result = await callAgent({}, {
    fetchImpl,
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: false, code: "internal" });
});

test("the status endpoint can be overridden", async () => {
  const { fetchImpl, pollUrls } = backgroundFetch(async () =>
    fakeResponse(200, { status: "success", body: { reply: "ok" } })
  );
  const result = await callAgent({}, {
    fetchImpl,
    statusEndpoint: "/.netlify/functions/agent-status",
    pollIntervalMs: 1,
    deadlineMs: 2000,
  });
  assert.deepEqual(result, { ok: true, data: { reply: "ok" } });
  assert.ok(pollUrls()[0].startsWith("/.netlify/functions/agent-status?job="));
});
