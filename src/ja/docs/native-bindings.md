# ネイティブバインディング

libsonare には 3 つのバインディングがあります。ブラウザ向けの **WASM**、**Python**、そして **Node.js ネイティブアドオン** です。このページでは 3 つすべてを比較して選べるようにします。Node ネイティブの関数リファレンスは専用ページにあります。各言語の詳細は個別の API ページを参照してください。

- **[Python API](/ja/docs/python-api)** — ctypes ベースのバインディング、PyPI でホイールを配布
- **[Node.js Native API](/ja/docs/node-api)** — C++ の性能を直接活用するネイティブアドオン

初学者向けには、選び方は単純です。スクリプトやノートブックなら Python、ブラウザアプリなら WASM、Node.js からネイティブのファイルデコードや実行性能が必要な場合だけ Node ネイティブを選びます。

| 作りたいもの | 使う | パッケージ |
|--------------|------|-----------|
| ブラウザアプリ | WASM | `@libraz/libsonare` |
| Python スクリプトやノートブック | Python | `pip install libsonare` |
| ネイティブデコードや性能が必要な Node.js アプリ | Node ネイティブ | `@libraz/libsonare-native` |

## このページで身につくこと

このページを読むと、次のことを判断・実行できるようになります。

- ブラウザ WASM、Python、Node ネイティブを、同じものとしてではなく用途で選べる。
- ネイティブデコードや実行性能が必要なときに、Node N-API アドオンをビルドして import できる。
- どの例が `@libraz/libsonare` を使い、どの例が `@libraz/libsonare-native` を使うかを区別できる。
- ネイティブアドオンの関数を、JavaScript、Python、マスタリング、ミキシングの広いドキュメントへ対応づけられる。

## 比較

| | WebAssembly | Python | Node.js（N-API） |
|---|---|---|---|
| **プラットフォーム** | ブラウザ | デスクトップ | デスクトップ |
| **配布** | npm (`@libraz/libsonare`) | PyPI (`pip install libsonare`) | ソース (`bindings/node`) |
| **ビルド** | Emscripten | ビルド済みホイール（または CMake + pip） | CMake + cmake-js |
| **パフォーマンス** | ネイティブに近い | ネイティブ | ネイティブ |
| **ストリーミング** | 対応 | 対応 | 対応 |
| **ファイル I/O** | サンプルベース API。`Audio.fromMemory(...)` は WAV/MP3 バイト列をデコードでき、ブラウザ側デコード経路では追加の対応形式も読めます | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 |
| **エフェクト** | 対応 | 対応 | 対応 |
| **特徴抽出** | 対応 | 対応 | 対応 |
| **逆再構成** | 対応 | 対応 | 対応 |
| **単位変換** | 対応 | 対応 | 対応 |
| **マスタリング** | 対応 | 対応 | 対応 |
| **ミキシング** | 対応 | 対応 | 対応 |

---

## Node.js（N-API）

Node.js バインディングは **N-API** を使用したネイティブアドオンで、WebAssembly のオーバーヘッドなしに C++ の性能を直接活用できます。

::: details N-API と「ネイティブアドオン」とは？
**ネイティブアドオン** は、Node が通常のパッケージのように読み込むコンパイル済み C/C++ モジュールで、JavaScript や WebAssembly ではなく実際の機械語で動きます。

**N-API**（Node-API） は、こうしたアドオンを作るために Node が提供する安定したインターフェースで、V8 エンジンの内部実装からアドオンを隔離します。そのため、コンパイル済みバイナリ 1 つが再ビルドなしで Node の各バージョンで動き続けます。

利点はネイティブ速度と Node からの直接ファイルデコードです。一方で、WASM パッケージのようにどこでも同じバイナリが動くわけではないため、プラットフォームごとにビルド／インストールが必要です。
:::

## Node パッケージの選び方

| パッケージ | 初期化 | 使いどころ |
|------------|--------|------------|
| `@libraz/libsonare` | 使う前に `await init()` を呼ぶ | ブラウザ互換の WASM パッケージ、またはブラウザデモと同じ API が必要な場合 |
| `@libraz/libsonare-native` | WASM 初期化は不要。import して直接呼び出す | ネイティブのファイルデコード、ネイティブ実行性能、ソースツリー内アドオン開発が必要な場合 |

[JavaScript API](./js-api.md) の例は WASM パッケージを使います。ネイティブアドオンを使う例は `@libraz/libsonare-native` の import パスを持ちます。ネイティブの完全なリファレンスは [Node.js Native API](./node-api.md) を参照してください。

