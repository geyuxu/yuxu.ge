#!/bin/bash
# Build site
# Usage:
#   ./build.sh           # Build all
#   ./build.sh --static  # Static only
#   ./build.sh --medium  # Medium only
#   ./build.sh --photos  # Process photos only (convert + compress)

cd "$(dirname "$0")"

# Photos only mode
if [ "$1" = "--photos" ]; then
    echo "=== Processing Photos ==="
    echo ""
    echo "--- Converting HEIC to JPG ---"
    ./scripts/convert-heic.sh
    echo ""
    echo "--- Compressing Photos ---"
    ./scripts/compress-photos.sh
    exit 0
fi

# Process photos first (convert HEIC, then compress)
echo "=== Converting HEIC to JPG ==="
./scripts/convert-heic.sh
echo ""
echo "=== Compressing Photos ==="
./scripts/compress-photos.sh
echo ""

# Generate posts.json from markdown frontmatter
echo "=== Building Blog ==="
node blog/build-posts-json.js

# Generate photos.json from folder structure
echo "=== Building Gallery ==="
node gallery/build-photos-json.js

# Build search index (optional, requires OPENAI_API_KEY)
if [ -n "$OPENAI_API_KEY" ]; then
    echo ""
    echo "=== Building Search Index ==="
    node --experimental-wasm-modules scripts/index-builder.mjs
else
    echo ""
    echo "=== Skipping Search Index (OPENAI_API_KEY not set) ==="
fi

# Build static/medium
cd blog && node build.js "$@"
