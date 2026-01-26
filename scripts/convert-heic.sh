#!/bin/bash
# Convert HEIC images to JPG
# Uses macOS sips (built-in) or ImageMagick
#
# Usage:
#   ./convert-heic.sh           # Convert all HEIC to JPG
#   ./convert-heic.sh --dry-run # Preview without changes

set -e

PHOTOS_DIR="$(dirname "$0")/../photos"

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "=== DRY RUN MODE ==="
fi

# Check for conversion tool
if command -v sips &> /dev/null; then
    CONVERTER="sips"
elif command -v magick &> /dev/null; then
    CONVERTER="magick"
elif command -v convert &> /dev/null; then
    CONVERTER="convert"
else
    echo "Error: No HEIC converter found. Need sips (macOS) or ImageMagick"
    exit 1
fi

echo "Using converter: $CONVERTER"
echo "Scanning for HEIC files in: $PHOTOS_DIR"
echo ""

count=0

# Find all HEIC files
find "$PHOTOS_DIR" -type f \( -iname "*.heic" -o -iname "*.HEIC" \) | while read -r heic; do
    # Output filename (replace extension)
    jpg="${heic%.*}.jpg"

    # Skip if JPG already exists
    if [ -f "$jpg" ]; then
        echo "✓ Skip (JPG exists): $(basename "$heic")"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "Would convert: $(basename "$heic") → $(basename "$jpg")"
        continue
    fi

    echo "Converting: $(basename "$heic")"

    if [ "$CONVERTER" = "sips" ]; then
        sips -s format jpeg "$heic" --out "$jpg" > /dev/null 2>&1
    else
        # Use -auto-orient to apply EXIF rotation to pixel data
        $CONVERTER "$heic" -auto-orient "$jpg"
    fi

    # Remove original HEIC after successful conversion
    if [ -f "$jpg" ]; then
        rm "$heic"
        echo "✓ Converted: $(basename "$heic") → $(basename "$jpg")"
        ((count++)) || true
    else
        echo "✗ Failed: $(basename "$heic")"
    fi
done

echo ""
echo "Done!"
