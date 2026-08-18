import { callChatCompletion, llmProvider } from "../../../src/lib/agent/llm.js";

const started = Date.now();
const result = await callChatCompletion({
  messages: [
    { role: "system", content: "Return JSON only." },
    { role: "user", content: 'Reply with {"ok":true,"n":4} and nothing else.' },
  ],
  jsonMode: true,
  thinking: false,
  maxTokens: 64,
});
console.log("PROVIDER=" + llmProvider());
console.log("MS=" + (Date.now() - started));
console.log("CONTENT_LEN=" + result.content.length);
console.log("REASON_LEN=" + (result.reasoningContent ? result.reasoningContent.length : 0));
console.log("CONTENT=" + JSON.stringify(result.content.slice(0, 120)));
