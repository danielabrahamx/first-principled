# 16 - Briefing mode: the tutor delivers information for decisions

**Type:** task
**Status:** claimed (opencode, 2026-08-08)
**Blocked by:** none
**Related:** tickets 05, 08, 12; spec sections 8, 9; src/lib/agent/socratic.js;
docs/MISSION.md

## Question

Danny's product observation (2026-08-08): "I like the tutor mode, but most
people would expect to receive information to model their decisions." The
current engine is pure Socratic with a narrow explanation fallback (learner
asks, or two failed attempts on the same point). There is no path where the
tutor simply delivers decision-ready information. What does a briefing mode
look like, and how does it coexist with the Socratic mission?

## What

1. A briefing capability: when the learner asks for information directly
   ("just tell me about X", "how do I decide between A and B", "brief me on
   the power path"), the tutor delivers a direct, accurate, plain-language
   answer built from the reality map - no Socratic detour, no new question
   at the end.
2. Keep the mission intact: briefing is a learner-initiated mode (an
   explicit request, or a directive from the engine), not the default. The
   default stays Socratic; the briefing fires when the learner asks for
   information to make a decision.
3. The briefing must still update the learner map: when the tutor states
   reality directly, nodes the learner then demonstrates they know become
   correct - do not leave the learner map frozen while the tutor lectures.
4. New probe kind or explicit directive in buildDirective:
   "brief" - distinct from the existing "explain" fallback (which is
   single-concept, triggered by failure); briefing is multi-concept,
   decision-oriented, learner-initiated.
5. Spec section 8 turn contract: add the briefing directive + probe kind.
6. Tests: socratic.js directive tests for the briefing path; validateTurn
   tests; an end-to-end chat test where the learner asks "just tell me" and
   receives a direct answer with probe.kind = brief.

## Acceptance criteria

1. Learner asks for direct information (e.g. "just explain the whole power
   path to me") mid-session: the tutor answers directly and completely, in
   plain first-principles language, and does not end with a new Socratic
   question.
2. The learner map is updated from the briefing (nodes stated become
   correct/known where the learner confirms them); gap closures still
   accumulate.
3. Default turns remain Socratic: no briefing without an explicit request
   or directive.
4. The briefing never leaks anything the reality map does not contain, and
   quotes the map's content accurately (this is the one mode where quoting
   reality is allowed - document that).
5. All tests pass (`npm test`), `npm run typecheck` clean, `netlify build`
   completes, live deploy verified.

## Docs rule

Spec sections 8 and 9 updated in the SAME commit as the code. If the
briefing mode requires amending principle 6 in docs/MISSION.md, stop and
ask Danny first - the mission is immutable.

## Human gate

None for the implementation; the mission stays intact because briefing is
learner-initiated. If the agent judges a mission amendment is required, it
must stop and ask Danny.
