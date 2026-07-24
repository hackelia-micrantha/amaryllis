# AI components stabilization progress ledger

Issue #34 defines the ordered stabilization plan for the AI-enabled components work introduced by PR #30. PR #41 implemented schema, policy, runtime-personalization, and generator hardening on `feature/ai-components`, plus part of the CI and documentation work. Those changes are not yet present on `main` because PR #30 remains open.

This ledger records feature-branch progress without closing issues before their implementation reaches the default branch.

## Progress status

| Issue | Area | Status |
| --- | --- | --- |
| #35 | `ComponentSpec` schema and DSL contract | Implemented on `feature/ai-components` by PR #41; pending integration through PR #30. |
| #36 | Policy enforcement and threat boundaries | Implemented on `feature/ai-components` by PR #41; pending integration through PR #30. |
| #37 | Runtime personalization safety | Implemented on `feature/ai-components` by PR #41; pending integration through PR #30. |
| #38 | React generation and provenance | Implemented on `feature/ai-components` by PR #41; pending integration through PR #30. |
| #39 | Components workspace CI/package checks | Partially implemented on `feature/ai-components`. Explicit components `typecheck` coverage was added, but independent lint/test/build/pack validation, package metadata checks, permission documentation, release artifact validation, `dist` policy documentation, and PR #33 review remain open. |
| #40 | Branch-aware documentation and examples | Partially implemented on `feature/ai-components`. Stabilization and security documentation was added, but runnable YAML/CLI/runtime examples with success and failure paths and CI or manual verification remain open. |

## Parent issue status

Issue #34 remains open because:

- PR #30 has not merged `feature/ai-components` into `main`;
- #35 through #38 should remain open until their implementation reaches the default branch;
- #39 still requires the remaining CI, packaging, release, and dependency-review acceptance criteria;
- #40 still requires runnable end-to-end examples and verification instructions.

Issue #34 should close only after PR #30 is integrated and #39 and #40 are completed or explicitly deferred with rationale.

## Remaining work

### Integration

- merge or otherwise integrate PR #30 into `main`;
- close #35 through #38 only after the implementation is present on the default branch.

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

This progress record does not declare `@micrantha/amaryllis-components` generally stable. The package and `amaryllis/v1alpha1` contract remain experimental while PR #30, #39, and #40 are open.
