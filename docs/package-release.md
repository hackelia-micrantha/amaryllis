# Package CI and release safeguards

Amaryllis publishes two npm packages from one repository:

- `@micrantha/react-native-amaryllis` from the repository root;
- `@micrantha/amaryllis-components` from `packages/amaryllis-components`.

## Continuous integration

The main CI workflow keeps the root package checks and adds an explicit components-package job. The components job runs tests, lint, typechecking, compilation, package metadata validation, and `npm pack --dry-run` for both packages.

Package validation is centralized in `scripts/validate-packages.mjs`. It fails when:

- a package name differs from the expected public name;
- a version is not valid semantic version syntax;
- a required `main`, `types`, or `bin` entry is missing;
- a declared package entrypoint does not exist after building.

The same validator runs in CI, the manual test-publish workflow, and the production publish workflow so release checks cannot drift from pull-request checks.

## Release permissions

The test-publish workflow has read-only repository access.

The production publish workflow requires:

- `actions: read` to confirm required workflows passed for the tagged commit;
- `contents: write` to create or update the GitHub Release;
- `id-token: write` for npm trusted publishing with provenance.

The workflow removes token-based npm authentication before publishing and publishes through npm OIDC trusted publishing.

## Release archives

Both packages are packed before publishing. The resulting tarballs are uploaded to the GitHub Release associated with the version tag. Existing release assets with the same names are replaced.

## Generated output policy

The root package output directory, `lib`, is generated and ignored.

The components package output directory, `packages/amaryllis-components/dist`, is intentionally exempted from the repository-wide `dist` ignore rule because the feature branch currently carries generated components-package output for review and packaging compatibility. CI always rebuilds it and validates the declared entrypoints; checked-in output is not trusted as a substitute for compilation.
