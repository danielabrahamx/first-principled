/**
 * The background-job status function (ticket 14): GET /api/agent-status
 * ?job=<id>. Netlify background functions return an empty 202 with no job
 * id and no built-in status endpoint, so the client polls THIS synchronous
 * function while the background agent (netlify/functions/agent/agent.mjs)
 * writes its outcome to the "agent-jobs" Netlify Blobs store under
 * job:<id>. This function reads that record and answers one of three
 * states, so the client collapses every outcome to the same stable codes as
 * the old sync path:
 *
 *   - no record yet            -> 200 {status:"running"}
 *   - running record           -> 200 {status:"running", stage?, snapshot?}
 *   - success record           -> 200 {status:"success", body} (the turn
 *     response), or, when the app returned a non-200 envelope, the mapped
 *     error: 200 {status:"error", code, message}
 *   - error record             -> 200 {status:"error", code, message}
 *   - store failure            -> 500 {error:{code,message}} - never
 *     platform HTML
 *
 * The function is synchronous on purpose: a background function can never
 * serve a poll (it returns a 202 and runs out of band).
 */

import { getStore } from "@netlify/blobs";
import { pollJson } from "../../../src/lib/agent/stageSnapshot.js";

/**
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @returns {Response}
 */
function errorResponse(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
}

export default async (req) => {
  let store;
  try {
    store = getStore({ name: "agent-jobs", consistency: "strong" });
  } catch (e) {
    console.error("agent-status getStore failed:", e && e.message);
    return errorResponse(500, "internal", "An unexpected server error occurred.");
  }

  let jobId = null;
  try {
    jobId = new URL(req.url).searchParams.get("job");
  } catch {
    return errorResponse(400, "bad_request", "The job id is invalid.");
  }
  if (!jobId) {
    return errorResponse(
      400,
      "bad_request",
      'The "job" query parameter is required.'
    );
  }

  /** @type {any} */
  let record = null;
  try {
    record = await store.get(`job:${jobId}`, { type: "json", consistency: "strong" });
  } catch (e) {
    console.error("agent-status store.get failed:", e && e.message, "job:", jobId);
    return errorResponse(500, "internal", "An unexpected server error occurred.");
  }

  if (record === null) {
    return Response.json(pollJson(null), { status: 200 });
  }

  if (record.status === "success") {
    if (record.httpStatus === 200) {
      return Response.json(pollJson(record), { status: 200 });
    }
    // The app answered with a non-200 stable envelope; map it to the error
    // shape the client already knows.
    const err = record.body && record.body.error;
    if (err && typeof err.code === "string") {
      return Response.json(
        { status: "error", code: err.code, message: err.message },
        { status: 200 }
      );
    }
    return errorResponse(500, "internal", "An unexpected server error occurred.");
  }

  if (record.status === "error" && typeof record.code === "string") {
    return Response.json(pollJson(record), { status: 200 });
  }

  if (record.status === "running") {
    return Response.json(pollJson(record), { status: 200 });
  }

  // An unrecognized record shape: behave as running rather than surface
  // anything the client cannot map.
  return Response.json({ status: "running" }, { status: 200 });
};
