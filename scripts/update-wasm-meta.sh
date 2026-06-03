#!/bin/bash
WASM_FILE="src/wasm/sonare.wasm"
SONARE_JS_FILE="src/wasm/sonare.js"
INDEX_JS_FILE="src/wasm/index.js"
META_FILE="src/wasm/meta.json"
LIBSONARE_DIR="../libsonare"

file_size() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

file_mtime_iso() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    stat -f%m "$1" | xargs -I{} date -u -r {} +"%Y-%m-%dT%H:%M:%SZ"
  else
    date -u -r "$1" +"%Y-%m-%dT%H:%M:%SZ"
  fi
}

file_md5() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    md5 -q "$1"
  else
    md5sum "$1" | cut -d' ' -f1
  fi
}

gzip_size() {
  gzip -c "$1" | wc -c | tr -d '[:space:]'
}

if [ -f "$WASM_FILE" ]; then
  for REQUIRED_FILE in "$SONARE_JS_FILE" "$INDEX_JS_FILE"; do
    if [ ! -f "$REQUIRED_FILE" ]; then
      echo "❌ Asset file not found: $REQUIRED_FILE"
      exit 1
    fi
  done

  SIZE=$(file_size "$WASM_FILE")
  MD5=$(file_md5 "$WASM_FILE")
  SIZE_KB=$((SIZE / 1024))
  GZIP_SIZE=$(gzip_size "$WASM_FILE")
  GZIP_KB=$((GZIP_SIZE / 1024))

  SONARE_JS_SIZE=$(file_size "$SONARE_JS_FILE")
  SONARE_JS_SIZE_KB=$((SONARE_JS_SIZE / 1024))
  SONARE_JS_GZIP_SIZE=$(gzip_size "$SONARE_JS_FILE")
  SONARE_JS_GZIP_KB=$((SONARE_JS_GZIP_SIZE / 1024))

  INDEX_JS_SIZE=$(file_size "$INDEX_JS_FILE")
  INDEX_JS_SIZE_KB=$((INDEX_JS_SIZE / 1024))
  INDEX_JS_GZIP_SIZE=$(gzip_size "$INDEX_JS_FILE")
  INDEX_JS_GZIP_KB=$((INDEX_JS_GZIP_SIZE / 1024))

  TOTAL_SIZE=$((SONARE_JS_SIZE + INDEX_JS_SIZE + SIZE))
  TOTAL_SIZE_KB=$((TOTAL_SIZE / 1024))
  TOTAL_GZIP_SIZE=$((SONARE_JS_GZIP_SIZE + INDEX_JS_GZIP_SIZE + GZIP_SIZE))
  TOTAL_GZIP_KB=$((TOTAL_GZIP_SIZE / 1024))

  # Get build date from WASM file mtime (ISO 8601)
  BUILD_DATE=$(file_mtime_iso "$WASM_FILE")

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
  "assets": {
    "sonare.js": {
      "size": $SONARE_JS_SIZE,
      "sizeKB": $SONARE_JS_SIZE_KB,
      "gzipSize": $SONARE_JS_GZIP_SIZE,
      "gzipKB": $SONARE_JS_GZIP_KB
    },
    "index.js": {
      "size": $INDEX_JS_SIZE,
      "sizeKB": $INDEX_JS_SIZE_KB,
      "gzipSize": $INDEX_JS_GZIP_SIZE,
      "gzipKB": $INDEX_JS_GZIP_KB
    },
    "sonare.wasm": {
      "size": $SIZE,
      "sizeKB": $SIZE_KB,
      "gzipSize": $GZIP_SIZE,
      "gzipKB": $GZIP_KB
    }
  },
  "total": {
    "size": $TOTAL_SIZE,
    "sizeKB": $TOTAL_SIZE_KB,
    "gzipSize": $TOTAL_GZIP_SIZE,
    "gzipKB": $TOTAL_GZIP_KB
  },
  "md5": "$MD5",
  "buildDate": "$BUILD_DATE",
  "commitHash": "$COMMIT_HASH"
}
EOF

  echo "📦 Updated $META_FILE"
  echo "   Version: $VERSION"
  echo "   Size: ${SIZE_KB}KB (${GZIP_KB}KB gzipped)"
  echo "   Total assets: ${TOTAL_SIZE_KB}KB (${TOTAL_GZIP_KB}KB gzipped)"
  echo "   MD5: $MD5"
  echo "   Build: $BUILD_DATE"
  [ -n "$COMMIT_HASH" ] && echo "   Commit: $COMMIT_HASH"
  exit 0
else
  echo "❌ WASM file not found: $WASM_FILE"
  exit 1
fi
