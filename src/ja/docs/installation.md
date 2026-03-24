# インストール

## npm（ブラウザ/Node.js）

::: warning パッケージ未公開
npm パッケージ `@libraz/libsonare` は現在ベータ版で、まだ公開されていません。現時点では、ソースからビルドするか、リポジトリから直接 WASM ファイルを使用してください。
:::

::: code-group

```bash [npm]
npm install @libraz/libsonare
```

```bash [yarn]
yarn add @libraz/libsonare
```

```bash [pnpm]
pnpm add @libraz/libsonare
```

:::

## ソースからビルド

### 前提条件

- CMake 3.16以上
- C++17対応コンパイラ（GCC 9+、Clang 10+、MSVC 2019+）
- Emscripten（WebAssemblyビルド用）

### ビルド手順

```bash
# リポジトリをクローン
git clone https://github.com/libraz/libsonare.git
cd libsonare

# ネイティブライブラリをビルド
mkdir build && cd build
cmake ..
make -j$(nproc)

# WebAssemblyをビルド
make build-wasm
```

## ネイティブバインディング（Python / Node.js）

デスクトップ環境ではネイティブバインディングによりC++の性能を直接活用できます。PythonとNode.jsのインストール・使用方法は[ネイティブバインディング](/ja/docs/native-bindings)を参照してください。

## 使用方法

### ブラウザ

```typescript
import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';

// WASMモジュールを初期化
await init();

// AudioContextから音声サンプルを取得
const audioContext = new AudioContext();
const response = await fetch('audio.mp3');
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const samples = audioBuffer.getChannelData(0);

// BPM検出
const bpm = detectBpm(samples, audioBuffer.sampleRate);

// キー検出
const key = detectKey(samples, audioBuffer.sampleRate);

// 全解析
const result = analyze(samples, audioBuffer.sampleRate);
```

### C++

```cpp
#include <sonare/quick.h>

// BPM検出
float bpm = sonare::quick::detect_bpm(samples, size, sample_rate);

// キー検出
sonare::Key key = sonare::quick::detect_key(samples, size, sample_rate);

// 全解析
sonare::AnalysisResult result = sonare::quick::analyze(samples, size, sample_rate);
```
