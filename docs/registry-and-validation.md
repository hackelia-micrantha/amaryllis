# Registry and Validation

The registry and validation path preserve executable ownership when AI participates in component generation or runtime personalization.

```text
The registry is authoritative over implementations.
The runtime contract is authoritative over personalization data.
Model output is untrusted until validated.
```

This document distinguishes controls implemented in the current runtime path from broader policy and delivery controls used at build or CLI time.

## Registry Responsibilities

A registered component binds:

```text
component name and version
  -> ComponentSpec
  -> personalization contract
  -> implementation identity
  -> deterministic spec and contract hashes
```

`ComponentRegistry.register` verifies that supplied names, versions, and optional hashes match the specification and contract. Replacement is explicit through `{ replace: true }`.

The registry therefore determines which reviewed implementation can render for a known component entry. Runtime model output cannot register or replace executable component code.

The current hashes are deterministic identity and drift-detection values. They are not cryptographic signatures or proof that an implementation is trustworthy.

## Implemented Runtime Path

`PersonalizedComponent` currently follows this path:

```text
component name
  -> registry lookup
  -> registered personalization contract
  -> untrusted structured output
  -> JSON Schema validation
  -> unsafe object-key validation
  -> JSON Patch path and value validation
  -> post-patch schema validation
  -> bounded prop overlay
  -> registered implementation render
```

The runtime rejects invalid personalization data and reverts to base props. Optional callbacks expose validation errors and diagnostics to the application.

### Contract validation

`PersonalizationEngine.validate` currently enforces:

- JSON Schema shape, types, required fields, enums, and additional-property rules declared by the contract;
- rejection of unsafe object keys such as `__proto__`, `constructor`, and `prototype`;
- JSON Patch paths restricted to declared `props`, `slots`, and `designTokens`, plus the top-level `variant` field;
- rejection of unsafe values within patch operations;
- schema validation again after patches are applied.

`PersonalizationEngine.apply` uses bounded recursive merging and ignores unsafe object keys when combining validated personalization data with base props.

### Registry identity checks

Registration and hydration validate:

- component name against `spec.metadata.name`;
- version against `spec.metadata.version`;
- optional spec and runtime-contract hashes against recomputed values;
- explicit replacement semantics for an existing versioned key.

An unversioned lookup resolves the registry's latest known entry for that component name. The project does not yet provide full compatibility negotiation or signed manifest verification.

## Policy Enforcement Boundary

The package contains a `PolicyEngine`, and the `generate` and `customize` CLI flows validate specifications against policy before producing artifacts.

The current programmatic runtime personalization path does **not** automatically invoke the full `PolicyEngine`. Registering a component directly and rendering it through `PersonalizedComponent` guarantees contract, unsafe-key, and patch validation, but does not by itself enforce every possible:

- network or external-capability restriction;
- accessibility requirement;
- review or approval rule;
- application-specific semantic constraint;
- design-system rule that is not encoded in the runtime contract.

Applications must encode enforceable runtime limits in the personalization schema and component implementation, and add application-level policy checks where required.

A future runtime policy layer should compose with `PersonalizationEngine` rather than treating schema validation as equivalent to policy enforcement.

## Build-Time Validation

Build or CI generation can apply stronger controls because executable output is reviewable before release. Depending on the workflow, controls may include:

- ComponentSpec schema and policy validation;
- import allowlists and dangerous-sink checks;
- formatting, linting, and type checking;
- unit, integration, and accessibility tests;
- package metadata and entrypoint validation;
- human diff review;
- provenance, SBOM, and approval evidence.

These controls are separate from device-time personalization and should not be inferred from the runtime schema-validation path.

## Failure Handling

Validation failures must not silently expand authority.

The implemented runtime behavior is to:

- reject invalid personalization output;
- preserve or restore base props;
- expose typed error arrays and diagnostics from `PersonalizationEngine`;
- optionally report validation events to application telemetry;
- avoid executing model output as source code.

Applications remain responsible for retry policy, user-visible fallback, logging, privacy-safe telemetry, and any remote-provider fallback.

## Security Properties and Limits

The current registry and runtime path provide useful boundaries:

- the model cannot introduce a new React implementation at runtime;
- personalization must satisfy a registered JSON contract;
- JSON Patch operations are constrained to declared paths;
- unsafe prototype-related keys are rejected or ignored;
- registration identity mismatches fail explicitly.

They do not currently provide:

- cryptographically signed registry manifests;
- automatic full-policy evaluation for every runtime personalization call;
- proof of accessibility or semantic correctness;
- capability isolation for component implementations;
- complete replay, audit, or compatibility negotiation.

## Future Work

Likely next steps include:

- compose runtime policy checks with contract validation;
- signed registry and model manifests;
- cryptographic identity and provenance evidence;
- explicit version compatibility and migration rules;
- overlay replay and diff tooling;
- runtime observability and audit interfaces;
- accessibility and design-system validators appropriate to the rendered platform.

The immediate priority is to keep implemented guarantees distinct from intended defense-in-depth controls while preserving strong registry and contract boundaries.