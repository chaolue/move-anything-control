#!/usr/bin/env bash
# Build Control module for Move Anything
# This is a JS-only module, so just package the files.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

echo "=== Building Control Module ==="

# Create dist directory
mkdir -p dist/control

# Copy files
echo "Packaging..."
cp src/module.json dist/control/
cp src/ui.js dist/control/

# Create tarball for release
cd dist
tar -czvf control-module.tar.gz control/
cd ..

echo ""
echo "=== Build Complete ==="
echo "Output: dist/control/"
echo "Tarball: dist/control-module.tar.gz"
echo ""
echo "To install on Move:"
echo "  ./scripts/install.sh"
