#!/bin/bash
WASM_FILE="src/wasm/sonare.wasm"
SONARE_JS_FILE="src/wasm/sonare.js"
INDEX_JS_FILE="src/wasm/index.js"
WORKLET_JS_FILE="src/wasm/worklet.js"
META_FILE="src/wasm/meta.json"
LIBSONARE_DIR="../libsonare"
WASM_DIST_DIR="$LIBSONARE_DIR/bindings/wasm/dist"
UPSTREAM_WASM_FILE="$WASM_DIST_DIR/sonare.wasm"
ANALYSIS_WASM_FILE="$WASM_DIST_DIR/sonare-analysis.wasm"

file_size() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

file_md5() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    md5 -q "$1"
  else
    md5sum "$1" | cut -d' ' -f1
  fi
}

file_sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    sha256sum "$1" | cut -d' ' -f1
  fi
}

gzip_size() {
  gzip -c "$1" | wc -c | tr -d '[:space:]'
}

# Emit one JSON asset entry: asset_entry <path>
asset_entry() {
  local path="$1"
  local size gzip_bytes
  size=$(file_size "$path")
  gzip_bytes=$(gzip_size "$path")
  printf '{\n      "size": %s,\n      "sizeKB": %s,\n      "gzipSize": %s,\n      "gzipKB": %s\n    }' \
    "$size" "$((size / 1024))" "$gzip_bytes" "$((gzip_bytes / 1024))"
}

# Validate that a freshly built upstream artifact is the one described by its
# source manifest. The copied full artifact is checked separately below so the
# metadata cannot combine bytes from different builds.
validate_manifest_artifact() {
  local artifact="$1"
  local manifest="$2"
  local artifact_name="$3"
  local actual_sha declared_sha

  if [ ! -f "$artifact" ]; then
    echo "❌ Upstream WASM artifact not found: $artifact"
    exit 1
  fi
  if [ ! -f "$manifest" ]; then
    echo "❌ Build manifest not found: $manifest"
    exit 1
  fi

  actual_sha=$(file_sha256 "$artifact")
  declared_sha=$(node -e '
    const fs = require("node:fs");
    const [manifestPath, artifactName] = process.argv.slice(1);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
      console.error(`❌ Could not read build manifest: ${manifestPath}`);
      process.exit(1);
    }
    const declared = manifest.artifacts?.[artifactName]?.sha256;
    if (typeof declared !== "string" || !/^[0-9a-f]{64}$/.test(declared)) {
      console.error(`❌ Build manifest declares no valid ${artifactName} artifact: ${manifestPath}`);
      process.exit(1);
    }
    process.stdout.write(declared);
  ' "$manifest" "$artifact_name") || exit 1

  if [ "$declared_sha" != "$actual_sha" ]; then
    echo "❌ Upstream artifact is not the artifact the build manifest describes"
    echo "   manifest: $declared_sha"
    echo "   upstream: $actual_sha"
    echo "   artifact: $artifact"
    exit 1
  fi
}

