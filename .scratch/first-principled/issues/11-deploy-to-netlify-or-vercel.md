# 11 - Deploy to Netlify or Vercel

**Type:** task
**Status:** resolved (2026-08-07)
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

## Resolution

- Site created and linked: `netlify sites:create --name first-principled`
  (admin https://app.netlify.com/projects/first-principled, project id
  1a5638ca-2cd1-418a-9110-4f4fbd092480); the create step links automatically.
  Platform: Netlify, as decided.
- Env secrets set from `.env` with `netlify env:set` for LLM_API_KEY,
  LLM_MODEL (deepseek-v4-flash), LLM_BASE_URL (https://api.deepseek.com) in
  the all context. The key is a platform secret, never client-side.
- Deployed with `netlify deploy --prod` (no build step; `netlify.toml`
  publishes `src/` plus `netlify/functions/` and rewrites /api/agent to the
  function). Live: https://first-principled.netlify.app. 34 static files + 1
  function uploaded.
- Key-leak check passed: the LLM_API_KEY value appears in zero files under
  `src/` and `netlify/` (grep) and in zero tracked repo files (git grep).
- Smoke test against the deployed endpoint: init "laptop" returned 200 in
  12.2s with an 11-node reality map and phase "active"; one active turn
  returned 200 in 4.6s with an updated learner map and diff. Word-to-turn
  flow live.
- README Deploy section rewritten: live URL, site id, one-time setup
  commands, deploy command, redeploy-on-env-change note. Spec section 6
  (Netlify or Vercel -> Netlify) and section 11 (platform, live URL, env
  secrets, deploy command) updated.
