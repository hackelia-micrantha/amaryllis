# Changelog

All notable changes to this project will be documented in this file.

This project follows Semantic Versioning. In addition to Added/Changed/Fixed,
each release includes an **Upgrade impact** section to indicate whether a
future **minor** or **major** bump is required for similar changes.


## [0.1.5] - 2026-01-17

### Upgrade impact
- Minor: new optional APIs and new subpath exports.
- Major (future): removal of deprecated callbacks or breaking import changes.

### Added
- Context Engine provider and context-aware inference hooks.
- Context formatter and default query factory on `ContextEngine`.
- `/context` subpath export for context APIs.

### Changed
- Documentation and examples now show context integration.
- Project paths include `react-native-amaryllis/context` for TypeScript.

### Fixed
- None.

## [0.1.6] - 2026-02-10

### Upgrade impact
- Patch: CI/CD and release automation only; no runtime API changes.
- Minor (future): broader release pipeline surface if additional channels or package outputs are introduced.

### Added
- GitHub Actions workflows for package publishing, canary publishing, dry-run publish validation, workflow linting, coverage gates, compatibility checks, and release drafting.
- OIDC-based npm trusted publishing with provenance generation for package releases.

### Changed
- Release process is now automated through GitHub Actions instead of relying on manual npm publishing.
- CI validation now includes stronger release readiness checks before publication.

### Fixed
- Reduced manual release risk by moving package publication onto a repeatable workflow-driven path.

## [0.1.7] - 2026-03-05

### Upgrade impact
- Patch: workflow reliability, security scan behavior, and test coverage only; no public API changes.
- Minor (future): additional CI gates if release governance expands beyond current required workflows.

### Added
- Extra automated tests to improve validation coverage in CI.
- Release gating that requires `CI`, `Dependency Audit`, and `Security - CodeQL` to pass for the target commit before canary or production publishing proceeds.

### Changed
- Dependency audit now runs for every push to `main`, waits for install-producing workflows to finish, and audits all workspaces recursively at high severity.
- CodeQL workflow triggers now avoid duplicate analysis on feature-branch pull request pushes while still covering `main`, pull requests, merge queues, and scheduled scans.
- Release documentation now reflects publish gating on upstream workflow success.

### Fixed
- Prevented duplicate CodeQL runs on pull request branches.
- Fixed canary and production publish flows so they do not publish while required validation workflows are failing or still in progress.
