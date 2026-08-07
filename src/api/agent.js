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
 * The function answers with the stable envelope
 * {"error": {"code", "message"}} (spec section 8); this module maps it to
 * {ok: false, code}. Anything the envelope does not cover - a dropped
 * network request, an unparseable body, an unexpected status - collapses to
 * a coarse code ("network" or "internal"), never to raw text.
 *
 * fetch is injected via options.fetchImpl so node:test can drive this module
 * without a network; in the browser it defaults to globalThis.fetch.
 */

/**
 * @typedef {{ok: true; data: any} | {ok: false; code: string}} CallResult
 */

/**
 * One POST /api/agent turn.
 *
 * @param {any} body - the spec 8 request shape:
 *   {word?, realityMap?, learnerMap?, failedAttempts?, history, phase}.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl] - defaults to globalThis.fetch.
 * @param {string} [options.endpoint] - defaults to "/api/agent".
 * @returns {Promise<CallResult>}
 */
export async function callAgent(body, options = {}) {
  const fetchImpl = options.fetchImpl ?? /** @type {typeof fetch} */ (globalThis.fetch);
  const endpoint = options.endpoint ?? "/api/agent";

  /** @type {Response} */
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Network-level failure (offline, connection refused, server down).
    return { ok: false, code: "network" };
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
