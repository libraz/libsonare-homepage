#!/bin/bash
set -e

LIBSONARE_DIR="../libsonare"
WASM_BUILD_DIR="$LIBSONARE_DIR/bindings/wasm/build-wasm/bin"
JS_DIST_DIR="$LIBSONARE_DIR/bindings/wasm/dist"
DEST_DIR="src/wasm"

# Required files
WASM_FILES=("sonare.wasm" "sonare.js")
JS_FILES=("index.js" "index.d.ts")

# Obsolete sub-module files from the previous tsc-based layout — removed after
# libsonare switched to a tsup bundle. Cleaned up from DEST_DIR if present.
OBSOLETE_FILES=(
  "public_types.js" "public_types.d.ts"
  "stream_types.js" "stream_types.d.ts"
  "wasm_types.js" "wasm_types.d.ts"
)

echo "📦 Copying WASM files from libsonare..."

# Check if libsonare directory exists
if [ ! -d "$LIBSONARE_DIR" ]; then
  echo "❌ Error: libsonare directory not found at $LIBSONARE_DIR"
  echo "   Please clone libsonare in the parent directory."
  exit 1
fi

# Check WASM build directory
if [ ! -d "$WASM_BUILD_DIR" ]; then
  echo "❌ Error: WASM build directory not found at $WASM_BUILD_DIR"
  echo "   Run 'yarn build:wasm' in libsonare/bindings/wasm first."
  exit 1
fi

# Check JS dist directory
if [ ! -d "$JS_DIST_DIR" ]; then
  echo "❌ Error: JS dist directory not found at $JS_DIST_DIR"
  echo "   Run 'yarn build:js' in libsonare/bindings/wasm first."
  exit 1
fi

# Check WASM files
missing_wasm=()
for file in "${WASM_FILES[@]}"; do
  if [ ! -f "$WASM_BUILD_DIR/$file" ]; then
    missing_wasm+=("$file")
  fi
done

if [ ${#missing_wasm[@]} -gt 0 ]; then
  echo "❌ Error: WASM files missing in $WASM_BUILD_DIR:"
  for file in "${missing_wasm[@]}"; do
    echo "   - $file"
  done
  echo ""
  echo "   Run 'yarn build:wasm' in libsonare/bindings/wasm first."
  exit 1
fi

# Check JS API files
missing_js=()
for file in "${JS_FILES[@]}"; do
  if [ ! -f "$JS_DIST_DIR/$file" ]; then
    missing_js+=("$file")
  fi
done

if [ ${#missing_js[@]} -gt 0 ]; then
  echo "❌ Error: JS API files missing in $JS_DIST_DIR:"
  for file in "${missing_js[@]}"; do
    echo "   - $file"
  done
  echo ""
  echo "   Run 'yarn build:js' in libsonare/bindings/wasm first."
  echo "   (or 'yarn build' to build both JS and WASM)"
  exit 1
fi

# Check if WASM has changed by comparing MD5
SRC_WASM="$WASM_BUILD_DIR/sonare.wasm"
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
  if [ ! -f "$DEST_DIR/$file" ] || ! cmp -s "$JS_DIST_DIR/$file" "$DEST_DIR/$file"; then
    JS_CHANGED=true
    break
  fi
done

# Detect leftover obsolete files
OBSOLETE_PRESENT=false
for file in "${OBSOLETE_FILES[@]}"; do
  if [ -f "$DEST_DIR/$file" ]; then
    OBSOLETE_PRESENT=true
    break
  fi
done

if ! $WASM_CHANGED && ! $JS_CHANGED && ! $OBSOLETE_PRESENT; then
  echo ""
  echo "✅ No changes detected — all files are identical"
  echo "   WASM MD5: $NEW_MD5"
  exit 0
fi

# Copy WASM files if changed
if $WASM_CHANGED; then
  echo "   Copying WASM files..."
  for file in "${WASM_FILES[@]}"; do
    cp "$WASM_BUILD_DIR/$file" "$DEST_DIR/"
    echo "   ✓ $file"
  done
else
  echo "   WASM unchanged, skipping (MD5: $NEW_MD5)"
fi

# Copy JS files if changed
if $JS_CHANGED; then
  echo "   Copying JS API files..."
  for file in "${JS_FILES[@]}"; do
    cp "$JS_DIST_DIR/$file" "$DEST_DIR/"
    echo "   ✓ $file"
  done

  # Remove sourceMappingURL from copied JS/DTS files (not needed in homepage)
  for file in "${JS_FILES[@]}"; do
    target="$DEST_DIR/$file"
    case "$file" in
      *.js|*.d.ts)
        if [ -f "$target" ]; then
          if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' '/^\/\/# sourceMappingURL=/d' "$target"
          else
            sed -i '/^\/\/# sourceMappingURL=/d' "$target"
          fi
        fi
        ;;
    esac
  done
else
  echo "   JS API unchanged, skipping"
fi

# Remove obsolete sub-module files left over from the previous layout
if $OBSOLETE_PRESENT; then
  echo "   Removing obsolete sub-module files..."
  for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$DEST_DIR/$file" ]; then
      rm "$DEST_DIR/$file"
      echo "   ✗ $file (removed)"
    fi
  done
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
elif $JS_CHANGED; then
  echo "✅ JS API updated! (WASM unchanged)"
else
  echo "✅ Cleaned up obsolete files"
fi
