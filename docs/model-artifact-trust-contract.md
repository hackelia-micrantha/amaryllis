# Model Artifact and Lifecycle Trust Contract

## Status

Draft design for #101.

Related:

- #97 — production verification and compatibility evidence
- #98 — Verify v1alpha1 contract
- #99 — operational evidence privacy boundary
- #117 — future attached-device verification adapters
- #120 — future dedicated Verify tooling package

## Purpose

Define the smallest open trust contract needed to identify, verify, approve, revoke, and deliberately roll back on-device model artifacts **without** requiring Amaryllis to become a hosted artifact repository or deployment service.

The design has two distinct objects:

1. an **immutable `ModelArtifactManifest`** describing what model bytes exist and what runtime they require;
2. a **signed `ModelReleaseRecord`** describing mutable lifecycle authority such as approval, compatibility evidence, revocation, and rollback.

Keeping these separate is a core security property. Artifact identity must not change merely because an organization changes approval or rollout policy.

---

## Design goals

- Give every executable model bundle an immutable content-addressed identity.
- Support multi-file model bundles without trusting filenames or storage locations.
- Reuse existing provenance/SBOM/attestation formats rather than inventing replacements.
- Make storage resolution independent from artifact trust.
- Keep verification and consumption usable with filesystem, application-owned, OCI, object, or other artifact storage.
- Make approval, revocation, rollback, and compatibility state explicit and signed.
- Provide anti-replay and anti-downgrade semantics before any remote deployment feature exists.
- Preserve the current Verify v1alpha1 meaning of `subject.model.digest`.
- Fail closed when required identity, integrity, lifecycle, or compatibility evidence is unavailable.
- Keep signing and verification primitives open even if a future managed control plane exists.

## Non-goals

- Hosted/private model registry implementation.
- Model marketplace.
- General blob/object storage.
- Remote deployment or fleet orchestration.
- Billing, SSO, RBAC, or approval UI.
- Defining a universal model file format.
- Replacing CycloneDX, in-toto, Sigstore, DSSE, or other applicable supply-chain standards.
- Reinterpreting an existing Verify v1alpha1 evidence field after publication.

---

## Why identity and lifecycle state are separate

A model artifact is immutable once identified by digest. These properties belong with the artifact:

- exact component bytes;
- format and roles;
- runtime requirements;
- license metadata;
- immutable provenance references.

These properties can change independently of the bytes:

- approved or blocked;
- allowed deployment channel;
- current compatibility evidence;
- revoked or superseded;
- rollback target;
- rollout percentage;
- organization policy.

Embedding mutable state into the immutable manifest creates undesirable behavior:

```text
same model bytes
  + changed approval
  -> new manifest identity
  -> new signature
  -> ambiguous artifact history
```

Instead:

```text
immutable artifact manifest
          ↑
          │ references by digest
signed release/lifecycle record
```

A lifecycle change produces a new release record while the artifact manifest and artifact digest remain stable.

---

## Object 1: ModelArtifactManifest

The manifest describes an immutable model bundle.

Illustrative shape:

```yaml
apiVersion: amaryllis.dev/model/v1alpha1
kind: ModelArtifactManifest

metadata:
  name: gemma3-1b-it-int4
  version: "1"

artifacts:
  - id: primary
    role: model
    mediaType: application/vnd.google.mediapipe.task
    digest:
      algorithm: sha256
      value: <64 hex>
    sizeBytes: 612000000

  - id: tokenizer
    role: tokenizer
    mediaType: application/json
    digest:
      algorithm: sha256
      value: <64 hex>
    sizeBytes: 123456

primaryArtifact: primary

runtime:
  engine: mediapipe-llm-inference
  versionRange: ">=0.10.24 <0.11.0"
  requiredCapabilities:
    - text-generation

licenses:
  expression: Apache-2.0
  references: []

provenance:
  sourceRevision: optional
  sbomRefs: []
  attestationRefs: []
```

This example is conceptual. A concrete schema should be introduced only after implementation work is approved.

### Immutable manifest identity

The manifest itself is content-addressed:

```text
manifestDigest = SHA-256(canonical manifest bytes)
```

When canonical JSON is used, RFC 8785 JSON Canonicalization Scheme is the preferred canonicalization contract.

A manifest name or semantic version is descriptive. The manifest digest is authoritative.

### Artifact component identity

Every executable or required auxiliary artifact is identified by SHA-256 digest.

Typical roles include:

