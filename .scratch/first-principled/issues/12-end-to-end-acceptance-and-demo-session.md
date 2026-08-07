# 12 - End to end acceptance and demo session

**Type:** task
**Status:** resolved (2026-08-07)
**Blocked by:** 11 (resolved)
**Related:** spec sections 8-11; map.md

## Question

Is the v1 actually the thing the mission describes, and can anyone run the
demo?

## Findings

1. End-to-end sessions ran on "laptop" (9 turns, live DeepSeek, all phases)
   and "recursion" (second word, proving it is not a laptop-only demo).
2. Mission alignment pass surfaced a REAL principle violation: a learner who
   asked "can you explain how a keypress becomes a letter?" was told to keep
   observing instead of getting the explanation fallback. The spec (section
   8) makes "when the learner asks" a trigger of the explanation fallback,
   but it was only a prompt instruction, so the model could silently defer.
   FIXED: `explanationRequested(utterance)` + `explainDirective(state)` in
   src/lib/agent/socratic.js turn "when the learner asks" into a code-level
   rule; `validateTurn` now rejects a non-explain probe when the explanation
   is due; the prompt hardens the fallback ("the reply IS the explanation, do
   not end with a new question"). 5 new tests cover the matcher, the gate
   priority, and the directive. 173 tests green, typecheck clean.
3. Live probe of the deployed site also found a raw-API edge (phase
   serialization on malformed requests, "Unknown phase: undefined") - the
   client always sends a valid phase, so this is not user-facing; noted for
   the function's error contract, not blocking.
4. README demo section present (how to run a session, what to look for).
5. Map page no-leak audit passed: zero reality content mid-session in the
   end-to-end run (learner grid only); reality tree appears only at session
   end (see ticket 13).

## Acceptance criteria

- Both sessions complete end to end with all phases. DONE
- Metrics recorded and reported. DONE (closeness trend, gap closures,
  transfer result captured in the run artifacts)
- README demo section present. DONE
- Mission-alignment findings recorded on the ticket; spec updated if a
  principle was violated in practice. DONE (explanation-fallback fix,
  principle 8, in the same commit)

## Docs rule

Commit and push before done. Update the map: this ticket resolving closes the
frontier unless new tickets graduated.
