# Amaryllis Verify v1alpha1 Contract

## Status

Draft implementation design for #98.

Parent architecture: [Production Verification and Compatibility Evidence](./production_verification_rfc.md).

Related security boundary: #99.

Future model-artifact lifecycle alignment: #101.

## Purpose

This document turns the production-verification RFC into a concrete `v1alpha1` contract without introducing hosted infrastructure, a device farm, or a model registry.

The contract answers one question:

> Can this exact application/runtime/model configuration run on this target environment within application-defined operational and quality requirements?

The primary output is a portable `VerificationEvidence` document. A human-readable report, CI gate, future hosted orchestrator, or governance consumer is a view or consumer of that same evidence.

## Decisions

### Canonical interchange format

The canonical contract is **JSON Schema 2020-12**, stored under:

```text
schemas/verify/v1alpha1/
  common.schema.json
  manifest.schema.json
  evidence.schema.json
```

JSON Schema is preferred over a TypeScript- or Zod-only source of truth because Verify crosses Node tooling, React Native, Android, iOS, customer-owned runners, and possible future non-JavaScript consumers.

TypeScript types and validators may be generated or wrapped from these schemas, but they must not become a second divergent contract.

### Strict schema by default

`v1alpha1` rejects unknown fields with `additionalProperties: false` on contract objects.

There is intentionally no generic `extensions` or arbitrary metadata bag in evidence. This is both a compatibility and privacy decision: a collector must not be able to silently add prompts, model output, raw logs, or new telemetry fields to an otherwise valid evidence document.

New evidence fields require an explicit schema revision.

### Package boundary

When implementation begins, Verify should remain outside the production mobile bundle:

```text
@micrantha/amaryllis-verify
  - schema validation
  - runner orchestration
  - policy evaluation
  - evidence generation
  - CLI

@micrantha/react-native-amaryllis
  - application/runtime under test
  - Android/iOS harness or platform adapter integration
  - native lifecycle behavior
```

A future `@micrantha/amaryllis-verify` package is preferable to adding a Node-oriented verification CLI to either the React Native runtime or `amaryllis-components` package.

The schemas remain repository-level public artifacts so other implementations do not need the Node package to interpret evidence.

This package split is a design target, not a requirement to create the package in this PR.

## Execution model

The runner has one bounded lifecycle:

```text
manifest
  -> schema + semantic validation
  -> resolve exact subject identities/digests
  -> discover adapter capabilities
  -> prepare target
  -> warmup
  -> run repetitions
  -> collect measurements/checks
  -> execute local evaluation suites
  -> derive summaries
  -> evaluate application policy
  -> cleanup
  -> validate evidence
  -> write evidence
```

A future remote service may schedule this runner, but it should not replace the runner contract or produce a hosted-only evidence format.

## Runner boundary

The implementation should preserve a narrow orchestration/adapter split equivalent to:

```ts
interface VerifyRunner {
  run(
    manifest: VerificationManifest,
    adapter: PlatformAdapter,
    signal?: AbortSignal
  ): Promise<VerificationEvidence>;
}

interface PlatformAdapter {
  capabilities(): Promise<AdapterCapabilities>;
  prepare(context: RunContext): Promise<void>;
  warmup(context: RunContext, iteration: number): Promise<void>;
  execute(context: RunContext, iteration: number): Promise<IterationResult>;
  cleanup(context: RunContext): Promise<void>;
}
```

The exact TypeScript names are not normative. The required separation is:

- the **runner** owns orchestration, timeouts, repetitions, aggregation, policy, evidence assembly, and cancellation;
- the **adapter** owns platform/device launch and collection mechanisms;
- collectors expose capability support explicitly rather than fabricating unavailable metrics;
- semantic/model-quality evaluators return bounded status/score evidence, not raw model content.

## Cancellation and cleanup

Runner cancellation must be fail-explicit:

1. stop starting new iterations;
2. attempt bounded cancellation of active target work;
3. run bounded cleanup;
4. emit `execution.status: cancelled` when a valid evidence artifact can still be assembled;
5. mark required facts that were not established as unavailable/cancelled;
6. derive `unknown` unless independent positive failure evidence already establishes `fail`.

A runner/tool crash that prevents a structurally and semantically valid evidence document from being produced is a tool failure, not a compatibility decision.

## Verification manifest

A `VerificationManifest` declares the requested verification work. It includes:

