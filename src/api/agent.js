/**
 * The client-side transport for POST /api/agent.
 *
 * Per ticket 08 and spec section 8, the browser sends the whole session state
 * to the one stateless function and gets the reply plus updated maps back.
 * This module is a thin fetch wrapper with one job: turn every failure into
 * a stable code the chat page can word politely. Raw provider errors, the
 * error envelope's internal message and any JSON structure never reach the
 * learner.
 *
 * Ticket 14 (background transport): the function is now a Netlify BACKGROUND
 * function - the POST answers with an EMPTY 202 immediately (there is no job
 * id in the response and no built-in status endpoint), the generation runs
 * out of band (15-minute budget, no 30s kill), and the result is written to
 * a Netlify Blobs store. So callAgent generates a per-call jobId, sends it in
 * the POST body, and when the POST returns 202 it polls the sibling status
 * endpoint (/api/agent-status?job=<id>, injectable) every ~2s until the job
 * record lands, the client deadline (default 10 minutes) is exceeded, or a
 * stable failure code collapses. A non-202 POST (local dev, stubbed fetch,
 * or a sync deploy) keeps the exact old parse-the-envelope behavior.
 *
 * The function answers with the stable envelope
 * {"error": {"code", "message"}} (spec section 8); this module maps it to
 * {ok: false, code}. Anything the envelope does not cover - a dropped
 * network request, an unparseable body, an unexpected status - collapses to
 * a coarse code ("network" or "internal"), never to raw text. The poll path
 * uses the exact same collapse rules.
 *
 * fetch is injected via options.fetchImpl so node:test can drive this module
 * without a network; in the browser it defaults to globalThis.fetch.
 */

/**
 * @typedef {{ok: true; data: any} | {ok: false; code: string}} CallResult
 */

/**
 * The callAgent options.
 *
 * @typedef {object} CallOptions
 * @property {typeof fetch} [fetchImpl] - defaults to globalThis.fetch.
 * @property {string} [endpoint] - defaults to "/api/agent".
 * @property {string} [statusEndpoint] - the poll endpoint, defaults to
 *   "/api/agent-status".
 * @property {number} [pollIntervalMs] - poll spacing, default 2000.
 * @property {number} [deadlineMs] - poll deadline, default 600000.
 * @property {string} [turnstileToken] - single-use Turnstile token (ticket
 *   18); included in the body only when present so unconfigured clients stay
 *   compatible with the gate-free server.
 */

/**
 * One POST /api/agent turn.
 *
 * @param {any} body - the spec 8 request shape:
 *   {word?, realityMap?, learnerMap?, failedAttempts?, history, phase}.
 * @param {CallOptions} [options]
 * @returns {Promise<CallResult>}
 */
export async function callAgent(body, options = {}) {
  const fetchImpl = options.fetchImpl ?? /** @type {typeof fetch} */ (globalThis.fetch);
  const endpoint = options.endpoint ?? "/api/agent";
  const jobId = makeJobId();
  const payload = {
    ...body,
    jobId,
    ...(options.turnstileToken
      ? { turnstileToken: options.turnstileToken }
      : {}),
  };

  /** @type {Response} */
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Network-level failure (offline, connection refused, server down).
    return { ok: false, code: "network" };
  }

  // A background-function deploy answers the POST with an empty 202
  // immediately and runs the generation out of band; poll for the result.
  if (response.status === 202) {
    return pollForJob(jobId, options);
  }

  /** @type {any} */
  let data = null;
  try {
    data = await response.json();
  } catch {
    // A body that is not JSON is never shown to the learner.
    return { ok: false, code: "internal" };
  }

  if (!response.ok) {
    if (
      data &&
      typeof data === "object" &&
      data.error &&
      typeof data.error.code === "string"
    ) {
      return { ok: false, code: data.error.code };
    }
    return { ok: false, code: "internal" };
  }
  return { ok: true, data };
}

/**
 * A per-call job id so the client can find the background job in the status
 * store. Uses crypto.randomUUID where available; falls back to a random hex
 * string elsewhere (the id only needs to be unique and url-safe).
 *
 * @returns {string}
 */
function makeJobId() {
  const cryptoObj = /** @type {any} */ (globalThis).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  const bytes = [];
  for (let i = 0; i < 16; i += 1) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the status endpoint until the background job lands. Every outcome
 * collapses with the same rules as the POST path - never raw text, platform
 * HTML, or the errorType envelope.
 *
 * @param {string} jobId
 * @param {CallOptions} options - the callAgent options.
 * @returns {Promise<CallResult>}
 */
async function pollForJob(jobId, options) {
  const fetchImpl = options.fetchImpl ?? /** @type {typeof fetch} */ (globalThis.fetch);
  const statusEndpoint = options.statusEndpoint ?? "/api/agent-status";
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const deadlineMs = options.deadlineMs ?? 600000;
  const deadline = Date.now() + deadlineMs;

  for (;;) {
    await sleep(pollIntervalMs);
    if (Date.now() > deadline) {
      // The job never finished in time; treat as a fault on our side.
      return { ok: false, code: "internal" };
    }

    /** @type {Response} */
    let response;
    try {
      response = await fetchImpl(
        `${statusEndpoint}?job=${encodeURIComponent(jobId)}`,
        { headers: { Accept: "application/json" } }
      );
    } catch {
      // Same contract as the POST path: a dropped poll is a network failure.
      return { ok: false, code: "network" };
    }

    /** @type {any} */
    let data = null;
    try {
      data = await response.json();
    } catch {
      // A status body that is not JSON is never shown to the learner.
      return { ok: false, code: "internal" };
    }

    if (data && typeof data === "object") {
      if (data.status === "success") {
        if (data.body !== undefined) return { ok: true, data: data.body };
        return { ok: false, code: "internal" };
      }
      if (data.status === "error" && typeof data.code === "string") {
        return { ok: false, code: data.code };
      }
      if (data.status === "running") {
        continue;
      }
    }

    if (!response.ok) {
      // The status function's own stable envelope (e.g. a store failure).
      if (
        data &&
        typeof data === "object" &&
        data.error &&
        typeof data.error.code === "string"
      ) {
        return { ok: false, code: data.error.code };
      }
      return { ok: false, code: "internal" };
    }

    // A 200 that is not a status record: collapse to internal.
    return { ok: false, code: "internal" };
  }
}
