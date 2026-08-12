# 02 - Rebuild the Socratic prompt: move taxonomy, gap report, few-shots

**Type:** grilling
**Status:** resolved 2026-08-10 (Buffy)
**Blocked by:** 01 (gap report shape), 03 (CoT policy), 04 (prediction move),
05 (confidence semantics), 07 (quality bar)
**Related:** tickets 01, 03, 04, 05, 07; v1 tickets 05, 08, 16;
src/lib/agent/socratic.js; src/lib/agent/orchestrator.js;
docs/MISSION.md

## Question

The audit (2026-08-10) found the Socratic system prompt is a 12-rule wall,
the user prompt dumps both full maps every turn (a major latency and drift
source - measured 8.5-14.3s per turn), the question strategy is a single
line, and confidence is unanchored. What is the minimal system + user prompt
that makes the model a genuinely good first-principles Socratic tutor, and
what does the turn contract become when the server sends a compact gap
report instead of both maps?

## What

1. A move taxonomy the tutor can make, each with a trigger and a reply shape:
   observe (empty model, principle 1), probe (gap-first, from 01), predict
   (principle 2 - from 04), confront (a stated misconception colliding with
   an observation), explain (fallback, from v1), brief (learner-initiated,
   from v1 ticket 16), converse (asides).
2. Shorten the 12 rules to the few that the model must hold; move the rest
   into code (01) or into the directive (already in buildDirective).
3. A prediction-oriented pedagogy block: questions that force the learner to
   commit to what they think would happen, so the answer is testable
   (principle 2).
4. Confidence semantics from 05 in the prompt.
5. CoT policy from 03: whether/how the model's own reasoning may drive the
   learner-map update privately (never shown to the learner).
6. Few-shot exemplars (1-2 model turns) in the system prompt.
7. The user prompt sends the gap report (01), learner evidence, and this
   turn's directive - never both maps.

## Acceptance criteria

1. Measurable improvement over the v1 prompt on ticket 07's quality bar
   (question quality, gap targeting, map update fidelity, transfer grading).
2. All existing tests still pass or are updated deliberately; `npm test`
   green, `npm run typecheck` clean.
3. The no-leak-in-chat rule is preserved: the tutor never quotes the reality
   map unprompted (briefing is the only exception).
4. Per-turn latency not worse than v1 (30s app budget, target under 15s).
5. Live-verified: one full session showing the taxonomy in action.

## Docs rule

Spec sections 8 and 9 updated in the same commit as the code. If the rebuild
requires amending a mission principle in docs/MISSION.md, stop and ask Danny.

## Human gate

Grilling session with Danny on the taxonomy and pedagogy before implementation
is accepted as final - this is the heart of the "the system prompt is bogus"
complaint.

## Resolution (2026-08-10)

The taxonomy is now the spine of the system prompt. Seven moves, each with a
trigger and a reply shape: observe (empty model), probe (gap-first, from 01),
predict (principle 2, from 04), CONFRONT (NEW - a stated misconception that
collides with the learner's own correct foundation: "you said X, but you also
said Y - how do both hold?"), explain (fallback), brief (sanctioned quoting
mode), converse (asides). The 12-rule wall collapsed to 5 standing rules
directly under the moves list; confidence semantics (05) and a few-shot
probe exemplar are in the prompt; a CoT privacy line states the model's
reasoning drives the update privately and is never shown.

Confront is real code, not just prompt text: `nextGaps` gained a confront
mode (misconception + stated belief + correct foundation in a strictly
lower layer, in the lowest affected layer), the directive branches to it,
probe.kind accepts "confront", and validateTurn enforces the commitment
the same way as predict (correct or misconception + evidence). Precedence
within the lowest layer: confront > predict > gap.

Judged on ticket 07's bar: eval invariants 0, gap targeting 9/9, rubric
1.00, fidelity 1.00, probe prompts 2,572 chars avg (still -56% vs the 5,795
baseline; the small rise from 2,412 is the richer reply-shape example).
266/266 tests, tsc clean. Live verification and Danny's taxonomy grilling
remain pending (human gate).
