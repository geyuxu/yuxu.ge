#!/bin/bash
# Clear generated files and caches

cd "$(dirname "$0")"

echo "Cleaning generated files..."

# Remove build outputs
rm -rf blog/static/
rm -rf blog/medium/

# Remove caches
rm -f blog/.gist-cache.json
rm -f blog/.table-cache.json

# Remove generated table images
rm -rf blog/images/tables/

echo "✓ Cleaned:"
echo "  - blog/static/"
echo "  - blog/medium/"
echo "  - blog/images/tables/"
echo "  - blog/.gist-cache.json"
echo "  - blog/.table-cache.json"
