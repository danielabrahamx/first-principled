# 01 - Can one background agent finish three serial LLM calls

**Type:** research

**Status:** claimed (cursor, 2026-08-17)

**Blocked by:** none

**Related:** [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md), [LLM_PROVIDER is a one-var switch](03-llm-provider-is-a-one-var-switch.md)

## Question

v7 builds a Tree with three serial LLM stages inside init. The agent is
already a Netlify background function (`netlify.toml`
`[functions.agent] background = true`) that returns 202 and writes a job
record for `/api/agent-status`. Can one background invocation finish
three `callChatCompletion` calls, and what timeout / retry / polling
facts must
[The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)
obey?

## What

Investigate against primary sources (Netlify background functions docs
for this site's plan, current `agent.mjs` / `agent-status.mjs` /
`llm.js`) and cite each claim. A live three-call probe is optional; do
not spend `:free` quota unless it is the only way to answer duration.
Never print the key.

1. **Platform budget.** Max duration of a background function on this
   site. What happens if it exceeds that. Confirm the empty-202 plus
   blobs job record plus status poll contract.
2. **Per-call timeout.** `llm.js` default abort vs three serial aborts.
   Worst case (each call hits timeout) vs expected P50 from v6 Nemotron
   notes (~18s per call).
3. **Retry / double-spend.** Background retry on throw already documented
   in `agent.mjs`. Does a long three-stage run change that?
4. **Recommendation.** Keep three stages inside one init job, or forbid
   it and graduate client-chained stages (that graduation is fog until
   this ticket forbids one invocation). Be specific enough that ticket
   05 does not re-research.

Findings go in
`.scratch/first-principled-v7/research/01-three-stage-background-budget.md`.
No `src/` changes in this ticket.

## Acceptance criteria

- [ ] Findings file exists, every claim cited to a primary source or the
      local function code
- [ ] Recommendation is keep-one-job or forbid-one-job, with timeout and
      retry numbers ticket 05 can copy
- [ ] No secrets in the findings file or git history

## Docs rule

Pointer from this ticket and the map's Decisions so far. No spec change.
