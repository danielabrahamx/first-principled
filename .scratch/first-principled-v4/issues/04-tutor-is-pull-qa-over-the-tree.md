# 04 - Tutor is pull Q&A over the Tree

**Type:** task

**Status:** resolved

**Blocked by:** [One chrome, one route](02-one-chrome-one-route.md), [Ship the cladogram and one-shot grow into the live Tree](03-ship-cladogram-and-one-shot-grow.md)

**Related:** [Deploy the tree-first shell](05-deploy-the-tree-first-shell.md)

## Question

Init currently returns an opening Socratic probe ("tell me what you have
seen"). The dock is supposed to be optional Q&A over the Tree: the learner
asks, the Tutor answers from the Reality Map, no grilling. How do we make
every dock turn a briefing and stop the opening probe?

## What

Reuse v1 briefing (`probe.kind === "brief"`, `briefingRequested`, the
sanctioned quote-the-Reality-Map path). Do not rebuild the Socratic engine.
Do not surface the Learner Mental Model.

1. **No opening probe.** Init still generates the Reality Map. It does not
   append a tutor question. The dock stays empty until the learner types.
2. **Every dock utterance is a briefing.** Code forces `brief` for dock
   turns (or treats every dock utterance as `briefingRequested`). The Tutor
   quotes the Reality Map, accurately, no closing Socratic question.
3. **Toggle unchanged.** Closed by default, from
   [One chrome, one route](02-one-chrome-one-route.md). Composer only while
   a Tree exists.
4. **Engine leftovers.** The function may still return a learner map in the
   payload. The UI must not show it. Do not start a v2 engine rewrite.

## Acceptance criteria

- [x] After Build, the Tree lands with no tutor question in the dock
- [x] A learner question in the dock gets a briefing that may quote the
      Reality Map
- [x] The briefing does not end with a Socratic probe
- [x] No learner-map chrome appears
- [x] Live-verified on real DeepSeek (one concept, one dock question)
- [x] npm test green, tsc clean (socratic/orchestrator tests retargeted)

## Docs rule

Update `AGENTS.md` no-leak line: chat/dock may quote the Reality Map because
every dock turn is a briefing. Note in `CONTEXT.md` that the Tutor is pull
Q&A, not an opening probe. Do not rewrite the v1 spec wholesale; a short
note on briefing-always-in-the-dock is enough.

## Resolution

Init generates the Reality Map and returns no `reply`, so the dock stays
empty until the learner types. Active turns set `forceBrief`; `turnIsBriefing`
treats that as a briefing, so the Tutor quotes the Reality Map and
`validateTurn` rejects a closing probe. Transfer-question push on active is
gone. Composer placeholder: "Type a question about the tree." Learner-map
chrome stays hidden (ticket 02).

Live DeepSeek (`bit`, then "What is a bit?"): init 200, no reply, 11 nodes;
active briefing 216 chars, does not end with `?`. Script:
`.scratch/first-principled-v4/research/04-live-brief.mjs`. tsc clean.
Tracked tests 310 pass; 2 pre-existing rate-limiter failures in
`netlify/functions/agent/agent.test.mjs` (untouched). Netlify build OK.

Committed and pushed. Parked v2 files were not added. `stash@{0}`
(`v2 socratic parked for v4 04`) was not popped.
