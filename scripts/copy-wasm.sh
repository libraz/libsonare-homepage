#!/bin/bash
set -e

LIBSONARE_DIR="../libsonare"
DIST_DIR="$LIBSONARE_DIR/dist"
DEST_DIR="src/wasm"

# Required files from dist/
WASM_FILES=("sonare.wasm" "sonare.js")
JS_FILES=("index.js" "index.d.ts")

echo "📦 Copying WASM files from libsonare..."

# Check if libsonare directory exists
if [ ! -d "$LIBSONARE_DIR" ]; then
  echo "❌ Error: libsonare directory not found at $LIBSONARE_DIR"
  echo "   Please clone libsonare in the parent directory."
  exit 1
fi

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Error: dist directory not found at $DIST_DIR"
  echo "   Run 'yarn build' in libsonare first."
  exit 1
fi

# Check WASM files
missing_wasm=()
for file in "${WASM_FILES[@]}"; do
  if [ ! -f "$DIST_DIR/$file" ]; then
    missing_wasm+=("$file")
  fi
done

if [ ${#missing_wasm[@]} -gt 0 ]; then
  echo "❌ Error: WASM files missing in $DIST_DIR:"
  for file in "${missing_wasm[@]}"; do
    echo "   - $file"
  done
  echo ""
  echo "   Run 'yarn build:wasm' in libsonare first."
  exit 1
fi

# Check JS API files
missing_js=()
for file in "${JS_FILES[@]}"; do
  if [ ! -f "$DIST_DIR/$file" ]; then
    missing_js+=("$file")
  fi
done

if [ ${#missing_js[@]} -gt 0 ]; then
  echo "❌ Error: JS API files missing in $DIST_DIR:"
  for file in "${missing_js[@]}"; do
    echo "   - $file"
  done
  echo ""
  echo "   Run 'yarn build:js' in libsonare first."
  echo "   (or 'yarn build' to build both WASM and JS)"
  exit 1
fi

# Copy files
echo "   Copying WASM files..."
for file in "${WASM_FILES[@]}"; do
  cp "$DIST_DIR/$file" "$DEST_DIR/"
  echo "   ✓ $file"
done

echo "   Copying JS API files..."
for file in "${JS_FILES[@]}"; do
  cp "$DIST_DIR/$file" "$DEST_DIR/"
  echo "   ✓ $file"
done

# Remove sourceMappingURL from index.js (not needed in homepage)
if [ -f "$DEST_DIR/index.js" ]; then
  sed -i '/^\/\/# sourceMappingURL=/d' "$DEST_DIR/index.js"
fi

# Update meta.json
echo ""
./scripts/update-wasm-meta.sh

echo ""
echo "✅ WASM files copied successfully!"