### 要件

- Node.js 22 以上
- CMake 3.16 以上
- C++17 対応コンパイラ
- Yarn 4 以上

### インストール

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

## マスタリング API

Node.js では WASM npm パッケージとネイティブアドオンの 2 経路があります。

| パッケージ | 使いどころ |
|-----------|------------|
| `@libraz/libsonare` | ブラウザデモと同じ API を使いたい、または Web 互換の WASM が必要な場合。 |
| `@libraz/libsonare-native` | Node.js でネイティブのファイルデコードやネイティブ実行性能が必要な場合。 |

```typescript
import {
  masterAudioStereo,
  masteringChainStereo,
  masteringAssistantSuggest,
  masteringAudioProfile,
  masteringPresetNames,
  masteringPairAnalyze,
  masteringProcessorNames,
  masteringStreamingPreview,
} from '@libraz/libsonare-native'

console.log(masteringProcessorNames())
console.log(masteringPresetNames())

const mastered = masteringChainStereo(left, right, sampleRate, {
  dynamics: {
    compressor: {
      thresholdDb: -18,
      ratio: 2.2,
      autoMakeup: true,
    },
  },
  loudness: {
    targetLufs: -14,
    ceilingDb: -1,
    truePeakOversample: 4,
  },
})
console.log(mastered.outputLufs, mastered.stages)

const presetMaster = masterAudioStereo(left, right, sampleRate, 'pop', {
  'loudness.targetLufs': -14,
})
console.log(presetMaster.outputLufs, presetMaster.stages)

const matchReport = JSON.parse(
  masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate),
)

const masteredWithProgress = masteringChainStereo(left, right, sampleRate, {
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
}, (progress, stage) => {
  console.log(`render ${(progress * 100).toFixed(0)}%: ${stage}`)
})
console.log(masteredWithProgress.outputLufs)

const profile = JSON.parse(masteringAudioProfile(samples, sampleRate, {
  nFft: 2048,
  hopLength: 512,
  truePeakOversample: 4,
}))
const suggestions = JSON.parse(masteringAssistantSuggest(samples, sampleRate, {
  targetLufs: -14,
  ceilingDb: -1,
  preferStreamingSafe: true,
}))
const deliveryPreview = JSON.parse(masteringStreamingPreview(samples, sampleRate, [
  { name: 'Streaming', targetLufs: -14, ceilingDb: -1 },
]))
console.log(profile, suggestions, deliveryPreview)
```

アシスタント／プロファイル系ヘルパーは、WASM 入口と同じオプション名を受け取ります。プロファイル設定は `nFft`、`hopLength`、`truePeakOversample`、アシスタント設定は `targetLufs`、`ceilingDb`、`enableRepair`、`preferStreamingSafe`、`speechMonoAmount` です。共有ネイティブパーサーを通るため、snake_case の別名も受け付けます。

長尺のオフラインレンダリングでは、`masteringChain(...)`、`masteringChainStereo(...)`、`masterAudio(...)`、`masterAudioStereo(...)` の最後に進捗コールバックを渡し、そこから Node UI を更新します。

WASM パッケージは、ブラウザデモと同じ camelCase のマスタリング API を公開しています。主なグループは次の通りです。

| グループ | API 名 |
|----------|--------|
| プリセットと簡易入口 | `mastering()`、`masteringPresetNames()`、`masterAudio()`、`masterAudioStereo()`、`masterAudioWithProgress()`、`masterAudioStereoWithProgress()` |
| フルチェーン | `masteringChain()`、`masteringChainStereo()`、`masteringChainWithProgress()`、`masteringChainStereoWithProgress()` |
| オフラインのダイナミクス（単発） | `masteringDynamicsCompressor()`、`masteringDynamicsGate()`、`masteringDynamicsTransientShaper()` |
| オフラインのリペア（単発） | `masteringRepairDeclick()`、`masteringRepairDeclip()`、`masteringRepairDecrackle()`、`masteringRepairDehum()`、`masteringRepairDenoiseClassical()`、`masteringRepairDereverbClassical()`、`masteringRepairTrimSilence()` |
| アシスタントとプロファイル | `masteringAudioProfile()`、`masteringAssistantSuggest()`、`masteringStreamingPreview()` |
| 名前付きプロセッサ | `masteringProcessorNames()`、`masteringProcessorCatalog()`、`masteringInsertNames()`、`masteringInsertParamNames(name)`、`masteringInsertParamInfo(name)`、`masteringProcess()`、`masteringProcessStereo()` |
| ペア処理とステレオ解析 | `masteringPairProcessorNames()`、`masteringPairProcess()`、`masteringPairAnalysisNames()`、`masteringPairAnalyze()`、`masteringStereoAnalysisNames()`、`masteringStereoAnalyze()` |
| ストリーミングレンダー | `StreamingMasteringChain` |

