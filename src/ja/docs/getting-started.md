# はじめに

libsonare は、音楽情報検索（MIR）、マスタリング、ミキシング、編集、クリエイティブ FX、ブラウザネイティブな音楽ツールのための、外部依存なし C++17 オーディオ DSP ツールキットです。

必要な機能や実行環境がまだ決まっていない場合は、先に [学習順ガイド](./learning-path.md) を読んでください。このページは、最初のサンプルを動かす段階のための入口です。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- すべての API で使うサンプル、サンプルレート、モノラル、ステレオの基本語彙を説明できる。
- インストール前に、自分のプロジェクトに合う実行環境を選べる。
- ブラウザ、Python、CLI、Node ネイティブの最小例を 1 つ動かせる。
- 次に開くべき実行環境別リファレンスを判断できる。

## 利用環境を選ぶ前に

多くの例は同じ流れです。音声を読み込むかデコードし、`Float32Array` のサンプルとサンプルレートを渡し、解析結果や処理結果を受け取ります。ブラウザでは通常、ファイルのデコードを呼び出し側で行います。Python と CLI では、一般的な音声ファイルを直接読み込めることが多いです。

| 用語 | 意味 |
|------|------|
| サンプル | 音声波形の 1 点の振幅値 |
| サンプルレート | 1 秒あたりのサンプル数。44,100 や 48,000 など |
| モノラル | 1 チャンネルの音声 |
| ステレオ | 左右 2 チャンネルの音声 |
| WASM | WebAssembly。npm パッケージがブラウザで使う実行形式 |

## 利用環境を選ぶ

まず、libsonare をどこで使うかを選んでください。

| やりたいこと | 使うもの | 最初に読むページ |
|-------------|---------|----------------|
| Web アプリのブラウザ上で解析したい | npm の WebAssembly パッケージ | [ブラウザ / WASM](/ja/docs/wasm) |
| Python スクリプトやノートブックで音声ファイルを解析したい | PyPI の Python パッケージ | [Python API](/ja/docs/python-api) |
| ターミナルやバッチ処理から解析したい | `pip install libsonare` で入る `sonare` CLI | [CLI リファレンス](/ja/docs/cli) |
| ピッチや声質の編集を入れたい | 編集 DSP | [編集 DSP](/ja/docs/editing-dsp) |
| 残響時間、明瞭度、室内音響パラメータを推定したい | 音響解析ヘルパー | [室内音響解析](/ja/docs/acoustic-analysis) |
| ミキサー、ルーティング画面、ステムレンダーを作りたい | WASM、Python、Node、C++ から使えるミキシングエンジン | [ミキシングエンジン](/ja/docs/mixing) |
| 判断根拠を見せるマスタリング UI を作りたい | マスタリングアシスタント／プロファイル／プレビュー API | [マスタリングアシスタント](/ja/docs/mastering-assistant) |
| ライブ可視化や再生ツールを作りたい | ストリーミングアナライザーとリアルタイムエンジン | [リアルタイムとストリーミング](/ja/docs/realtime-streaming) |
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
print(f"キー: {result.key.name}")
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
yarn install
yarn build
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
- **室内音響解析** - RT60、EDT、C50、C80、D50、オクターブバンド別減衰、ブラインド推定
- **スペクトル特徴量** - メルスペクトログラム、MFCC、クロマ、CQT/VQT、スペクトル重心、平坦度
- **オーディオエフェクト** - HPSS、タイムストレッチ、ピッチシフト、ノーマライズ、トリム
- **ストリーミング解析** - チャンク単位処理とプログレッシブBPM/キー/コード推定
- **マスタリング** - LUFS ターゲット、トゥルーピークリミッター、EQ、ダイナミクス、リペア、ステレオ処理、リファレンスマッチングを含むプリセット／設定式チェーン
- **ミキシング** - チャンネルストリップ、センド、バス、オートメーション、シーンプリセット、ゴニオメーター／トゥルーピーク計測、オフラインステレオレンダー
- **編集 DSP とインサート** - ピッチ補正、ノート区間ストレッチ、ピッチ／フォルマントによるボイスチェンジを直接提供し、リバーブやダッキングは有効な場合に名前付きプロセッサまたはミキサーインサート経路から使えます
- **逆変換ヘルパー** - メルスペクトログラムや MFCC から STFT／音声を近似的に再構成

## 今すぐ試す

[デモ](/ja/demos)にアクセスして、ブラウザで libsonare を試せます。音声ファイルをドラッグ & ドロップするだけで解析結果が表示されます。
