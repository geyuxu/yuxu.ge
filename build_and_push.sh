#!/bin/bash
# Build site and push to GitHub
#
# Usage:
#   ./build_and_push.sh              # Build and push with auto commit message
#   ./build_and_push.sh "message"    # Build and push with custom commit message

set -e

cd "$(dirname "$0")"

# Run build
echo "=== Building Site ==="
./build.sh

echo ""
echo "=== Git Status ==="
git status --short

# Check if there are changes
if git diff --quiet && git diff --cached --quiet; then
    echo ""
    echo "No changes to commit."
    exit 0
fi

# Commit message (use parameter or default)
MSG="${1:-build: update site $(date '+%Y-%m-%d %H:%M')}"

echo ""
echo "=== Committing ==="
git add -A
git commit -m "$MSG"

echo ""
echo "=== Pushing ==="
git push

echo ""
echo "Done!"
