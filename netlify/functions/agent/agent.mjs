/**
 * The one serverless function: POST /api/agent, per ticket 06 and spec
 * section 8. Thin HTTP wrapper around the stateless orchestrator
 * (src/lib/agent/orchestrator.js): parse the body, dispatch, map {status,
 * body} onto a Response. All session state travels in the request and the
 * response; the function stores nothing.
 *
 * Error mapping: 400 bad JSON body (the orchestrator owns field-level 400s),
 * 500 internal for unexpected throws, and the orchestrator's own stable
 * envelope for config, upstream and model-output failures. Raw upstream
 * errors and the key never reach the client.
 */

import { handleRequest } from "../../../src/lib/agent/orchestrator.js";

export default async (req) => {
  let request;
  try {
    request = await req.json();
  } catch {
    return Response.json(
      { error: { code: "bad_request", message: "The request body must be valid JSON." } },
      { status: 400 }
    );
  }

  try {
    const result = await handleRequest(request);
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json(
      { error: { code: "internal", message: "An unexpected server error occurred." } },
      { status: 500 }
    );
  }
};