if [ -f "$WASM_FILE" ]; then
  for REQUIRED_FILE in "$SONARE_JS_FILE" "$INDEX_JS_FILE" "$WORKLET_JS_FILE"; do
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

  # Package-entry sizes come from the current upstream artifacts, not the
  # historical size baseline. Each artifact has its own source manifest; the
  # hash check makes a stale or partially rebuilt dist directory fail loudly.
  validate_manifest_artifact \
    "$UPSTREAM_WASM_FILE" \
    "$WASM_DIST_DIR/sonare.sources.json" \
    "sonare.wasm"
  validate_manifest_artifact \
    "$ANALYSIS_WASM_FILE" \
    "$WASM_DIST_DIR/sonare-analysis.sources.json" \
    "sonare-analysis.wasm"

  ENTRIES_FULL_SIZE=$(file_size "$UPSTREAM_WASM_FILE")
  ENTRIES_FULL_GZIP_SIZE=$(gzip_size "$UPSTREAM_WASM_FILE")
  ENTRIES_FULL_SIZE_KB=$((ENTRIES_FULL_SIZE / 1024))
  ENTRIES_FULL_GZIP_KB=$((ENTRIES_FULL_GZIP_SIZE / 1024))
  ENTRIES_ANALYSIS_SIZE=$(file_size "$ANALYSIS_WASM_FILE")
  ENTRIES_ANALYSIS_GZIP_SIZE=$(gzip_size "$ANALYSIS_WASM_FILE")
  ENTRIES_ANALYSIS_SIZE_KB=$((ENTRIES_ANALYSIS_SIZE / 1024))
  ENTRIES_ANALYSIS_GZIP_KB=$((ENTRIES_ANALYSIS_GZIP_SIZE / 1024))

  # Build provenance comes from the manifest the emscripten build writes beside
  # its artifacts, never from the sibling checkout's current HEAD: the checkout
  # keeps moving after a build, so a hash read here can name a tree that was
  # never compiled. The manifest also pins the digest of every source that went
  # in, which identifies the built tree even when that tree was dirty, and its
  # artifact hash is checked against the copy so the recorded provenance cannot
  # describe a binary other than the one in src/wasm.
  SOURCES_MANIFEST="$LIBSONARE_DIR/bindings/wasm/dist/sonare.sources.json"
  if [ ! -f "$SOURCES_MANIFEST" ]; then
    echo "❌ Build manifest not found: $SOURCES_MANIFEST"
    exit 1
  fi
  PROVENANCE=$(node -e '
    const { createHash } = require("node:crypto");
    const [manifestPath, wasmSha] = process.argv.slice(1);
    const manifest = JSON.parse(require("node:fs").readFileSync(manifestPath, "utf8"));
    const declared = manifest.artifacts?.["sonare.wasm"]?.sha256;
    if (!declared) {
      console.error(`❌ Build manifest declares no sonare.wasm artifact: ${manifestPath}`);
      process.exit(1);
    }
    if (declared !== wasmSha) {
      console.error("❌ Copied sonare.wasm is not the artifact the build manifest describes");
      console.error(`   manifest: ${declared}`);
      console.error(`   copied:   ${wasmSha}`);
      process.exit(1);
    }
    const sources = manifest.sources ?? {};
    const digest = createHash("sha256")
      .update(
        Object.keys(sources)
          .sort()
          .map((name) => `${name}:${sources[name]}`)
          .join("\n"),
      )
      .digest("hex")
      .slice(0, 12);
    process.stdout.write(`${manifest.builtAt}\t${digest}`);
  ' "$SOURCES_MANIFEST" "$(file_sha256 "$WASM_FILE")") || exit 1
  BUILD_DATE=${PROVENANCE%%$'\t'*}
  SOURCES_DIGEST=${PROVENANCE##*$'\t'}

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
    },
    "worklet.js": $(asset_entry "$WORKLET_JS_FILE")
  },
  "total": {
    "size": $TOTAL_SIZE,
    "sizeKB": $TOTAL_SIZE_KB,
    "gzipSize": $TOTAL_GZIP_SIZE,
    "gzipKB": $TOTAL_GZIP_KB
  },
  "entries": {
    "full": {
      "sizeKB": $ENTRIES_FULL_SIZE_KB,
      "gzipKB": $ENTRIES_FULL_GZIP_KB
    },
    "analysis": {
      "sizeKB": $ENTRIES_ANALYSIS_SIZE_KB,
      "gzipKB": $ENTRIES_ANALYSIS_GZIP_KB
    }
  },
  "md5": "$MD5",
  "buildDate": "$BUILD_DATE",
  "sourcesDigest": "$SOURCES_DIGEST"
}
EOF

  echo "📦 Updated $META_FILE"
  echo "   Version: $VERSION"
  echo "   Size: ${SIZE_KB}KB (${GZIP_KB}KB gzipped)"
  echo "   Total assets: ${TOTAL_SIZE_KB}KB (${TOTAL_GZIP_KB}KB gzipped)"
  echo "   MD5: $MD5"
  echo "   Build: $BUILD_DATE"
  echo "   Sources: $SOURCES_DIGEST"
  exit 0
else
  echo "❌ WASM file not found: $WASM_FILE"
  exit 1
fi
