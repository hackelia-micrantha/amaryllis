# Software bill of materials

Amaryllis generates a CycloneDX 1.6 software bill of materials (SBOM) from the repository dependency inventory.

## Pull requests and main

Dependency-related pull requests generate and validate `artifacts/sbom.cdx.json`. The workflow retains the file as the `amaryllis-sbom-cyclonedx` Actions artifact for 90 days, including when validation fails.

Pushes to `main` also submit the generated dependency inventory to GitHub's dependency graph.

## Releases

Pushing a `v*` tag generates and validates a versioned release asset named:

```text
amaryllis-vX.Y.Z.cdx.json
```

The release job creates the GitHub Release when it does not already exist, signs an artifact-provenance attestation for the validated SBOM, and then uploads the SBOM to the release.

The attestation binds the exact SBOM filename and digest to the GitHub Actions workflow and source revision that generated it. The OIDC and attestation write permissions are limited to the tag-only release job.

## Verification

Download the SBOM from the GitHub Release, then verify its attestation with GitHub CLI:

```sh
gh attestation verify amaryllis-vX.Y.Z.cdx.json \
  --repo hackelia-micrantha/amaryllis
```

Verification should identify `hackelia-micrantha/amaryllis` as the source repository and the release workflow as the signer workflow. A changed or substituted SBOM will fail digest verification.

The SBOM itself can also be checked against the repository contract:

```sh
bash scripts/validate-sbom.sh amaryllis-vX.Y.Z.cdx.json
```

## Trust boundary

Pull-request jobs retain read-only repository permissions and cannot request GitHub OIDC tokens or publish attestations. Only release-tag executions of the `publish-release` job receive:

- `contents: write`, to create the release and upload its SBOM
- `id-token: write`, to request the short-lived signing identity
- `attestations: write`, to publish the signed attestation
- `artifact-metadata: write`, as required by the pinned attestation action

Third-party actions in the workflow are pinned to full commit SHAs.
