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

# Check if WASM has changed by comparing MD5
SRC_WASM="$DIST_DIR/sonare.wasm"
if [[ "$OSTYPE" == "darwin"* ]]; then
  NEW_MD5=$(md5 -q "$SRC_WASM")
else
  NEW_MD5=$(md5sum "$SRC_WASM" | cut -d' ' -f1)
fi

OLD_MD5=""
META_FILE="$DEST_DIR/meta.json"
if [ -f "$META_FILE" ]; then
  OLD_MD5=$(grep -o '"md5": *"[^"]*"' "$META_FILE" | cut -d'"' -f4)
fi

WASM_CHANGED=false
JS_CHANGED=false

if [ "$OLD_MD5" != "$NEW_MD5" ] || [ -z "$OLD_MD5" ]; then
  WASM_CHANGED=true
fi

# Check if JS files have changed
for file in "${JS_FILES[@]}"; do
  if [ ! -f "$DEST_DIR/$file" ] || ! cmp -s "$DIST_DIR/$file" "$DEST_DIR/$file"; then
    JS_CHANGED=true
    break
  fi
done

if ! $WASM_CHANGED && ! $JS_CHANGED; then
  echo ""
  echo "✅ No changes detected — all files are identical"
  echo "   WASM MD5: $NEW_MD5"
  exit 0
fi

# Copy WASM files if changed
if $WASM_CHANGED; then
  echo "   Copying WASM files..."
  for file in "${WASM_FILES[@]}"; do
    cp "$DIST_DIR/$file" "$DEST_DIR/"
    echo "   ✓ $file"
  done
else
  echo "   WASM unchanged, skipping (MD5: $NEW_MD5)"
fi

# Copy JS files if changed
if $JS_CHANGED; then
  echo "   Copying JS API files..."
  for file in "${JS_FILES[@]}"; do
    cp "$DIST_DIR/$file" "$DEST_DIR/"
    echo "   ✓ $file"
  done

  # Remove sourceMappingURL from JS/DTS files (not needed in homepage)
  for target in "$DEST_DIR/index.js" "$DEST_DIR/index.d.ts"; do
    if [ -f "$target" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/^\/\/# sourceMappingURL=/d' "$target"
      else
        sed -i '/^\/\/# sourceMappingURL=/d' "$target"
      fi
    fi
  done
else
  echo "   JS API unchanged, skipping"
fi

# Update meta.json if WASM changed
if $WASM_CHANGED; then
  echo ""
  ./scripts/update-wasm-meta.sh
fi

echo ""
if $WASM_CHANGED && $JS_CHANGED; then
  echo "✅ WASM + JS API updated!"
  [ -n "$OLD_MD5" ] && echo "   Old MD5: $OLD_MD5"
  echo "   New MD5: $NEW_MD5"
elif $WASM_CHANGED; then
  echo "✅ WASM updated! (JS API unchanged)"
  [ -n "$OLD_MD5" ] && echo "   Old MD5: $OLD_MD5"
  echo "   New MD5: $NEW_MD5"
else
  echo "✅ JS API updated! (WASM unchanged)"
fi
