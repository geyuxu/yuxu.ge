#!/bin/bash
# Convert HEIC/HIF/ARW images to JPG
# Uses macOS sips (built-in) or ImageMagick
# ARW (Sony RAW) requires ImageMagick with raw delegate
#
# Usage:
#   ./convert-heic.sh           # Convert all HEIC/HIF/ARW to JPG
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
echo "Scanning for HEIC/HIF/ARW files in: $PHOTOS_DIR"
echo ""

count=0

# Find all HEIC/HIF/ARW files
find "$PHOTOS_DIR" -type f \( -iname "*.heic" -o -iname "*.hif" -o -iname "*.arw" \) | while read -r heic; do
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

    # Get file extension (lowercase)
    ext="${heic##*.}"
    ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

    if [ "$ext_lower" = "arw" ]; then
        # ARW (Sony RAW) requires ImageMagick
        if [ "$CONVERTER" = "sips" ]; then
            if command -v magick &> /dev/null; then
                magick "$heic" -auto-orient -quality 95 "$jpg"
            elif command -v convert &> /dev/null; then
                convert "$heic" -auto-orient -quality 95 "$jpg"
            else
                echo "✗ Skip (ARW needs ImageMagick): $(basename "$heic")"
                continue
            fi
        else
            $CONVERTER "$heic" -auto-orient -quality 95 "$jpg"
        fi
    elif [ "$CONVERTER" = "sips" ]; then
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