Node ネイティブは同じ基本名を使いますが、進捗は個別の `*WithProgress` ヘルパー関数ではなく、最後のオプション引数に渡すコールバックとして受け取ります。

## ミキシング API

ネイティブアドオンと WASM パッケージのどちらからも、ミキシング API を使えます。入口は `mixStereo(...)`、`mixingScenePresetNames()`、`mixingScenePresetJson()`、保持して使う `Mixer` クラスです。

チャンネルストリップ処理、シーンプリセット、センド、バス、オートメーション、メーター、オフラインのステムレンダーに使います。

ランタイム横断の説明は [ミキシングエンジン](./mixing.md) を参照してください。

永続ミキサーでは、Node ネイティブは多くのストリップ制御メソッドで `StripRef`（`number | string`）を受け取ります。WASM メソッドは数値のストリップインデックスを使い、ID からは `stripById(id)` で引きます。

Node の `stripMeter(strip)` はポストフェーダーメーターを読みます。タップを明示したい場合は `meterTap(strip, 'preFader' | 'postFader')` を使います。シーン JSON の読み込み後は、`mixer.sceneWarnings()` がどのプロセッサも消費しなかった insert パラメータ(典型的にはタイプミス)を非致命的な警告として一覧します。

## プロジェクト・インストゥルメント・ライブ MIDI

Node ネイティブアドオンは、WASM や Python と同じヘッドレス DAW 向け API を公開しています。`Project` クラス（トラック、クリップ、テンポ、undo/redo、SMF／MIDI 2.0 入出力）、インストゥルメント付きバウンス（`bounceWithSynthInstrument(s)` と SoundFont のロード）、NativeSynth プリセットカタログ（`synthPresetNames()`／`synthPresetPatch()`／`SynthPatch`）、`chordFunctionalAnalysis(...)`、そしてライブ MIDI 入力付きの `RealtimeEngine` が使えます。

