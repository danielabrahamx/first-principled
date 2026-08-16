# STE-style controlled English for learner-facing copy

Decision: ticket 05 (v3), 2026-08-12, HITL with Danny. We adopt the rules of
ASD-STE100 (Simplified Technical English) as described by public training
summaries, with our own small approved word list for this domain. The full
STE100 specification is a licensed standard; we do not use its vocabulary.

## Rule subset (8 rules)

1. One meaning per word - each word has a single fixed meaning (see the
   approved word list).
2. Short sentences - under 20 words.
3. Active voice - the subject does the action.
4. One idea per sentence.
5. No vague words - avoid it, this, that, thing without a clear referent.
6. Consistent terminology - the same word for the same concept; no synonyms.
7. No slang, idioms, or figurative language.
8. Avoid contractions.

## Application boundaries

- Applies to: node descriptions, observation narratives, layer stories,
  error messages, docs.
- Generated content: the tree generation prompt carries the STE constraints
  (rules 1-6). Hand-written copy is edited to STE.
- Microcopy (button labels, node titles, layer names, empty states):
  exempt from the sentence rules, but uses only approved words and follows
  the repo rule (single dashes, no emojis).
- Does NOT apply to: code identifiers, internal module names, commit
  messages, ticket files.
  - A vocabulary check (src/ste-copy.test.js) scans the hand-written UI copy
  (index.html, dock.js, how.js) against the approved list plus the documented
  function-word and UI-chrome allowlists, and fails when new words drift in.
  Scripted demo content and generated narratives are STE-gated by the
  generator prompt and steProblems instead.

## Approved word list

One meaning per word. Additions are made by ticket review only.

### Domain words

| Word | One meaning |
|------|-------------|
| abstraction | an idea that compresses a simpler set of facts |
| basis | the observation an abstraction compresses |
| branch | a path of the tree away from the trunk |
| cause | what makes something happen |
| claim | a statement presented as true |
| concept | an idea or subject of study |
| connection | a link between two nodes |
| discovery | a new fact found by observation |
| effect | what happens because of a cause |
| evidence | a fact that supports a claim |
| example | one case that shows an idea |
| fact | a statement that is true |
| foundation | the first layer of the tree |
| gap | a missing step in the layer chain |
| idea | a thought about how something works |
| knowledge | what is known |
| layer | one stage of the tree, above the layer below it |
| marker | a label that shows a state (for example unknown) |
| node | one idea shown on the tree |
| observation | a fact found by looking at reality |
| reality | the way things are |
| root | the base of the tree |
| sequence | a set of things in order |
| tree | the whole map of layers and nodes |
| trunk | the central line of the tree |
| unknown | not known; no evidence exists |

### Action words

| Word | One meaning |
|------|-------------|
| add | put in |
| ask | put a question |
| avoid | stay away from |
| build | make by putting parts together |
| change | make different |
| check | look at to find a fault |
| choose | pick one |
| compare | look at two things for differences |
| decide | make a choice |
| describe | say what something is like |
| explain | make an idea clear |
| find | discover by looking |
| follow | go after in order |
| give | hand over |
| learn | gain knowledge |
| make | create or produce |
| need | require |
| remove | take away |
| see | look at and notice |
| show | make visible |
| start | begin |
| stop | end |
| test | check against reality |
| think | use the mind |
| use | employ for a purpose |

### Descriptor words

| Word | One meaning |
|------|-------------|
| after | later in time or order |
| always | every time |
| before | earlier in time or order |
| clear | easy to understand |
| different | not the same |
| first | before all others |
| last | after all others |
| next | the one after this |
| real | true, part of reality |
| same | not different |
| short | few words |
| simple | easy to understand |
