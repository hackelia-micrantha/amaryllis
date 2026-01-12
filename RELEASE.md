# Release Process

This document describes the automated release process for `@micrantha/react-native-amaryllis`.

## 🎯 Overview

Automated npm publishing with GitHub Actions OIDC trusted publishing, ensuring secure, zero-token deployments with full quality validation.

## 🔄 Release Process

### Development Workflow

1. **Make Changes**

   ```bash
   # Standard development
   npm test && npm run lint && npm run typecheck

   # Commit changes
   git commit -m "feat: new feature"
   ```

2. **Push Changes**
   ```bash
   git push origin main  # Triggers CI but no publish
   ```

### Automated Release Workflow

1. **Version Bump & Tag**

   ```bash
   # Standard release (updates package.json, creates tag, pushes both)
   npm version patch    # Creates v0.1.3

   # Major release (breaking changes)
   npm version major     # Creates v1.0.0

   # Minor release (new features)
   npm version minor     # Creates v0.2.0
   ```

2. **Automated Publishing**
   ```bash
   git push origin main --follow-tags  # Pushes commit + tag
   # → GitHub Actions automatically publishes to npm
   ```

## 🏗️ Architecture

### GitHub Actions Workflows

#### Test Workflow (`.github/workflows/test-publish.yml`)

- **Trigger**: Manual (`workflow_dispatch`)
- **Purpose**: Safe testing without publishing
- **Features**: Dry-run npm pack, full validation
- **Usage**:
  ```bash
  gh workflow run "Test Publish Workflow"
  ```

#### Production Workflow (`.github/workflows/publish.yml`)

- **Trigger**: Tag pushes (`v*`)
- **Purpose**: Automated npm publishing
- **Features**:
  - OIDC trusted publisher authentication
  - Full quality gates (test, lint, typecheck, build)
  - Automatic provenance generation
  - Zero npm tokens required

#### Enhanced CI Workflow (`.github/workflows/ci.yml`)

- **Updates**: Node.js v24, latest stable action versions
- **Features**: Improved caching, mobile builds, comprehensive testing

## 🔐 Security Features

### OIDC Trusted Publisher

- **Configuration**:
  - Organization: `hackelia-micrantha`
  - Repository: `amaryllis`
  - Workflow: `publish.yml`
- **Benefits**:
  - Zero npm tokens needed
  - Short-lived, cryptographically-signed credentials
  - Automatic provenance generation
  - Enhanced security posture

### Tag Protection

- **Rules**: Only `ryjen` and `hackelia-micrantha` team can create `v*` tags
- **Protection**: Requires status checks, prevents force pushes
- **Benefits**: Prevents unauthorized releases

## 🚀 Quality Gates

All automated releases include comprehensive validation:

### Pre-Publish Validation

```bash
npm test              # Full test suite
npm run lint          # Code quality checks
npm run typecheck      # TypeScript validation
yarn prepare          # Build package
```

### Package Validation

```bash
# Verify built files and metadata
node -e "console.log('Package:', JSON.parse(require('fs').readFileSync('./package.json', 'utf8')).name)"
node -e "console.log('Version:', JSON.parse(require('fs').readFileSync('./package.json', 'utf8')).version)"
ls -la lib/           # Verify build artifacts
```

## 📦 Publishing Command

### Automated Publishing

```bash
npm publish --provenance --access public
```

- **Authentication**: OIDC (no tokens)
- **Provenance**: Automatic cryptographic proof
- **Registry**: npmjs.org
- **Access**: Public

## 📊 Workflow Status Monitoring

### Check Recent Runs

```bash
# List recent workflows
gh run list --limit=10

# Check specific workflow
gh run view <workflow-id>

# Monitor running workflow
gh run view --job=<job-id>
```

### Debug Publishing Issues

```bash
# Check failed publish workflow
gh run view <workflow-id> --log-failed

# Common issues:
# - "NEEDAUTH" error: Trusted publisher not configured
# - Cache failures: Temporary GitHub Actions issue
# - Tag exists: Use new tag name
```

## 🛠 Troubleshooting

### Common Issues & Solutions

#### "npm error code ENEEDAUTH"

- **Cause**: Trusted publisher not configured correctly
- **Solution**:
  1. Check npmjs.com trusted publisher settings
  2. Verify organization: `hackelia-micrantha`
  3. Verify repository: `amaryllis`
  4. Verify workflow: `publish.yml`

#### Tag Already Exists

- **Cause**: Git tag already exists locally
- **Solution**:
  ```bash
  git tag -d v0.1.2
  git tag v0.1.3
  ```

#### Workflow Not Triggered

- **Cause**: Tag push not triggering publish workflow
- **Solution**:
  1. Check tag format (must be `v*`)
  2. Verify workflow trigger configuration
  3. Check tag protection rules

#### CI Cache Failures

- **Cause**: Temporary GitHub Actions caching issues
- **Solution**:
  1. Re-run workflow
  2. Caches are ephemeral, retry usually works
  3. Check cache action configuration

## 📝 Best Practices

### Release Validation

- [ ] All tests pass locally
- [ ] Code follows linting rules
- [ ] TypeScript compilation succeeds
- [ ] Build completes without errors
- [ ] Package.json is valid

### Security Checks

- [ ] Two-factor authentication enabled on npmjs.com
- [ ] "Require 2FA and disallow tokens" enabled
- [ ] Tag protection rules configured
- [ ] Only authorized team members can create release tags

### Documentation Updates

- [ ] CHANGELOG.md updated with release notes
- [ ] GitHub release created (optional)
- [ ] Documentation reflects new features

## 🎯 Benefits Achieved

### Before Automation

❌ Manual `npm publish` commands
❌ Token management overhead
❌ Risk of token exposure
❌ Manual provenance generation (optional)
❌ Release process prone to human error

### After Automation

✅ Zero npm tokens needed
✅ OIDC secure authentication
✅ Automatic provenance generation
✅ Full quality validation before publish
✅ Consistent, repeatable process
✅ Enhanced security controls
✅ Manual control maintained via tag creation
✅ Streamlined development workflow

---

**Last Updated**: 2025-01-12  
**Version**: 1.0  
**Status**: Production Ready ✅
