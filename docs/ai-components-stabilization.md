# AI Components Stabilization Notes

This document records the implementation boundary for the ordered parent issue #34.

## Status

`@micrantha/amaryllis-components` remains experimental while the `amaryllis/v1alpha1` contract stabilizes. The module is intended to make AI-enabled components governable by keeping AI output inside deterministic schema, policy, runtime, and generation boundaries.

## Ordered implementation mapping

| Issue | Implementation boundary |
| --- | --- |
| #35 | `ComponentSpec` schema validation, required-property checks, safe generated identifiers, and unsafe layout rejection. |
| #36 | Structured policy errors, fail-closed device execution checks, executable-output review gating, and explicit runtime policy. |
| #37 | Runtime personalization diagnostics, constrained JSON Patch paths, unsafe object-key rejection, and deterministic fallback behavior. |
| #38 | Deterministic generated provenance, richer TypeScript type generation, and generator-side layout hardening. |
| #39 | Components workspace `typecheck` script and explicit CI/publish typecheck steps. |
| #40 | Example and documentation flow for spec validation, policy validation, generation, and runtime personalization. |

## ComponentSpec contract notes

`amaryllis/v1alpha1` is a narrow contract, not a full general-purpose UI DSL.

Required invariants:

- `metadata.name` is kebab-case and suitable for deterministic generated component naming.
- `props.required` entries must reference declared `props.properties` keys.
- prop, slot, variant, and design token names must be safe generated-code identifiers.
- device execution cannot scaffold TSX or executable code.
- layouts must not contain script tags, imports, exports, `require`, `eval`, or `Function` constructors.

Unsupported JSON Schema features may be passed through only where they are non-policy-critical. Generator and runtime behavior should only rely on documented fields.

## Policy model

Policy evaluation is deterministic and side-effect free.

Device execution is the strictest mode:

- output must be structured data only: `props-json`, `variant-selection`, or `json-patch`
- runtime network access must be declared as `restricted` or `none`
- runtime DOM access must be declared as `restricted` or `none`
- executable, raw markup, import, network, DOM, and native-module operations are forbidden on device

Executable TSX output is build/CI-only and requires explicit human review policy.

## Runtime personalization model

Runtime personalization behaves as a safe overlay:

```text
base props
  + schema-validated structured AI output
  + constrained patch application
  -> final props
  -> deterministic render
```

Runtime AI output is never authoritative state. Invalid personalization data falls back to base props and may report diagnostics through `onValidation`.

Diagnostics intentionally avoid logging raw prompts or raw model inputs. Callers that need telemetry should log aggregate validation outcomes, error counts, and whether patches were used.

## Generator provenance model

Generated source is a build artifact. Provenance comments describe the generation context but should not claim perfect reproducibility unless callers provide enough pinned inputs.

Generated provenance includes:

- spec version
- spec hash
- generator version
- model identifier, when applicable
- prompt version, when applicable
- validation summary
- generated timestamp, only when explicitly supplied

When `generatedAt` is omitted, generated output uses `Generated At: unavailable` to avoid injecting wall-clock nondeterminism into snapshots or generated code.

## Example verification flow

Use a static structured fixture rather than a live model provider:

```text
component.yaml
  -> parse + schema validate
  -> policy validate
  -> generate personalization contract
  -> generate React component or apply runtime personalization
  -> show deterministic fallback on invalid AI output
```

Suggested commands:

```sh
yarn workspace @micrantha/amaryllis-components typecheck
yarn workspace @micrantha/amaryllis-components test --runInBand
yarn workspace @micrantha/amaryllis-components build
```

## Security notes

Primary risks:

- prompt injection into generated or personalized output
- generated-code injection through layouts or executable output modes
- data leakage through telemetry or runtime model calls
- unsafe JSON Patch paths mutating policy or component identity
- prototype pollution through structured output keys
- false reproducibility claims when model/prompt/spec inputs are not pinned

Default posture: fail closed for device execution and treat all AI output as a proposal accepted only after deterministic validation.