```text
model
tokenizer
config
adapter
vision-encoder
vision-adapter
vocabulary
metadata
```

Roles are descriptive. The digest is authoritative.

A model bundle may contain multiple artifacts, but it must identify exactly one `primaryArtifact` for Verify v1alpha1 interoperability.

### Storage locations are not identity

A manifest should not make a URL, path, bucket key, registry tag, or filename authoritative.

A resolver may map a digest to:

- application bundle path;
- local filesystem/cache;
- OCI artifact;
- object storage;
- customer artifact repository;
- future Amaryllis-managed storage.

After resolution, the consumer verifies the bytes against the manifest digest **before activation**.

This preserves one trust contract across different storage providers.

---

## Relationship to Verify v1alpha1

Verify v1alpha1 already defines:

```text
subject.model.digest
```

That field means the digest of the concrete executable model artifact tested by that evidence.

#101 must not silently redefine it to mean a manifest digest.

For `ModelArtifactManifest` interoperability:

```text
Verify evidence subject.model.digest
        ==
ModelArtifactManifest.artifacts[primaryArtifact].digest
```

A future Verify schema version may add an explicit `modelManifestDigest`, but v1alpha1 evidence keeps its published semantics.

This allows a multi-file manifest to be introduced without invalidating retained v1alpha1 evidence.

---

## Runtime requirements

The immutable manifest may declare requirements necessary to load the artifact safely, for example:

- runtime/engine identifier;
- supported runtime version range;
- required model format;
- required runtime features;
- minimum static capability requirements that are properties of the artifact format.

It should **not** claim production performance compatibility such as acceptable latency, memory, thermal behavior, or output quality. Those are environment/application-dependent facts owned by Verify evidence and application policy.

Runtime requirements answer:

> Can this runtime interpret this artifact?

Verify answers:

> Did this exact configuration satisfy this application's declared deployment budgets on this environment?

---

## License metadata

The manifest may contain machine-readable license metadata sufficient to prevent accidental redistribution or activation under an incompatible policy.

Prefer standard identifiers/expressions such as SPDX where applicable.

License text, policy opinions, or legal conclusions should not be duplicated into the manifest when a digest-addressed reference is sufficient.

License metadata is evidence for application policy; Amaryllis does not provide a legal-compliance certification.

---

## Provenance and SBOM references

Do not create Amaryllis-specific replacements for existing supply-chain evidence.

The manifest may reference external artifacts by digest and media type, such as:

- CycloneDX SBOM;
- build provenance;
- in-toto statement;
- Sigstore/GitHub artifact attestation;
- source revision/build record.

A reference locator is optional convenience metadata. Its digest is authoritative when integrity matters.

Embedding a large SBOM or attestation directly into every model manifest is discouraged because it couples independent evidence lifecycles and increases canonical artifact size.

---

## Manifest signatures

Signing remains optional at the base open-contract layer, but higher-assurance policy may require it.

The contract should support **detached signatures/attestations** over the immutable manifest digest rather than inventing an inline signature format.

A verifier needs:

```text
manifest bytes
  -> canonicalize
  -> SHA-256 digest
  -> verify required detached signature/attestation
  -> verify signer against application-configured trust policy
```

Signing policy is application/organization-owned.

No trust-on-first-use or remote trust-root discovery is implied.

---

## Object 2: ModelReleaseRecord

A release record expresses mutable lifecycle authority over an immutable artifact manifest.

Illustrative shape:

```yaml
apiVersion: amaryllis.dev/model/v1alpha1
kind: ModelReleaseRecord

metadata:
  project: com.example.app
  channel: production
  sequence: 42
  issuedAt: 2026-08-13T12:00:00Z
  expiresAt: 2026-09-13T12:00:00Z

subject:
  modelManifestDigest:
    algorithm: sha256
    value: <64 hex>

state:
  status: approved

compatibility:
  evidenceRefs:
    - digest:
        algorithm: sha256
        value: <64 hex>
      profile: production-mobile

rollback:
  predecessorManifestDigest:
    algorithm: sha256
    value: <64 hex>

signing:
  keyId: production-model-release-2026
```

The record is signed/attested separately from the immutable manifest.

### Lifecycle states

A minimal lifecycle vocabulary may include:

```text
approved
blocked
revoked
superseded
```

The exact schema should avoid encoding business workflow states that are not required for safe artifact consumption.

An organization may have richer review/approval workflow elsewhere. The mobile/application consumer only needs a bounded signed state relevant to activation.

