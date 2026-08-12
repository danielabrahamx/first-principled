// Live probe for ticket 03: reasoning_content reliability on the configured model.
// Reads env from .env (sourced by the caller). Prints one JSON line per call. No secrets printed.
const base = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
const model = process.env.LLM_MODEL || "deepseek-v4-flash";
const key = process.env.LLM_API_KEY;

function makePayload(thinking) {
  return {
    model,
    messages: [
      { role: "system", content: "You are a helper. Reply in json only." },
      {
        role: "user",
        content:
          'Reply with a json object with one key "answer": the result of 2+2. No markdown.',
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
    ...(thinking ? {} : { thinking: { type: "disabled" } }),
  };
}

async function probe(label, thinking) {
  const start = Date.now();
  try {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(makePayload(thinking)),
    });
    const json = await res.json();
    const ch = json.choices && json.choices[0];
    const m = (ch && ch.message) || {};
    console.log(
      JSON.stringify({
        label,
        status: res.status,
        latencyMs: Date.now() - start,
        hasReasoning: typeof m.reasoning_content === "string",
        reasoningLen: m.reasoning_content ? m.reasoning_content.length : 0,
        reasoningPreview: m.reasoning_content ? m.reasoning_content.slice(0, 120) : null,
        contentLen: m.content ? m.content.length : 0,
        contentPreview: (m.content || "").slice(0, 80),
        reasoningTokens:
          (json.usage &&
            json.usage.completion_tokens_details &&
            json.usage.completion_tokens_details.reasoning_tokens) ||
          null,
        completionTokens: json.usage ? json.usage.completion_tokens : null,
        totalTokens: json.usage ? json.usage.total_tokens : null,
      })
    );
  } catch (e) {
    console.log(JSON.stringify({ label, error: String((e && e.message) || e) }));
  }
}

(async () => {
  await probe("thinking-on", true);
  await probe("thinking-off", false);
})();
