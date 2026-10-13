# はじめに

libsonare は、音楽情報検索（MIR）、マスタリング、ミキシング、編集、クリエイティブ FX、ブラウザネイティブな音楽ツールのための、外部依存のない C++17 オーディオエンジンです。このページでは、何もインストールしていない状態から、普段使っている実行環境で BPM、キー、コード列を表示するところまで進みます。

必要な機能がまだ決まっていない場合は、先に [学習順ガイド](./learning-path.md) を読んでください。

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- すべての API で使うサンプル、サンプルレート、モノラル、ステレオの基本語彙を説明できる。
- 自分のプロジェクトに合う実行環境を選べる。
- ブラウザ、Node.js、Python、ターミナルのいずれかで libsonare をインストールし、最初の解析結果を表示できる。
- 次に開くべきリファレンスを判断できる。

## 実行環境を選ぶ前に

多くの例は同じ流れです。音声を読み込むかデコードし、`Float32Array` のサンプルとサンプルレートを渡し、結果を受け取ります。

| 用語 | 意味 |
|------|------|
| サンプル | 音声波形の 1 点の振幅値 |
| サンプルレート | 1 秒あたりのサンプル数。44,100 や 48,000 など |
| モノラル | 1 チャンネルの音声 |
| ステレオ | 左右 2 チャンネルの音声 |
| WASM | WebAssembly。npm パッケージのコンパイル先で、ブラウザでも Node.js でも動く |

これらの用語は [オーディオ基礎](./glossary/concepts/audio-basics.md) でさらに詳しく説明しています。

::: info 初めてなら「ファイル」と「サンプル」を分けて考える
MP3 や WAV は音声を保存するファイル形式です。libsonare の多くの API が受け取る `Float32Array` や Python の配列は、ファイルを読み込んだ後の PCM サンプル（圧縮を解いた素のサンプル値の列）です。下のどの実行環境でも WAV と MP3 はデコードできます。それ以外の形式は、ブラウザでは先にブラウザ側でデコードし、Python では FFmpeg 有効のビルドが必要です。
:::

## どこで動かすか

