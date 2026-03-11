#!/usr/bin/env bash
#
# Determine the version bump type from merged PR labels.
#
# Finds the last "chore: version packages" commit as the boundary,
# queries the GitHub API for PRs merged after it, and picks the
# highest bump (major > minor > patch). PR titles are written to
# /tmp/pr-entries.txt for inclusion in the version bump PR.
#
# Requires:
#   - GH_TOKEN in the environment (for `gh` CLI)
#   - Full git history (fetch-depth: 0)
#   - GITHUB_OUTPUT pointing to the step outputs file
#
# Outputs:
#   - bump: the resolved bump type (patch, minor, major, or empty)

set -euo pipefail

LAST_VERSION_SHA=$(git log --grep="^chore: version packages" -1 --format=%H)

if [ -n "$LAST_VERSION_SHA" ]; then
  SINCE_DATE=$(git log -1 --format=%aI "$LAST_VERSION_SHA")
  echo "Last version commit: $(git log -1 --oneline "$LAST_VERSION_SHA")"
  echo "Looking for PRs merged after: $SINCE_DATE"
else
  SINCE_DATE="2000-01-01T00:00:00Z"
  echo "No version commits found — scanning all merged PRs"
fi

PRS=$(gh pr list --state merged --base master --limit 100 \
  --json number,title,labels,mergedAt)

FILTERED=$(echo "$PRS" | jq -c --arg since "$SINCE_DATE" \
  '[.[] | select(.mergedAt > $since)]')

COUNT=$(echo "$FILTERED" | jq 'length')
echo "Found $COUNT merged PR(s) since last version"

BUMP=""
rm -f /tmp/pr-entries.txt
NUMBERS=$(echo "$FILTERED" | jq -r '.[].number')

for NUMBER in $NUMBERS; do
  PR=$(echo "$FILTERED" | jq -c ".[] | select(.number == $NUMBER)")
  TITLE=$(echo "$PR" | jq -r '.title')
  LABEL_NAMES=$(echo "$PR" | jq -r '[.labels[].name] | join(" ")')

  if echo "$TITLE" | grep -q "^chore: version packages"; then
    echo "  skip (version commit): #$NUMBER"
    continue
  fi

  if echo "$LABEL_NAMES" | grep -q "no-release"; then
    echo "  skip (no-release): #$NUMBER — $TITLE"
    continue
  fi

  PR_BUMP=""
  if echo "$LABEL_NAMES" | grep -q "major"; then PR_BUMP="major"
  elif echo "$LABEL_NAMES" | grep -q "minor"; then PR_BUMP="minor"
  elif echo "$LABEL_NAMES" | grep -q "patch"; then PR_BUMP="patch"
  fi

  if [ -z "$PR_BUMP" ]; then
    echo "  skip (no release label): #$NUMBER — $TITLE"
    continue
  fi

  if [ "$PR_BUMP" = "major" ]; then
    BUMP="major"
  elif [ "$PR_BUMP" = "minor" ] && [ "$BUMP" != "major" ]; then
    BUMP="minor"
  elif [ "$PR_BUMP" = "patch" ] && [ -z "$BUMP" ]; then
    BUMP="patch"
  fi

  echo "- ${TITLE} (#${NUMBER})" >> /tmp/pr-entries.txt
  echo "  included ($PR_BUMP): #$NUMBER — $TITLE"
done

echo ""
echo "Resolved bump type: ${BUMP:-none}"
echo "bump=$BUMP" >> "$GITHUB_OUTPUT"