エンジンには他のバインディングと同じレーンミキサーと MIDI クリップスケジュールが載っています。`setTrackLanes` / `setTrackBuses`、トラック／マスター／バスのストリップ JSON とインサート操作、インサートオートメーション id の解決、`setParamSmoothingMs`、ワイド／スコープテレメトリ、`setMidiClips`、`sampleAtPpq` を、WASM と同じ camelCase 名で使えます。外部機器へのルーティングも `setMidiDestinationExternal`、`setExternalMidiClockEnabled`、`drainExternalMidi`、`externalMidiDroppedCount` から利用できます（[リアルタイムエンジン](./realtime-engine.md#トラックを外部-midi-機器へ送る)を参照）。ブラウザ専用のつなぎ込み（`bindWebMidi`、`bindMicrophoneInput`）は WASM 固有で、ネイティブアドオンには含まれません。

詳細は各ガイドを参照してください: [プロジェクト編集](./project-editing.md)、[プロジェクトのバウンス](./project-bounce.md)、[内蔵シンセサイザー](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)、[MIDI 入力](./midi-input.md)。

## エラーハンドリング

WASM パッケージと同じく、ネイティブアドオンもネイティブ側の失敗をすべて構造化された `SonareError` としてスローします。`Error` のサブクラスで、C ABI のエラー enum を映した数値の `code` と正準名 `codeName` を持ちます。両パッケージとも `ErrorCode`・`SonareError`・型ガード `isSonareError(value)` をエクスポートし、同じ失敗はどのバインディングでも同じ数値コードを報告します。コード表と使用例は[エラーハンドリング](./js-api.md#エラーハンドリング)を参照してください。

## Audio メソッドの違い

WASM の `Audio` クラスは、よく使う単発ヘルパーをメソッド形式で呼ぶための入口です。BPM／キー／ビート／コードなどの基本解析、HPSS／編集、マスタリング、特徴量抽出、ラウドネス、リサンプリングをメソッドとして持ちます。

`analyzeSections(...)`、`analyzeMelody(...)`、`analyzeDynamics(...)`、`analyzeTimbre(...)`、ルーム音響解析・推定・RIR 合成・ルームモーフィングのような個別ヘルパーは、WASM では独立した関数として呼び出します。

Node ネイティブの `Audio` オブジェクトは、ネイティブアドオンへ直接委譲できるためメソッドの範囲が広くなっています。

共通メソッドに加えて、次のような focused helper も `Audio` メソッドとして持ちます: `analyzeBpm(...)`、`analyzeImpulseResponse(...)`、`detectAcoustic(...)`、`analyzeRhythm(...)`、`analyzeDynamics(...)`、`analyzeTimbre(...)`、`detectChords(...)`。ルーム系ヘルパーの `estimateRoom(...)`、`synthesizeRir(...)`、`roomMorph(...)` はスタンドアロン関数のままです。

読み込み入口も異なります。Node ネイティブは `Audio.fromFile(...)` と `Audio.fromMemory(...)` に対応します。WASM は `Audio.fromBuffer(...)`、`Audio.fromMemory(...)`、`Audio.fromMemoryWithBrowserFallback(...)` に対応します。

メソッドと関数の完全なリファレンスは [Node.js Native API](./node-api.md) を参照してください。

### StreamingMasteringChain

ネイティブアドオン（および WASM パッケージ）は、ブロック単位でレンダリングする
`StreamingMasteringChain` クラスも公開しています。Electron アプリや
ワーカー、音声入力パイプラインなどから、`masteringChain()` と同じ
ネスト構造の設定を使ってブロックごとに処理を進められます。

```typescript
import { StreamingMasteringChain } from '@libraz/libsonare-native';

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames(), chain.latencySamples());
chain.reset();   // 状態だけクリア（prepare し直さない）
```

`numChannels === 1` のときはステレオ専用ステージはスキップされます。
ストリーミングチェーンはオフライン専用の repair 段と、ファイル全体が必要な
`loudness` 段を拒否します。これらが必要な場合は `masteringChain*` または
`masterAudio*` を使ってください。WASM ビルドは追加で `chain.delete()` を
公開しておりハンドルを解放できます。
ネイティブアドオンは GC で自動的に解放します。

関連するマスタリングガイド: [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md)、[リファレンスマッチ](./glossary/mastering/reference-match.md)、[品質チェックリスト](./glossary/mastering/quality-checklist.md)。

### StreamingEqualizer

`StreamingEqualizer` は Node ネイティブ、Python、WASM で使えます。

`processMono` / `processStereo` の呼び出しをまたいで EQ の状態を保持し、スペクトラムスナップショットを出せます。リファレンスマッチからバンドを設定することもできます。

Node ネイティブと WASM は同じフェーズモード値を受け取ります。Python はさらにコンテキストマネージャ構文もサポートします。

| ランタイム | フェーズモード |
|---------|------------|
| Node ネイティブ | `'zero'`, `'natural'`, `'linear'`, または `1`/`2`/`3` |
| WASM | `'zero'`, `'natural'`, `'linear'`, または `1`/`2`/`3`（Node ネイティブと同じ） |
| Python | 文字列または数値モード |

Python では `with StreamingEqualizer(...) as eq:` / `eq.close()` で解放できます。

```typescript
import { StreamingEqualizer } from '@libraz/libsonare-native';

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
eq.setBand(0, { type: 'HighShelf', frequencyHz: 8000, gainDb: 4, enabled: true });
eq.setPhaseMode('natural');
eq.setAutoGain(true);

const { left, right } = eq.processStereo(leftBlock, rightBlock);
console.log(eq.spectrum(), eq.latencySamples(), left, right);
```

`@libraz/libsonare-native` は現在、ソースツリー内の `bindings/node` でビルドして使う前提です。別プロジェクトから使う場合は、ビルド済みのローカルパッケージをワークスペースや `file:` 依存として参照してください。

ネイティブビルドは `pkg-config` で FFmpeg 開発ライブラリを自動検出します。
FFmpeg がない場合は WAV/MP3 のみをデコードします。明示的に指定する場合は次の環境変数を使います。

```bash
SONARE_FFMPEG=1 yarn build  # FFmpeg デコードを必須にする
SONARE_FFMPEG=0 yarn build  # WAV/MP3 のみに固定する
```

## 関数リファレンス全体

Node ネイティブの関数ごとの完全なリファレンスは専用ページにあります: [Node.js Native API](./node-api.md)。解析、エフェクト、特徴抽出、逆再構成、librosa 互換、変換、メータリング、スケール量子化の各関数、ストリーミング／リアルタイムクラス、エクスポートされる TypeScript 型を掲載しています。
