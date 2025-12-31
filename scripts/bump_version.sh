#!/bin/bash

# Configuration
# Path relative to root (script is run from root by hook)
VERSION_FILE="VERSION"

# Ensure version file exists
if [ ! -f "$VERSION_FILE" ]; then
    echo "v1.0.0" > "$VERSION_FILE"
fi

# Read current version
CURRENT_VERSION=$(cat "$VERSION_FILE")

# Remove 'v' prefix if present
VERSION_NUM=${CURRENT_VERSION#v}

# Split into array
IFS='.' read -r -a parts <<< "$VERSION_NUM"

MAJOR=${parts[0]}
MINOR=${parts[1]}
PATCH=${parts[2]}

# Increment Patch (simple logic: v1.0.0 -> v1.0.1)
PATCH=$((PATCH + 1))

# Reconstruct
NEW_VERSION="v$MAJOR.$MINOR.$PATCH"

# Update file
echo "$NEW_VERSION" > "$VERSION_FILE"

# Output
echo "Version bumped: $CURRENT_VERSION -> $NEW_VERSION"

# STAGE the modified VERSION file so it is included in the CURRENT commit
git add "$VERSION_FILE"
