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
  [Ship JSON Schema on Epiphanies](issues/10-ship-json-schema-on-epiphanies.md)
  is resolved. Next:
  [11 - Deterministic Arrange over a shuffled inventory](issues/11-deterministic-arrange-over-a-shuffled-inventory.md)
  (falsification verdict 2026-08-20, research 11-14; 07's KEEP/KILL walk
  is superseded - the funnel was killed by its own rule before a walk).
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
  tickets, or research notes. JSON maps send `thinking: false`. OpenRouter
  maps that to `reasoning: { effort: "none" }`. DeepSeek maps that to
  `thinking: { type: "disabled" }`. `thinkingByStage` can turn one stage
  on; DeepSeek Epiphanies-on was tried and failed. Epiphanies sends JSON
  Schema, thinking still off. OpenRouter prod uses paid Nemotron because
  `:free` cannot constrain that call. Do not raise host timeouts
  to fix joints. Do not parse `reasoning_content` as the JSON contract.
  Do not send OpenRouter `reasoning` on the DeepSeek path.
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
  (HITL; schema ship has landed, do not score in a schema-ship session)
  and
  [Lock the thinking architecture from the council](issues/09-lock-the-thinking-architecture-from-the-council.md)
  (resolved: Option A; council essay in
  [09-thinking-architecture-council.md](research/09-thinking-architecture-council.md));
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
- [Vendor anti-slop](issues/02-vendor-anti-slop.md) - plugin vendored at `tools/oxlint/anti-slop`; `npm run lint` on Windows PowerShell.
- [Prototype the three stage prompts](issues/04-prototype-the-three-stage-prompts.md) - Danny locked `research/04-stage-prompts/stage-prompts.md` as the ticket 05 input. Iterate after KEEP/KILL, not before.
- [LLM_PROVIDER is a one-var switch](issues/03-llm-provider-is-a-one-var-switch.md) - `LLM_PROVIDER=openrouter|deepseek` selects the live triple in `llm.js`. OpenRouter headers and `reasoning` stay OpenRouter-only. DeepSeek JSON maps send `thinking: { type: "disabled" }`. Prod stays OpenRouter. Record: [06-thinking-off.md](research/06-thinking-off.md).
- [The generator is three stages and nothing else](issues/05-the-generator-is-three-stages-and-nothing-else.md) - init now runs the locked Chronology, Epiphanies, and Arrange prompts exactly once, gates the role-marked Tree and hidden provenance mechanically, and returns only the checked map.
- [Deploy the three-stage Tree](issues/06-deploy-the-three-stage-tree.md) - prod deploy `6a83a3dd6082d925b8c3d127` is OpenRouter `:free`. Chrome 12/12. Live gold words returned `invalid_model_output` with no learner leaks. Diagnostics stay capturable off `/api/agent`.
- [DeepSeek thinks only on Epiphanies](issues/08-deepseek-thinks-only-on-epiphanies.md) - mixed thinking does not get a DeepSeek Tree. Chronology off is fine (~5 s). Epiphanies on spent 75 s, wrote 34k chars of hidden thinking, and left 784 chars of content that was not an `epiphanies` array. Default stays thinking off. Per-stage override remains. Record: [08-mixed-thinking.md](research/08-mixed-thinking.md).
- [Lock the thinking architecture from the council](issues/09-lock-the-thinking-architecture-from-the-council.md) - Option A: thinking off, JSON Schema on Epiphanies. Rejected B (thinking-on two-region emit) and C (few-shot exemplars). Netlify timeout is not the fix. Record: [09-thinking-architecture-council.md](research/09-thinking-architecture-council.md).
- [Ship JSON Schema on Epiphanies](issues/10-ship-json-schema-on-epiphanies.md) - thinking-off JSON Schema on Epiphanies returns joints that pass the field checklist so Arrange can run, on OpenRouter paid Nemotron. DeepSeek rejects `json_schema`. `:free` cannot constrain. Schema is the strict subset; certainty rules stay in `epiphaniesProblems`. Prod deploy `6a8429c0f3fea97f620a6800`. Record: [10-json-schema-epiphanies.md](research/10-json-schema-epiphanies.md).
- [Danny scores followability on the three-stage Tree](issues/07-danny-scores-followability-on-the-three-stage-tree.md) - 2026-08-18 capture on paid Nemotron: all four gold words failed the mechanical gate (laptop / battery / recursion Arrange schema; photosynthesis Epiphanies UNKNOWN contract). Arrange diagnoses are three `CHRONOLOGY_CAPTURE` and one `CHRONOLOGY_DISREGARD`. Learner maps are empty. Gate-fail rows are four 0s. KEEP/KILL not recorded. Do not recapture. Record: [07-danny-followability.md](research/07-danny-followability.md).
- [FALSIFICATION 2026-08-20] The funnel is falsified by its own rule (map:47): Arrange preserved Chronology as a flat list on 3/4 gold words and disregarded it on the fourth. KILL recorded; no prompt retune, no repair loop. Research agents (11 forensics, 12 provider matrix, 13 prior art) converged: the model must never emit the global arrangement. Replacement candidate graduates as [11 - Deterministic Arrange over a shuffled inventory](issues/11-deterministic-arrange-over-a-shuffled-inventory.md) - stage 3 emits an edge-set over a shuffled inventory, code arranges (topo sort, cycle-break, longest-path layering). Synthesis: [14-synthesis.md](research/14-synthesis.md).

## Open frontier

- [11 - Deterministic Arrange over a shuffled inventory](issues/11-deterministic-arrange-over-a-shuffled-inventory.md) - replacement candidate after falsification: stage 3 emits an edge-set over a shuffled inventory, code arranges deterministically; six free tests first, then one live Epiphanies probe, then the four gold words (2026-08-20). Free work done 2026-08-20: listness checker, Arrange JSON Schema, prompt assertions, deterministic Arrange (gate-pass on captured gold-word stages), v6-control revalidation. Remaining: live probe + live gold run + Danny's walk.

## Not yet specified

- Spine / layout retune only if the generation architecture first passes
  and the remaining defect is demonstrably visual. Do not use layout work
  to rescue Chronology capture or disregard.
- Grow motion on a branching trunk.
- Layer-band visual.
- Whether STE ever returns to generator prompts.
- Exemplars on Epiphanies only if schema-valid joints are consistently
  shallow after
  [Ship JSON Schema on Epiphanies](issues/10-ship-json-schema-on-epiphanies.md).

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
- Raising host timeouts to fix joints. The 14 min poll is not the
  bottleneck.
- Parsing `reasoning_content` as the JSON contract.
- Option B (thinking on plus a two-region emit) until a provider ships
  thinking and structured outputs in the same call. Leave `thinkingByStage`
  as a seam; do not build it now.
- Few-shot exemplars as the first joints fix (Option C). Schema first.

## Ticket sequence (dependency overview)

```
01 research can one background agent finish three serial LLM calls
02 vendor anti-slop
03 LLM_PROVIDER is a one-var switch
04 prototype the three stage prompts
01 + 03 + 04 -> 05 the generator is three stages and nothing else
05 -> 06 deploy the three-stage Tree
03 -> 08 DeepSeek thinks only on Epiphanies
08 -> 09 lock the thinking architecture from the council
09 -> 10 ship JSON Schema on Epiphanies
06 + 10 -> 07 Danny scores followability on the three-stage Tree
```
