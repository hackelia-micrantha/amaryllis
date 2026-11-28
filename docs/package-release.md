# Package CI and release safeguards

Amaryllis publishes three npm packages from one repository:

```text
@micrantha/amaryllis
        ↓
@micrantha/react-native-amaryllis

@micrantha/amaryllis-components
```

The shared core package is a runtime dependency of the React Native root package. Release validation therefore treats the package graph as one preflight unit even though components remains independently consumable.

## Continuous integration

The main CI workflow keeps the stable root/components jobs and adds a dedicated `package-preflight` job. That job uses one checkout and one project-owned Nix toolchain to:

1. test the package-release contract helpers;
2. typecheck and build `@micrantha/amaryllis`;
3. build `@micrantha/react-native-amaryllis`;
4. build `@micrantha/amaryllis-components`;
5. validate all three package manifests and entrypoints;
6. stage the exact file sets reported by `npm pack --dry-run --json`;
7. replace `workspace:` dependency specifiers only in staged manifests;
8. reject undeclared runtime imports in built JavaScript;
9. pack exact tarballs for all three packages;
10. install those tarballs into a temporary project outside the workspace and run package/import smoke tests.

`scripts/validate-packages.mjs` validates package identity, versions, repository metadata, and required outputs. `scripts/package-preflight.mjs` owns the stronger artifact and clean-consumer contract.

The clean-consumer smoke test executes the shared core and `/context` entrypoints, constructs a minimal Context Engine, and verifies that the React Native root/context and components entrypoints are resolvable without pretending plain Node is a native React Native runtime.

## Exact release artifacts

Preflight writes:

- one `.tgz` for each publishable package;
- `package-release.json`, which records package names, effective versions, filenames, and publication order.

Production and canary publication must use those exact files. The hosted publish job must not rebuild or repack them.

Tarball digest/SBOM binding is tracked separately by #132.

## Publication order

Publication is intentionally sequential:

1. `@micrantha/amaryllis`;
2. `@micrantha/react-native-amaryllis`;
3. `@micrantha/amaryllis-components`.

If publication fails after one or more packages have been accepted by npm, the workflow reports the published, failed, and pending package versions. Recovery must confirm registry state and reuse the same preflight artifact set rather than rebuilding a new one.

## Trusted-publishing boundary

npm trusted publishing currently requires GitHub-hosted runners. The release workflows therefore split authority:

```text
runner-amaryllis
  build / test / typecheck / package preflight
  no npm OIDC minting authority
        ↓ exact workflow artifacts
ubuntu-latest
  npm trusted publishing only
  id-token: write
```

The self-hosted preflight job has read-only repository/actions permissions. `id-token: write` is granted only to the GitHub-hosted publication job.

npm automatically creates provenance attestations for public packages published through trusted publishing, so the hosted job does not rebuild the artifact or need a separate provenance-generation phase.

### npmjs.com configuration

Each publishable npm package must configure trusted publishers whose values match the workflow exactly:

- organization: `hackelia-micrantha`;
- repository: `amaryllis`;
- production workflow: `publish.yml`;
- production environment: `production` when configured on npm;
- canary workflow: `canary-publish.yml` if canary publication is enabled through OIDC.

The package manifests also carry repository metadata pointing to this GitHub repository, including package-directory metadata for the two workspace packages.

## Canary releases

Canary publication uses the same preflight and hosted handoff. All three packages receive a related prerelease suffix such as:

```text
0.1.0-canary.<run>.<sha>
0.1.7-canary.<run>.<sha>
```

The staged root manifest points to the exact canary core version, then all three tarballs are published with the `canary` dist-tag in dependency order.

## Manual preflight

`.github/workflows/test-publish.yml` runs the same package checks without publishing. It can optionally materialize a prerelease suffix to exercise staged-version rewriting.

## Generated output policy

Generated output remains build-derived and is never accepted as a substitute for compilation. The package preflight rebuilds publishable outputs before staging tarballs and validates the declared entrypoints in those staged artifacts.
