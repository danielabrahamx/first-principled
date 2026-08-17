# Round 1 lock - Prototype the three stage prompts

Source: Danny brought the council verdict into the claimed ticket
(2026-08-17). This file is the architecture lock behind the prompt
prototype. The complete prompts, contracts, and worked example live in
`stage-prompts.md`.

## Verdict

Keep the three-stage funnel and ship it as a falsifiable architecture,
not as an article of faith. Use C for Chronology, B for Epiphany, and
let Arrange reorder and drop aggressively. Define Chronology as a short
chain of target-specific capability regimes, with physical ancestry as
its default spine - not discovery history and not every literal
precondition. Human discovery enters only as evidence attached to the
joints.

The cost is real: the first call becomes a lossy prior, so three calls
may produce a more confidently wrong Tree through anchoring and error
amplification. Do not add a repair loop. If the four-topic Danny test
shows that Arrange either copies chronology or ignores it, kill this
funnel rather than rescuing it with more prompt machinery.

- Chronology identifies candidate regimes that made the target possible.
- Epiphanies identify and honestly document the joints between those
  regimes.
- Arrange turns that material into one followable Dependence Tree.
- The learner receives only Stage 3 output.
- The decisive experiment is whether this produces more followable Trees
  than the one-shot generator on laptop, battery, photosynthesis, and
  recursion. JSON validity is not the experiment.

## Q1. Chronology is a chain of what?

**C - named periods or regimes, using physical ancestry as the spine.**

A short, target-relative chain of regimes in which each regime
introduces a capability needed for the next regime and eventually for
the target.

It is not a list of inventions, a sequence of famous discoveries, the
Tree's future trunk, every physical prerequisite, or necessarily the
best teaching order.

Target specificity: include a regime only if it introduces a capability
whose removal would break a reasonably direct account of the target.

Kill Chronology (replace with an unordered prerequisite inventory) if
Stage 1 repeatedly turns natural processes into speculative evolutionary
histories, or abstract ideas into histories of mathematicians and
terminology. Do not patch with a longer prompt.

## Q2. What is an epiphany in the data?

**B - a joint between two periods, with an observation record.**

An Epiphany is a result that warrants the transition, not a person's
private insight, one historical event, a final Tree node, a famous
discovery, or something with an exact discoverer and date.

Invariant: a period card that carries the record must be tagged as
having the EPIPHANY role. Observation records must not leak onto
ordinary cards.

Do not require one epiphany per transition. The data must represent a
supported joint, a distributed or gradual joint, no single historical
joint, and unknown history.

Kill the separate Stage 2 call if Epiphany output becomes decorative
history that Arrange drops. Merge Chronology and Epiphanies into one
ancestry-with-warrants call in that case.

## Q3. May Arrange reorder and drop?

**Yes. Reorder, drop, collapse, and promote.**

Chronology must not be a spanning chain in the final Tree. Arrange may
not use "came earlier" as a Dependence reason.

Arrange must not have unlimited permission to regenerate from scratch.
Require hidden provenance: final domain nodes cite chronology or
epiphany IDs; discarded inputs are listed with a short machine-hidden
reason; grouping-only nodes are marked STRUCTURAL.

If Arrange produces the old TOC while attaching superficial provenance
IDs, kill the chronology scaffold or constrain Arrange's permitted
nodes. Calendar preservation is not an acceptable repair.

## Q4. What does "best structure for the user" mean?

**A - one walkable spine for a curious adult who opens rabbit holes.**

Not personalization. Product-level default. Edge explanations complete
"A rests on B because without B...". No kid-versus-engineer user types
in this effort.

If the adult-default rubric systematically fails photosynthesis or
recursion because "small conceptual jump" depends on unstated prior
knowledge, add an explicit baseline knowledge assumption. That still
does not require user types.

## One pass

One pass per Stage. No repair loop for this effort. Stage 2 may emit
NO_SINGLE_JOINT or UNKNOWN; Stage 3 may drop bad material. That is
abstention and selection, not repair.

## Dissent kept

Dependence is usually a partial order; Chronology forces a chain. The
funnel may self-anchor. Best alternative if the four-topic test fails:
unordered prerequisite inventory, then evidence/epiphany enrichment,
then Arrange.
