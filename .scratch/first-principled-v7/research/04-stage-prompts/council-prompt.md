# Council brief: three-stage Tree generation

Paste this whole file into another LLM. You are a design council, not an
implementer. Do not write production code, prompts-to-ship, or a rewritten
product spec. Stress-test the generation architecture and argue.

Danny (the human) will read your reply and bring it back to the repo
council. Disagreement is useful. Vague agreement is not.

## What this product is

First-principled is a Tree-only explorer. The learner types a thing in
reality (laptop, photosynthesis, battery, recursion). The system builds a
Reality Map from an LLM's knowledge and renders it as a Tree: crown at the
top, foundations at the bottom, a contiguous trunk. A node is an invitation
to go study that thing, not a nested generated Tree and not a chat topic.

Tutor / Socratic chat is parked. There is no learner-model UI. There is no
user-type (kid vs engineer) in this effort.

Mission, kept in a human doc, not in generator prompts: reduce the
cognitive distance between the learner's mental model and reality. That
sentence has been stripped from map-building prompts because it does not
help the model emit a followable Tree.

## The problem with the current generator

Init is one LLM call (one-shot). That call is asked to do four jobs at
once:

1. Recall what came before the thing.
2. Name the joints that made later understanding possible.
3. Impose a pedagogical Tree (layers, nodes, dependence edges).
4. Emit valid JSON, including a full observation record (who / when /
   EXACT|APPROXIMATE|UNKNOWN) on every node.

The gold laptop spine already looks like a table of contents:

- physics (electricity)
- materials (silicon)
- electronics (transistor, circuit)
- logic (logic gate, bit)
- OS
- apps

The suspicion: the model emits that TOC as a first guess instead of
earning it. Prompts also over-prescribe (mission manifesto, soft layer
cap, Simplified Technical English, honest-history block on every card).
We do not want a more complicated prompt. We want more than one call,
each with one job, each prompt small.

## Locked decisions (do not reopen unless you can kill them)

Argue against these only if you have a concrete failure mode. They are
locked for this effort.

- Destination: ship this builder, not a spec handoff.
- Three LLM calls, same model, serial. Learner sees only the final Tree.
- Chronology is a generation scaffold, not the Tree layout.
- The Tree still draws **Dependence**: node A rests on node B when A
  cannot exist or be understood without B. Not discovery-date order.
- Check is mechanical (JSON shape, contiguity, honest UNKNOWN). No
  fourth LLM critique.
- Observation records live on epiphany nodes only, not on every card.
- No mission sentence in generator prompts. No prescribed layer count.
  No STE requirement.
- One path: delete one-shot and serial-per-layer. No fallback chain.
- Latency of ~a minute (three serial calls) is acceptable.
- Followability bar: Danny scores 0/1 on laptop, battery,
  photosynthesis, recursion. Same rubric. Chronology is not the layout.
- Provider switch is out of this discussion (`LLM_PROVIDER` env).
- No in-app picker, no per-stage model, no nested Trees, no rewriting
  the mission doc.

## Glossary (use these words)

- **Tree**: the product surface. Dependence path, not a timeline.
- **Dependence**: A cannot exist or be understood without B.
- **Chronology**: sequential time chain of what came before. Scaffold.
- **Epiphany**: the shift that made a new period of understanding
  possible from the one before. History lives here.
- **Stage**: one LLM call with one job. Chronology, then epiphanies,
  then arrange.
- **Foundation**: deepest observable layer the thing rests on.
- **Followability**: whether Danny would actually walk this Tree.
- **Rabbit hole**: inspect a node, then go study. Not generate-from-node.

Avoid: "another model" (it is another call), timeline as the product,
user-personalized Trees.

## Architecture under discussion

A funnel, not three independent Trees:

1. **Chronology** - inventory. Short ordered list of periods / regimes
   that had to exist. Not every event. Not the Big Bang. Example grain
   for laptop: charged matter → controlled current → a solid that
   switches → a stored program → a personal machine.
2. **Epiphanies** - joints between those periods. The result that made
   the next regime possible (transistor, not "Shockley had an insight").
   This is where honest history (discoverer / date / observation, or
   UNKNOWN) lives. Arrange may promote a joint to a Tree node or leave
   it as a record on a card.
3. **Arrange** - the only call allowed to think like a teacher. Takes
   periods + joints and emits a dependence Reality Map (layers, nodes,
   edges). May reorder and drop. If it cannot, we shipped a timeline.

Two timelines are tangled in the human's original sketch:

- "All the things that actually came before" = physical ancestry.
- "Epiphanies that caused periods of discovery to emerge" = how humans
  found the joints.

The second call is where those are supposed to meet. Challenge that.

## Open questions (answer all four, then go wider)

Q1. What is chronology a chain of?
- A: Physical ancestry (what had to exist).
- B: Discovery history (what humans found, in order).
- C: Named periods / regimes, not events, mixing A as the spine.
Current lean: C, and short, so call 2 is not drowned.

Q2. What is an epiphany in the data?
- A: A Tree node.
- B: A joint between two periods, with the observation record; arrange
  may promote it to a node.
- C: A sentence on the period.
Current lean: B. Transistor is both a joint and a card. Faraday's field
might stay a record on "controlled current" and never become its own
card.

Q3. May arrange reorder and drop, or must the Tree preserve chronology
as a spanning chain?
Current lean: reorder and drop. Counterexample: electricity can sit
under algorithm even if "algorithm" appeared earlier in a history of
ideas.

Q4. "Best structure for the user" means what, with no learner model?
- A: One walkable spine for a curious adult who opens rabbit holes.
- B: User types (kid vs engineer) in this effort.
Current lean: A. User types are a later map.

## Failure modes to probe

Invent concrete failure cases, not slogans. At least cover:

- Photosynthesis or battery, not only laptop. Does discovery order
  diverge from physical dependence? What does each stage do then?
- Recursion (an idea, not an artifact). What is "what came before"?
- Chronology too long, too short, or too cosmic (stars → carbon →
  laptop).
- Epiphany inflation (every period gets a famous name) vs empty joints.
- Arrange ignoring stages 1-2 and emitting the old TOC anyway.
- Arrange clinging to calendar order and drawing a timeline.
- Stage 1 is wrong; stages 2-3 amplify it. One pass, or a repair loop?
  Locked preference is simple; say if simplicity dies here.
- Intermediate JSON leaking into the UI (it must not).

## What to return

1. Verdict: keep the three-stage funnel, merge stages, split further,
   or reject the approach. One paragraph, then bullets.
2. Your answers to Q1-Q4, with the failure case that would change your
   mind.
3. Proposed JSON grains (not full schemas): what one chronology item
   is, what one epiphany item is, what arrange is allowed to throw away.
4. What you would forbid in the three prompts (the "do not" list).
5. Dissent: the strongest case against your own verdict.

Do not flatten this into "it depends." Pick, then name the cost.
