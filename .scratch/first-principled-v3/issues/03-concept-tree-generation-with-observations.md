# 03 - Concept tree generation with observations

**Type:** task (AFK)
**What to build:** the generator produces, for every layer, the observations
and discoveries that made that layer possible - foundation-first, every
abstraction tracing to observations strictly below (the `deriveCheck` rule
holds), the `basis` field populated for every node, and all observation
narratives written to the approved STE subset. Extends the v2 foundation-first
generator (v2 06).

**Blocked by:** 02 - Observations content model: the crux

**Status:** ready-for-agent

- [ ] Every layer carries the observations that enabled it
- [ ] deriveCheck still rejects any abstraction without a lower observation
- [ ] All narratives STE-clean per ticket 05's subset
- [ ] Live reliability measured (same bar as v1 ticket 04)