---

## Audience binding

A release record must be bound to the intended application/project and deployment channel.

A valid signature for one application must not authorize the same artifact in another application merely because the bytes are identical.

Candidate audience fields include:

```text
application/project identifier
channel/environment
tenant/organization where applicable
```

The verifier checks audience before considering approval state.

---

## Anti-replay and anti-downgrade

Semantic version comparison alone is insufficient security authority.

Use a monotonically increasing signed release `sequence` for each application/channel authority domain.

The consumer persists the highest accepted sequence:

```text
incoming sequence > highest accepted sequence
    -> eligible for normal evaluation

incoming sequence <= highest accepted sequence
    -> reject as replay/downgrade
```

A deliberate rollback does **not** bypass this rule.

Instead, rollback is represented by a **newer signed release record with a higher sequence** that explicitly authorizes activation of an older known-good artifact manifest.

Example:

```text
sequence 41 -> model B
sequence 42 -> model C
sequence 43 -> explicit rollback to model B
```

This distinguishes authorized rollback from replay of the old sequence-41 authorization.

---

## Rollback semantics

A rollback target must be explicit and content-addressed.

Do not implement rollback as:

- "accept any lower semantic version";
- "use the previous filename";
- "restore whatever was last in cache".

A rollback release record should identify the exact target manifest digest and preserve a higher monotonic sequence.

The consumer re-verifies the rollback target's manifest and artifact component digests before activation.

Compatibility evidence may need to be re-evaluated against the current application/runtime/device policy even when the target artifact was previously approved.

---

## Revocation semantics

An immutable artifact cannot revoke itself.

Revocation is signed lifecycle state referencing the artifact manifest digest.

A consumer encountering a valid revocation record must not activate the revoked artifact.

If the currently active artifact becomes revoked, fallback behavior remains application policy. Safe options may include:

- disable the affected AI capability;
- activate an explicitly authorized known-good rollback target;
- continue a previously approved artifact only when policy explicitly allows a bounded grace period.

The runtime must not silently switch to remote inference or a broader capability merely because a local artifact is revoked.

---

## Expiry and offline behavior

A signed release record may include `issuedAt` and `expiresAt`.

Expiry prevents an indefinitely cached approval from becoming permanent authority, but offline applications need explicit behavior when refresh is impossible.

Amaryllis should not invent one universal answer.

Application policy chooses among modes such as:

```text
strict       -> stop using approval after expiry
boundedGrace -> continue last known-good for a declared grace window
offlineStable -> continue an already active artifact until an explicit newer trusted record is available
```

The selected behavior must be explicit and testable. Network failure must not silently broaden trust.

---

## Compatibility evidence references

Compatibility evidence is mutable lifecycle evidence and therefore belongs with the release record, not the immutable artifact manifest.

A compatibility reference should identify evidence by digest and enough policy/profile metadata to interpret its intended use.

Before activation, policy may require that evidence matches:

- the manifest's primary artifact digest;
- required Amaryllis/runtime version constraints;
- application/build compatibility policy;
- target device/profile class;
- required evaluation suite/version;
- acceptable evidence age or source policy.

A stale evidence reference is not equivalent to failed evidence. It is **insufficient current evidence** and should become a non-pass activation state according to application policy.

---

## Trust roots and key rotation

Trust roots are application/organization configuration, not model metadata.

A consumer may be configured with one or more trusted key identities or attestation policies.

Key rotation should support an overlap window:

```text
trusted set: old + new
  -> publish records signed with new
  -> confirm adoption
  -> remove old in a later trusted application/policy update
```

Do not bootstrap a replacement trust root solely from an artifact signed by the untrusted replacement key.

A future control plane may automate rotation, but the verification rule remains local and open.

---

## Activation flow

A higher-assurance local activation path should be equivalent to:

```text
signed ModelReleaseRecord
  -> verify signature/attestation policy
  -> verify audience + channel
  -> verify sequence / anti-replay
  -> verify time/offline policy
  -> verify lifecycle state is activatable
  -> resolve ModelArtifactManifest by digest
  -> verify manifest digest/signature policy
  -> resolve required artifact components
  -> verify every component digest/size
  -> verify runtime requirements
  -> verify required compatibility evidence/policy
  -> stage complete model bundle
  -> atomically activate
```

Any failure before atomic activation leaves the prior known-good state unchanged unless explicit application policy says otherwise.

Partial artifact replacement is not activation.

