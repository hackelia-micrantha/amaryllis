# Local Verify Runner

Amaryllis Verify currently runs as **repository tooling** while the v1alpha1 behavior stabilizes. The public contract is defined in [Verify v1alpha1](./verify-v1alpha1.md); package promotion is tracked separately in #120.

The current implementation lives under:

```text
packages/amaryllis-components/tools/verify/
```

This is temporary dependency reuse, not an `@micrantha/amaryllis-components` public API. The tooling directory is not included in the Components package files or exports.

## Commands

Run commands from the repository root.

### Validate evidence

```bash
node packages/amaryllis-components/tools/verify/cli.mjs validate \
  --evidence evidence.json
```

This checks JSON Schema and semantic invariants without running a device or model.

Exit codes:

- `0` — evidence is valid;
- `64` — invalid evidence, usage, path, or JSON input;
- `70` — unexpected tooling failure.

### Check compatibility

```bash
node packages/amaryllis-components/tools/verify/cli.mjs check \
  --evidence evidence.json
```

`check` validates the evidence, re-derives the compatibility decision from the retained evidence and embedded application policy, and rejects a mismatched/tampered embedded decision.

Exit codes:

- `0` — completed execution with `pass` or `warn` compatibility decision;
- `2` — completed execution with `fail` compatibility decision;
- `3` — `unknown` compatibility decision **or any non-completed execution**;
- `64` — invalid/tampered evidence or usage;
- `70` — unexpected tooling failure.

A compatibility-only `pass` does not make a partial, failed, or cancelled verification run suitable for promotion.

### Run the local fake adapter

Until real Android/iOS adapters are implemented in #117, the runner can be exercised through a deterministic local adapter script:

```bash
node packages/amaryllis-components/tools/verify/cli.mjs run \
  --manifest verify.json \
  --adapter-script adapter.json \
  --output evidence.json
```

`run` returns `0` whenever it successfully produces and writes a valid evidence artifact, including when that artifact contains a compatibility `fail` or `unknown` decision. Use `check` as the separate CI/promotion gate.

Runner or target-setup failures that prevent valid evidence from being produced return `70`. Invalid manifest/fixture/path input returns `64`.

## Local-only boundary

The v1alpha1 local runner intentionally has no remote fixture-fetch capability.

- manifest fixture references must be local filesystem paths;
- HTTP(S), cloud-storage URI, `file:` URI, and UNC-style references are rejected;
- relative fixture paths are resolved beneath the manifest directory;
- real paths are checked to prevent `..`/symlink escape;
- absolute fixture paths are disabled by default;
- declared fixture SHA-256 digests are verified;
- fixture size is bounded before reading;
- fixture bytes remain in adapter context and are not copied into normal evidence.

The fake adapter script and CLI input/output arguments are also explicit local files. The runner does not perform network fallback.

## Adapter trust boundary

Adapters may emit only metrics, checks, and evaluations declared by the manifest.

Each iteration result is validated **before** it mutates accumulated evidence. A result containing an undeclared field/target, invalid value, conflicting available/unavailable target, or malformed identifier is rejected atomically; cleanup still runs and the failed iteration is not committed.

Diagnostic messages are bounded and sanitized. Raw logs, prompts, model output, retrieved context, fixture content, arbitrary telemetry, and application payloads are not fields in the evidence contract.

## Lifecycle

The runner owns:

```text
manifest validation
  -> bounded fixture resolution
  -> capability discovery
  -> prepare
  -> warmup
  -> repetitions
  -> deterministic aggregation
  -> application policy evaluation
  -> bounded cleanup
  -> evidence validation
```

The scenario timeout starts before fixture resolution and covers setup/warmup/execution. Cleanup has a separate bounded timeout so cancellation or target failure cannot make teardown unbounded.

Execution status and compatibility decision remain separate. For example, cleanup may fail after all required measurements were successfully collected; the evidence can retain a compatibility `pass` while its execution status is `partial`. The `check` command still blocks that incomplete run.

## Next steps

- #117 — real attached-device Android/iOS adapters;
- #120 — move the stable tooling into a dedicated `@micrantha/amaryllis-verify` workspace/package with generated Yarn lockfile and release/SBOM/provenance handling.

No hosted service, device farm, telemetry ingestion, or model deployment is required by this runner.
