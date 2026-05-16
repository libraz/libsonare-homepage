# はじめに

libsonare は、音楽情報検索（MIR）のための C++17 音声解析ライブラリです。

## 利用環境を選ぶ

まず、libsonare をどこで使うかを選んでください。

| やりたいこと | 使うもの | 最初に読むページ |
|-------------|---------|----------------|
| Web アプリのブラウザ上で解析したい | npm の WebAssembly パッケージ | [ブラウザ / WASM](/ja/docs/wasm) |
| Python スクリプトやノートブックで音声ファイルを解析したい | PyPI の Python パッケージ | [Python API](/ja/docs/python-api) |
| ターミナルやバッチ処理から解析したい | `pip install libsonare` で入る `sonare` CLI | [CLI リファレンス](/ja/docs/cli) |
| Node.js のサーバーやデスクトップツールから使いたい | N-API ネイティブバインディング | [Node.js ネイティブ](/ja/docs/native-bindings) |
| C++ ライブラリとして組み込みたい | C++17 ライブラリ | [C++ API](/ja/docs/cpp-api) |

ブラウザ向け npm パッケージはサンプルベースです。ファイルのデコードは行わず、デコード済みのモノラル `Float32Array` を渡します。Python パッケージと CLI は標準で WAV/MP3 を読み込めます。FFmpeg 有効ビルドでは、より多くの形式を直接読み込めます。

::: info パッケージ名
- ブラウザ / WASM: npm から `@libraz/libsonare` をインストールします。
- Python API と CLI: PyPI から `libsonare` を `pip install libsonare` でインストールします。
- Node.js ネイティブバインディング: `bindings/node` の `@libraz/libsonare-native` を使います。現在はソースビルド前提です。
:::

## クイックスタート

### ブラウザ（WebAssembly）

ブラウザでは、まずファイルをデコードし、モノラルの `Float32Array` サンプルを libsonare に渡します。

```typescript
import { init, analyze } from '@libraz/libsonare';

// WASM モジュールを初期化
await init();

// 音声サンプルを解析
const result = analyze(samples, sampleRate);

console.log('BPM:', result.bpm);
console.log('キー:', result.key.name);
console.log('コード:', result.chords);
```

次に読むページ: [WebAssembly ガイド](/ja/docs/wasm)、[JavaScript API リファレンス](/ja/docs/js-api)。

### Python

```bash
pip install libsonare
```

標準のホイールは WAV と MP3 を読み込みます。M4A/AAC/FLAC/OGG/Opus を直接読み込む場合は、FFmpeg を有効にしてソースからビルドします。

```python
from libsonare import Audio, analyze

# 音声ファイルを解析
audio = Audio.from_file("music.mp3")
result = analyze(audio.data, audio.sample_rate)

print(f"BPM: {result.bpm}")
print(f"キー: {result.key}")
print(f"ビート数: {len(result.beat_times)}")
```

次に読むページ: [Python API リファレンス](/ja/docs/python-api)。

### CLI（コマンドライン）

CLI は、ターミナルでの簡易確認、バッチ処理、JSON サマリーの出力に向いています。`sonare` コマンドは PyPI の Python パッケージに含まれます。npm の WebAssembly パッケージには含まれません。

```bash
pip install libsonare

# BPM とキーをすばやく確認
sonare bpm music.mp3
sonare key music.mp3

# JSON 形式で完全解析
sonare analyze music.mp3 --json
```

CLI の対応フォーマットは、インストールされている Python パッケージのデコード対応と同じです。

次に読むページ: [CLI リファレンス](/ja/docs/cli)。

### Node.js（ネイティブ）

Node.js からネイティブのファイル読み込みやデスクトップ/サーバーサイドの性能が必要な場合は、N-API バインディングを使います。現在はソースビルド前提です。

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
npm install
npm run build
```

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');
const result = audio.analyze();

console.log('BPM:', result.bpm);
console.log('キー:', result.key.name);
```

次に読むページ: [Node.js / ネイティブバインディング](/ja/docs/native-bindings)。

## できること

- **BPM 検出** - テンポグラムと自己相関を使用したテンポ推定
- **キー検出** - Krumhansl-Schmuckler プロファイルによる調性検出
- **ビート検出** - 動的計画法に基づくビート抽出
- **コード認識** - 108種類のコードタイプに対応したテンプレートマッチング
- **セクション検出** - イントロ、Aメロ、サビなどの構造的セグメンテーション
- **メロディ / ピッチ検出** - YIN / pYIN アルゴリズムによる基本周波数検出
- **音響特性** - 音色、ダイナミクス、リズム分析
- **スペクトル特徴量** - メルスペクトログラム、MFCC、クロマ、CQT/VQT、スペクトル重心、平坦度
- **オーディオエフェクト** - HPSS、タイムストレッチ、ピッチシフト、ノーマライズ、トリム
- **ストリーミング解析** - チャンク単位処理とプログレッシブBPM/キー/コード推定

## 今すぐ試す

[デモ](/ja/)にアクセスして、ブラウザで libsonare を試せます。音声ファイルをドラッグ & ドロップするだけで解析結果が表示されます。
