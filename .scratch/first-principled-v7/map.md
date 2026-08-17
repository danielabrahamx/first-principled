# First-Principled v7 - Build Map (MAIN FRONTIER)

**Effort:** Rebuild Tree generation as three simple LLM stages, switch
providers with one env var, and measure followability on that builder.
**Planning source:** wayfinder grilling 2026-08-17 (Cursor). v6 shipped a
Tree-only explorer on one-shot OpenRouter Nemotron `:free`. One-shot
scoring is parked. The generator is the work.

## Destination

A shipped Tree whose Reality Map is built by three stages (chronology,
epiphanies, arrange), checked by the mechanical gate, with a one-var
switch between OpenRouter and DeepSeek. The learner still types a thing
and walks a dependence Tree. Mission stays in `docs/MISSION.md`; it does
not ride on generator prompts. Danny scores followability on the gold
words against this builder.

## Notes

- **This map carries execution.** Tickets are the rewrite, not a spec to
  hand off. One session, one ticket (research excepted).
- Domain: read `docs/MISSION.md` and `CONTEXT.md` before any ticket.
  Glossary adds Chronology, Epiphany, Stage. Tree still draws Dependence.
  Chronology is a scaffold, not the layout.
- Stages: (1) chronology time chain, (2) epiphanies, (3) arrange into a
  dependence Tree. Same model for every stage. Learner sees only the Tree.
  Check is mechanical (JSON, contiguity, honest UNKNOWN on epiphany
  nodes). No fourth LLM critique. No layer-count in prompts. No STE
  requirement. History only on epiphany nodes.
- One path. Delete one-shot and serial. No fallback chain.
- Provider: `LLM_PROVIDER=openrouter|deepseek` fills key, URL, and model.
  Prod stays OpenRouter. Do not point prod at DeepSeek. Key lives only in
  `.env` (gitignored) and Netlify secrets. Never paste keys into chat,
  tickets, or research notes.
- Salvage: Tree chrome, invitation card, background `POST /api/agent` plus
  status poll, `src/lib/agent/llm.js`, `src/lib/mmg/` validator, 
  `eval/map-quality`. Rebuild `generateRealityMap`. Do not touch
  uncommitted v2 engine-thread files (`src/lib/agent/gaps.js`,
  `confidence.js`, parked `eval/concepts.js` and tutor scorers).
- v6 leftovers parked, not scored:
  [Danny scores followability](../first-principled-v6/issues/12-danny-scores-followability.md),
  [One-shot gold maps pass the quality gate](../first-principled-v6/issues/13-one-shot-gold-maps-pass-the-quality-gate.md).
- Skills: grilling + domain-modeling on HITL, including
  [Danny scores followability on the three-stage Tree](issues/07-danny-scores-followability-on-the-three-stage-tree.md)
  and
  [Prototype the three stage prompts](issues/04-prototype-the-three-stage-prompts.md);
  `/research` on
  [Can one background agent finish three serial LLM calls](issues/01-can-one-background-agent-finish-three-serial-llm-calls.md).
  Existing test/tsc/netlify-build discipline. anti-slop on
  [Vendor anti-slop](issues/02-vendor-anti-slop.md).
- Style: single dashes, no emojis. Windows/PowerShell-tested. Docs in the
  same commit as the code they describe.

## Decisions so far

<!-- grilling 2026-08-17, locked before tickets -->

- Destination: shipped three-stage Tree builder, execution map, not a spec
  handoff.
- Chronology is a generation scaffold. The Tree still draws Dependence.
- Mission sentence: strip from generator prompts only. `docs/MISSION.md`
  stays.
- v6 one-shot scoring is parked. Do not finish it as this effort's bar.
- Three LLM stages: chronology, epiphanies, arrange. Learner sees the
  final Tree only. ~a minute of serial latency is acceptable.
- Check is mechanical only. No extra LLM critique call.
- History (observation records) lives on epiphany nodes only.
- `LLM_PROVIDER=openrouter|deepseek`. Same model for every stage. Prod
  stays OpenRouter. No in-app picker.
- Followability bar unchanged: Danny 0/1 on laptop, battery,
  photosynthesis, recursion. Same rubric, new builder.
- Vendor anti-slop on this map as early hygiene.
- Delete one-shot and serial. One path.
- Three stages stay in one background init job. Raise client poll
  `deadlineMs` to 14 min (840000). Do not raise the 240 s per-call abort.
  Never throw after 202. No in-job LLM retries. Do not client-chain.
  [Can one background agent finish three serial LLM calls](issues/01-can-one-background-agent-finish-three-serial-llm-calls.md)

## Not yet specified

- Spine / layout retune if a live three-stage tree still reads as a
  labeled list.
- Grow motion on a branching trunk.
- Layer-band visual.
- Paid OpenRouter slug, only if `:free` cannot serve the three-stage
  builder.
- Whether STE ever returns to generator prompts.

## Out of scope

- Nested generated Trees from a node click.
- New stack (React, bundler, DB).
- v2 engine thread (gap selection, confidence, tutor eval harness,
  prediction).
- Learner Mental Model as a tab, page, or node-panel chrome.
- Discovery timeline as the product surface (chronology is scaffold only).
- In-app provider picker. Per-stage models.
- Extra LLM check stage.
- Rewriting `docs/MISSION.md`.
- Finishing v6 one-shot scoring as the bar for this effort.
- Accounts, auth, persistence, web grounding, agent frameworks.
- Cross-concept linking.
- Deleting the Tutor engine from `src/lib/agent/`.
- Client-chained stages. One background init job is enough.

## Ticket sequence (dependency overview)

```
01 research can one background agent finish three serial LLM calls
02 vendor anti-slop
03 LLM_PROVIDER is a one-var switch
04 prototype the three stage prompts
01 + 03 + 04 -> 05 the generator is three stages and nothing else
05 -> 06 deploy the three-stage Tree
06 -> 07 Danny scores followability on the three-stage Tree
```
