# Software bill of materials

Amaryllis generates CycloneDX 1.6 software bills of materials (SBOMs) from the repository dependency inventory.

## Pull requests and main

Dependency-related pull requests generate and validate:

- `artifacts/sbom.cdx.json`, the complete repository inventory
- `artifacts/packages/react-native-amaryllis.cdx.json`
- `artifacts/packages/amaryllis-core.cdx.json`
- `artifacts/packages/amaryllis-components.cdx.json`

The workflow retains the files in the `amaryllis-sbom-cyclonedx` Actions artifact for 90 days, including when validation fails.

Pushes to `main` also submit the complete repository inventory to GitHub's dependency graph.

## Validation layers

Every generated repository or package SBOM is validated as CycloneDX 1.6 before repository-specific contract checks run. Standards validation uses the official CycloneDX CLI 0.32.0 container pinned to immutable image digest `sha256:9a858a15e7b0843606efc0ff19d5f7575011a5428d7f3d343b4f6cf09d8f0d4e`. The pinned image contains the official CycloneDX schemas and validator implementation; validation runs with container networking disabled.

Standards validation and repository contracts remain separate:

- `scripts/validate-cyclonedx-schema.sh` verifies standards-level CycloneDX 1.6 conformance for any repository or package SBOM.
- `scripts/validate-sbom.sh` verifies Amaryllis-specific repository or package identity, dependency-scope, and graph guarantees.

The package derivation logic has deterministic synthetic-fixture tests covering exact published roots, direct and transitive production dependencies, optional peers, workspace traversal, development-only exclusion, duplicate descriptors, missing resolutions, stable ordering, and byte-for-byte output stability. Committed synthetic golden SBOMs make output-format and semantic changes explicit during review. The fixtures do not contain or regenerate the production repository SBOM.

Run the package derivation regression tests locally:

```sh
node --test scripts/package-sbom-lib.test.mjs
```

Validate generated files using the pinned CycloneDX validator image:

```sh
bash scripts/validate-cyclonedx-schema.sh \
  artifacts/sbom.cdx.json \
  artifacts/packages/*.cdx.json
```

The script pulls only the immutable image digest before validation and then executes the validator with `--network none`. It does not install packages dynamically, resolve a moving container tag, or download schemas during validation.

## Package scope

Package SBOMs use each published `package.json` as the source of truth. Each file has the package's exact name, version, npm PURL, and `bom-ref` as its CycloneDX root component.

Required dependencies are resolved to exact versions through `yarn.lock`, and their transitive production dependency closure is retained. Matching Syft components enrich those lockfile-derived identities when available. Peer dependencies are recorded with their declared ranges as optional direct dependencies because the consuming application supplies them. Development-only dependencies and unrelated workspace or example-application branches are excluded.

Choose the SBOM matching what you consume:

- `react-native-amaryllis-*` for `@micrantha/react-native-amaryllis`
- `amaryllis-core-*` for `@micrantha/amaryllis`
- `amaryllis-components-*` for `@micrantha/amaryllis-components`
- `amaryllis-*` for maintainers who need the complete monorepo, example application, tooling, and native dependency inventory

The React Native package SBOM includes its published JavaScript dependency on the shared Amaryllis core package and its declared peers. Use the repository-wide SBOM when auditing Android, iOS, build-tooling, or other repository dependencies that are not expressed in the npm package manifest.

## Releases

Pushing a `v*` tag generates and validates four versioned release assets:

```text
amaryllis-vX.Y.Z.cdx.json
react-native-amaryllis-vX.Y.Z.cdx.json
amaryllis-core-vX.Y.Z.cdx.json
amaryllis-components-vX.Y.Z.cdx.json
```

The release job creates the GitHub Release when it does not already exist, signs artifact-provenance attestations for every validated SBOM, and then uploads all four files to the release.

Each attestation binds the exact SBOM filename and digest to the GitHub Actions workflow and source revision that generated it. The OIDC and attestation write permissions are limited to the tag-only release job.

## Verification

Download the relevant SBOM from the GitHub Release, then verify its attestation with GitHub CLI:

```sh
gh attestation verify react-native-amaryllis-vX.Y.Z.cdx.json \
  --repo hackelia-micrantha/amaryllis
```

Verification should identify `hackelia-micrantha/amaryllis` as the source repository and the release workflow as the signer workflow. A changed or substituted SBOM will fail digest verification.

The SBOM itself can also be checked against the standards schema and repository contract:

```sh
bash scripts/validate-cyclonedx-schema.sh \
  react-native-amaryllis-vX.Y.Z.cdx.json

bash scripts/validate-sbom.sh \
  react-native-amaryllis-vX.Y.Z.cdx.json \
  '@micrantha/react-native-amaryllis'
```

Omit the package-name argument when validating the repository-wide SBOM contract.

## First-release validation checklist

Validate the complete release path on the next real `v*` release rather than creating a disposable attestation record.

- Confirm the `SBOM` workflow completes successfully for the release tag.
- Confirm the GitHub Release contains all four expected SBOM assets.
- Download each asset and run both validation scripts with its expected package identity.
- Run `gh attestation verify` for every asset and confirm the source repository and workflow identity.
- Copy one downloaded file, change one byte, and confirm attestation verification fails for the modified copy.
- Confirm every attestation subject name exactly matches its published release asset.
- Record the workflow run, release, and verification result in the release notes or tracking issue.

Treat any missing asset, failed schema or contract validation, absent attestation, signer mismatch, package-root mismatch, or successful verification of a modified file as a release-blocking failure.

## Trust boundary

Pull-request jobs retain read-only repository permissions and cannot request GitHub OIDC tokens or publish attestations. Only release-tag executions of the `publish-release` job receive:

- `contents: write`, to create the release and upload its SBOMs
- `id-token: write`, to request the short-lived signing identity
- `attestations: write`, to publish the signed attestations
- `artifact-metadata: write`, as required by the pinned attestation action

Third-party actions in the workflow are pinned to full commit SHAs. Standards validation additionally pins the CycloneDX CLI version and immutable container digest.