---

## Fail-safe defaults

The contract should fail closed when a required condition cannot be established:

- unknown manifest digest;
- malformed manifest;
- missing required component;
- component digest mismatch;
- required signature missing/invalid;
- signer outside configured trust policy;
- wrong application/channel audience;
- replayed/stale release sequence;
- revoked/blocked lifecycle state;
- incompatible runtime requirement;
- required compatibility evidence missing/stale/invalid.

Fail closed means "do not activate this candidate artifact." It does not necessarily mean crash the application or delete the previously active model.

---

## Storage-neutral resolver boundary

The trust contract should depend on a resolver interface, not a storage product.

Conceptually:

```text
resolve(digest) -> bytes/local artifact
```

Resolvers may support:

- application bundle;
- local cache;
- filesystem;
- OCI/artifact registry;
- object storage;
- enterprise repository;
- future managed Amaryllis service.

The resolver is not authoritative for identity. Every resolved artifact is verified against the requested digest before use.

This lets organizations keep existing artifact infrastructure while still using Amaryllis trust/verification contracts.

---

## Relationship to existing ComponentRegistry

Amaryllis already uses registry terminology for executable component implementation selection.

Do not reuse an unqualified `Registry` name for model lifecycle infrastructure.

Use:

- `ComponentRegistry` for existing component implementation lookup;
- `ModelArtifactManifest` for immutable model identity;
- `ModelReleaseRecord` for signed lifecycle authority;
- **Model Registry** only for a future model/artifact storage/lifecycle product or subsystem.

This prevents application runtime registry concepts from becoming confused with artifact distribution infrastructure.

---

## Relationship to a future Model Registry

A future Model Registry may add:

- private artifact storage;
- organization access control;
- signing automation;
- promotion workflows;
- release-record publication;
- retention/history;
- compatibility evidence indexing;
- audit trail.

Those are managed conveniences around the open contracts.

Safe local artifact consumption must remain possible with ordinary storage plus open manifest/release verification.

---

## Relationship to Deploy

A future Deploy capability should distribute **signed release intent**, not make an arbitrary mutable model URL authoritative.

Deploy may deliver or notify clients of a newer `ModelReleaseRecord`. The local consumer still performs the activation flow and verifies exact digests/trust policy.

This keeps remote orchestration outside the local trust root.

---

## Relationship to Anthesis and governance

Amaryllis may emit lifecycle decisions/evidence such as:

- manifest verified;
- signature accepted/rejected;
- release sequence accepted/replayed;
- compatibility evidence satisfied/missing;
- artifact activated/revoked/rolled back.

These events can be consumed by local files, CI, SIEM, organizational governance systems, or Anthesis through an open evidence interface.

Anthesis is not required to interpret or enforce the model artifact trust contract.

---

## Implementation sequencing

Do not build a hosted Model Registry from this design alone.

Recommended order:

1. keep this as the shared artifact/lifecycle design contract;
2. let #117 produce real-device Verify evidence against exact model digests;
3. define concrete JSON Schemas only when a local artifact resolver/verification implementation is justified;
4. implement local digest/manifest verification before remote distribution;
5. prove signed release records and anti-replay behavior locally;
6. only then evaluate managed storage/promotion/deployment based on demonstrated demand.

---

## Open implementation decisions

Before a concrete schema/API lands, decide:

- exact media types and role vocabulary for common model artifacts;
- whether version ranges use npm-style semver where runtime versions are semver-compatible or a simpler bounded comparator grammar;
- which detached-signature/attestation standards are supported first;
- how the highest accepted release sequence is persisted transactionally on Android/iOS;
- how cached release records interact with explicit offline/grace policy;
- whether evidence reference age is encoded in release policy or application compatibility profile;
- how atomic multi-file model activation is represented by each native platform adapter.

These decisions should not change the core split between immutable artifact identity and mutable signed lifecycle authority.

---

## Decision

Amaryllis model lifecycle trust is built from **content-addressed immutable artifact manifests plus signed mutable release records**.

The model bytes, artifact roles, runtime requirements, license metadata, and immutable provenance belong to the artifact manifest. Approval, compatibility evidence, revocation, rollback, audience, expiry, and anti-replay sequence belong to the release/lifecycle record.

Storage location is never artifact identity. Safe local consumption verifies exact digests and required trust policy before atomic activation. A future Model Registry or Deploy service may manage these contracts, but does not replace them or become required for their safe use.
