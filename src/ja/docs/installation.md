# インストール

このページは、[はじめに](./getting-started.md) で使う実行環境を決めた後に読むページです。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- ブラウザ/WASM npm パッケージ、Python パッケージ、ソースビルドを用途に応じて導入できる。
- npm パッケージでは `sonare` CLI がインストールされない理由を理解できる。
- 標準の WAV/MP3 対応ではなく、FFmpeg 有効デコードが必要な場面を判断できる。
- ホイールや既存パッケージで足りないときだけ、ソースからビルドできる。
- C++ ライブラリをプレフィックス配下にインストールし、自分の CMake プロジェクトから `find_package(sonare)` でリンクできる。

## どれをインストールするか

| 作るもの | インストール |
|----------|--------------|
| ブラウザアプリ | `npm install @libraz/libsonare` |
| Python スクリプトやノートブック | `pip install libsonare` |
| ターミナルでのバッチ処理 | `pip install libsonare` で `sonare` を使う |
| Node ネイティブのサービスやデスクトップツール | `bindings/node` を `@libraz/libsonare-native` としてビルド |
| C++ 組み込み | ソースからビルドして `cmake --install` し、`find_package(sonare)` で利用 |
| 独自 WASM ビルド | Emscripten でソースからビルド |

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
| `@libraz/libsonare/analysis` | 解析専用モジュール。マスタリング・ミキシング・リアルタイム・プロジェクトのバインディングを含まないため、MIR（音楽情報検索）だけが必要な場合はダウンロードがはるかに小さくなります |
| `@libraz/libsonare/worklet` | `SonareRealtimeEngineNode`、`SonareEngine`、Worklet 側ライフサイクルエクスポートを含む AudioWorklet ブリッジヘルパー |
| `@libraz/libsonare/worker` | ワンショットの解析・マスタリングを専用 Worker で実行する `OfflineWorkerClient` |
| `@libraz/libsonare/wasm` | バンドラーや独自ローダー用の通常 WASM アセット |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset.schema.json` | ボイスチェンジャープリセットの JSON Schema |
| `@libraz/libsonare/schemas/realtime-voice-changer-preset-pack.schema.json` | プリセットパックの JSON Schema |

::: tip 解析だけならアナリシスバンドルを選ぶ
`@libraz/libsonare/analysis` は同じ DSP からマスタリング・ミキシング・リアルタイム・プロジェクトの各サーフェスを外してビルドしたものです。CI はサイズをレポートに記録しますが、増加だけでビルドを失敗させません。BPM・キー・コード検出やスペクトログラム表示だけを行い、マスタリングやミキシングをしないページなら、メインエントリの代わりにこちらをインポートすると WASM のダウンロード量を大きく減らせます。
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

公開されている成果物は、WebAssembly の npm パッケージ、Python ホイール、ネイティブ CLI のリリースアーカイブです。ネイティブ CLI アーカイブは Linux `x86_64`／`aarch64` と macOS `arm64` 向けに公開されます。Node ネイティブバインディングは private 指定で、ローカル依存としてのみインストールされます（[ネイティブバインディング](/ja/docs/native-bindings) を参照）。

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

# ネイティブライブラリを構成してビルド
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release   # FFmpeg を自動検出
# ... -DSONARE_WITH_FFMPEG=ON   # FFmpeg デコードを必須にする
# ... -DBUILD_ACOUSTIC_SIM=ON   # 幾何ベースのルーム音響（既定 ON）
cmake --build build --parallel

# WebAssembly をビルド（リポジトリルートで実行）
make wasm
```

