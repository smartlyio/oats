#!/usr/bin/env bash
#
# Create or update a version bump PR.
#
# Commits the version-bumped package files to a dedicated branch and
# opens a PR against master. If a version bump PR already exists
# (from a previous feature merge), it is updated via force-push.
#
# Expects to be run from the repository root after `lerna version`
# has already bumped the package files on disk.
#
# Requires:
#   - GH_TOKEN in the environment (for `gh` CLI)
#   - /tmp/pr-entries.txt with included PR titles (optional)

set -euo pipefail

VERSION=$(node -p "require('./lerna.json').version")
BRANCH="chore/version-packages"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git checkout -b "$BRANCH"
git add -A

BODY=""
if [ -f /tmp/pr-entries.txt ]; then
  BODY=$(cat /tmp/pr-entries.txt)
fi

git commit -m "chore: version packages v${VERSION}" -m "$BODY"
git push -f origin "$BRANCH"

PR_BODY="## Version bump: v${VERSION}

This PR was automatically created by the Version workflow.
Merging it will publish all packages to npm at version **${VERSION}**.

### Included changes
${BODY:-_No PR entries found._}

---
> **Do not add additional code changes to this PR.**
> Just review the version bumps and merge when ready to release."

EXISTING_PR=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number')

if [ -n "$EXISTING_PR" ]; then
  gh pr edit "$EXISTING_PR" \
    --title "chore: version packages v${VERSION}" \
    --body "$PR_BODY"
  echo "Updated existing PR #${EXISTING_PR}"
else
  gh pr create \
    --title "chore: version packages v${VERSION}" \
    --body "$PR_BODY" \
    --label "no-release"
  echo "Created new version bump PR"
fi