- exact application identity;
- exact Amaryllis/runtime identity;
- exact model digest;
- Android or iOS target constraints;
- scenario identity and version;
- timeout, warmup, and repetition policy;
- fixture references rather than embedded fixture content;
- requested metrics, checks, and evaluations;
- application-owned compatibility requirements;
- optional local output settings.

See:

- `schemas/verify/v1alpha1/manifest.schema.json`
- `docs/examples/verify/android.manifest.json`
- `docs/examples/verify/ios.manifest.json`

### Fixture references

Fixture content may contain prompts, images, context, or other application data needed to execute a scenario. The manifest therefore references fixtures rather than embedding them into evidence.

Rules:

- fixture references must not embed credentials or bearer tokens;
- a digest should be supplied when reproducibility requires exact fixture identity;
- `evidencePolicy: exclude-content` is the only `v1alpha1` evidence policy;
- the runner may read fixture content locally but must not copy it into ordinary evidence;
- evaluation suites may consume local output and reduce it to bounded score/status evidence.

## Evidence envelope

A `VerificationEvidence` document contains these independent concerns:

```text
metadata       evidence identity
execution      runner completion/partial/failure/cancellation state
subject        application + runtime + model identity
environment    actual OS/device environment
provenance     runner + scenario + manifest + collector/evaluator identity
measurements   numeric samples + summaries
checks         deterministic behavioral outcomes
evaluations    bounded semantic/application-quality outcomes
unavailable    facts that could not be established
errors         bounded sanitized operational errors
policy         application requirements used for the decision
decision       pass | warn | fail | unknown
integrity      optional detached-attestation preparation
```

A valid JSON document does not imply a successful run or a passing decision.

## Subject identity

The subject is compound:

```text
application/build + Amaryllis runtime + model artifact
```

The model requires a SHA-256 digest in `v1alpha1`. A filename, URL, model name, or mutable tag is insufficient as the authoritative artifact identity.

Application/runtime digests are optional when an immutable build/package digest is not available, but their explicit version/build identities remain required as defined by the schemas.

#101 should reuse or supersede this model identity when the model-artifact manifest is defined. Verify must not invent a separate model identity namespace.

## Environment identity

Evidence records the actual environment, not just the requested target:

- platform;
- OS version/build;
- manufacturer;
- model/model code;
- architecture;
- relevant capability metadata;
- optional bounded correlation identity.

### Device correlation privacy

The schema intentionally has no serial number, IMEI, advertising identifier, or platform-global device identifier.

If correlation is required, `environment.device.correlation` supports only:

- `run` scope; or
- `project` scope.

An implementation should generate the narrowest-scoped pseudonymous identity that satisfies the comparison requirement.

## Measurements

`measurements` are numeric series. Each metric contains:

- stable metric name;
- canonical unit;
- raw per-iteration numeric samples;
- derived summary.

Raw samples are retained because an aggregate alone can hide failures and make later statistical changes impossible to reproduce.

Initial metric identifiers should remain small and high-signal. Candidate reserved identifiers include:

```text
timing.initialization.ms
timing.ttft.ms
timing.generation.ms
throughput.tokensPerSecond
memory.peakRssBytes
storage.modelBytes
```

Additional battery/energy/thermal/accelerator metrics should be introduced only when the platform collector has defensible semantics.

A reserved metric identifier must define one canonical unit. Semantic validation must reject a reserved metric paired with a conflicting unit.

## Checks

`checks` represent deterministic or categorical runtime invariants that do not naturally reduce to a scalar metric.

Initial examples include:

```text
lifecycle.cancelRestart
lifecycle.closeDuringGeneration
lifecycle.reinitializeAfterFailure
runtime.requestCompletes
runtime.noCrash
runtime.noOom
```

A check status is:

```text
pass | fail | unknown
```

The evidence message is optional, bounded, and sanitized. Raw logs are not part of the canonical evidence artifact.

## Evaluations

`evaluations` represent application/model-quality assessments.

An evaluation may contain:

- stable evaluation name;
- `pass | fail | unknown` status;
- bounded numeric score;
- unit such as `ratio`;
- machine-readable code.

Evaluation-suite identity/version/digest belongs in provenance.

The evidence does not contain the prompt, generated response, retrieved context, or user content used to compute the score.

This separation allows a quality suite to run locally over sensitive content while retaining only the minimum result needed for a compatibility decision.

## Unavailable evidence

Unsupported or failed collection is first-class evidence:

