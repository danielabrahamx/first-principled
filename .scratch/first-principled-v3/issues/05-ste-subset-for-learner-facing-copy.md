# 05 - STE subset for learner-facing copy

**Type:** grilling (HITL)
**Question:** which ASD-STE100 rules and what small approved vocabulary do we
adopt? The full spec is a licensed standard with a maintenance-flavored
vocabulary; we take the rules (one meaning per word, short active-voice
sentences, no vague words) and build our own approved word list for this
domain. Decide where it applies (node descriptions, observation narratives,
layer stories, error messages, docs) and where it does not (code identifiers).

**Blocked by:** None - can start immediately.

**Status:** resolved (hermes session, 2026-08-12 - grilling with Danny in
chat; Danny is the verifier, approved all four picks)

**Answer:** Adopt 8 STE100 rules (one meaning per word; short sentences under
20 words; active voice; one idea per sentence; no vague words; consistent
terminology; no slang or idioms; no contractions). Own approved word list
(~60 words) drafted in docs/ste.md. Applies to node descriptions, observation
narratives, layer stories, error messages, docs - generated content via the
generation prompt, hand-written copy edited to STE. Microcopy (labels, node
titles, layer names, empty states) exempt from sentence rules but uses only
approved words. Never applied to code identifiers. New words added by ticket
review only.

- [ ] STE rule subset adopted and written down
- [ ] Approved word list drafted for the concept-tree domain
- [ ] Application boundaries decided (learner-facing text yes, code no)
