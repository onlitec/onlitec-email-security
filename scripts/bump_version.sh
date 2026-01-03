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
# Update file
echo "$NEW_VERSION" > "$VERSION_FILE"

# Update package.json files (remove v prefix)
NEW_VERSION_NO_V="${NEW_VERSION#v}"
echo "Updating package.json files to $NEW_VERSION_NO_V..."

if [ -f "panel/frontend/package.json" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION_NO_V\"/" panel/frontend/package.json
fi

if [ -f "panel/backend/package.json" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION_NO_V\"/" panel/backend/package.json
fi

# Output
echo "Version bumped: $CURRENT_VERSION -> $NEW_VERSION"

# STAGE the modified files so they are included in the CURRENT commit
git add "$VERSION_FILE" "panel/frontend/package.json" "panel/backend/package.json" 2>/dev/null || true
