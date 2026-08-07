# 11 - Deploy to Netlify or Vercel

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 10
**Related:** spec sections 6, 11; `vercel.json` or `netlify.toml`

## Question

How does the app get live as static files plus one function, with the LLM key
as a platform secret?

## What

1. Choose Netlify or Vercel (Danny's call; both work for this shape) and wire
   the platform config from ticket 01.
2. Deploy: static frontend plus the single function. Platform CI from the
   GitHub repo (danielabrahamx/first-principled) or direct CLI deploy.
3. Environment secrets on the platform: LLM_API_KEY (Danny supplies the
   DeepSeek key), LLM_MODEL, LLM_BASE_URL. The key must never reach the
   client bundle (verify: grep the built assets).
4. Live URL recorded in README with a one-line deploy note.
5. Smoke test the live function: one map generation and one turn against the
   deployed endpoint.

## Acceptance criteria

- Live URL loads the chat page and completes a word-to-turn flow.
- Built assets contain no LLM key (grep check passes).
- README documents deploy steps and the live URL.

## Human gate

Danny must be logged into the chosen platform (or provide CLI auth) and must
supply the DeepSeek API key. Agents prepare everything else and stop at the
credential gate if needed.

## Docs rule

Commit and push before done. Update README and spec section 11.
