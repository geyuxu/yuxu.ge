#!/bin/bash
# Build blog (static + medium)
# Usage:
#   ./build.sh           # Build both
#   ./build.sh --static  # Static only
#   ./build.sh --medium  # Medium only

cd "$(dirname "$0")/blog" && node build.js "$@"
