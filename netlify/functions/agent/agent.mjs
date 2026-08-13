/**
 * The one serverless function: POST /api/agent, per ticket 06 and spec
 * section 8, and since ticket 14 a Netlify BACKGROUND function (netlify.toml
 * [functions.agent] background = true) so a 20-50s generation survives the
 * sync 30s cap. The platform answers the POST with an EMPTY 202 immediately
 * - there is no job id in the response and no built-in status endpoint - so
 * this wrapper is a thin job recorder around the stateless orchestrator
 * (src/lib/agent/orchestrator.js): it reads the client-generated jobId from
 * the body, runs the abuse controls first (body cap, per-IP rate limit,
 * Turnstile), then dispatch, and writes EVERY outcome as a terminal record
 * to a Netlify Blobs store ("agent-jobs") under key job:<jobId> with a 30
 * minute TTL. The client polls the sibling synchronous function
 * (netlify/functions/agent-status) until that record lands.
 *
 * CRITICAL retry contract: Netlify retries a background invocation that
 * returns an error (after one minute, then after two more). An uncaught
 * throw after the 202 therefore re-runs the WHOLE generation and
 * double-spends LLM tokens. Every path writes a terminal job record instead
 * of throwing; the outer try/catch is the last-resort guard.
 *
 * Abuse controls (ticket 18, in order, all before any LLM call):
 * 1. Body cap: reject requests over 64KB with too_large. The client never
 *    sends more than a few KB; anything larger is an attacker.
 * 2. Rate limit: RATE_LIMIT_MAX requests per IP per hour (default 60),
 *    counted in a Netlify Blobs store (no DB, works on every plan).
 *    Fail-open when the store is unavailable so local dev and outages do
 *    not take the site down; the Turnstile check is the primary bot wall.
 * 3. Turnstile: when TURNSTILE_SECRET_KEY is set, every request must carry
 *    a valid Turnstile token (single-use, 5-minute lifetime, verified
 *    against Cloudflare). Skipped entirely when the secret is unset, so
 *    local dev and the site keep working until the widget is configured.
 *
 * Job records: success = {status:"success", httpStatus, body}; error =
 * {status:"error", code, message}. Codes mirror the old HTTP envelope
 * (bad_request, too_large, rate_limited, captcha_required, captcha_failed,
 * internal, and the orchestrator's own config/upstream/model-output codes).
 * The client never receives raw upstream errors, the key, or platform HTML.
 */

import { handleRequest } from "../../../src/lib/agent/orchestrator.js";
import { getStore } from "@netlify/blobs";

const MAX_BODY_BYTES = 64 * 1024;
const JOB_TTL_SECONDS = 30 * 60;
const RATE_LIMIT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
const RATE_LIMIT_WINDOW_HOURS = 2;
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "agent_turn";

/**
 * A server-generated job id, used when the request body cannot be parsed or
 * carries no client jobId - there is still a terminal record to write so
 * the platform never sees a throw, but nothing will poll it.
 *
 * @returns {string}
 */
function serverJobId() {
  const rand =
    typeof globalThis.crypto === "object" &&
    typeof /** @type {any} */ (globalThis.crypto).randomUUID === "function"
      ? /** @type {any} */ (globalThis.crypto).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `srv-${rand}`;
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ status: "error", code: string, message: string }}
 */
function terminalError(code, message) {
  return { status: "error", code, message };
}

/**
 * Write a terminal job record and return the (discarded) response. Never
 * throws: an uncaught throw after the 202 re-runs the whole generation.
 *
 * @param {string} jobId
 * @param {{ status: "success", httpStatus: number, body: any } | { status: "error", code: string, message: string }} record
 * @returns {Promise<Response>}
 */
async function writeTerminal(jobId, record) {
  try {
    const store = getStore({ name: "agent-jobs" });
    // setJSON, not set: @netlify/blobs v10 set() sends the value as a raw
    // body, so an object would be stored as the literal string
    // "[object Object]" and the poll would never parse it.
    await store.setJSON(`job:${jobId}`, record, { expires: JOB_TTL_SECONDS });
  } catch (e) {
    // The job record could not be persisted. Do not throw - the platform
    // would retry and re-run the generation, double-spending LLM tokens.
    console.error("writeTerminal failed:", e && e.message, "job:", jobId);
  }
  return new Response(null, { status: 204 });
}

