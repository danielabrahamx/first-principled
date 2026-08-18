# Design Council Review: Reality Map Inference Architecture

Pasted 2026-08-18 by Danny for
[Lock the thinking architecture from the council](../issues/09-lock-the-thinking-architecture-from-the-council.md).
Live DeepSeek numbers stay in [08-mixed-thinking.md](08-mixed-thinking.md).
This file is the council essay. The ticket holds the lock.

## Bottleneck

The bottleneck is **not** Netlify. You already proved that: two live stages ran in ~16s under thinking-off, and 75s of hidden thinking on a single stage still returned inside your 240s abort. The 14-minute poll is theater; kill that hypothesis.

The actual bottleneck is a **contract mismatch between DeepSeek's two output surfaces and your one-shot schema expectation on the Epiphanies stage.** Specifically:

- **Thinking ON**: the model is doing the joint-finding work in `reasoning_content` (28k–37k chars) and never re-emits it as a structured `content` payload. Your empty-content fallback saves Chronology because Chronology is easy enough that the model treats reasoning as scratch and re-serializes to content. On Epiphanies (the mixed run), content was populated with 784 chars of non-array prose — so your copy-reasoning-to-content fallback correctly did *not* fire, and you were left with the model's *summary* of its thinking rather than the JSON.
- **Thinking OFF**: fast (~1s ping, ~16s live), parses as JSON, but violates the field discipline for joints (`joint_kind: TECHNICAL`, missing history, regime names in place of `c1`/`c2`). This is not a reasoning deficit — it is a schema/enum enforcement deficit. The model was never *told* in a machine-checkable way that `joint_kind ∈ {…}` and that `c1`/`c2` must be ids from Chronology.

So the diagnosis is two-part:
1. **Epiphanies with thinking OFF fails constraints** → this is a JSON-mode / structured-output problem, not an intelligence problem.
2. **Epiphanies with thinking ON returns prose** → this is a "hidden CoT with no explicit emit step" problem. DeepSeek's `reasoning_content` channel is not designed to also be the JSON delivery vehicle when content is non-empty.

Your Chronology stage is a red herring for speed diagnosis: 5s with thinking is fine. The 75s cost on Epiphanies is real cognitive work you probably want. The failure is that you paid for it and got prose back.

## Three Cited Analogues

**1. OpenAI's "reasoning then structured output" pattern (o1 / o3 API).**
OpenAI explicitly documented that o1-family models do reasoning in a hidden channel and that `response_format: json_schema` is the way to force a schema-conformant emit *after* the reasoning tokens. The reasoning tokens are billed but not returned as content; the content channel is where the schema is enforced. See OpenAI's [Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) and the [reasoning models guide](https://platform.openai.com/docs/guides/reasoning). The relevant design choice: reasoning and emit are the same call, but the schema is a *hard constraint on the emit surface*, not a soft instruction in the prompt. Your DeepSeek pipeline is doing the reasoning half of this without the constrained-emit half.

