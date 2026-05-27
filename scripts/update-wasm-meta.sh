#!/bin/bash
WASM_FILE="src/wasm/sonare.wasm"
META_FILE="src/wasm/meta.json"
LIBSONARE_DIR="../libsonare"

if [ -f "$WASM_FILE" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    SIZE=$(stat -f%z "$WASM_FILE")
    MD5=$(md5 -q "$WASM_FILE")
  else
    # Linux
    SIZE=$(stat -c%s "$WASM_FILE")
    MD5=$(md5sum "$WASM_FILE" | cut -d' ' -f1)
  fi
  SIZE_KB=$((SIZE / 1024))
  GZIP_SIZE=$(gzip -c "$WASM_FILE" | wc -c)
  GZIP_KB=$((GZIP_SIZE / 1024))

  # Get build date from WASM file mtime (ISO 8601)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    BUILD_DATE=$(stat -f%m "$WASM_FILE" | xargs -I{} date -u -r {} +"%Y-%m-%dT%H:%M:%SZ")
  else
    BUILD_DATE=$(date -u -r "$WASM_FILE" +"%Y-%m-%dT%H:%M:%SZ")
  fi

  # Get commit hash from libsonare repo
  COMMIT_HASH=""
  if [ -d "$LIBSONARE_DIR/.git" ]; then
    COMMIT_HASH=$(git -C "$LIBSONARE_DIR" rev-parse --short HEAD)
  fi

  # Get version from libsonare WASM binding's package.json (single source of truth)
  WASM_PKG="$LIBSONARE_DIR/bindings/wasm/package.json"
  VERSION=""
  if [ -f "$WASM_PKG" ]; then
    VERSION=$(sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$WASM_PKG" | head -1)
  fi
  if [ -z "$VERSION" ]; then
    echo "❌ Could not read version from $WASM_PKG"
    exit 1
  fi

  cat > "$META_FILE" << EOF
{
  "version": "$VERSION",
  "size": $SIZE,
  "sizeKB": $SIZE_KB,
  "gzipSize": $GZIP_SIZE,
  "gzipKB": $GZIP_KB,
  "md5": "$MD5",
  "buildDate": "$BUILD_DATE",
  "commitHash": "$COMMIT_HASH"
}
EOF

  echo "📦 Updated $META_FILE"
  echo "   Version: $VERSION"
  echo "   Size: ${SIZE_KB}KB (${GZIP_KB}KB gzipped)"
  echo "   MD5: $MD5"
  echo "   Build: $BUILD_DATE"
  [ -n "$COMMIT_HASH" ] && echo "   Commit: $COMMIT_HASH"
  exit 0
else
  echo "❌ WASM file not found: $WASM_FILE"
  exit 1
fi