| 実行環境 | インストール | ファイルを直接読めるか | リファレンス |
|----------|--------------|------------------------|--------------|
| ブラウザ | `npm install @libraz/libsonare`、または [CDN 版](./wasm.md#cdn) | WAV/MP3 のバイト列をデコードする。ほかの形式はブラウザのデコーダーを使う | [WebAssembly ガイド](./wasm.md) |
| Node.js（WASM） | `npm install @libraz/libsonare`（Node.js 22.12 以上） | `node:fs` で読んだ WAV/MP3 のバイト列をデコードする | [JavaScript API](./js-api.md) |
| Python | `pip install libsonare`（Python 3.11 以上） | 読める。WAV と MP3、FFmpeg 有効ならさらに多くの形式 | [Python API](./python-api.md) |
| CLI | `pip install libsonare`（`sonare` コマンドも入る） | 読める。Python パッケージと同じ形式 | [CLI リファレンス](./cli.md) |

npm パッケージでは `sonare` コマンドはインストールされません。Node.js ネイティブアドオンと C++ ライブラリはソースからビルドします。[ネイティブバインディング](./native-bindings.md) と [C++ API](./cpp-api.md) を参照してください。

## 最初の結果

どのタブも、インストール行、プログラム、表示される出力までそろっています。例で解析する `demo.mp3` は [楽曲解析スタジオ](/ja/music-analysis) が読み込むのと同じ曲なので、自分の出力をデモと見比べられます。

::: code-group

```html [ブラウザ]
<!-- first.html — フォルダを任意の静的サーバー（たとえば `npx serve`）で配信し、
     https://libsonare.libraz.net/demo.mp3 から入手した demo.mp3 を選ぶ -->
<input type="file" id="file" accept=".mp3,.wav" />
<pre id="out"></pre>
<script type="module">
  import { init, Audio } from 'https://unpkg.com/@libraz/libsonare';

  await init();
  document.getElementById('file').addEventListener('change', async (event) => {
    const bytes = new Uint8Array(await event.target.files[0].arrayBuffer());
    const result = Audio.fromMemory(bytes).analyze();
    document.getElementById('out').textContent = [
      `BPM: ${result.bpm.toFixed(1)}`,
      `Key: ${result.key.name}`,
      `First chords: ${result.chords.slice(0, 8).map((c) => c.name).join(' ')}`,
    ].join('\n');
  });
</script>

<!-- 表示:
BPM: 160.4
Key: C major
First chords: C Am C Bm G G#m Em C
-->
```

```js [Node.js（WASM）]
// npm install @libraz/libsonare
// curl -O https://libsonare.libraz.net/demo.mp3
// node first.mjs
import { readFileSync } from 'node:fs';
import { init, Audio } from '@libraz/libsonare';

await init();
const audio = Audio.fromMemory(new Uint8Array(readFileSync('demo.mp3')));
const result = audio.analyze();

console.log('BPM:', result.bpm.toFixed(1));
console.log('Key:', result.key.name);
console.log('First chords:', result.chords.slice(0, 8).map((c) => c.name).join(' '));

// BPM: 160.4
// Key: C major
// First chords: C Am C Bm G G#m Em C
```

```python [Python]
# pip install libsonare
# curl -O https://libsonare.libraz.net/demo.mp3
# python first.py
from libsonare import Audio

audio = Audio.from_file("demo.mp3")
result = audio.analyze()

print(f"BPM: {result.bpm:.1f}")
print(f"Key: {result.key.name}")
print("First chords:", " ".join(c.name for c in result.chords[:8]))

# BPM: 160.4
# Key: C major
# First chords: C Am C Bm G G#m Em C
```

```bash [CLI]
pip install libsonare
curl -O https://libsonare.libraz.net/demo.mp3
sonare analyze demo.mp3

# warning: 2-channel input is downmixed to mono by this CLI command; use the stereo library API for channel-preserving processing
#
#   > Estimated BPM : 160.42 BPM  (conf 80.7%)
#   > Estimated Key : C major  (conf 98.3%)
#   > Time Signature: 4/4
#   > Beats: 192
```

:::

`analyze()` は 1 回の呼び出しで結果全体を返します。BPM とキーに加えて、ビート、コード、セクションと楽曲形式、さらに音色、ダイナミクス、リズム、メロディも含まれます。各フィールドの意味と、個別の推定器を呼ぶべき場面は [楽曲解析](./analysis.md) で説明しています。

`Audio.fromMemory` と `Audio.from_file` はステレオファイルをモノラルに畳み込みます。解析が想定しているのはモノラル入力です。ブラウザで AAC、OGG、FLAC をデコードするには `Audio.fromMemoryWithBrowserFallback` を使います（[ファイル入力](./wasm.md#ファイル入力)）。バンドラーを使うアプリでは、CDN の URL ではなく `'@libraz/libsonare'` からインポートします。

::: details Node.js ネイティブアドオン
N-API アドオン `@libraz/libsonare-native` は、libsonare を WebAssembly ではなくコンパイル済みのネイティブコードとして動かし、パスからファイルを読み込みます。npm には公開していないので、チェックアウトからビルドします。

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

```typescript
import { Audio } from '@libraz/libsonare-native';

const result = Audio.fromFile('demo.mp3').analyze();
console.log('BPM:', result.bpm, 'Key:', result.key.name);
```

[Node.js / ネイティブバインディング](./native-bindings.md) を参照してください。
:::

## できること

| 分野 | 例 | 最初に読むページ |
|------|----|------------------|
| 解析 | BPM、キー、コード、ビートとダウンビート、セクション、メロディ | [楽曲解析](./analysis.md) |
| 編集とリペア | ピッチ補正、タイムストレッチ、ノート編集、ノイズとハムの低減 | [編集 DSP](./editing-dsp.md)、[オーディオリペアの流れ](./audio-repair.md) |
| ミキシングとマスタリング | チャンネルストリップ、センドとバス。LUFS ターゲットと True Peak リミッターを備えたマスタリングチェーン | [ミキシングエンジン](./mixing.md)、[マスタリングアシスタント](./mastering-assistant.md) |
| 楽器と MIDI | 17 種のエンジンを持つシンセサイザー、GM/GS フォールバックバンク、SoundFont 2 プレイヤー | [音源方式](./sound-sources.md)、[内蔵シンセサイザー](./native-synth.md) |
| プロジェクトとリアルタイム | オフラインバウンスを備えたヘッドレス DAW のプロジェクト、ストリーミング解析、リアルタイムエンジン | [プロジェクト編集](./project-editing.md)、[リアルタイムとストリーミング](./realtime-streaming.md) |
| ルーム音響 | RT60 と明瞭度、音声からの部屋推定、インパルス応答の合成 | [ルーム音響解析](./acoustic-analysis.md) |

すべての分野と、目的ごとに書かれたページの一覧は [学習順ガイド](./learning-path.md) にあります。

::: details この表に出る略語
- **BPM**: 1 分あたりの拍数。曲の速さです。
- **LUFS / True Peak**: マスタリング指標です。LUFS（Loudness Units relative to Full Scale）は聴感上のラウドネス、True Peak（トゥルーピーク）はサンプル間のピークまで含めたピーク安全性を測ります。
- **RT60**: 部屋の残響が 60 dB 減衰するまでの時間です。
:::

## 今すぐ試す

いま表示したコードは、クロマのフレームをコードテンプレートと照合して得たものです。下のデモは同じコード認識を C–Am–F–G の短いクリップに対して実行します。計算しているのは、いまインストールしたのと同じ WASM ビルドです。

<SonareDemo id="chord-track" />

ブラウザで使える完全なツールは [デモ](/ja/demos) にあります。どのデモにも音声ファイルをドロップでき、何もアップロードされません。

## 次のステップ

サンプルが 1 つ動きました。ここから先は、目的によって読むページが 2 つに分かれます。

### 何かを作りたい

- [使用例](/ja/docs/examples) — 作りたいものに一番近い動作パターンを、実行環境ごとに
- [学習順ガイド](/ja/docs/learning-path) — 解析から再生まで、10 の分野を目的別に辿る道案内
- [実践ユースケース](/ja/docs/use-cases) — 素材から成果物まで 1 つの仕事を通しで、実行できるスクリプトの形で
- [インストール](/ja/docs/installation) — 既定の構成で足りなくなったときの FFmpeg デコード、ソースビルド、Node ネイティブアドオン

### エンジンを理解したい

- [イントロダクション](/ja/docs/introduction) — 波形からコードまでの解析パイプラインと、他のすべてのページが前提にする用語
- [楽曲解析](/ja/docs/analysis) — いま表示した結果の意味と、`analyze()` では粗すぎるときに選ぶ呼び出し
- [音源方式](/ja/docs/sound-sources) — エンジンがサンプルを同梱しない理由と、代わりに楽器の音がどこから来るか
- [DSP 実装解説](/ja/docs/dsp-implementation) — プロセッサの構造。パラメータを UI に出すときや、レンダリング結果を説明するときに
