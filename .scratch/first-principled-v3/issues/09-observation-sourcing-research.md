# 09 - Observation sourcing research

**Type:** research (AFK)
**Question:** how do we get REAL discovery history when the model may not have
the information? Probe DeepSeek's parametric coverage of canonical discovery
facts (discoverer, date, key observation) across representative concepts at
different obscurity levels. Design the fail-honest contract: the model marks
an observation unknown rather than inventing one, and the tree shows the gap.
Recommendation covers whether web grounding is required for the crux to be
REAL (scope decision for Danny - recommendation only, no adoption).
Findings land in `research/` under this effort, linked from here.

**Blocked by:** None - can start immediately.

**Status:** resolved - 2026-08-12

**Findings:**

- [Coverage probe: parametric memory of canonical discovery history](research/09-coverage-probe.md)
- [Fail-honest contract for observation sourcing](research/09-fail-honest-contract.md)

## Answer (recorded 2026-08-12)

Recommendation: web grounding is NOT required for the crux to be REAL
discovery history at this scope. Evidence: 15/15 concepts answered, 40/45
fact fields EXACT, 5/45 APPROXIMATE (all dates), 0/45 UNKNOWN, 1 confident
conflation - coverage held across famous, mid, and obscure tiers. Told to be
honest, the model marks UNKNOWN under pressure (invented-discoverer test)
and documents never-confirmed claims accurately (Vulcan). What IS required:
the fail-honest contract (UNKNOWN marker + visible gap + token headroom and
empty-output retry), because confident errors slip past honesty
instructions and empty completions arrive silently at low token budgets.
Grounding returns only if the corpus escapes canonical territory or gap
density rises. Decision for Danny.

- [ ] Coverage probe run across representative concepts (famous to obscure)
- [ ] Fail-honest contract drafted (unknown marker, never invent)
- [ ] Recommendation: grounding required or not, with evidence
