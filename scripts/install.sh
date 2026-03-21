#!/bin/bash
# Install Control module to Move
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

if [ ! -d "dist/control" ]; then
    echo "Error: dist/control not found. Run ./scripts/build.sh first."
    exit 1
fi

echo "=== Installing Control Module ==="

# Deploy to Move - utilities subdirectory
echo "Copying module to Move..."
ssh ableton@move.local "mkdir -p /data/UserData/schwung/modules/other/control"
scp -r dist/control/* ableton@move.local:/data/UserData/schwung/modules/other/control/

# Set permissions so Module Store can update later
echo "Setting permissions..."
ssh ableton@move.local "chmod -R a+rw /data/UserData/schwung/modules/other/control"

echo ""
echo "=== Install Complete ==="
echo "Module installed to: /data/UserData/schwung/modules/other/control/"
echo ""
echo "Restart Schwung to load the new module."
