/**
 * The one serverless function: POST /api/agent, per ticket 06 and spec
 * section 8. Thin HTTP wrapper around the stateless orchestrator
 * (src/lib/agent/orchestrator.js): abuse controls first (body cap, per-IP
 * rate limit, Turnstile), then parse the body, dispatch, map {status, body}
 * onto a Response. All session state travels in the request and the
 * response; the function stores nothing except rate-limit counters in a
 * Netlify Blobs store.
 *
 * Abuse controls (ticket 18, in order, all before any LLM call):
 * 1. Body cap: reject requests over 64KB with 413 too_large. The client
 *    never sends more than a few KB; anything larger is an attacker.
 * 2. Rate limit: RATE_LIMIT_MAX requests per IP per hour (default 60),
 *    counted in a Netlify Blobs store (no DB, works on every plan).
 *    Fail-open when the store is unavailable so local dev and outages do
 *    not take the site down; the Turnstile check is the primary bot wall.
 * 3. Turnstile: when TURNSTILE_SECRET_KEY is set, every request must carry
 *    a valid Turnstile token (single-use, 5-minute lifetime, verified
 *    against Cloudflare). Skipped entirely when the secret is unset, so
 *    local dev and the site keep working until the widget is configured.
 *
 * Error mapping: 400 bad JSON body, 413 too_large, 429 rate_limited,
 * 403 captcha_required / captcha_failed, 500 internal for unexpected
 * throws, and the orchestrator's own stable envelope for config, upstream
 * and model-output failures. Raw upstream errors and the key never reach
 * the client.
 */

import { handleRequest } from "../../../src/lib/agent/orchestrator.js";
import { getStore } from "@netlify/blobs";

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
const RATE_LIMIT_WINDOW_HOURS = 2;
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "agent_turn";

/** @param {number} status @param {string} code @param {string} message */
function errorResponse(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
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
 * Fixed-window per-IP counter in Netlify Blobs. Returns true when the IP
 * is over the hourly cap. Fail-open: any store error returns false (no
 * limiting) so a broken store never takes the site down.
 *
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function overRateLimit(ip) {
  if (RATE_LIMIT_MAX <= 0) return false;
  let store;
  try {
    store = getStore({ name: "agent-ratelimits" });
  } catch {
    return false;
  }
  const hour = new Date().toISOString().slice(0, 13);
  const key = `ip:${ip}`;
  try {
    /** @type {{ count?: number, hour?: string } | null} */
    const current = await store.get(key, { type: "json" });
    const count = current && current.hour === hour ? current.count || 0 : 0;
    if (count >= RATE_LIMIT_MAX) return true;
    await store.set(
      key,
      { count: count + 1, hour },
      { expires: RATE_LIMIT_WINDOW_HOURS * 60 * 60 }
    );
    return false;
  } catch {
    return false;
  }
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
  const ip = clientIp(req);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return errorResponse(
      413,
      "too_large",
      "The request is larger than the tutor accepts."
    );
  }

  let request;
  try {
    request = JSON.parse(raw);
  } catch {
    return errorResponse(
      400,
      "bad_request",
      "The request body must be valid JSON."
    );
  }

  if (await overRateLimit(ip)) {
    return errorResponse(
      429,
      "rate_limited",
      "Too many requests from this address. Please try again later."
    );
  }

  const captchaCode = await turnstileError(
    req,
    typeof request.turnstileToken === "string" ? request.turnstileToken : null,
    ip
  );
  if (captchaCode !== null) {
    return errorResponse(
      403,
      captchaCode,
      captchaCode === "captcha_required"
        ? "This request needs a human verification pass."
        : "Human verification failed. Please try again."
    );
  }

  try {
    const result = await handleRequest(request);
    return Response.json(result.body, { status: result.status });
  } catch {
    return errorResponse(
      500,
      "internal",
      "An unexpected server error occurred."
    );
  }
};
