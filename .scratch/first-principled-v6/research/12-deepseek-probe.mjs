// Probe DeepSeek via the landed llm.js path. Prints status only. No secrets.
process.env.LLM_API_KEY = process.env.DEEPSEEK_API_KEY;
process.env.LLM_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
process.env.LLM_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

if (!process.env.LLM_API_KEY) {
  console.error("missing DEEPSEEK_API_KEY");
  process.exit(1);
}

const { callChatCompletion, llmModel, llmBaseUrl } = await import(
  "../../../src/lib/agent/llm.js"
);

const started = Date.now();
try {
  const reply = await callChatCompletion({
    messages: [{ role: "user", content: 'Reply with JSON {"ok":true} only.' }],
    jsonMode: true,
    thinking: false,
    maxTokens: 32,
    timeoutMs: 30000,
  });
  const host = new URL(llmBaseUrl()).host;
  console.log("ok=true");
  console.log("host=" + host);
  console.log("model=" + llmModel());
  console.log("ms=" + (Date.now() - started));
  console.log("content_len=" + String(reply.content || "").length);
} catch (err) {
  const msg = String(err instanceof Error ? err.message : err).replace(
    /sk-[A-Za-z0-9_-]+/g,
    "[redacted]"
  );
  console.log("ok=false");
  console.log("err=" + msg.slice(0, 240));
  process.exitCode = 1;
}
