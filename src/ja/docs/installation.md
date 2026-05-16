# インストール

## npm（ブラウザ / WASM）

Node.js 18.0.0 以上が必要です。

`@libraz/libsonare` は WebAssembly パッケージです。ファイルデコード機能は含まないため、
Web Audio API などでデコード済みのモノラル `Float32Array` サンプルを渡します。

この npm パッケージはブラウザ / WebAssembly 向けです。`sonare` CLI はインストールされません。コマンドラインツールを使う場合は、PyPI の Python パッケージを `pip install libsonare` でインストールしてください。

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

- CMake 3.16 以上
- C++17 対応コンパイラ（対応対象の Linux/macOS では GCC または Clang）
- M4A/AAC/FLAC/OGG/Opus デコード用の FFmpeg 開発ライブラリ（任意）
- Emscripten（WebAssembly ビルド用）

### ビルド手順

```bash
# リポジトリをクローン
git clone https://github.com/libraz/libsonare.git
cd libsonare

# ネイティブライブラリをビルド
mkdir build && cd build
cmake ..                         # FFmpeg を自動検出
# cmake .. -DSONARE_WITH_FFMPEG=ON  # FFmpeg デコードを必須にする

make -j$(nproc)

# WebAssembly をビルド（build/ ではなくリポジトリルートで実行）
cd .. && make wasm
```

## PyPI（Python）

Python 3.11 以上が必要です（3.11、3.12、3.13）。

```bash
pip install libsonare
```

Python パッケージをインストールすると、ライブラリとして使えるだけでなく `sonare` コマンドも使えます。詳細は [CLI リファレンス](/ja/docs/cli) を参照してください。

PyPI のホイールはインストール結果が環境に左右されないよう、標準では WAV と MP3 の
デコードに対応しています。M4A、AAC、FLAC、OGG、Opus など FFmpeg が扱える形式を
直接読み込む場合は、FFmpeg を有効にしてソースからビルドします。

```bash
SONARE_FFMPEG=1 pip install libsonare --no-binary libsonare
```

FFmpeg 有効ビルドには FFmpeg の開発ライブラリが必要です。macOS では `brew install ffmpeg`、Debian/Ubuntu 系では `libavformat-dev libavcodec-dev libavutil-dev libswresample-dev` をインストールしてください。

## ネイティブバインディング（Python / Node.js）

デスクトップ環境ではネイティブバインディングにより C++ の性能を直接活用できます。Python は PyPI から利用できます。Node.js N-API バインディングは現在ソースビルド前提です。詳細は[ネイティブバインディング](/ja/docs/native-bindings)を参照してください。

## 使用方法

### ブラウザ

```typescript
import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare';

// WASM モジュールを初期化
await init();

// AudioContext から音声サンプルを取得
const audioContext = new AudioContext();
const response = await fetch('audio.mp3');
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const samples = audioBuffer.getChannelData(0);

// BPM 検出
const bpm = detectBpm(samples, audioBuffer.sampleRate);

// キー検出
const key = detectKey(samples, audioBuffer.sampleRate);

// フル解析
const result = analyze(samples, audioBuffer.sampleRate);
```

ステレオファイルで両チャンネルを反映したい場合は、片チャンネルだけを渡すのではなく事前にモノラルへダウンミックスしてください。

### C++

```cpp
#include <sonare/quick.h>

// BPM 検出
float bpm = sonare::quick::detect_bpm(samples, size, sample_rate);

// キー検出
sonare::Key key = sonare::quick::detect_key(samples, size, sample_rate);

// フル解析
sonare::AnalysisResult result = sonare::quick::analyze(samples, size, sample_rate);
```