/** The real client IP, set by Netlify's proxy layer. */
function clientIp(req) {
  const direct = req.headers.get("x-nf-client-connection-ip");
  if (direct) return direct;
  const forwarded = req.headers.get("x-forwarded-for") || "";
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * Fixed-window per-IP counter. Returns true when the IP is over the
 * hourly cap.
 *
 * Primary store: Netlify Blobs (shared across function instances), used
 * when the platform injects the blob context. Fallback: an in-process
 * counter (per instance, resets on cold start) so the gate works even on
 * sites where the blob context is unavailable - best-effort under
 * multi-instance load, strictly better than nothing, zero config.
 *
 * The store is injectable for tests; production callers omit it.
 *
 * @param {string} ip
 * @param {{ get(key: string, opts?: any): Promise<any>, set(key: string, value: any, opts?: any): Promise<any> } | null} [store]
 * @returns {Promise<boolean>}
 */
export async function overRateLimit(ip, store = null) {
  if (RATE_LIMIT_MAX <= 0) return false;
  const hour = new Date().toISOString().slice(0, 13);
  const key = `ip:${ip}`;
  if (store !== null) {
    try {
      /** @type {{ count?: number, hour?: string } | null} */
      const current = await store.get(key, { type: "json" });
      const count = current && current.hour === hour ? current.count || 0 : 0;
      if (count >= RATE_LIMIT_MAX) return true;
      // setJSON, not set: set() stores an object as the literal string
      // "[object Object]", which the get() above would fail to parse and
      // the gate would silently fall back to in-memory counting.
      await store.setJSON(
        key,
        { count: count + 1, hour },
        { expires: RATE_LIMIT_WINDOW_HOURS * 60 * 60 }
      );
      return false;
    } catch {
      // Fall through to the in-memory counter; never take the site down
      // on a store error.
    }
  }
  return inMemoryRateLimit(key, hour);
}

/**
 * In-process fallback: a fixed-window counter per (ip, hour) with the
 * previous hour's entries dropped on access. Bounded by the number of
 * distinct IPs seen in an hour.
 *
 * @type {Map<string, number>}
 */
const memoryCounters = new Map();

/**
 * @param {string} key
 * @param {string} hour
 * @returns {boolean} true when the cap is already met.
 */
function inMemoryRateLimit(key, hour) {
  const bucket = `${key}:${hour}`;
  const count = memoryCounters.get(bucket) || 0;
  if (count >= RATE_LIMIT_MAX) return true;
  memoryCounters.set(bucket, count + 1);
  if (memoryCounters.size > 10_000) {
    for (const stale of [...memoryCounters.keys()]) {
      if (!stale.endsWith(hour)) memoryCounters.delete(stale);
    }
  }
  return false;
}

/**
 * Verify a Turnstile token with Cloudflare. Returns null when the check
 * passes, or a stable error code when it fails.
 *
 * @param {Request} req
 * @param {string | null} token
 * @param {string} ip
 * @returns {Promise<string | null>}
 */
async function turnstileError(req, token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return null; // widget not configured: no gate
  if (!token) return "captcha_required";
  let payload;
  try {
    const resp = await fetch(TURNSTILE_SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    payload = await resp.json();
  } catch {
    // Verification service unreachable: fail closed - do not spend LLM
    // tokens on requests we could not vet.
    return "captcha_failed";
  }
  if (!payload.success) return "captcha_failed";
  if (payload.action && payload.action !== TURNSTILE_ACTION) return "captcha_failed";
  return null;
}

export default async (req) => {
  try {
    return await run(req);
  } catch {
    // Last-resort guard: never throw after the 202 (a throw re-runs the
    // whole generation). Record a terminal internal error and return the
    // discarded response.
    await writeTerminal(
      serverJobId(),
      terminalError("internal", "An unexpected server error occurred.")
    );
    return new Response(null, { status: 204 });
  }
};

/**
 * Netlify background mode: the platform answers the POST with an EMPTY 202
 * immediately and runs this function out of band (15-minute budget, no 30s
 * sync cap). In-source config is the docs-preferred mechanism
 * (docs.netlify.com/build/functions/api#background); netlify.toml
 * [functions.agent] background = true is kept alongside it for
 * git-based builds.
 */
export const config = {
  background: true,
};

/**
 * The whole handler. Every outcome - abuse-control rejection, success, or a
 * caught dispatch error - is written as a terminal job record instead of an
 * HTTP response a client will never see. Returns the discarded Response.
 *
 * @param {Request} req
 * @returns {Promise<Response>}
 */
async function run(req) {
  const ip = clientIp(req);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return writeTerminal(
      serverJobId(),
      terminalError("too_large", "The request is larger than the tutor accepts.")
    );
  }

  let request;
  try {
    request = JSON.parse(raw);
  } catch {
    return writeTerminal(
      serverJobId(),
      terminalError("bad_request", "The request body must be valid JSON.")
    );
  }

  // The client-generated job id is the polling key. A request without one
  // has nothing to poll, so it is a terminal bad_request under a
  // server-generated id (never a throw).
  const jobId =
    typeof request.jobId === "string" && request.jobId.length > 0
      ? request.jobId
      : null;
  if (jobId === null) {
    return writeTerminal(
      serverJobId(),
      terminalError("bad_request", "The request is missing a job id.")
    );
  }

  let blobStore = null;
  try {
    blobStore = getStore({ name: "agent-ratelimits" });
  } catch {
    blobStore = null;
  }
  if (await overRateLimit(ip, blobStore)) {
    return writeTerminal(
      jobId,
      terminalError(
        "rate_limited",
        "Too many requests from this address. Please try again later."
      )
    );
  }

  const captchaCode = await turnstileError(
    req,
    typeof request.turnstileToken === "string" ? request.turnstileToken : null,
    ip
  );
  if (captchaCode !== null) {
    return writeTerminal(
      jobId,
      terminalError(
        captchaCode,
        captchaCode === "captcha_required"
          ? "This request needs a human verification pass."
          : "Human verification failed. Please try again."
      )
    );
  }

  try {
    const result = await handleRequest(request);
    return writeTerminal(jobId, {
      status: "success",
      httpStatus: result.status,
      body: result.body,
    });
  } catch {
    return writeTerminal(
      jobId,
      terminalError("internal", "An unexpected server error occurred.")
    );
  }
}