**2. ReAct / Toolformer-style "think, then act" separation.**
Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models (2022)](https://arxiv.org/abs/2210.03629) explicitly split a free-form Thought turn from a schema-bound Action turn in the *same* model. The Action turn is short, typed, and validated; the Thought turn is prose and never parsed. LangChain's structured-tool interface and Anthropic's [tool use with Claude](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) inherit this. The lesson for you: when you want reasoning *and* structure in one call, you commit the model to a two-region output where only the second region is parsed. You are currently trying to parse the whole thing.

**3. Guidance / Outlines / llama.cpp grammar-constrained decoding.**
[Outlines](https://github.com/dottxt-ai/outlines) and Microsoft's [Guidance](https://github.com/guidance-ai/guidance) constrain decoding to a Pydantic/JSON schema *at the token level* — the model cannot emit `joint_kind: "TECHNICAL"` if `TECHNICAL` isn't in the enum, because the sampler masks those tokens. Willard & Louf, [Efficient Guided Generation for Large Language Models (2023)](https://arxiv.org/abs/2307.09702). This is the industrial answer to "the field checklist failed." It also makes thinking-off runs materially faster because the model spends fewer tokens hedging. DeepSeek's OpenAI-compatible endpoint supports `response_format: {type: "json_object"}` and, on newer builds, JSON schema; OpenRouter passes structured outputs through to compatible providers (see [OpenRouter structured outputs](https://openrouter.ai/docs/features/structured-outputs)).

Honorable mention: **process supervision** (Lightman et al., [Let's Verify Step by Step (2023)](https://arxiv.org/abs/2305.20050)) is the wrong analogue for you — it's about training-time reward, not inference-time shape. Do not chase it.

## Three Ranked Options

### Option A — Thinking OFF everywhere + JSON Schema constrained decoding on Epiphanies (RECOMMENDED)

Treat the joints failure as what it is: a contract bug. Ship the enum, the `c1`/`c2` id references, and the `history` object as a JSON Schema on the Epiphanies call. Keep thinking off. Keep Chronology and Arrange as they are.

- **Expected latency**: 3 calls, ~20–30s total on battery-class inputs. Faster than today.
- **Failure mode**: the model produces schema-valid but *shallow* joints — the enum is satisfied but the causal claim inside `history.who`/`when` is weak or generic. This is the honest failure and it's the one you should want, because it's caught by the human 0/1 followability score, not by a silent shape error. It's also the failure mode you can iterate on without touching architecture.
- **Why it wins**: the DeepSeek-OFF Epiphanies run *parsed*. The content was there. The only thing missing was constraint. You are one schema away.

### Option B — Thinking ON on Epiphanies only, with an explicit two-region emit contract in the same call

Keep thinking on for Epiphanies (you clearly need it — 75s of reasoning content on joint-finding is not wasted). Change the prompt contract so the model must terminate its content with a fenced JSON block, and parse only that block. This mirrors ReAct's Thought/Action split inside a single completion. Combine with `response_format: json_object` where the provider supports it after a thinking block (OpenRouter's docs are explicit that not all providers do; DeepSeek's thinking mode + JSON mode compatibility is [documented as partial](https://api-docs.deepseek.com/guides/reasoning_model) — reasoning models do not support `response_format` or function calling in the same call on the official DeepSeek API as of the current docs).

- **Expected latency**: ~75–100s for Epiphanies alone, ~90–120s total. Slower than A. Within your "about a minute" budget only marginally.
- **Failure mode**: on DeepSeek specifically, `deepseek-reasoner` refuses `response_format`, so you fall back to prompt-level contract, which is exactly the situation that gave you 784 chars of non-array prose. You would be trusting the model to self-discipline. That trust is what failed you.
- **Why it's second**: correct in spirit, blocked by DeepSeek's current API surface. On OpenAI o-series or Anthropic extended thinking with tool use, this is the right answer. On DeepSeek, it's aspirational.

### Option C — Thinking OFF + one-shot with few-shot exemplars pinning the joints contract

No schema library, no thinking. Just three fully-worked joint examples in the Epiphanies prompt, each showing the enum values, the `c1`/`c2` id form, and an UNKNOWN provenance. Rely on in-context imitation.

- **Expected latency**: ~20s total, same as A, possibly less because no schema-constrained sampling overhead.
- **Failure mode**: exemplar leakage — the model produces joints that rhyme with your examples instead of the target concept. You said no prompt rewrite as the first move; adding three fat exemplars *is* a prompt rewrite, and it bloats every call. Also, in-context enforcement of enums is empirically ~90% reliable, not 100%, which means you re-introduce a repair-loop temptation you correctly banned.
- **Why it's third**: it works often enough to be tempting and fails often enough to make you distrust the pipeline. That's the worst combination.

## Recommendation

**Ship Option A.** Thinking off, JSON Schema on Epiphanies (enum for `joint_kind`, referential integrity for `c1`/`c2` against Chronology ids, required `history.observation ∈ {EXACT, APPROXIMATE, UNKNOWN}`). If DeepSeek's local endpoint doesn't honor full JSON schema, use `json_object` mode plus a client-side validator that rejects and *does not retry* — surface the invalid output to the eval log and let the human 0/1 followability score be the arbiter of whether the joints are actually good.

The uncomfortable part, and the reason the council exists: **your Epiphanies-with-thinking runs almost certainly produce better joints than Option A will.** The 34818 chars of hidden reasoning were doing something. You are choosing schema-fidelity and speed over cognitive depth. That is a legitimate design choice for a system whose contract is "a node is an invitation to go study" — a shallow-but-valid joint is a study invitation; a deep-but-unparseable joint is nothing. But own the tradeoff. Don't tell yourself you're getting the reasoning-mode joints for free at thinking-off speeds. You aren't.

## What Not To Do

- **Do not raise timeouts.** You've established the ceiling isn't the host.
- **Do not add a fourth call** (critic, repair, verifier). You banned it, correctly. A schema is a critic that costs zero tokens.
- **Do not per-stage swap models.** The moment Chronology and Epiphanies run on different models, `c1`/`c2` referential integrity becomes a cross-model coordination problem and you'll spend a week on it.
- **Do not bloat the prompt with exemplars** as the first move. Schema first, exemplars only if schema-valid outputs are consistently shallow.
- **Do not "just parse `reasoning_content`"** on thinking-on runs. It is not stable output. DeepSeek's own docs mark it as non-contract. Building on it is building on sand.
- **Do not conflate Chronology and Arrange.** They passed. Leave them.

The adult answer is Option A. The interesting answer is Option B in 12 months when DeepSeek (or whoever) ships thinking + structured outputs in the same call. Design for A now; leave a seam for B.
