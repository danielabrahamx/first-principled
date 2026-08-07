# 11 - Deploy to Netlify or Vercel

**Type:** task
**Status:** ready-for-agent (unblocked by 10)
**Blocked by:** 10 (resolved)
**Related:** spec sections 6, 11; `netlify.toml`

## Question

How does the app get live on Netlify as static files plus one function, with
the LLM key as a platform secret?

## What

1. Platform is **Netlify** (Danny confirmed 2026-08-07). CLI is installed and
   authed as danielftabraham@outlook.com (team danielabrahamx);
   `"$APPDATA/npm/netlify.cmd"` in git-bash. Wire the `netlify.toml` from
   ticket 01.
2. Deploy: static frontend plus the single function. Platform CI from the
   GitHub repo (danielabrahamx/first-principled) or direct CLI deploy.
3. Environment secrets on the platform: LLM_API_KEY (from `.env`, gitignored),
   LLM_MODEL, LLM_BASE_URL. Set them with `netlify env:set`. The key must
   never reach the client bundle (verify: grep the built assets).
4. Live URL recorded in README with a one-line deploy note.
5. Smoke test the live function: one map generation and one turn against the
   deployed endpoint.

## Acceptance criteria

- Live URL loads the chat page and completes a word-to-turn flow.
- Built assets contain no LLM key (grep check passes).
- README documents deploy steps and the live URL.

## Human gate

None blocking: the Netlify CLI is already authed and the DeepSeek key is in
`.env`. Create and link the site with `netlify sites:create --name
first-principled` and `netlify link` (or the agent picks a sensible name).
Stop and ask Danny only if site creation fails for a reason the CLI cannot
resolve.

## Docs rule

Commit and push before done. Update README and spec section 11.
