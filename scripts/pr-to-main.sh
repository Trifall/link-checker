#!/usr/bin/env bash
# Create a PR from develop to main without workflow files leaking.
# Usage: ./scripts/pr-to-main.sh [PR title]
#
# This creates a temporary branch based on develop, removes workflow files,
# and pushes it for a PR to main. The workflow files are restored on develop
# automatically (no changes committed to develop).

set -euo pipefail

PR_TITLE="${1:-Release}"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
	echo "Error: must be on develop branch"
	exit 1
fi

if ! git diff-index --quiet HEAD --; then
	echo "Error: working tree is dirty. Commit or stash changes first."
	exit 1
fi

TEMP_BRANCH="pr-to-main-$(date +%Y%m%d%H%M%S)"

echo "Creating temp branch: $TEMP_BRANCH"
git checkout -b "$TEMP_BRANCH"

echo "Removing workflow files for main-compatible PR..."
git rm -q .github/workflows/ci.yml .github/workflows/release-please.yml 2>/dev/null || true
git commit -m "chore: remove workflow files for main compatibility" --allow-empty

echo "Pushing $TEMP_BRANCH..."
git push origin "$TEMP_BRANCH"

echo ""
echo "Done. Create a PR from $TEMP_BRANCH → main:"
echo "  gh pr create --base main --head $TEMP_BRANCH --title \"$PR_TITLE\""

git checkout develop
git branch -d "$TEMP_BRANCH" 2>/dev/null || true
