// Print OpenRouter HTTP status only. Never prints the key or raw body.
const key = process.env.LLM_API_KEY || "";
const model = process.env.LLM_MODEL || "";
const base = (process.env.LLM_BASE_URL || "").replace(/\/$/, "");
if (!key || !model || !base) {
  console.error("missing LLM_*");
  process.exit(1);
}
const r = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 1,
  }),
});
let msg = "";
try {
  const j = await r.json();
  msg = j && j.error && j.error.message ? String(j.error.message) : "";
} catch {
  msg = "";
}
msg = msg.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 160);
console.log("HTTP=" + r.status);
console.log("MSG=" + msg);
