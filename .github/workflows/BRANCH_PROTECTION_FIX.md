# Branch Protection Fix for Automated Publishing

## Problem

When publishing packages in GitHub Actions on a protected `master` branch, the workflow fails with branch protection errors even though:
- the version bump step does not push changes directly
- A GitHub App token with bypass permissions is configured

## Root Cause

The issue occurs because:

1. **Git credential persistence**: `actions/checkout@v4` persists git credentials using the default `GITHUB_TOKEN` by default, even when a different token is passed to the checkout action. This means subsequent git operations (including those performed by Lerna) may use the wrong token.

2. **Versioning step git operations**: Even when the version bump step does not push, it may still perform git operations that require authentication. If these operations use the default `GITHUB_TOKEN` instead of the GitHub App token, they will fail on protected branches.

3. **Git remote URL**: The git remote URL needs to be explicitly configured with the app token to ensure all git operations authenticate correctly.

## Solution

The fix involves two changes:

1. **Disable credential persistence in checkout**: Set `persist-credentials: false` in the checkout action to prevent it from persisting the default `GITHUB_TOKEN`.

2. **Explicitly configure git credentials**: After checkout, configure git to use the GitHub App token for all operations by:
   - Setting git user name and email
   - Updating the git remote URL to include the app token

This ensures that all git operations use the GitHub App token, which has permission to bypass branch protection rules.

## References

- [actions/checkout issue #344](https://github.com/actions/checkout/issues/344) - Push to protected branch
- [semantic-release/git issue #196](https://github.com/semantic-release/git/issues/196#issuecomment-600842086) - Solution pattern

## Verification

After applying this fix, the workflow should:
- Successfully run the version bump step without branch protection errors
- Commit version bumps to master using the GitHub App token
- Push tags and commits without authentication issues
