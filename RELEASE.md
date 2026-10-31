# Release Process

Amaryllis releases a dependency-complete npm package set rather than publishing the repository root in isolation.

## Publishable packages

```text
@micrantha/amaryllis
        ↓
@micrantha/react-native-amaryllis

@micrantha/amaryllis-components
```

The shared core must be published before the React Native package that depends on it. Components is validated with the same artifact set and then published independently.

## Release architecture

Production releases use two trust boundaries:

```text
runner-amaryllis
  repository-owned Nix toolchain
  tests / typechecks / builds
  clean-consumer package preflight
  exact .tgz artifacts
        ↓ GitHub Actions artifacts
ubuntu-latest
  npm trusted publishing (OIDC)
  publishes the exact .tgz files
```

No package is rebuilt after the preflight/publish handoff.

The GitHub-hosted publish job alone receives `id-token: write`. The self-hosted preflight job has read-only repository/actions permissions.

## Before tagging

A release commit must have successful required validation for the exact commit. The package preflight additionally proves that:

- all three packages build;
- staged manifests contain no unresolved `workspace:` dependency;
- the root package points at the core version in the same release set;
- built JavaScript has no undeclared bare runtime import;
- exact package tarballs install outside the monorepo;
- the core root and `/context` exports execute in the clean consumer;
- the React Native root/context and components package entrypoints resolve from their tarballs.

The same contract is exercised in CI and by the manual `Test Publish Workflow`.

## Production release

Create and push the release commit/tag using the repository's normal versioning process. A `v*` tag starts `.github/workflows/publish.yml`.

The workflow:

1. waits for `CI`, `Dependency Audit`, and `Security - CodeQL` evidence for the tagged commit;
2. runs project-owned package preflight on `runner-amaryllis`;
3. uploads the exact tarballs and `package-release.json`;
4. crosses to `ubuntu-latest`;
5. publishes, in order:
   - `@micrantha/amaryllis`;
   - `@micrantha/react-native-amaryllis`;
   - `@micrantha/amaryllis-components`;
6. uploads the same tarballs to the GitHub Release.

If npm accepts only part of the sequence, the workflow records the already-published and pending versions. Do not rebuild during recovery; confirm registry state and resume from the same artifact set.

## Canary release

`.github/workflows/canary-publish.yml` uses the same build/preflight/publish split. It materializes related prerelease versions for all three packages and publishes the exact tarballs with the `canary` dist-tag.

Changes under the core or components workspace also trigger canary validation/publication.

## npm trusted-publisher configuration

Trusted publishing must be configured on npmjs.com for every package that the workflow publishes.

Use:

- organization: `hackelia-micrantha`;
- repository: `amaryllis`;
- production workflow: `publish.yml`;
- production environment: `production` when the npm publisher entry is environment-scoped;
- canary workflow: `canary-publish.yml` when canary OIDC publication is enabled.

The workflow uses Node 24 and npm 11.5.1 or later. npm trusted publishing automatically generates provenance for eligible public packages; no long-lived npm publish token is required.

## Manual release validation

Run the `Test Publish Workflow` to exercise the package graph without publication. It builds all publishable packages, stages publishable manifests, creates tarballs, and installs them in a temporary clean consumer.

## Troubleshooting

### `ENEEDAUTH`

Verify that the npm trusted-publisher entry exactly matches the package, organization, repository, workflow filename, and environment. The publish job must be running on GitHub-hosted `ubuntu-latest` with `id-token: write`.

### Clean consumer fails

Treat this as a package-integrity failure. Do not add monorepo-only hoisting or a hidden runtime dependency to make the test pass. Fix the packed manifest, package file set, entrypoint, or declared dependency instead.

### Partial npm publication

Read the structured failure evidence from `publish-package-artifacts.mjs`, verify which exact versions exist in npm, and reuse the original workflow artifacts. Do not create a second build to finish the same release.

### GitHub Actions substrate failure

Classify action/runtime failures separately from package-preflight failures. Do not widen the Amaryllis project runner merely to work around a generic action-runtime defect.

## Related release work

- #90: dependency-complete package validation/publication;
- #132: bind exact package tarball bytes to package SBOMs;
- #67: validate the complete release/SBOM/provenance flow on a real `v*` tag.
