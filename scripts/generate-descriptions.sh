#!/bin/bash
# Generate description.md for photo albums without one
# Uses: Claude CLI > Gemini CLI > OpenAI API (in order of preference)
# With timeout and error handling for graceful fallback

set -e
cd "$(dirname "$0")/.."

PHOTOS_DIR="photos"
TIMEOUT_SECONDS=60

# Cross-platform timeout command (macOS uses gtimeout or perl fallback)
run_with_timeout() {
    local seconds=$1
    shift
    if command -v timeout >/dev/null 2>&1; then
        timeout "${seconds}s" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "${seconds}s" "$@"
    else
        # Perl-based fallback for macOS
        perl -e 'alarm shift; exec @ARGV' "$seconds" "$@"
    fi
}

# Check available AI tools
has_claude() { command -v claude >/dev/null 2>&1; }
has_gemini() { command -v gemini >/dev/null 2>&1; }
has_openai() { [ -n "$OPENAI_API_KEY" ]; }

# Check if output looks like an error
is_error_response() {
    local output="$1"
    # Empty or null
    [ -z "$output" ] && return 0
    [ "$output" = "null" ] && return 0

    # Common error patterns (case insensitive)
    echo "$output" | grep -qiE "(error|rate.?limit|quota|exceeded|unauthorized|invalid|failed|timeout|exception)" && return 0

    # Too short to be a valid description
    [ ${#output} -lt 20 ] && return 0

    return 1
}

# Generate description using Claude CLI (with timeout)
generate_with_claude() {
    local location="$1"
    local date="$2"
    local output
    local exit_code

    output=$(run_with_timeout ${TIMEOUT_SECONDS} claude -p "Generate a short, evocative 1-2 sentence description for a photo album titled '$location' taken on $date. The description should be poetic yet informative, suitable for a photography portfolio. Output only the description text, no quotes or extra formatting." --dangerously-skip-permissions 2>&1) || exit_code=$?

    # Check timeout (exit code 124)
    if [ "$exit_code" = "124" ]; then
        echo "  [Claude CLI timeout after ${TIMEOUT_SECONDS}s]" >&2
        return 1
    fi

    # Check for errors in output
    if is_error_response "$output"; then
        echo "  [Claude CLI error or invalid response]" >&2
        return 1
    fi

    echo "$output"
    return 0
}

# Generate description using Gemini CLI (with timeout)
generate_with_gemini() {
    local location="$1"
    local date="$2"
    local output
    local exit_code

    output=$(run_with_timeout ${TIMEOUT_SECONDS} gemini "Generate a short, evocative 1-2 sentence description for a photo album titled '$location' taken on $date. The description should be poetic yet informative, suitable for a photography portfolio. Output only the description text, no quotes or extra formatting." -y 2>&1) || exit_code=$?

    # Check timeout
    if [ "$exit_code" = "124" ]; then
        echo "  [Gemini CLI timeout after ${TIMEOUT_SECONDS}s]" >&2
        return 1
    fi

    # Check for errors in output
    if is_error_response "$output"; then
        echo "  [Gemini CLI error or invalid response]" >&2
        return 1
    fi

    echo "$output"
    return 0
}

# Generate description using OpenAI API (with timeout)
generate_with_openai() {
    local location="$1"
    local date="$2"
    local prompt="Generate a short, evocative 1-2 sentence description for a photo album titled '$location' taken on $date. The description should be poetic yet informative, suitable for a photography portfolio. Output only the description text, no quotes or extra formatting."
    local response
    local output

    response=$(run_with_timeout ${TIMEOUT_SECONDS} curl -s https://api.openai.com/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d "{
            \"model\": \"gpt-4o-mini\",
            \"messages\": [{\"role\": \"user\", \"content\": $(echo "$prompt" | jq -Rs .)}],
            \"max_tokens\": 150
        }" 2>&1) || {
        echo "  [OpenAI API timeout or connection error]" >&2
        return 1
    }

    # Check for API error in response
    if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
        local error_msg=$(echo "$response" | jq -r '.error.message // .error.type // "unknown error"')
        echo "  [OpenAI API error: $error_msg]" >&2
        return 1
    fi

    output=$(echo "$response" | jq -r '.choices[0].message.content // empty')

    if is_error_response "$output"; then
        echo "  [OpenAI API invalid response]" >&2
        return 1
    fi

    echo "$output"
    return 0
}

# Generate description with fallback
generate_description() {
    local location="$1"
    local date="$2"
    local result=""

    if has_claude; then
        echo "  Trying Claude CLI..." >&2
        if result=$(generate_with_claude "$location" "$date"); then
            echo "$result"
            return 0
        fi
        echo "  Fallback from Claude CLI..." >&2
    fi

    if has_gemini; then
        echo "  Trying Gemini CLI..." >&2
        if result=$(generate_with_gemini "$location" "$date"); then
            echo "$result"
            return 0
        fi
        echo "  Fallback from Gemini CLI..." >&2
    fi

    if has_openai; then
        echo "  Trying OpenAI API..." >&2
        if result=$(generate_with_openai "$location" "$date"); then
            echo "$result"
            return 0
        fi
        echo "  Fallback from OpenAI API..." >&2
    fi

    echo "  All AI tools failed" >&2
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
echo "Timeout: ${TIMEOUT_SECONDS}s per request"
echo ""

generated=0
skipped=0
failed=0

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
        if description=$(generate_description "$location" "$date"); then
            echo "$description" > "$album_dir/description.md"
            echo "✓ Created: $album_dir/description.md"
            ((generated++))
        else
            echo "✗ Failed: $year/$album (all tools failed)"
            ((failed++))
        fi
        echo ""
    done
done

echo "Done! Generated: $generated, Skipped: $skipped, Failed: $failed"
