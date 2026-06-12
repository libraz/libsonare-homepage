#!/bin/bash
set -e

LIBSONARE_DIR="../libsonare"
JS_DIST_DIR="$LIBSONARE_DIR/bindings/wasm/dist"
WASM_BUILD_DIR="$JS_DIST_DIR"
DEST_DIR="src/wasm"

# Required files
# Emscripten artifacts: main module + the dedicated realtime AudioWorklet
# runtime (sonare-rt, C-ABI-only build selectable via runtimeTarget).
WASM_FILES=("sonare.wasm" "sonare.js" "sonare-rt.wasm" "sonare-rt.js" "sonare-rt-module.js")
# tsup bundle: index.* is the high-level API, worklet.* is the AudioWorklet
# entry that index.d.ts re-exports its types from.
JS_FILES=("index.js" "index.d.ts" "worklet.js" "worklet.d.ts")
JS_CHUNK_GLOB="chunk-*.js"

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
  echo "   Run 'yarn build' in libsonare/bindings/wasm first."
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
  echo "   Run 'yarn build' in libsonare/bindings/wasm first."
  exit 1
fi

# Check JS API files
missing_js=()
for file in "${JS_FILES[@]}"; do
  if [ ! -f "$JS_DIST_DIR/$file" ]; then
    missing_js+=("$file")
  fi
done

shopt -s nullglob
JS_CHUNK_FILES=("$JS_DIST_DIR"/$JS_CHUNK_GLOB)
shopt -u nullglob

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

# Compare every Emscripten artifact, not just sonare.wasm — a sonare-rt-only
# rebuild must still trigger a copy.
for file in "${WASM_FILES[@]}"; do
  if [ ! -f "$DEST_DIR/$file" ] || ! cmp -s "$WASM_BUILD_DIR/$file" "$DEST_DIR/$file"; then
    WASM_CHANGED=true
    break
  fi
done

# Check if JS files have changed
for file in "${JS_FILES[@]}"; do
  if [ ! -f "$DEST_DIR/$file" ] || ! cmp -s "$JS_DIST_DIR/$file" "$DEST_DIR/$file"; then
    JS_CHANGED=true
    break
  fi
done

for source_file in "${JS_CHUNK_FILES[@]}"; do
  file=$(basename "$source_file")
  if [ ! -f "$DEST_DIR/$file" ] || ! cmp -s "$source_file" "$DEST_DIR/$file"; then
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

# Detect stale chunks: chunk-*.js in DEST that no longer exist in source.
# tsup emits content-hashed chunk names, so renamed chunks would otherwise
# accumulate in DEST_DIR on each copy.
SOURCE_CHUNK_NAMES=()
for source_file in "${JS_CHUNK_FILES[@]}"; do
  SOURCE_CHUNK_NAMES+=("$(basename "$source_file")")
done

STALE_CHUNKS=()
shopt -s nullglob
for dest_file in "$DEST_DIR"/$JS_CHUNK_GLOB; do
  name=$(basename "$dest_file")
  found=false
  for src_name in "${SOURCE_CHUNK_NAMES[@]}"; do
    if [ "$name" = "$src_name" ]; then
      found=true
      break
    fi
  done
  $found || STALE_CHUNKS+=("$name")
done
shopt -u nullglob

# Keep an untransformed copy of the worklet bridge in src/public/. The studio
# demo's AudioWorklet imports it raw: the bundled src/wasm/worklet.js gets a
# Vite /@vite/client import injected in dev, which fails silently inside
# AudioWorkletGlobalScope, so the worklet must load the public copy instead.
# Runs on the no-change path too, repairing a deleted or stale public copy.
sync_public_worklet() {
  PUBLIC_WORKLET="src/public/sonare-worklet.js"
  if ! cmp -s "$DEST_DIR/worklet.js" "$PUBLIC_WORKLET" 2>/dev/null; then
    cp "$DEST_DIR/worklet.js" "$PUBLIC_WORKLET"
    echo "   ✓ src/public/sonare-worklet.js (worklet bridge for AudioWorklet)"
  fi
}

if ! $WASM_CHANGED && ! $JS_CHANGED && ! $OBSOLETE_PRESENT && [ ${#STALE_CHUNKS[@]} -eq 0 ]; then
  sync_public_worklet
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
  for source_file in "${JS_CHUNK_FILES[@]}"; do
    file=$(basename "$source_file")
    cp "$source_file" "$DEST_DIR/"
    echo "   ✓ $file"
  done

  # Remove sourceMappingURL from copied JS/DTS files (not needed in homepage)
  JS_COPIED_FILES=("${JS_FILES[@]}")
  for source_file in "${JS_CHUNK_FILES[@]}"; do
    JS_COPIED_FILES+=("$(basename "$source_file")")
  done
  for file in "${JS_COPIED_FILES[@]}"; do
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

sync_public_worklet

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

# Prune stale chunks no longer present in source
if [ ${#STALE_CHUNKS[@]} -gt 0 ]; then
  echo "   Pruning stale chunks..."
  for file in "${STALE_CHUNKS[@]}"; do
    rm "$DEST_DIR/$file"
    echo "   ✗ $file (removed)"
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
