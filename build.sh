#!/bin/bash
# Build site
# Usage:
#   ./build.sh           # Build all
#   ./build.sh --static  # Static only
#   ./build.sh --medium  # Medium only

cd "$(dirname "$0")"

# Generate posts.json from markdown frontmatter
node blog/build-posts-json.js

# Generate photos.json from folder structure
node gallery/build-photos-json.js

# Build static/medium
cd blog && node build.js "$@"
