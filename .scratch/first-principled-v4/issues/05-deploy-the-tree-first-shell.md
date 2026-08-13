# 05 - Deploy the tree-first shell

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Ship the cladogram and one-shot grow into the live Tree](03-ship-cladogram-and-one-shot-grow.md), [Tutor is pull Q&A over the Tree](04-tutor-is-pull-qa-over-the-tree.md)

**Related:** none

## Question

The rewrite is in the working tree. Is the live site the tree-first shell:
one chrome, a visible cladogram at scroll 0, Tutor toggle, briefing Q&A?

## What

Deploy to Netlify prod (`first-principled.netlify.app`) and live-verify.
Windows/PowerShell. Do not ship secrets.

1. `netlify deploy --prod` via the documented CLI path.
2. Live smoke: type a word, wait for the Tree, confirm cladogram (not a
   vertical stack), confirm layers visible without scrolling, confirm no
   Ask/Tree vs Chat/Map/Reality swap, open Tutor, ask one question, get a
   briefing.
3. 375px live check: no header overflow, Tutor toggle usable.

## Acceptance criteria

- [ ] Prod deploy succeeded; unique deploy id recorded on this ticket
- [ ] Live: one chrome, branching Tree visible at scroll 0, Tutor closed
      until toggled, one briefing turn works
- [ ] Key-leak grep clean on tracked files
- [ ] README / AGENTS.md deploy notes still accurate

## Docs rule

If the README still says chat-first or two pages, fix it in this commit.
