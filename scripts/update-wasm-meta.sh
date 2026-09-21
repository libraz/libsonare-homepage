#!/bin/bash
WASM_FILE="src/wasm/sonare.wasm"
SONARE_JS_FILE="src/wasm/sonare.js"
INDEX_JS_FILE="src/wasm/index.js"
WORKLET_JS_FILE="src/wasm/worklet.js"
RT_WASM_FILE="src/wasm/sonare-rt.wasm"
RT_JS_FILE="src/wasm/sonare-rt.js"
RT_MODULE_JS_FILE="src/wasm/sonare-rt-module.js"
META_FILE="src/wasm/meta.json"
LIBSONARE_DIR="../libsonare"

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

if [ -f "$WASM_FILE" ]; then
  for REQUIRED_FILE in "$SONARE_JS_FILE" "$INDEX_JS_FILE" "$WORKLET_JS_FILE" \
    "$RT_WASM_FILE" "$RT_JS_FILE" "$RT_MODULE_JS_FILE"; do
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

  # Published package-entry sizes, taken from the upstream size gate rather than
  # from the artifacts copied here. The gate pins its own emsdk and measures both
  # bundle entries in one run, so `full` and `analysis` are comparable with each
  # other; the copied `sonare.wasm` above is whatever the sibling checkout last
  # built and is not.
  SIZE_BASELINE="$LIBSONARE_DIR/bindings/wasm/wasm-size-baseline.json"
  if [ ! -f "$SIZE_BASELINE" ]; then
    echo "❌ Size baseline not found: $SIZE_BASELINE"
    exit 1
  fi
  ENTRIES_JSON=$(node -e '
    const b = require(process.argv[1]).artifacts;
    const kb = (n) => Math.round(n / 1024);
    const entry = (name) => {
      const a = b[name];
      if (!a) throw new Error(`size baseline has no ${name}`);
      return { sizeKB: kb(a.raw), gzipKB: kb(a.gzip) };
    };
    process.stdout.write(
      JSON.stringify({ full: entry("sonare.wasm"), analysis: entry("sonare-analysis.wasm") }),
    );
  ' "$(cd "$(dirname "$SIZE_BASELINE")" && pwd)/$(basename "$SIZE_BASELINE")") || exit 1
  ENTRIES_FULL_SIZE_KB=$(node -pe 'JSON.parse(process.argv[1]).full.sizeKB' "$ENTRIES_JSON")
  ENTRIES_FULL_GZIP_KB=$(node -pe 'JSON.parse(process.argv[1]).full.gzipKB' "$ENTRIES_JSON")
  ENTRIES_ANALYSIS_SIZE_KB=$(node -pe 'JSON.parse(process.argv[1]).analysis.sizeKB' "$ENTRIES_JSON")
  ENTRIES_ANALYSIS_GZIP_KB=$(node -pe 'JSON.parse(process.argv[1]).analysis.gzipKB' "$ENTRIES_JSON")

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
    "worklet.js": $(asset_entry "$WORKLET_JS_FILE"),
    "sonare-rt.wasm": $(asset_entry "$RT_WASM_FILE"),
    "sonare-rt.js": $(asset_entry "$RT_JS_FILE"),
    "sonare-rt-module.js": $(asset_entry "$RT_MODULE_JS_FILE")
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
