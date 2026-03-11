#!/usr/bin/env bash
#
# Publish each package to npm directly (instead of lerna publish).
# Idempotent — versions already on the registry are skipped,
# so re-running after a partial failure only publishes what's missing.
#
# Expects ~/.npmrc to be configured with registry auth before this
# script runs (handled by the "Log in to NPM registry" workflow step).
# Requires NODE_AUTH_TOKEN to be set in the environment (referenced
# by the ${NODE_AUTH_TOKEN} variable in ~/.npmrc).

set -euo pipefail

FAILED=0
for dir in packages/*; do
  NAME=$(node -p "require('./$dir/package.json').name")
  VERSION=$(node -p "require('./$dir/package.json').version")

  if npm view "${NAME}@${VERSION}" version >/dev/null 2>&1; then
    echo "Already published: ${NAME}@${VERSION}"
  else
    echo "Publishing ${NAME}@${VERSION}..."
    if npm publish "./$dir" --access public; then
      echo "Published ${NAME}@${VERSION}"
    else
      echo "::error::Failed to publish ${NAME}@${VERSION}"
      FAILED=1
    fi
  fi
done

if [ "$FAILED" -eq 1 ]; then
  echo "::error::One or more packages failed to publish. Re-run is safe — already-published versions are skipped."
  exit 1
fi
