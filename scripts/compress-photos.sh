#!/bin/bash
# Compress photos for web
# Requires: ImageMagick (brew install imagemagick)
#
# Usage:
#   ./compress-photos.sh           # Compress all photos
#   ./compress-photos.sh --dry-run # Preview without changes

set -e

PHOTOS_DIR="$(dirname "$0")/../photos"
MAX_WIDTH=2000
QUALITY=85

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "=== DRY RUN MODE ==="
fi

# Check ImageMagick
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

# Use magick or convert
if command -v magick &> /dev/null; then
    CONVERT="magick"
else
    CONVERT="convert"
fi

echo "Scanning photos in: $PHOTOS_DIR"
echo "Settings: max ${MAX_WIDTH}px width, ${QUALITY}% quality"
echo ""

total_before=0
total_after=0
count=0

# Find all images
find "$PHOTOS_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | while read -r img; do
    # Skip already compressed files
    if [[ "$img" == *"-thumb"* ]] || [[ "$img" == *"-compressed"* ]]; then
        continue
    fi

    # Get original size
    size_before=$(stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null)
    size_before_kb=$((size_before / 1024))

    # Get dimensions
    dimensions=$($CONVERT "$img" -format "%wx%h" info: 2>/dev/null)
    width=$(echo "$dimensions" | cut -d'x' -f1)

    # Skip if already small enough and well compressed
    if [ "$width" -le "$MAX_WIDTH" ] && [ "$size_before_kb" -lt 500 ]; then
        echo "✓ Skip (already optimized): $(basename "$img") (${size_before_kb}KB)"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "Would compress: $img (${size_before_kb}KB, ${dimensions})"
        continue
    fi

    # Create temp file
    tmp_file="${img}.tmp"

    # Compress: auto-orient first (apply EXIF rotation), then resize and strip
    $CONVERT "$img" \
        -auto-orient \
        -resize "${MAX_WIDTH}x>" \
        -quality "$QUALITY" \
        -strip \
        -interlace Plane \
        "$tmp_file"

    # Get new size
    size_after=$(stat -f%z "$tmp_file" 2>/dev/null || stat -c%s "$tmp_file" 2>/dev/null)
    size_after_kb=$((size_after / 1024))

    # Only keep if smaller
    if [ "$size_after" -lt "$size_before" ]; then
        mv "$tmp_file" "$img"
        saved=$((size_before_kb - size_after_kb))
        echo "✓ Compressed: $(basename "$img") ${size_before_kb}KB → ${size_after_kb}KB (-${saved}KB)"
    else
        rm "$tmp_file"
        echo "✓ Skip (already optimal): $(basename "$img") (${size_before_kb}KB)"
    fi
done

echo ""
echo "Done!"