```json
{
  "kind": "metric",
  "name": "energy.averageMilliwatts",
  "reason": "unsupported"
}
```

Supported reasons are intentionally bounded:

```text
unsupported
collector-failed
not-run
cancelled
insufficient-samples
```

A required target must never disappear silently. It must either have evidence or an explicit unavailable record.

## Execution status vs compatibility decision

These are separate state machines.

### Execution status

```text
completed | partial | failed | cancelled
```

Execution status describes the verification operation.

### Compatibility decision

```text
pass | warn | fail | unknown
```

Compatibility status describes application policy against the available evidence.

Examples:

- a completed run can be `fail` because latency exceeded budget;
- a completed run can be `unknown` because a required collector was unsupported;
- a partial run can be `fail` if a crash definitively violated a required check;
- a cancelled run will normally be `unknown` because required evidence is incomplete.

## Decision precedence

The policy evaluator should use this precedence:

```text
known required violation  -> fail
required evidence missing -> unknown
advisory violation/missing -> warn
otherwise                  -> pass
```

If both a known required violation and an unknown required fact exist, `fail` wins because a blocking violation is already established. Reasons should still include the unknown requirement.

This gives the stable ordering:

```text
fail > unknown > warn > pass
```

All `fail` and `unknown` states block a normal compatibility promotion workflow. `warn` remains application policy; a caller may choose to fail CI on warnings separately.

## Requirement semantics

The JSON Schema validates the shape of requirements. A semantic validator must additionally enforce operator/type rules.

### Numeric comparisons

For `lte`, `lt`, `gte`, and `gt`:

- `value` must be numeric;
- metric targets must specify a compatible `aggregate` and canonical unit;
- evaluation targets may compare a bounded numeric score;
- check targets are invalid.

### Equality

`eq` and `neq` compare a scalar result whose type is defined by the target contract.

### Presence

`present` requires evidence to exist and be valid. It does not compare a value.

### Pass

`pass` is valid for check/evaluation status and requires status `pass`.

### Severity

`required` affects `fail`/`unknown` decisions. `advisory` affects `warn` only.

## Evidence semantic validation

JSON Schema validation is necessary but not sufficient. The Verify implementation must also check at least these invariants:

- requirement IDs are unique;
- requested metric/check/evaluation IDs are unique;
- every requirement target is declared for collection/evaluation;
- every required target has either a result or an explicit unavailable record;
- no target appears simultaneously as available and unavailable;
- measurement names are unique;
- check names are unique;
- evaluation names are unique;
- sample iteration numbers are valid for the completed execution;
- summary `count` matches the samples used;
- summary values are recomputable from samples under the defined aggregation algorithm;
- completed repetitions do not exceed requested repetitions;
- reserved metric IDs use their canonical unit;
- policy operator/value/aggregate combinations are valid;
- decision reasons reference declared requirements when `requirementId` is present;
- the derived decision matches the evidence and policy.

Evidence that fails these invariants is invalid evidence; it must not be repaired by silently converting the result to `unknown`.

## Statistical summaries

`v1alpha1` retains raw samples and permits:

```text
min
max
mean
p50
p95
```

Percentile interpolation must be defined by the implementation and versioned with the runner/collector semantics. CI comparison tools must not assume two differently versioned collectors calculate percentiles identically unless their contract says so.

Historical baseline comparison is intentionally **not embedded** in `v1alpha1` evidence. A comparison tool may compare two independently valid evidence documents. This keeps a single-run artifact self-contained and prevents a mutable baseline pointer from changing the meaning of historical evidence.

## Privacy invariants

The #99 threat-model boundary applies directly to this schema.

`v1alpha1` has no fields for:

- prompts;
- generated output;
- retrieved context;
- embeddings;
- user media/documents;
- arbitrary application payloads;
- credentials/secrets;
- raw logs.

Because contract objects reject additional properties, these cannot be inserted into a valid evidence document without an explicit schema change.

Bounded `message` fields are for sanitized machine/operator context only. Implementations must treat model/application-originated text as untrusted and must not copy it verbatim into these messages.

## Integrity and attestations

`integrity` is optional in `v1alpha1`.

When present:

- canonicalization is RFC 8785 JSON Canonicalization Scheme;
- `payloadDigest` is SHA-256 over the canonicalized evidence document **with the `integrity` property omitted**;
- signatures remain detached;
- `attestationRefs` may point to an external attestation/signature artifact and optionally identify its digest.

