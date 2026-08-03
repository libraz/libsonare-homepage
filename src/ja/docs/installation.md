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

::: tip 迷ったらアプリの実行場所で選ぶ
ブラウザ UI なら npm / WASM、ノートブックやローカル処理なら PyPI、ターミナルだけで確認するなら PyPI 同梱の `sonare` CLI から始めます。Node ネイティブや C++ ビルドは、WASM や Python では性能・配布・既存コード連携が足りないと分かった段階で選ぶと判断しやすくなります。
:::

迷う場合は、今日すぐ 1 コマンドで試せる経路を選んでください。

- **Web サイトや Vite / Vue / React アプリ** — npm パッケージを入れ、解析前に `await init()` を呼びます。
- **ローカルのデータ処理** — Python パッケージを入れ、`Audio.from_file(...)` から始めます。
- **まだコードを書かずに確認したい** — Python パッケージを入れ、`sonare bpm audio.mp3` や `sonare analyze audio.mp3 --json` を実行します。

後から別の実行環境へ移れます。解析や DSP の中核は共通で、インストール先の違いは主に「音声をどう渡すか」と「結果をどこで使うか」の違いです。

## npm（ブラウザ / WASM）

Node.js 18.0.0 以上が必要です。

`@libraz/libsonare` は WebAssembly パッケージです。多くの API はサンプルベースなので、
デコード済みのモノラル `Float32Array` サンプルを渡します。読み込み用途では
`Audio.fromMemory(...)` が WAV/MP3 のバイト列をメモリ内でデコードでき、
`Audio.fromMemoryWithBrowserFallback(...)` は AAC、OGG、FLAC などをブラウザの
コーデックスタックへフォールバックできます。

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
| `@libraz/libsonare/analysis` | 解析専用モジュール。マスタリング・ミキシング・リアルタイム・プロジェクトのバインディングを含まないため、MIR だけが必要な場合はダウンロードがはるかに小さくなります |
| `@libraz/libsonare/worklet` | `SonareRealtimeEngineNode`、`SonareEngine`、Worklet 側ライフサイクルエクスポートを含む AudioWorklet ブリッジヘルパー |
| `@libraz/libsonare/worker` | ワンショットの解析・マスタリングを専用 Worker で実行する `OfflineWorkerClient` |
| `@libraz/libsonare/wasm` | バンドラーや独自ローダー用の通常 WASM アセット |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset.schema.json` | ボイスチェンジャープリセットの JSON Schema |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset-pack.schema.json` | プリセットパックの JSON Schema |

::: tip 解析だけならアナリシスバンドルを選ぶ
`@libraz/libsonare/analysis` は同じ DSP を、マスタリング・ミキシング・リアルタイム・
プロジェクトの各サーフェスを外してビルドしたものです（CI でサイズ上限を検査しています）。
BPM・キー・コード検出やスペクトログラム表示だけを行い、マスタリングやミキシングをしない
ページなら、メインエントリの代わりにこちらをインポートすると WASM のダウンロード量を
大きく減らせます。
:::

## PyPI（Python）

Python 3.11 以上が必要です（3.11、3.12、3.13）。

```bash
pip install libsonare
```

Python パッケージをインストールすると、ライブラリとして使えるだけでなく `sonare` コマンドも使えます。詳細は [CLI リファレンス](/ja/docs/cli) を参照してください。

PyPI のホイールはインストール結果が環境に左右されないよう、標準では WAV と MP3 の
デコードに対応しています。M4A、AAC、FLAC、OGG、Opus など FFmpeg が扱える形式を
直接読み込む場合は、FFmpeg を有効にしてソースからホイールをビルドします。`SONARE_FFMPEG`
フラグは `pip` ではなくホイールビルダースクリプトが参照するため、リポジトリをクローンして
ビルドスクリプトを実行します。

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
SONARE_FFMPEG=1 bash bindings/python/build_wheel.sh
pip install bindings/python/dist/*.whl
```

FFmpeg 有効ビルドには FFmpeg の開発ライブラリが必要です。macOS では `brew install ffmpeg`、Debian/Ubuntu 系では `libavformat-dev libavcodec-dev libavutil-dev libswresample-dev` をインストールしてください。

## 対応プラットフォーム

対応プラットフォームは **Linux・macOS・WebAssembly・WSL2** です。

| プラットフォーム | 備考 |
|------------------|------|
| Linux | ホイールは対応する manylinux 2.28 イメージ内でビルドし、`auditwheel` で修復したうえで glibc 2.31 に対して検査しています |
| macOS | macOS 11.0 以降が対象です |
| WebAssembly | WebAssembly が動くブラウザ。既定の経路では SharedArrayBuffer は不要です |
| WSL2 | Windows マシンでビルド・実行する場合はこちらを使います |

::: warning Windows ネイティブビルドは拒否されます
Windows 上の CMake 構成は、中途半端に構成を進めるのではなく WSL2 への案内を出して
失敗します。Windows でネイティブビルドを行う場合は WSL2 を使ってください。npm の
WebAssembly パッケージは Windows のブラウザでも問題なく動きます。この制限は
ネイティブライブラリのコンパイルに関するもので、ブラウザ実行の話ではありません。
:::

公開されている成果物は、WebAssembly の npm パッケージ、Python ホイール、
ネイティブ CLI のリリースアーカイブです。Node ネイティブバインディングは private 指定で、
ローカル依存としてのみインストールされます（[ネイティブバインディング](/ja/docs/native-bindings) を参照）。

## ソースからビルド

::: info ソースビルドとは？
公開済みの npm / PyPI パッケージをそのまま使うのではなく、手元の環境で C++ コアやバインディングをコンパイルする方法です。独自の FFmpeg 対応、未配布の環境、開発中の変更確認には有効ですが、最初の導入では通常パッケージインストールの方が簡単です。
:::

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
# cmake .. -DBUILD_ACOUSTIC_SIM=ON  # 幾何ベースのルーム音響を有効化（既定 ON）

make -j$(nproc)

# WebAssembly をビルド（build/ ではなくリポジトリルートで実行）
cd .. && make wasm
```

## ネイティブバインディング（Python / Node.js）

デスクトップ環境ではネイティブバインディングにより C++ の性能を直接活用できます。Python は PyPI から利用できます。Node.js の N-API バインディングは **npm には公開されていません**。private 指定でローカル依存として使う前提なので、常にソースからビルドします。詳細は [ネイティブバインディング](/ja/docs/native-bindings) を参照してください。

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

下のデモは、同じブラウザ / WASM 経路を視覚化したものです。デコード済みサンプルを入力し、STFT 系の時間 × 周波数表示を出力します。これがアプリ内で描画できれば、WASM パッケージの読み込み、初期化、サンプルレートの受け渡しが動いていると確認できます。

<SonareDemo id="stft-basics" />

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

### CLI

```bash
pip install libsonare

# ターミナルでの簡易確認
sonare bpm audio.mp3
sonare key audio.mp3

# 機械処理しやすいフル解析
sonare analyze audio.mp3 --json > analysis.json
```

### C++

```cpp
#include <quick.h>

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
幾何ベースのルーム音響では、次の 2 点を確認します。

- 使う機能に応じて、`acoustic/rir_synthesizer.h`、`analysis/room_estimator.h`、`effects/acoustic/room_morph.h` のいずれかをインクルードする。
- `BUILD_ACOUSTIC_SIM=ON` でビルドする。
