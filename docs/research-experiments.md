# Research-informed experiment plans

Status: **proposed, conditional, not executed**. The [22-paper review and dispositions (#174)](https://github.com/hackelia-micrantha/amaryllis/issues/174) are complete. This document converts the findings into bounded comparison protocols, not an additional work queue or a claim of implemented capabilities. Existing issues own scheduling, detailed acceptance, evidence and implementation. [Architecture](architecture.md) and the [predictive intelligence RFC](predictive-intelligence-rfc.md) define the design context; this plan cannot override their trust boundaries or existing release gates.

## Admission and sequence

Finish #88 correctness/security/release hardening before speculative runtime expansion. Prioritize existing deterministic test work (#94), ContextPolicy evidence (#92), the deterministic personalization baseline (#131) and Verify (#116/#117). Run comparisons only when their owner identifies a concrete decision that existing evidence cannot answer.

As of the reviewed source revision, `0f751340b712f20e264c99829adfe9dbcf8b2d1d` (2026-11-28), PR #172 has merged the proposed predictive RFC, not a predictor. PR #180 proposes the audience baseline documentation; #122 is open for the Verify runner; #159 is an open optional Android pilot. #151 merged the ContextPolicy migration, but its example explicitly rejects unsupported byte/eviction policies, and successful maxBytes enforcement evidence remains open. PR #182 has merged a #94 slice; do not infer that the entire test pyramid is complete. Refresh these states at admission; this paragraph is historical evidence, not a live status ledger.

| Plan | Decision | Existing owner | Admission condition |
| --- | --- | --- | --- |
| E1 | Does a smaller generation contract improve useful outputs? | [#125](https://github.com/hackelia-micrantha/amaryllis/issues/125), [#127](https://github.com/hackelia-micrantha/amaryllis/issues/127), [#94](https://github.com/hackelia-micrantha/amaryllis/issues/94) | Concrete generation-quality or repair-cost gap |
| E2 | Is compact local inference worth its cost? | [#117](https://github.com/hackelia-micrantha/amaryllis/issues/117) | Common runner and physical adapter admitted; supported licensed model already available |
| E3 | Do decision models improve on rules? | [#170](https://github.com/hackelia-micrantha/amaryllis/issues/170), [#131](https://github.com/hackelia-micrantha/amaryllis/issues/131) | Implemented, verified deterministic baseline |
| E4 | Does latent prediction improve sequential task utility? | [#171](https://github.com/hackelia-micrantha/amaryllis/issues/171) | E3 leaves a material sequential problem; simple transition baseline insufficient |
| E5 | Does adaptive retrieval improve bounded context? | [#92](https://github.com/hackelia-micrantha/amaryllis/issues/92) | Retention guarantees qualified for the chosen adapter and measured retrieval gap |
| E6 | Does governed adaptation preserve user intent and state? | [#131](https://github.com/hackelia-micrantha/amaryllis/issues/131), #94 | Existing demo/contract implementation; test with no model first |
| E7 | Does exploratory automation add unique test value? | [#158](https://github.com/hackelia-micrantha/amaryllis/issues/158), #94 | Existing native pilot qualified, concrete coverage/maintenance gap |

## Common experiment contract

Before any comparative run, the owning issue records the decision, exact baseline and candidate identity, independent task oracle, allowed inputs/actions, frozen fixture version and split, resource ceilings and a quantitative meaningful-improvement threshold with allowable regression. Use synthetic, non-sensitive data; no real visitor profiling, network fallback, new model downloads or training infrastructure. Separate tuning/calibration from an untouched final set, split by scenario family to avoid leakage, and tune simple baselines fairly. All attempts count; failures, abstentions, timeouts, cancellations, unsupported and unexercised cases are distinct, not silently removed from the denominator.

For every applicable invariant, require zero observed unauthorized effects and no regression in mandatory deterministic contract assertions. Exercise an allowed positive case, a denied case and a deliberately false expectation; verify independent observable state rather than trusting model confidence, schema conformance, a screenshot or a self-generated assertion. Zero observed violations in a bounded sample is not proof of universal safety. If a threshold, collector, oracle or admitted resource is unavailable, defer or mark the comparison indeterminate. Do not retrofit the threshold after viewing final results.

For comparative research, the numerical values below are **proposed pilot limits**, not product SLOs or accepted release gates. Owners may refine them before freezing the evaluation; use existing stricter constraints. Prefer the existing Jest/fast-check, native test, Verify and example surfaces. Do not build another harness or mandatory CI job. Keep logs data-minimized: identifiers/digests, sanitized outcome categories, counts, timing and numeric samples; no raw prompts, private context, credentials or global persistent device identifiers. Preserve fixture identity, seeds, action order, run configuration, limitations and exact app/model/device/runtime identity as applicable. Record adopt/defer/reject and cost; no automatic promotion from a passing experiment.

## E1 — structured candidate quality and mediation

**Question.** Can a smaller model-facing payload improve semantic usefulness or reduce repair cost without weakening canonical validation?

- Baseline: existing generation contract and bounded repair. Candidate: one minimal payload for the same task, deterministically normalized into the same ComponentSpec/IR. Do not alter authoritative schema, permitted variants, dependency policy, registry identity or runtime effect authorization.
- Fixtures: one existing component task; use held-out families containing required/optional fields, escaped text, nested data, invalid or unknown paths, conflicting constraints, and schema-valid but semantically denied capability-bearing values. Positive oracle: exact expected normalized semantic result. Negative oracle: rejected candidate, correct base fallback, no forbidden effect. Use actual validators and a controlled inference seam for deterministic adversarial cases; this is not a model-quality measurement.
- If model comparison is justified, match admitted model/inputs, context/output/deadline and repair cap, and freeze semantic expectations before running. Score structural validity and semantic task success over all attempts separately; record policy rejection, repair count and end-to-end latency.
- Proposed decision rule: no contract regression; require either at least 5 percentage points improvement in paired semantic success or at least 20% lower median task latency at non-inferior semantic success (owner freezes sample size and uncertainty rule). Otherwise keep baseline. Do not introduce a constrained decoder or schema-RL training.

Evidence: [JSONSchemaBench](https://arxiv.org/abs/2501.10868v3), [Schema RL](https://aclanthology.org/2025.acl-long.243/), [Hidden Cost of Structure](https://aclanthology.org/2025.ranlp-1.124/), [indirect prompt injection](https://arxiv.org/abs/2302.12173v2). See #174 A01/A04/A12/A13.

## E2 — local inference economics

Reuse the existing #117 Mobile AI Factory/MELT protocol, not a parallel benchmark. Compare one already supported artifact/backend with at most one admitted alternative after a concrete quality/resource gap. One available physical Android device first; qualify iOS separately through its admitted adapter. Freeze artifact SHA-256, provenance, format/quantization, model configuration, runtime, device/OS/backend and collector semantics. Use a single synthetic structured extraction task with an exact deterministic result and invalid/abstention controls; distinguish selection from held-out evaluation.

Reuse five clean initializations and five bounded warm requests per eligible configuration; record actual context/output tokens, initialization, TTFT and decode throughput where observable, end-to-end task latency, peak process memory and full artifact bytes. Keep the existing bounded sustained case; a matched idle/synthetic app-load contrast is conditional on demonstrated contention. Stop for unsafe resource/thermal behavior, OOM, unsupported runtime or exhausted budget. Keep all failures and cancellation/restart outcomes. Do not infer energy from desktop GPU measurements or count simulators as physical performance.

Owner must set device-specific latency/memory/quality ceilings before execution. A candidate must satisfy all ceilings and mandatory semantic/lifecycle controls and provide a meaningful benefit over the supported baseline; no ranking by parameter count or tokens/second alone. Five repeats are a pilot, not robust tail-latency or broad-device evidence. If a p95 is required for a decision, plan enough measurements first. Keep MediaPipe absent that evidence. #101 owns exact artifact identity; a converted/quantized artifact does not inherit another artifact's qualification.

Evidence: #174 A02/A05–A08; [MELT](https://arxiv.org/abs/2403.12844v4), [MobileLLM](https://arxiv.org/abs/2402.14905v2), [MobileLLM-R1](https://arxiv.org/abs/2509.24945v3), [mobile study](https://arxiv.org/abs/2410.03613v5).

## E3 — deterministic decision baseline and compact predictors

Implement and verify #131 before adding a learned candidate. Use the existing example/test surface, pure rules and a narrow injected predictor only if needed. Start with the default and deterministic resolver; compare a small linear classifier or decision tree using the same finite allowed options and admitted non-sensitive synthetic features. Explicit preferences and accessibility settings win; unknowns default safely. Use independently authored expected outcomes for ordinary, missing/ambiguous, shifted, stale and preference-conflict scenarios. Keep training/tuning/calibration and final scenario families separate; do not train a model to merely recover the labels produced by the baseline.

Measure paired task success, abstention/coverage, appropriate score calibration, denied/late results, CPU/time/memory and fallback. Proposed meaningful benefit: at least 5 percentage points improvement in held-out task success with no deterministic or permission regression and owner-approved resource budget. If rules suffice, stop before fitting. A separate routing comparison may measure avoided LLM calls; propose at least 20% reduction with no task-quality loss on the frozen pilot, bounded context/output/deadline and independent task oracle. Count false routing negatives, all attempted calls and total task latency. Conditional bandit evaluation requires a real decision gap and valid action support/propensities; no live exploration.

Evidence and details: [predictive intelligence RFC](predictive-intelligence-rfc.md), #174 A05/A06/A09–A11, #170. These are proposed experiments, not a predictor API or a production recommendation system.

## E4 — conditional predictive state and planning

Only after E3, choose one synthetic sequential workflow with explicit canonical state, allowed transitions and goal predicate. Compare a deterministic transition table/Markov baseline and a small supervised sequence predictor first, on identical admitted information and matched budgets. Consider a compact JEPA-inspired predictor only for a residual gap, not by porting a video/robot planner.

Proposed pilot bounds: horizon at most three, at most eight candidate sequences per decision, no actual application effects by the planner. Include held-out scenario families with similar observations but different canonical states/permissions; distinguish representation quality, one-step/multi-step error and downstream task success. Reobserve authoritative state and validate each proposed action against current policy; reject stale, invalid and denied predictions. Positive control: valid transition/goal; negative: representation collision with disallowed transition and false goal assertion. Do not treat latent similarity as goal attainment.

Require at least the owner-frozen meaningful task-success improvement over the best simpler baseline and no extra invalid/unauthorized recommendations accepted. Compare error accumulation, latency, memory and resource cost under the fixed horizon. Stop if simpler methods suffice, canonical state information is lost, or budgets cannot be met. Distilled encoders are not complete planners; any actual native model requires separate license/operator/artifact/device qualification in #117. No camera, surveillance, video-model downloads or training pipeline.

Evidence: [I-JEPA](https://arxiv.org/abs/2301.08243v3), [V-JEPA 2](https://arxiv.org/abs/2506.09985v1), [V-JEPA 2.1](https://arxiv.org/abs/2603.14482v3); #174 A09–A11.

## E5 — bounded context retrieval and ordering

Use the [Context Engine](context-engine.md) store/scorer/formatter boundaries unchanged. Start with existing text/tag/recency scoring and independently labeled synthetic queries. If a material retrieval bottleneck persists, compare one fixed-dimension semantic scorer; only with an already provisioned Matryoshka-trained encoder and demonstrated need, compare one nested prefix shortlist/full-vector reranker. Ordinary embeddings cannot be assumed truncatable.

Freeze encoder digest/version, dimension, distance/normalization, index and fixture identities. Measure recall@k including candidate misses, embedding plus search/reranking latency, peak memory and total retained bytes including full vectors/index metadata. Proposed decision: non-inferior recall on held-out labels and at least 20% improvement in measured end-to-end retrieval latency or total persisted bytes. Enforce the same TTL, deletion/eviction and byte policy for derived records, reject incompatible identities or unsupported policy. Positive/negative controls: live relevant item retrieved; expired/evicted or inadmissible item cannot be recovered by reranking. Do not create a second retention authority.

With an existing qualified local task, compare current bounded formatting against shorter ranked context and relevant fact first/middle/last under matched token budgets; separate relevance from semantic answer success, abstention, tokens and task latency. A meaningful improvement must preserve instructions, provenance, admitted inputs and policy. Ranking is not prompt-injection defense. No bundled vector DB, new SDK embedding API or automatic reordering. The existing #92 byte-limit evidence remains an independent correctness gate.

Evidence: [Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147v4), [Lost in the Middle](https://arxiv.org/abs/2307.03172v3); #174 A18/A19.

## E6 — governed adaptation and user control

Use #131's existing deterministic demo and its explicit precedence; no additional UI framework or user study. Compare the approved base presentation with approved variant changes, explicit selection/correction/reset, conflicting valid hints and invalid/stale proposals. Freeze application state and exact registered identity; assert that a view switch cannot change underlying task state, permission, event destination or canonical spec. Required labels/actions and accessible navigation/focus must survive applicable presentation changes; explicit accessibility preferences win.

Use existing component tests and actual rendered behavior where needed; compare user-visible outcomes against independently authored scenario expectations, not inferred demographic identity or model judgment. Positive: valid view switch or reset with unchanged task state. Negative: denied/stale variant, lost required action, or deliberately false state expectation. Require all applicable deterministic invariants to pass; no aggregate score can compensate for a forbidden effect. These tests do not establish general usability, accessibility certification or user benefit. If the existing demo already covers a case, reuse it rather than add another test.

Evidence: #174 A03/A14–A17; [Jelly](https://arxiv.org/abs/2503.04084v1), [Human-AI Interaction guidelines](https://doi.org/10.1145/3290605.3300233).

## E7 — optional exploratory mobile verification

Reuse the existing #158 model-import admission journey and #159 pilot; do not add a second journey. Pin installed APK and disposable emulator identity. Native baseline: current ADB/UIAutomator and independent gate/navigation assertion. Confirm actual attempted Continue interaction, denied admission and relaunch state; a separate deliberately wrong enabled expectation must fail. A disabled-looking screenshot or model's task-completion verdict cannot pass; missing evidence is indeterminate. No fake model path, real model provisioning, external endpoint, arbitrary shell privilege or production bypass.

After native pilot qualification, consider one optional exploration tool only if there is a concrete diagnostic or coverage gap and local/offline permission and data boundaries can be verified. Same pinned fixture, action budget, oracle and device conditions; propose three bounded repetitions per eligible tool, report all rather than best-run results, including setup/locator failures. Compare independently confirmed unique defects, replayability, elapsed time, maintenance and privileges. Adopt only if a new independently reproducible defect or a material measured maintenance saving justifies the extra dependency without weakening any oracle or data boundary; otherwise retain native-only testing. Do not substitute screen evidence for #117 physical inference metrics or #94 deterministic lifecycle/contract assertions. Do not claim installed-app proof from the prior blocked KVM run.

Evidence: [DroidAgent](https://arxiv.org/abs/2311.08649v1), [GPTDroid](https://arxiv.org/abs/2310.15780v1), [mobile GUI testing mapping](https://doi.org/10.1049/sfw2.12123); #174 A20–A22.

## Disposition

Retain existing MediaPipe, storage DI, ComponentSpec, deterministic fallback and test pyramid. The first conditional predictive comparison remains E3 after #131, not E4. Other experiments are independent only when their own owner and prerequisites permit them. Record evidence and stop decisions in the owner issue, with exact source, fixture and experiment identity. A completed literature review is not execution evidence, authority to acquire resources, or a reason to expand the roadmap.
