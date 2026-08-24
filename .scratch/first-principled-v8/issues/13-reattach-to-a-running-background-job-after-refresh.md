# 13 - Reattach to a running background job after refresh

**Type:** task

**Status:** ready-for-agent

**Blocked by:** [Deploy the Chapel Tree](12-deploy-the-chapel-tree.md)

**Related:** [Grow stage products in place on the Chapel flowchart](11-grow-stage-products-in-place-on-the-chapel-flowchart.md)

## Question

What smallest change lets a learner who refreshes or navigates away
mid-build reattach to the running background job instead of orphaning
it and paying for a second generation?

## What

AFK. Today the jobId lives only inside `callAgent`'s closure
(`src/api/agent.js`). A refresh during the up-to-14-minute build loses
it: the background function keeps burning three LLM calls to nobody,
the learner resubmits, and generation runs twice. Fix on the client:
persist `{ jobId, word }` in `sessionStorage` when the POST returns
202; on page load with no Reality Map and a stored job, resume polling
that job (grow-in-place wait-state included) before offering a fresh
build. Clear the stored job on terminal success or error. No server
change: `GET /api/agent-status?job=` already answers any jobId. A
missing blob still reads as running, so an expired job (30 min TTL)
degrades to a normal rebuild offer after the poll deadline. No SSE.
No prod deploy in this ticket.

## Acceptance criteria

- [ ] Refresh mid-build resumes the same job and the wait-state returns
- [ ] Terminal success clears the stored job and shows the Tree
- [ ] Terminal error clears it and shows the error, not a rebuild loop
- [ ] Expired / missing blob degrades to the deadline path, no crash
- [ ] Windows/PowerShell-tested
- [ ] Map Decisions so far points at this ticket

## Docs rule

Spec section 8 init paragraph gets one line about client-side job
reattach. Same commit as the code.
