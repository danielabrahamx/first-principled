# 10 - Session end comparison and transfer question

**Type:** task
**Status:** ready-for-agent (blocked)
**Blocked by:** 08, 09
**Related:** spec sections 8, 9, 10; `src/lib/agent/` and `src/pages/map.tsx`

## Question

How does a session close, prove the learning, and make the mission visible?

## What

1. Transfer question: at the end phase the agent asks a novel problem that
   requires the corrected model (not a restatement of anything practiced).
   The learner answers; the agent records pass or fail against the reality
   map; the result is stored in the session state.
2. Comparison view (session end only): reality map vs learner map side by
   side, closed-gap summary (count of flips from missing or misconception to
   correct), closeness score, transfer result. This is the mission made
   visible: here is reality, here is what your model had, here is what we
   closed.
3. Metrics captured per session: gap closure count, transfer pass or fail,
   closeness score. Recorded client-side in the session store; a future
   analytics surface can read them.
4. Session end state: chat page shows the entry point to the comparison;
   map page renders it.

## Acceptance criteria

- Transfer question fires only at session end and is novel, not practiced.
- Pass or fail is recorded deterministically from the learner's answer.
- Comparison renders both maps, the closed-gap summary, and both metrics.
- No session leaks into the next one.

## Docs rule

Commit and push before done. Update spec sections 8-10 if the flow changes.
