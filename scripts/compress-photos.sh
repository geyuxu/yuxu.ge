#!/bin/bash
# Compress photos for web
# Requires: ImageMagick (brew install imagemagick)
#
# Usage:
#   ./compress-photos.sh           # Compress all photos
#   ./compress-photos.sh --dry-run # Preview without changes
#   ./compress-photos.sh --force   # Ignore cache, reprocess all

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PHOTOS_DIR="$(cd "$SCRIPT_DIR/../photos" && pwd)"
CACHE_FILE="$PHOTOS_DIR/.compress-cache"
TEMP_LIST="/tmp/compress-photos-list-$$.txt"
MAX_WIDTH=2000
QUALITY=85

DRY_RUN=false
FORCE=false
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "=== DRY RUN MODE ==="
elif [ "$1" = "--force" ]; then
    FORCE=true
    echo "=== FORCE MODE (ignoring cache) ==="
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

# Ensure cache file exists
touch "$CACHE_FILE"

# Load cache count
if [ "$FORCE" = false ]; then
    cache_count=$(wc -l < "$CACHE_FILE" | tr -d ' ')
    echo "Loaded cache: $cache_count files"
fi

echo "Scanning photos in: $PHOTOS_DIR"
echo "Settings: max ${MAX_WIDTH}px width, ${QUALITY}% quality"
echo ""

# Find all images
find "$PHOTOS_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | grep -v "\-thumb" | grep -v "\-compressed" | sort > "$TEMP_LIST"

total=$(wc -l < "$TEMP_LIST" | tr -d ' ')

# Filter out cached files
if [ "$FORCE" = false ]; then
    # Create list of uncached files
    new_list="/tmp/compress-photos-new-$$.txt"
    > "$new_list"
    while IFS= read -r img; do
        if ! grep -qxF "$img" "$CACHE_FILE" 2>/dev/null; then
            echo "$img" >> "$new_list"
        fi
    done < "$TEMP_LIST"
    mv "$new_list" "$TEMP_LIST"
fi

new_count=$(wc -l < "$TEMP_LIST" | tr -d ' ')

echo "Total images: $total, New/uncached: $new_count"
echo ""

if [ "$new_count" -eq 0 ]; then
    echo "No new images to process."
    rm -f "$TEMP_LIST"
    echo "Done!"
    exit 0
fi

# Process images
while IFS= read -r img; do
    [ -z "$img" ] && continue

    # Get original size
    size_before=$(stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null)
    size_before_kb=$((size_before / 1024))

    # Get dimensions
    dimensions=$($CONVERT "$img" -format "%wx%h" info: 2>/dev/null)
    width=$(echo "$dimensions" | cut -d'x' -f1)

    # Skip if already small enough and well compressed
    if [ "$width" -le "$MAX_WIDTH" ] && [ "$size_before_kb" -lt 500 ]; then
        echo "✓ Skip (optimized): $(basename "$img") (${size_before_kb}KB)"
        # Add to cache
        [ "$DRY_RUN" = false ] && echo "$img" >> "$CACHE_FILE"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "Would compress: $(basename "$img") (${size_before_kb}KB, ${dimensions})"
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
        echo "✓ Skip (optimal): $(basename "$img") (${size_before_kb}KB)"
    fi

    # Add to cache
    echo "$img" >> "$CACHE_FILE"
done < "$TEMP_LIST"

rm -f "$TEMP_LIST"
echo ""
echo "Done!"
