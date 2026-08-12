# 07 - Eval harness: baseline scores

Recorded by `node eval/run.js --baseline` on 2026-08-10.
Engine fingerprint: git 00828d5 (working tree dirty); two-phase generator: no (v1).

All deterministic dimensions are scored offline with a scripted (compliant) transport.
LLM-judged dimensions - subjective question quality and transfer grading - are marked
pending live: the .env key returns 402 Insufficient Balance (research/03). Re-run live
after a top-up: `node eval/run.js --live`.

```
Concept set: laptop, recursion, photosynthesis, battery
Generator: one-shot (v1)

concept fixture valid              yes
session invariants (errors)        0
gap targeting (dependency order)   9/9
question rubric avg                1.00
evidence fidelity                  1.00
probe prompt chars (avg)           5795
probe prompt chars (max)           6319
llm calls per session              13
transfer graded                    pending live (scripted pass; real grading needs a live key)
```

Notes:
- Gap targeting is scored against the dependency-order reference (lowest layer first,
  misconception > missing > untested). The script is written to that order, so a high
  score means the session follows it. Ticket 01 moves this rule into deterministic
  code (nextGaps, unit-tested in gaps.test.js) and shrinks the probe prompt from a full
  map dump to a gap report - the prompt-chars row measures that reduction.
- A v1 engine that dumps both full maps scores ~$promptAvg+ chars per probe prompt; the
  post-01 gap report should cut it substantially.