This avoids defining a new signing system inside Verify and leaves room for GitHub artifact attestations, Sigstore-style evidence, or organization-specific signing without changing the core measurement model.

The final trust/signing relationship should align with #101 rather than creating separate model and evidence trust roots unnecessarily.

## Schema evolution

Every artifact identifies:

```text
apiVersion: amaryllis.dev/verify/v1alpha1
kind: VerificationManifest | VerificationEvidence
```

Rules:

- unknown fields are rejected;
- a change that alters required fields or semantics requires a new API version;
- platform-specific data must be normalized into shared fields or added in a new schema revision rather than creating separate Android/iOS top-level schemas;
- old evidence remains interpretable according to its declared API version;
- hosted tooling must accept/produce the same public schema used by local tooling for a supported API version;
- no hosted-only evidence fields may become required for local compatibility decisions.

## CLI shape

The first implementation should use a dedicated thin binary rather than adding Node tooling to the production React Native package:

```bash
amaryllis-verify run \
  --manifest verify.json \
  --output evidence.json

amaryllis-verify validate --evidence evidence.json

amaryllis-verify check --evidence evidence.json
```

### `run`

- validates the manifest;
- executes the runner locally;
- writes one evidence document;
- may print a human-readable summary generated from that evidence;
- does not require network access.

`run` should return exit code `0` whenever a structurally and semantically valid evidence document was produced, even if its decision is `fail` or `unknown`. This separates runner/tool health from compatibility policy.

### `validate`

Validates schema plus semantic invariants. It does not rerun the target and does not reinterpret compatibility policy.

### `check`

Evaluates the embedded policy/evidence decision for CI gating.

Recommended initial exit codes:

```text
0   pass or warn
2   fail
3   unknown
64  invalid manifest/evidence/usage
70  runner/internal failure with no valid evidence artifact
```

A later `--fail-on-warn` option may be added without changing the evidence schema.

## Human-readable output

Console and Markdown summaries are presentation layers over `VerificationEvidence`.

They must not become a second source of truth and should not attach raw runtime logs by default.

A report should be reproducible from the evidence document alone.

## Android example

The Android example demonstrates:

- exact application/runtime/model identity;
- numeric timing/memory/storage measurements;
- a lifecycle check;
- a local quality evaluation;
- unavailable advisory thermal evidence;
- final decision `warn`.

Files:

```text
docs/examples/verify/android.manifest.json
docs/examples/verify/android.evidence.json
```

## iOS example

The iOS example demonstrates fail-safe unavailable evidence:

- initialization evidence is present;
- cancellation/restart passes;
- a required energy collector is unsupported;
- the runner completes;
- the compatibility decision is `unknown`, not `pass`.

Files:

```text
docs/examples/verify/ios.manifest.json
docs/examples/verify/ios.evidence.json
```

## Initial implementation sequence

After this design is accepted:

1. add schema/meta-schema and example validation to CI;
2. add negative privacy tests from #99, including rejection of prompt/output/context fields;
3. implement semantic manifest/evidence validation;
4. implement policy decision derivation and test precedence;
5. create the smallest local `amaryllis-verify` runner package/CLI;
6. add one deterministic fake/platform adapter for runner lifecycle tests;
7. add one Android and one iOS attached-device execution path;
8. retain evidence as a CI artifact without requiring hosted infrastructure;
9. only then evaluate remote orchestration or a managed reference device fleet.

## Non-goals for v1alpha1

- hosted execution;
- accounts or billing;
- web dashboard;
- broad physical-device inventory;
- fleet telemetry ingestion;
- remote model deployment;
- model registry implementation;
- general mobile-device management;
- universal model-quality benchmark;
- automatic safety/compliance certification;
- raw prompt/output retention;
- Anthesis dependency.

## Completion criteria for #98

This design satisfies #98 when review confirms:

- one manifest/evidence model represents Android and iOS;
- exact model identity uses an immutable digest;
- local execution requires no Amaryllis-hosted service;
- runner and platform-adapter responsibilities are separated;
- `pass`, `warn`, `fail`, and `unknown` are unambiguous;
- required unavailable evidence cannot become `pass`;
- raw samples remain available for later comparison;
- privacy-sensitive content is excluded structurally from normal evidence;
- CLI/tool failure is distinct from compatibility failure;
- versioning allows future orchestration without a hosted-only contract.
