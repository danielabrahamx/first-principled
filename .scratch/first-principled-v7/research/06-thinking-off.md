# 06 - DeepSeek thinking off for JSON maps

Maps already pass `thinking: false`. OpenRouter maps that to
`reasoning: { effort: "none" }`. Until this change, the DeepSeek path
sent neither field, so `deepseek-v4-flash` kept its default: thinking
on, effort `high`. Stage 2 then wrote 28k-37k chars of
`reasoning_content`, often left `content` empty, and took minutes.

`llm.js` now sends DeepSeek's own switch when `thinking === false`:
`thinking: { type: "disabled" }`. OpenRouter `reasoning` is still not
sent on the DeepSeek path. Docs:
https://api-docs.deepseek.com/guides/thinking_mode

## Ping (local DeepSeek, 2026-08-18)

Script: `06-thinking-off-ping.mjs`. `LLM_PROVIDER=deepseek`.

- 996 ms
- `content` `{"ok":true,"n":4}`
- `reasoning_content` length 0

Two live three-stage calls for `battery` with thinking off finished in
about 16 s. Chronology parsed. Epiphanies parsed and then failed the
mechanical contract: `joint_kind` was `TECHNICAL`, `history` missing,
regime names used instead of `c1`/`c2`.

Speed vs contract quality is parked for a later session. No prompt
rewrite here. Prod stays OpenRouter.
