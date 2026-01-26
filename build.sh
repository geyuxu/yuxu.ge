#!/bin/bash
# Build blog (static + medium)
# Usage:
#   ./build.sh           # Build both
#   ./build.sh --static  # Static only
#   ./build.sh --medium  # Medium only

cd "$(dirname "$0")/blog"

# Generate posts.json from markdown frontmatter
node build-posts-json.js

# Build static/medium
node build.js "$@"
