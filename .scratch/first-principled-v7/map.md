# First-Principled v7 - Build Map (MAIN FRONTIER)

**Effort:** Rebuild Tree generation as three simple LLM stages, switch
providers with one env var, and measure followability on that builder.
**Planning source:** wayfinder grilling 2026-08-17 (Cursor). v6 shipped a
Tree-only explorer on one-shot OpenRouter Nemotron `:free`. One-shot
scoring is parked. The generator is the work.

## Destination

A shipped, falsifiable three-stage candidate whose Reality Map is built
by Chronology, Epiphanies, and Arrange, checked by the mechanical gate,
with a one-var switch between OpenRouter and DeepSeek. The learner still
types a thing and walks a Dependence Tree. Mission stays in
`docs/MISSION.md`; it does not ride on generator prompts. Danny compares
the candidate with one-shot on the four gold words and records KEEP or
KILL. A killed funnel is replaced, not rescued with prompt machinery.

## Notes

- **This map carries execution.** Tickets are the rewrite, not a spec to
  hand off. One session, one ticket (research excepted).
- Domain: read `docs/MISSION.md` and `CONTEXT.md` before any ticket.
  Glossary adds Chronology, Epiphany, Stage. Tree still draws Dependence.
  Chronology is a scaffold, not the layout.
- Stages: (1) chronology as target-specific capability regimes, (2)
  epiphanies as joints with observation records, (3) arrange into a
  Dependence Tree. Physical ancestry is Chronology's default spine;
  technical and conceptual ancestry are legal. Arrange may reorder,
  drop, collapse, and promote. Same model for every stage. Learner sees
  only the checked Tree.
  Check is mechanical (JSON, contiguity, honest UNKNOWN on epiphany
  nodes, explicit roles, provenance, use-or-drop accounting). It cannot
  prove semantic Dependence or Followability. No fourth LLM critique or
  repair call. No layer-count in prompts. No STE requirement. History
  only on `EPIPHANY` nodes.
- Hidden diagnostics retain Chronology, Epiphanies, provenance, and
  discarded IDs for the benchmark. None enters the learner payload.
- Falsification: if Arrange copies Chronology or disregards it while
  emitting the old table of contents, kill the funnel. The replacement
  candidate is unordered prerequisites, evidence enrichment, then
  Arrange. Do not graduate a prompt-retune or repair-loop rescue.
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
- v6 quality-gate work remains parked. Its persisted one-shot maps are
  comparison controls for the v7 falsification test:
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
- [Prompt architecture verdict](research/04-stage-prompts/round-1-verdict.md):
  Chronology is a short chain of target-specific capability regimes,
  with physical ancestry as its default spine. The Tree still draws
  Dependence.
- Mission sentence: strip from generator prompts only. `docs/MISSION.md`
  stays.
- v6 one-shot scoring is parked. Do not finish it as this effort's bar.
- Three LLM stages: chronology, epiphanies, arrange. Learner sees the
  final Tree only. ~a minute of serial latency is acceptable.
- Check is mechanical only. No extra LLM critique, retry, or repair call.
- History lives only on nodes explicitly marked `EPIPHANY`. Arrange may
  reorder, drop, collapse, and promote while hidden provenance accounts
  for every used and discarded input.
- `LLM_PROVIDER=openrouter|deepseek`. Same model for every stage. Prod
  stays OpenRouter. No in-app picker.
- Followability is one walkable spine for a curious adult who opens
  rabbit holes. Danny compares three-stage with one-shot, 0/1 on laptop,
  battery, photosynthesis, and recursion, then records KEEP or KILL.
- Vendor anti-slop on this map as early hygiene.
- Delete one-shot and serial. One path.
- Three stages stay in one background init job. Raise client poll
  `deadlineMs` to 14 min (840000). Do not raise the 240 s per-call abort.
  Never throw after 202. No in-job LLM retries. Do not client-chain.
  [Can one background agent finish three serial LLM calls](issues/01-can-one-background-agent-finish-three-serial-llm-calls.md)
- [Vendor anti-slop](issues/02-vendor-anti-slop.md) — plugin vendored at `tools/oxlint/anti-slop`; `npm run lint` on Windows PowerShell.

## Not yet specified

- Spine / layout retune only if the generation architecture first passes
  and the remaining defect is demonstrably visual. Do not use layout work
  to rescue Chronology capture or disregard.
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
- Reviving the parked v6 quality-gate effort. Persisted v6 maps are used
  only as the one-shot comparison control for ticket 07.
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
