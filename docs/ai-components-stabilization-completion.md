# AI components stabilization progress ledger

Issue #34 defines the ordered stabilization plan for the AI-enabled components work introduced by PR #30. PR #41 implemented the schema, policy, runtime-personalization, and generator hardening slices, plus part of the CI and documentation work. This ledger records that progress without overstating completion of the remaining roadmap.

## Progress status

| Issue | Area | Status |
| --- | --- | --- |
| #35 | `ComponentSpec` schema and DSL contract | Completed in PR #41. The schema rejects undeclared required props and unsafe prop, slot, variant, and design token identifiers. |
| #36 | Policy enforcement and threat boundaries | Completed in PR #41. Policy failures expose stable codes/issues and device execution remains fail-closed for executable, unsafe, or under-declared runtime behavior. |
| #37 | Runtime personalization safety | Completed in PR #41. Personalization validation rejects unsafe object keys, constrains patch paths to declared personalization paths, and exposes validation diagnostics. |
| #38 | React generation and provenance | Completed in PR #41. Generated output is deterministic by default, includes generator provenance, and rejects unsafe layout constructs before code generation. |
| #39 | Components workspace CI/package checks | Partially completed in PR #41. Explicit components `typecheck` coverage was added to publish and test-publish workflows. Independent lint/test/build/pack validation, package metadata checks, permission documentation, release artifact validation, `dist` policy documentation, and PR #33 review remain open. |
| #40 | Branch-aware documentation and examples | Partially completed in PR #41. Stabilization and security documentation was added, but runnable YAML/CLI/runtime examples with success and failure paths and CI or manual verification remain open. |

## Parent issue status

PR #41 intentionally grouped several ordered child slices into one stabilization PR rather than splitting every child into a separate PR. It is sufficient to close #35 through #38 because those implementation boundaries were directly addressed and tested.

Issue #34 remains open because its ordered roadmap is not complete:

- #39 still requires the remaining CI, packaging, release, and dependency-review acceptance criteria.
- #40 still requires runnable end-to-end examples and verification instructions.
- #34 should close only after #39 and #40 are completed or explicitly deferred with rationale.

## Remaining work

### Issue #39

- run components lint, test, build, typecheck, and pack checks independently in CI;
- exercise `npm pack --dry-run` for both packages;
- verify package names, versions, and build outputs before publish;
- document and constrain workflow permissions;
- validate or document GitHub Release artifact uploads;
- document intentional `dist` ignore behavior;
- review dependency PR #33 after the CI shape is stable.

### Issue #40

- add a realistic `ComponentSpec` YAML fixture;
- document CLI flows for `generate`, `contract`, and `customize`;
- add a registered-component runtime personalization example;
- show valid and invalid personalization behavior;
- provide CI validation or reproducible manual verification commands;
- link the runnable examples from the branch-aware documentation.

## Scope boundary

This progress record does not declare `@micrantha/amaryllis-components` generally stable. The package and `amaryllis/v1alpha1` contract remain experimental while #39 and #40 are open.
