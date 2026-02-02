#!/bin/bash
# Generate description.md for photo albums without one
# Uses: Claude CLI > Gemini CLI > OpenAI API (in order of preference)

set -e
cd "$(dirname "$0")/.."

PHOTOS_DIR="photos"

# Check available AI tools
has_claude() { command -v claude >/dev/null 2>&1; }
has_gemini() { command -v gemini >/dev/null 2>&1; }
has_openai() { [ -n "$OPENAI_API_KEY" ]; }

# Generate description using Claude CLI
generate_with_claude() {
    local location="$1"
    local date="$2"
    claude -p "Generate a short, evocative 1-2 sentence description for a photo album titled '$location' taken on $date. The description should be poetic yet informative, suitable for a photography portfolio. Output only the description text, no quotes or extra formatting." --dangerously-skip-permissions 2>/dev/null
}

# Generate description using Gemini CLI
generate_with_gemini() {
    local location="$1"
    local date="$2"
    gemini "Generate a short, evocative 1-2 sentence description for a photo album titled '$location' taken on $date. The description should be poetic yet informative, suitable for a photography portfolio. Output only the description text, no quotes or extra formatting." -y 2>/dev/null
}

# Generate description using OpenAI API
generate_with_openai() {
    local location="$1"
    local date="$2"
    local prompt="Generate a short, evocative 1-2 sentence description for a photo album titled '$location' taken on $date. The description should be poetic yet informative, suitable for a photography portfolio. Output only the description text, no quotes or extra formatting."

    curl -s https://api.openai.com/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d "{
            \"model\": \"gpt-4o-mini\",
            \"messages\": [{\"role\": \"user\", \"content\": $(echo "$prompt" | jq -Rs .)}],
            \"max_tokens\": 150
        }" | jq -r '.choices[0].message.content // empty'
}

# Generate description with fallback
generate_description() {
    local location="$1"
    local date="$2"
    local result=""

    if has_claude; then
        echo "  Using Claude CLI..." >&2
        result=$(generate_with_claude "$location" "$date")
        if [ -n "$result" ] && [ "$result" != "null" ]; then
            echo "$result"
            return 0
        fi
    fi

    if has_gemini; then
        echo "  Using Gemini CLI..." >&2
        result=$(generate_with_gemini "$location" "$date")
        if [ -n "$result" ] && [ "$result" != "null" ]; then
            echo "$result"
            return 0
        fi
    fi

    if has_openai; then
        echo "  Using OpenAI API..." >&2
        result=$(generate_with_openai "$location" "$date")
        if [ -n "$result" ] && [ "$result" != "null" ]; then
            echo "$result"
            return 0
        fi
    fi

    echo "  No AI tool available or all failed" >&2
    return 1
}

# Parse folder name: "20260120-Leeds" -> date and location
parse_folder() {
    local folder="$1"
    if [[ "$folder" =~ ^([0-9]{4})([0-9]{2})([0-9]{2})-(.+)$ ]]; then
        local year="${BASH_REMATCH[1]}"
        local month="${BASH_REMATCH[2]}"
        local day="${BASH_REMATCH[3]}"
        local location="${BASH_REMATCH[4]}"
        # Remove "Part N" suffix for cleaner location
        location=$(echo "$location" | sed 's/ Part [0-9]*$//')
        echo "${year}-${month}-${day}|${location}"
    fi
}

# Main
echo "=== Generating Missing Descriptions ==="

if ! has_claude && ! has_gemini && ! has_openai; then
    echo "No AI tools available (need claude CLI, gemini CLI, or OPENAI_API_KEY)"
    exit 0
fi

echo "Available: $(has_claude && echo 'Claude CLI') $(has_gemini && echo 'Gemini CLI') $(has_openai && echo 'OpenAI API')"
echo ""

generated=0
skipped=0

# Scan all album folders
for year_dir in "$PHOTOS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -d "$year_dir" ] || continue
    year=$(basename "$year_dir")

    for album_dir in "$year_dir"/[0-9]*-*; do
        [ -d "$album_dir" ] || continue
        album=$(basename "$album_dir")

        # Skip if description already exists
        if [ -f "$album_dir/description.md" ] || [ -f "$album_dir/description.txt" ]; then
            ((skipped++))
            continue
        fi

        # Parse folder name
        parsed=$(parse_folder "$album")
        if [ -z "$parsed" ]; then
            echo "⚠ Skip: $year/$album (invalid format)"
            continue
        fi

        date=$(echo "$parsed" | cut -d'|' -f1)
        location=$(echo "$parsed" | cut -d'|' -f2)

        echo "Generating: $year/$album"
        description=$(generate_description "$location" "$date")

        if [ -n "$description" ]; then
            echo "$description" > "$album_dir/description.md"
            echo "✓ Created: $album_dir/description.md"
            ((generated++))
        else
            echo "✗ Failed: $year/$album"
        fi
        echo ""
    done
done

echo "Done! Generated: $generated, Skipped (already exists): $skipped"
