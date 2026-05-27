# インストール

このページは、[はじめに](./getting-started.md) で使う実行環境を決めた後に読むページです。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- ブラウザ/WASM npm パッケージ、Python パッケージ、ソースビルドを用途に応じて導入できる。
- npm パッケージでは `sonare` CLI がインストールされない理由を理解できる。
- 標準の WAV/MP3 対応ではなく、FFmpeg 有効デコードが必要な場面を判断できる。
- ホイールや既存パッケージで足りないときだけ、ソースからビルドできる。

## どれをインストールするか

| 作るもの | インストール |
|----------|--------------|
| ブラウザアプリ | `npm install @libraz/libsonare` |
| Python スクリプトやノートブック | `pip install libsonare` |
| ターミナルでのバッチ処理 | `pip install libsonare` で `sonare` を使う |
| Node ネイティブのサービスやデスクトップツール | `bindings/node` を `@libraz/libsonare-native` としてビルド |
| C++ 組み込みや独自 WASM ビルド | ソースからビルド |

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

### WASM パッケージのサブパス

このパッケージは、Worklet やアセットローダー向けのサブパスエクスポートも公開しています。通常のアプリコードでは、まずメインの `@libraz/libsonare` からインポートします。

| インポート | 用途 |
|--------|------|
| `@libraz/libsonare` | 初期化、解析、特徴量、マスタリング、ミキシング、リアルタイムクラスを含む通常の TypeScript API |
| `@libraz/libsonare/worklet` | `SonareRealtimeEngineNode`、`SonareEngine`、Worklet 側ライフサイクルエクスポートを含む AudioWorklet ブリッジヘルパー |
| `@libraz/libsonare/rt` | AudioWorklet のリアルタイムエンジンのホットパス向けに小さくした `sonare-rt` モジュールファクトリ |
| `@libraz/libsonare/wasm` | バンドラーや独自ローダー用の通常 WASM アセット |
| `@libraz/libsonare/rt-wasm` | 独自 Worklet 組み込み用の軽量リアルタイム WASM アセット |

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

## ネイティブバインディング（Python / Node.js）

デスクトップ環境ではネイティブバインディングにより C++ の性能を直接活用できます。Python は PyPI から利用できます。Node.js N-API バインディングは現在ソースビルド前提です。詳細は [ネイティブバインディング](/ja/docs/native-bindings) を参照してください。

Node.js ネイティブバインディングは Yarn 4 を使い、Node.js 22 以上が必要です。

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

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

### Python

```python
from libsonare import Audio

# WAV/MP3 を読み込む（FFmpeg 付きで再ビルドすると M4A/FLAC/OGG/Opus も対応）
audio = Audio.from_file("audio.mp3")

# BPM 検出
bpm = audio.detect_bpm()

# キー検出
key = audio.detect_key()

# フル解析
result = audio.analyze()
```

同じ `sonare` CLI がパッケージに同梱されています。ターミナルでの使い方や JSON 出力は
[CLI リファレンス](/ja/docs/cli) を参照してください。

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

室内音響メトリクスでは、測定済みインパルスレスポンスに
`sonare::quick::analyze_impulse_response()`、通常音声からのブラインド推定に
`sonare::quick::detect_acoustic()` を使います。
