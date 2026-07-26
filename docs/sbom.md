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

## Package scope

Package SBOMs are derived from the resolved repository dependency graph. Each one uses the published npm package as its CycloneDX root component and retains only components reachable from that package's dependency node.

Choose the SBOM matching what you consume:

- `react-native-amaryllis-*` for `@micrantha/react-native-amaryllis`
- `amaryllis-core-*` for `@micrantha/amaryllis`
- `amaryllis-components-*` for `@micrantha/amaryllis-components`
- `amaryllis-*` for maintainers who need the complete monorepo, example application, tooling, and native dependency inventory

The React Native package SBOM includes dependencies represented in the repository graph, including its shared Amaryllis core dependency. Native Android and iOS dependencies remain visible when they are connected to the package in the generated graph. The components and core package SBOMs do not include unrelated example-application or workspace tooling branches.

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

The SBOM itself can also be checked against the repository contract:

```sh
bash scripts/validate-sbom.sh \
  react-native-amaryllis-vX.Y.Z.cdx.json \
  '@micrantha/react-native-amaryllis'
```

Omit the package-name argument when validating the repository-wide SBOM.

## First-release validation checklist

Validate the complete release path on the next real `v*` release rather than creating a disposable attestation record.

- Confirm the `SBOM` workflow completes successfully for the release tag.
- Confirm the GitHub Release contains all four expected SBOM assets.
- Download each asset and run `scripts/validate-sbom.sh` with its expected package identity.
- Run `gh attestation verify` for every asset and confirm the source repository and workflow identity.
- Copy one downloaded file, change one byte, and confirm attestation verification fails for the modified copy.
- Confirm every attestation subject name exactly matches its published release asset.
- Record the workflow run, release, and verification result in the release notes or tracking issue.

Treat any missing asset, failed contract validation, absent attestation, signer mismatch, package-root mismatch, or successful verification of a modified file as a release-blocking failure.

## Trust boundary

Pull-request jobs retain read-only repository permissions and cannot request GitHub OIDC tokens or publish attestations. Only release-tag executions of the `publish-release` job receive:

- `contents: write`, to create the release and upload its SBOMs
- `id-token: write`, to request the short-lived signing identity
- `attestations: write`, to publish the signed attestations
- `artifact-metadata: write`, as required by the pinned attestation action

Third-party actions in the workflow are pinned to full commit SHAs.