ネイティブビルドの成果物（アーカイブと CLI）は `build/` 配下に残ります。これをプレフィックス配下にインストールし、別プロジェクトからリンクする手順は[次の節](#c-ライブラリのインストール)にあります。

::: warning 共有ライブラリとバインディングは一緒にビルドし直す
Python バインディングは、別のツリーでビルドされた共有ライブラリを受け付けません。自前でビルドした `.so` / `.dylib` と、それを読み込むバインディングは、同じチェックアウトから生成する必要があります。C 構造体のレイアウトが変わるバージョンを取り込んだあとは、新しいバインディングを古い成果物へ向けるのではなく、ライブラリをビルドし直してください。公開されている wheel を使えば、対応の取れた組み合わせがそのまま入るため、この問題は起きません。
:::

## C++ ライブラリのインストール

C++ ライブラリを入手する方法はソースビルドだけです（ビルド済みアーカイブは公開されていません）。ただし、利用側がビルドツリーを直接参照する必要はありません。`cmake --install` を実行すると、下流の CMake プロジェクトに必要なものが 1 つのプレフィックス配下にまとめてコピーされます。

```bash
cmake --install build --prefix /your/prefix
```

`--prefix` を省略すると CMake の既定値、Linux と macOS では `/usr/local` 配下に入ります。構成時に `-DCMAKE_INSTALL_PREFIX=/your/prefix` を渡しても同じです。プレフィックス配下の配置は次のとおりです（`GNUInstallDirs` がそう定める Linux ディストリビューションでは `lib` が `lib64` になります）。

| プレフィックス配下のパス | 内容 |
|--------------------------|------|
| `lib/` | サブシステムごとの静的アーカイブ（`libsonare_core.a`、`libsonare_midi.a` など）、同梱 FFT の `libsonare_kissfft.a` と `libsonare_pffft.a`、`BUILD_SHARED=ON` でビルドした場合は `libsonare.so` / `.dylib` |
| `include/sonare/` | C ABI のヘッダー。`<sonare/sonare_c.h>` としてインクルードする |
| `include/sonare/cpp/` | C++ のヘッダーツリー。相対 include が解決できるようツリーごと入る。include ルート経由の `<sonare/cpp/sonare.h>` でも、ツリー内と同じ `"sonare.h"` でも届く |
| `lib/cmake/sonare/` | `sonareConfig.cmake`、`sonareConfigVersion.cmake`、`sonareTargets.cmake`。`find_package(sonare)` が読み込むファイル |
| `lib/pkgconfig/sonare.pc` | 共有ビルドのみ。pkg-config が記述できるのはライブラリ 1 つで、静的構成は依存順に並んだアーカイブの集合だから |
| `bin/sonare-cli` | ネイティブ CLI。`BUILD_CLI` が ON（既定）の場合 |

インストールルールが生成されるのは、libsonare がネイティブ構成のトップレベルプロジェクトであるときだけです。`SONARE_INSTALL` はその場合 `ON`、`add_subdirectory()` 配下や `BUILD_WASM` では `OFF` が既定になります。親プロジェクトの install ステップに何を含めるかは親が決めることであり、WebAssembly ビルドが生成するのは C++ ライブラリではなく embind モジュールだからです。

インストール時のコンポーネントはありません。`cmake --install --component` で選べるものはなく、インストールに何が含まれるかは構成時の `BUILD_*` オプションで決まります。`-DBUILD_MIXING=OFF` で構成したインストールにはミキシングのアーカイブが存在せず、パッケージファイルもそう申告します。利用側で言う「コンポーネント」は別の意味で、次項で扱います。絞り込んだ構成の例は[内蔵インストゥルメントだけをリンクする](./cpp-api.md#内蔵インストゥルメントだけをリンクする)を参照してください。

### find_package で利用する

パッケージ名は `sonare`、名前空間は `sonare::`、リンクするターゲットは `sonare::sonare` です。利用側プロジェクトの全体は次のようになります。

```cmake
cmake_minimum_required(VERSION 3.16)
project(my_app LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(sonare REQUIRED)

add_executable(my_app main.cpp)
target_link_libraries(my_app PRIVATE sonare::sonare)
```

```cpp
// main.cpp
#include <iostream>
#include <sonare/cpp/sonare.h>

int main(int argc, char** argv) {
  const auto audio = sonare::Audio::from_file(argv[1]);
  const auto result = sonare::MusicAnalyzer(audio).analyze();
  std::cout << "BPM: " << result.bpm << "\nKey: " << result.key.to_string() << "\n";
}
```

`sonare::sonare` は、そのインストールに含まれる静的アーカイブすべてを束ねた集約ターゲットです。どのアーカイブが必要か、どの順に並べるかを自分で見極める必要はありません。各サブシステムは単独でもエクスポートされており、内蔵インストゥルメントで MIDI をレンダリングするだけのアプリなら `sonare::midi` だけで足ります。サブシステムをコンポーネントとして指名すると、存在しないサブシステムはリンク時の未定義シンボルではなく構成時のエラーになります。

```cmake
find_package(sonare REQUIRED COMPONENTS midi)
target_link_libraries(app PRIVATE sonare::midi)
```

コンポーネント名は `BUILD_*` オプションではなくエクスポートされたターゲット名に対応します。`BUILD_ACOUSTIC_SIM` が生成するのは `sonare::acoustic` なので、コンポーネントは `acoustic` です。一覧は[リンクターゲット](./cpp-api.md#リンクターゲット)にあります。

**`find_package` が探す場所。** CMake は `/usr` や `/usr/local` を含む標準のシステムプレフィックスを探索するため、既定のプレフィックスへのインストールは追加設定なしで見つかります。それ以外の場所に入れた場合、`find_package(sonare)` は `Could not find a package configuration file provided by "sonare"` で止まります。利用側にプレフィックスを教えてください。

```bash
cmake -S . -B build -DCMAKE_PREFIX_PATH=/your/prefix
cmake --build build
```

`CMAKE_PREFIX_PATH` はセミコロン区切りのリストなので、複数のパッケージが別々のプレフィックスにあっても 1 つの設定に収まります。このパッケージだけを指すなら `-Dsonare_DIR=/your/prefix/lib/cmake/sonare` でディレクトリを直接指定しても同じです。バージョンファイルは、要求したものとメジャーバージョンが一致するインストールをすべて受け入れます。アーカイブはインストールする人がソースから再ビルドするものであり、互換性を壊すのは C++ API の変更だけだからです。

**ビルド時と実行時に必要なもの。** ビルド時に利用側で必要なのは、C++17 対応コンパイラ、CMake 3.16 以上、スレッドライブラリです。Eigen は不要です。インストールされるヘッダーはどれも Eigen をインクルードしません。インストールが FFmpeg 有効でビルドされている場合、パッケージファイルは FFmpeg のライブラリを `pkg-config` 経由で解決するため、利用側のマシンにも FFmpeg の開発パッケージが必要です。実行時には、既定の静的インストールなら C++ ランタイム以外に何も要りません。共有ビルドのインストールではローダーのパス上に `libsonare.so` / `.dylib` が必要で、FFmpeg 有効のインストールはどちらの形でも FFmpeg の共有ライブラリが必要です。

### インストールと add_subdirectory() の使い分け

チェックアウトに対する `add_subdirectory()` も引き続き使え、同じ `sonare::` のターゲット名が定義されるため、リンク行に入手方法の違いは現れません。利用側が独立したプロジェクトなら、インストール済みパッケージを使うほうが向いています。複数のプロジェクトで 1 つのインストールを共有でき、アプリを再ビルドしても libsonare は再ビルドされません。libsonare 自体をアプリと並行して変更しているなら `add_subdirectory()` のほうが向いています。チェックアウトから毎回ライブラリがコンパイルされ、途中に install ステップが要りません。テストツリーと CLI を自分のビルドから外すため、親側で `BUILD_TESTING` と `BUILD_CLI` を `OFF` にしてください。libsonare リポジトリの `examples/cpp` は両方に対応しており、まず `find_package(sonare CONFIG QUIET)` を試し、何もインストールされていなければチェックアウトにフォールバックします。

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

ルーム音響メトリクスでは、測定済みインパルス応答（IR）に
`sonare::quick::analyze_impulse_response()`、通常音声からのブラインド推定に
`sonare::quick::detect_acoustic()` を使います。
幾何ベースのルーム音響では、次の 2 点を確認します。

- 使う機能に応じて、`acoustic/rir_synthesizer.h`、`analysis/room_estimator.h`、`effects/acoustic/room_morph.h` のいずれかをインクルードする。
- `BUILD_ACOUSTIC_SIM=ON` でビルドする。

自分の CMake プロジェクトからのリンク方法（`find_package(sonare)`、`sonare::sonare` ターゲット、ヘッダーの配置先、システムプレフィックス外のインストールに対する `CMAKE_PREFIX_PATH`）は [C++ ライブラリのインストール](#c-ライブラリのインストール)で扱っています。エクスポートされる全ターゲットと、どれが存在するかを決めるビルドフラグは[リンクターゲット](./cpp-api.md#リンクターゲット)にあります。
