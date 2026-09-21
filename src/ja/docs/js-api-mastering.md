---
title: JavaScript/TypeScript マスタリング API
description: libsonare JavaScript/TypeScript パッケージのマスタリングチェーン、名前付きプロセッサ、プリセット、ストリーミングマスタリング、ミキシング API のリファレンスです。
---

# JavaScript/TypeScript マスタリング API

## マスタリング API

ブラウザ向けパッケージには `/ja/mastering` デモと同じ名前付きマスタリングプロセッサが含まれます。Web Audio API などでデコードした `Float32Array` のチャンネルバッファを渡し、戻り値のサンプルをアプリ側で WAV などに書き出します。

この節では JS の入口と、その結果／設定の型を一覧します。各プロセッサの働き、プリセット一覧、解析／アシスタントが返す JSON は、[マスタリングプロセッサ](./mastering-processors.md) と [マスタリングアシスタント](./mastering-assistant.md) を参照してください。

```typescript
import { init, masterAudioStereo, masteringChainStereo } from '@libraz/libsonare'

await init()

// ステージを明示したフルチェーン
const result = masteringChainStereo(left, right, sampleRate, {
  spectral: { airBand: { amount: 0.35, shelfFrequencyHz: 14000 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
})
console.log(result.outputLufs, result.outputTruePeakDbtp, result.outputLra)
if (result.loudnessTargetLimited) {
  console.warn('トゥルーピーク上限のため、要求した LUFS 目標には届きませんでした。')
}
console.log(result.stageGainReductions)

// プリセット + ネストした上書き（型定義どおりの MasteringChainConfig 形式）
const presetResult = masterAudioStereo(left, right, sampleRate, 'pop', {
  loudness: { targetLufs: -14 },
  maximizer: { truePeakLimiter: { releaseMs: 50 } },
})
```

これらにはそれぞれ `(progress, stage) => void` のコールバックを取る `*WithProgress` 変種があります。`masteringProcess(...)` / `masteringProcessStereo(...)` は名前付きプロセッサを 1 つ実行し、`masteringStereoAnalyze(...)` は JSON レポートを返します。

オフラインのチェーン／プリセット結果には、`outputTruePeakDbtp`、`outputLra`、`loudnessTargetLimited`、`stageGainReductions` が含まれます。

`loudnessTargetLimited` が true なら、True Peak 上限のため要求した LUFS 目標には届いていません。目標ではなく実際の `outputLufs` を報告してください。各 `StageGainReduction` は、ダイナミクスまたはマキシマイザーの直近のゲインリダクションを示します。

#### `report` — 処理前後を 1 つのオブジェクトで

オフラインチェーンの結果は `report` も持ちます。これは「実際に何が起きたか」の要約で、
自分で入力を測り直して組み立てる必要がなくなります。

```typescript
interface MasteringReport {
  before: MasteringLoudnessSummary;
  after: MasteringLoudnessSummary;
  appliedGainDb: number;
  maxGainReductionDb: number;
  loudnessTargetLimited: boolean;
  /** 対数等間隔 32 バンドの「後 − 前」エネルギー差（dB） */
  bandEnergyDeltaDb: Float32Array;
}

interface MasteringLoudnessSummary {
  integratedLufs: number;
  maxMomentaryLufs: number;
  maxShortTermLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
}
```

```typescript
const { report } = masteringChainStereo(left, right, sampleRate, config);
console.log(report.before.integratedLufs, '→', report.after.integratedLufs);
console.log(report.after.loudnessRange - report.before.loudnessRange, 'LU 変化');
drawTiltCurve(report.bandEnergyDeltaDb);   // 32 バンド。正なら処理後の方が明るい
```

同じオブジェクトが C ABI・ctypes・Node・Python・両 CLI のレポートファイルにミラーされて
いるため、CLI から書き出したレポートとブラウザで読むレポートは同じ形になります。

説明可能なマスタリングのヘルパー（`masteringAudioProfile(...)`、`masteringAssistantSuggest(...)`、`masteringStreamingPreview(...)`）は JSON 文字列を返します。正確な形、受け付けるオプション、提案をレンダー済みマスターに変換する方法は [マスタリングアシスタント](./mastering-assistant.md) を参照してください。リファレンストラック用途では `masteringPairProcessorNames()` と `masteringPairAnalyze()` を使います（サンプルレートを揃え、長さも近づける）。

#### 説明可能なヘルパーのステレオ版

この 3 つには、チャンネルペアを直接計測するステレオ版があります。いずれも、**リクエストオブジェクト専用です**。位置引数のオーバーロードはなく、位置引数で呼ぶと例外になります。

```typescript
function masteringAudioProfileStereo(request: MasteringStereoParamsRequest): string
function masteringAssistantSuggestStereo(request: MasteringStereoParamsRequest): string
function masteringStreamingPreviewStereo(request: MasteringStreamingPreviewStereoRequest): string

interface MasteringStereoParamsRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringProcessorParams;
}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}
```

```typescript
const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
const suggestion = JSON.parse(masteringAssistantSuggestStereo({ left, right, sampleRate }));
const preview = JSON.parse(
  masteringStreamingPreviewStereo({
    left,
    right,
    sampleRate,
    platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
  }),
);
```

ステレオ素材ならこちらを使ってください。モノラル版は `0.5 * (left + right)` のダウンミックスを計測するため、相関の低い素材では約 6 dB 低く出ます。積分ラウドネス、そこから導かれる正規化ゲイン、天井に当たるリスクの判断が、そろって同じぶんだけ過小に報告されます。相関の低いピンクノイズのペア（48 kHz、4 秒）での実測値は、ダウンミックス経由が **-22.55 LUFS**、ステレオ版が **-16.44 LUFS** で、差は **6.11 dB** でした。Spotify の `normalizationGainDb` もダウンミックス経由が **+8.55**、ステレオ版が **+2.44** です。相関の高いペアでは差が 3.01 dB まで縮みますが、これは単純に半分になったぶんで、残りの約 3 dB がデコリレーションによるものです。

ステレオプロファイルのうち、左右両チャンネルから計測されるのは `loudness` ブロックだけです。積分 LUFS と LRA はチャンネル加算したプログラムから求め、True Peak は左右の大きいほうを採ります。スペクトル、ダイナミクス、テンポの各フィールドは絶対レベルではなく形と時間を表すため、引き続きダウンミックス上で計測され、`masteringAudioProfile` の値とそのまま比較できます。

#### ドキュメント全体ではなくチェーンだけを受け取る

`masteringAssistantSuggest(...)` はアシスタントのドキュメント全体を JSON 文字列で返し、
提案されたチェーンはそのなかの 1 ブロックです。チェーンだけが必要なときは、こちらが
`{ キー: number | boolean }` のフラットなマップをそのまま返します。JSON のパースも、
目的のブロックを掘り出す手間も要りません。

```typescript
function masteringAssistantSuggestChain(
  request: MasteringAssistantParamsRequest,
): Record<string, number | boolean>

function masteringAssistantSuggestChainStereo(
  request: MasteringAssistantStereoParamsRequest,
): Record<string, number | boolean>
```

このマップは `mastering(...)` や `masterAudio(...)`、ステレオなら `masterAudioStereo(...)` が
`overrides` として受け取る形そのものなので、変換をはさまずに適用できます。

```typescript
const chain = masteringAssistantSuggestChainStereo({ left, right, sampleRate });
const mastered = masterAudioStereo({ left, right, sampleRate, overrides: chain });
```

どちらもリクエストオブジェクト専用です。ステレオ版が左右のペアを直接計測するのは、ほかの
ステレオ用エントリポイントと同じ理由によります。Python での綴りは
`mastering_assistant_suggest_chain` と `mastering_assistant_suggest_chain_stereo` です。

#### `masteringPlatformNames()`

```typescript
function masteringPlatformNames(): string[]
```

`targetPlatform` として受け付けられる配信ターゲットを、インデックス順に返します。`'streaming'`、`'broadcast'`、`'club'` など、ロード中のビルドが持つものすべてです。バインディング側にハードコードされているのではなくライブラリから読み出されるため、コアに追加されたターゲットはバインディングを変えなくてもここに現れます。自前のリストを同梱するのではなく、この値からピッカーを組み立ててください。

#### `masteringAbMatchLoudness(request)`

一方のテイクをもう一方のラウドネスに合わせ、A/B 比較がレベル差ではなく音色の比較になるようにします。

```typescript
function masteringAbMatchLoudness(request: MasteringAbMatchLoudnessRequest): LoudnessMatchResult

interface MasteringAbMatchLoudnessRequest {
  source: Float32Array;      // ゲインが適用される側
  reference: Float32Array;   // そのまま返る
  sampleRate?: number;       // 既定 22050
}

interface LoudnessMatchResult {
  samples: Float32Array;        // reference のラウドネスに合わせた source
  sampleRate: number;
  referenceLufs: number;        // BS.1770 の積分値
  sourceLufs: number;           // ゲイン適用前
  appliedGainDb: number;        // referenceLufs - sourceLufs
  matchedTruePeakDbtp: number;  // ゲイン適用後の True Peak
}
```

受け取るのはリクエストオブジェクトのみです。2 つのバッファは長さが異なっていても構いません。それぞれ自身のプログラムとして計測されます。

::: warning ゲインに上限はなく、結果が 0 dBTP を超えることがある
`appliedGainDb` には上限がなく、ヘッドルームのクランプも行われないため、`matchedTruePeakDbtp` が **`0` を超える**ことがあります。これは意図的です。ヘッドルームのためにクランプすると、すでにフルスケール近くにある音源ではマッチングが暗黙に無効化されてしまい、それこそ A/B でもっとも調べたいケースだからです。レンダリングする場合は、試聴とは別に `matchedTruePeakDbtp` を自分で確認し、ペアごとまとめて減衰させてください。

どちらかのテイクが無音、または計測ゲートを下回る場合、その LUFS フィールドは**非有限値**になり、`appliedGainDb` は `0`、source はそのまま返ります。値を表示する前に `Number.isFinite(result.sourceLufs)` を確認してください。
:::

`masteringStreamingPreviewStereo` の `platforms` の扱いはモノラル版と同じです。省略するか空配列を渡すと、組み込みの Spotify / Apple Music / YouTube のセットにフォールバックし、例外ではなく 3 行分の結果を返します。

### StreamingEqualizer

`StreamingEqualizer` は、ブロック単位で動かすリアルタイム安全な EQ オブジェクトです。

最大 24 バンド、`zero-latency` / `natural` / `linear` の位相モード、ダイナミック EQ、ミッド／サイド処理、外部サイドチェイン、スペクトルスナップショット、オフラインのリファレンスマッチを扱えます。

WASM 版では先に `init()` を呼び、使い終わったら `delete()` で解放します。

```typescript
import { init, StreamingEqualizer } from '@libraz/libsonare';
await init();

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
try {
  eq.setBand(0, {
    type: 'HighShelf',
    frequencyHz: 8000,
    gainDb: 4,
    q: 0.7,
    enabled: true,
  });
  eq.setPhaseMode(1); // 1 = zero-latency, 2 = natural, 3 = linear
  eq.setAutoGain(true);

  const { left, right } = eq.processStereo(leftBlock, rightBlock);
  console.log(eq.spectrum(), eq.latencySamples(), left, right);
} finally {
  eq.delete();
}
```

ファイル単位の EQ / フィルタ処理に対応するソースビルド C++ CLI 例:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

### StreamingRetune

`StreamingRetune` は、ブロック単位で動かすモノラルのピッチリチューン用オブジェクトです。グレインとディレイの状態を呼び出し間で保持するため、最初のブロック前に `prepare()`、使い終わったら `delete()` を呼びます。

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';
await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1, grainSize: 0 });
retune.prepare(48000, 512);

try {
  const out = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  console.log(out, retune.config(), retune.grainSize());
} finally {
  retune.delete();
}
```

ソースビルド C++ CLI でのオフラインファイル処理に近いコマンド:

```bash [C++ CLI]
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

### RealtimeVoiceChanger

`RealtimeVoiceChanger` はプリセットで動かすライブ音声チェーン（ハイパス、ゲート、リチューン、フォルマント、EQ、コンプレッサー、ディエッサー、リバーブ、リミッターの各段）で、音声ブロックをまたいで状態を保持します。モニタリング、AudioWorklet 形式の処理、または `voiceChange(...)` では単純すぎるチャンク単位の音声処理で使います。標準プリセット ID は `realtimeVoiceChangerPresetNames()` で取得し、プリセット JSON は `realtimeVoiceChangerPresetJson(...)` で取得、`validateRealtimeVoiceChangerPresetJson(...)` で検証できます（スキーマバージョン `1`）。`RealtimeVoiceChangerConfigInput` は厳密な型で、6 種類の `VoicePresetId` 文字列、または `dsp` と `macros` のどちらか一方だけを持つプリセットオブジェクトを指定します。

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger(realtimeVoiceChangerPresetNames()[1]); // 例: "bright-idol"
changer.prepare(48000, /*maxBlockSize=*/128, /*channels=*/1);
try {
  const out = changer.processMono(inputBlock);
  const realtime = changer.createRealtimeMonoBuffer(128); // ゼロコピーの WASM ヒープビュー
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();
  console.log(out, realtime.output, changer.latencySamples());
} finally {
  changer.delete();
}
```

ゼロコピーバッファヘルパー（`createRealtimeMonoBuffer`、`createRealtimeInterleavedBuffer`、`createRealtimePlanarBuffer`）は changer が所有する WASM ヒープのビューを返します。リアルタイムループ内で再利用し、`delete()` 後は破棄してください。プリセット一覧とチェーン各段は [リアルタイムボイスチェンジャー](./realtime-voice-changer.md) を参照してください。

### `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` は `RealtimeVoiceChanger` をバッファ全体に対してオフラインで一括適用する便利関数です。内部で changer を構築・準備し、ブロック単位のレンダリングループを実行したうえで破棄します（Python の `voice_change_realtime` や Node の同等関数と同じ考え方です）。そのため、呼び出し側が状態を持つオブジェクトを管理する必要はありません。

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // デフォルト 48000
  preset?: RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // デフォルト 1（モノラル）。2 = インターリーブステレオ (L0,R0,L1,R1,...)
    /** @deprecated Ignored — the shared C-ABI renderer uses a fixed block size. */
    blockSize?: number;
  },
): Float32Array  // 入力と同じレイアウト・長さ
```

バッファ全体が手元にある場合はこれを使います。ブロック単位のライブ処理を手動で行う場合は [`RealtimeVoiceChanger`](#realtimevoicechanger) を、フルのプリセットチェーンが不要で一度きりのピッチ／フォルマント変更だけが必要な場合は `voiceChange(...)` を使ってください。

### StreamingMasteringChain

リアルタイム処理やメモリ制約のあるユースケース（`AudioWorklet` やストリーム
入力からのブロック単位処理など）向けに、WASM モジュールは
`StreamingMasteringChain` を公開しています。受け取るのは `StreamingMasteringChainConfig` で、これは `masteringChain()` の `MasteringChainConfig` に、ストリーミング専用の任意フィールドを 2 つ追加したものです。

- `loudnessStaticGainDb` — 事前計算した静的ラウドネスゲイン（dB、例: `targetLufs - measuredIntegratedLufs`）。ブロックごとに適用され、`loudness` ステージを有効にしたプリセットのストリーミングプレビューがオフラインレンダリングと一致するようにします。
- `loudnessStaticGainPeakDb` — オフラインで計測した音源の True Peak（dBFS）。指定すると静的ゲインが `loudness.ceilingDb - loudnessStaticGainPeakDb` にクランプされ、ストリーミングのリミッターへオフラインチェーンより大きい入力が入らないようにします。

それ以外は、固定ブロックサイズで内部状態を準備したうえで、入力ブロックに対してチェーンを順番に適用します。

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

// Use the path that matches the prepared channel count: processMono() /
// flushMono() after prepare(..., 1), processStereo() / flushStereo() after
// prepare(..., 2). Mixing them throws a num_channels mismatch.
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // 有効ステージの合計レイテンシ

// 入力の最終ブロックのあと、チェーンの遅延と有限のテールを吐き出す
let tail: { left: Float32Array; right: Float32Array };
while ((tail = chain.flushStereo()).left.length > 0) {
  write(tail.left, tail.right);
}

chain.reset();   // prepare し直さずに状態だけクリア
chain.delete();  // WASM ハンドルを解放（使い終わったら呼ぶ）
```

`flushMono()` / `flushStereo()` は、入力がもうない状態で遅延分の音声と有限のプロセッサ
テールを吐き出します。空の結果が返るまで呼び続けてください。フラッシュしないと、
ストリーミングチェーンで作ったバウンスは末尾の `latencySamples()` サンプルと、
リバーブやリミッターのテールを失います。連結したストリームの先頭 `latencySamples()`
サンプルはチェーンの遅延なので、時間を揃えるには捨ててください。

`numChannels === 1` のときはステレオ専用ステージはスキップされます。チェーン設定のリペアステージ（`repair.declick`／`repair.dereverb`／`repair.denoise`／`repair.declip`／`repair.decrackle`／`repair.dehum`）はオフライン専用で、streaming constructor で有効にすると例外を投げます。`masteringChain*` / `masterAudio*`、または単発の `masteringRepair*` ヘルパーで実行してください。`loudness` ステージも、ストリーミングチェーンが信号全体の積分 LUFS を計測できないため、`loudnessStaticGainDb`（任意で `loudnessStaticGainPeakDb` も）を指定しない限り例外を投げます。同じチェーンで複数曲を順に処理する場合は `reset()`、使い終わったら `delete()` を呼んでハンドルを解放してください。

名前付きマスタリング API は次の系統に分かれます。

| 目的 | 関数 |
|------|----------|
| シンプルなラウドネスマスタリングを実行 | `mastering()` |
| 組み込みプリセットの一覧 | `masteringPresetNames()` |
| プリセットをモノラルに適用 | `masterAudio()` |
| プリセットをステレオに適用 | `masterAudioStereo()` |
| プリセットをモノラルに適用（進捗付き） | `masterAudioWithProgress()` |
| プリセットをステレオに適用（進捗付き） | `masterAudioStereoWithProgress()` |
| フルチェーン実行（モノラル） | `masteringChain()` |
| フルチェーン実行（ステレオ） | `masteringChainStereo()` |
| ブロック単位の EQ | `StreamingEqualizer` |
| 進捗付きフルチェーン実行（モノラル） | `masteringChainWithProgress()` |
| 進捗付きフルチェーン実行（ステレオ） | `masteringChainStereoWithProgress()` |
| ストリーミング（ブロック単位）チェーン | `StreamingMasteringChain` |
| マスタリング判断用の音源プロファイルを取得 | `masteringAudioProfile()` |
| ステレオペアの音源プロファイルを取得 | `masteringAudioProfileStereo()` |
| 音源解析からマスタリングの提案を取得 | `masteringAssistantSuggest()` |
| ステレオペアからマスタリングの提案を取得 | `masteringAssistantSuggestStereo()` |
| 提案されたチェーンだけを `overrides` に使える形で取得 | `masteringAssistantSuggestChain()` / `masteringAssistantSuggestChainStereo()` |
| 配信先ごとのラウドネス見込みをプレビュー | `masteringStreamingPreview()` |
| ステレオペアの配信ラウドネスをプレビュー | `masteringStreamingPreviewStereo()` |
| 名前付きプロセッサ一覧（モノラル／ステレオ） | `masteringProcessorNames()` |
| プロセッサ分類カタログを取得 | `masteringProcessorCatalog()` |
| チェーンのインサートプロセッサ一覧 | `masteringInsertNames()` |
| インサートが受け付けるパラメータキー一覧 | `masteringInsertParamNames(name)` |
| リアルタイムオートメーション可能なインサートパラメータ一覧 | `masteringInsertParamInfo(name)` |
| モノラル音声を処理 | `masteringProcess()` |
| ステレオ音声を処理 | `masteringProcessStereo()` |
| ペアプロセッサ一覧 | `masteringPairProcessorNames()` |
| ソース／リファレンスのペアを処理 | `masteringPairProcess()` |
| ペア解析の一覧 | `masteringPairAnalysisNames()` |
| ソース／リファレンスのペアを解析 | `masteringPairAnalyze()` |
| ステレオ解析の一覧 | `masteringStereoAnalysisNames()` |
| ステレオチャンネルを解析 | `masteringStereoAnalyze()` |

関連するマスタリングガイド: [処理チェーン](./glossary/mastering.md)、[トーンと Air](./glossary/mastering/tone-air.md)、[ダイナミクス](./glossary/mastering/dynamics.md)、[ステレオ、リミッター、ラウドネス](./glossary/mastering/stereo-limiter-loudness.md)、[リファレンスマッチ](./glossary/mastering/reference-match.md)。

### 単体のダイナミクス／リペアプロセッサ

名前付きの各ステージは単発の関数としても使え、チェーンを組まずに 1 つのプロセッサだけを実行できます。ダイナミクス系は `DynamicsResult`（処理後の `samples` と、プロセッサの先読みレイテンシをサンプル数で表す `latencySamples`）を、リペア系は `Float32Array` を返します。

```typescript
// オフラインのダイナミクス
function masteringDynamicsCompressor(samples: Float32Array, sampleRate: number, options?: CompressorOptions): DynamicsResult
function masteringDynamicsGate(samples: Float32Array, sampleRate: number, options?: GateOptions): DynamicsResult
function masteringDynamicsTransientShaper(samples: Float32Array, sampleRate: number, options?: TransientShaperOptions): DynamicsResult

// オフラインのリペア
function masteringRepairDeclick(samples: Float32Array, sampleRate: number, options?: DeclickOptions): Float32Array
function masteringRepairDeclip(samples: Float32Array, sampleRate: number, options?: DeclipOptions): Float32Array
function masteringRepairDecrackle(samples: Float32Array, sampleRate: number, options?: DecrackleOptions): Float32Array
function masteringRepairDehum(samples: Float32Array, sampleRate: number, options?: DehumOptions): Float32Array
function masteringRepairDenoiseClassical(samples: Float32Array, sampleRate: number, options?: DenoiseClassicalOptions): Float32Array
function masteringRepairDereverbClassical(samples: Float32Array, sampleRate: number, options?: DereverbClassicalOptions): Float32Array
function masteringRepairTrimSilence(samples: Float32Array, sampleRate: number, options?: TrimSilenceOptions): Float32Array
```

リペア系のステージはオフライン専用で、`StreamingMasteringChain` では拒否されます。これらの単発ヘルパー、または `masteringChain*`／`masterAudio*` の中で実行してください。[ダイナミクス](./glossary/mastering/dynamics.md)と[リペア](./glossary/mastering/repair.md)を参照してください。

#### ステレオ／リンクされたリペア

各リペアプロセッサには、チャンネルペアをまとめて受け取るステレオ版があります。リペアの判断は
常にチャンネルごとに下せるとは限らないからです。クリックは左右に共通する 1 つの物理的事象です
し、チャンネルごとに異なるマスクを作るノイズリダクションは、処理しながらステレオイメージを
動かしてしまいます。以下のエントリポイントはいずれもリクエストオブジェクト**と**位置引数の
両方を受け付けます。位置引数形式では `sampleRate` が必須で、リクエスト形式では既定値 `22050`
が使われます。チャンネル長は一致している必要があり、オプションはモノラル版と同じ
インターフェースです。

```typescript
function masteringRepairDeclickStereo(request: MasteringRepairDeclickStereoRequest): MasteringRepairDeclickStereoResult
function masteringRepairDeclipStereo(request: MasteringRepairDeclipStereoRequest): MasteringRepairDeclipStereoResult
function masteringRepairDecrackleStereo(request: MasteringRepairDecrackleStereoRequest): MasteringRepairDecrackleStereoResult
function masteringRepairDehumStereo(request: MasteringRepairDehumStereoRequest): MasteringRepairDehumStereoResult
function masteringRepairDenoiseClassicalStereo(request: MasteringRepairDenoiseClassicalStereoRequest): MasteringRepairDenoiseClassicalStereoResult
function masteringRepairDereverbClassicalStereo(request: MasteringRepairDereverbClassicalStereoRequest): MasteringRepairDereverbClassicalStereoResult
function masteringRepairTrimSilenceStereo(request: MasteringRepairTrimSilenceStereoRequest): MasteringRepairTrimSilenceStereoResult

// 完全にリンクされる 2 つのプロセッサの N チャンネル版
function masteringRepairDenoiseClassicalLinked(request: MasteringRepairDenoiseClassicalLinkedRequest): MasteringRepairDenoiseClassicalLinkedResult
function masteringRepairDereverbClassicalLinked(request: MasteringRepairDereverbClassicalLinkedRequest): MasteringRepairDereverbClassicalLinkedResult
```

結果の**形がリンクの度合いを表して**おり、形は 3 種類あります。

| 結果の形 | エントリポイント | 形が意味すること |
|----------|------------------|------------------|
| `{ left, right, leftReport, rightReport }` | declick / declip / decrackle / dehum | レポートが 2 つ必要な程度には、チャンネルが別々に処理された。 |
| `{ left, right, report }` | denoise / dereverb | 1 つの判断が両チャンネルを覆ったので、レポートは 1 つ。 |
| `{ left, right, report, leftRange, rightRange }` | 無音トリム | カットは 1 つ。加えて検査用に各チャンネルの検出範囲も返る。 |

リンクのされ方は次のとおりです。

- **declick** は*選択*を共有します。どちらかのチャンネルが検出した区間は両方で修復されますが、
  埋める処理は各チャンネル自身のサンプルと AR モデルを使うため、2 つのレポートは実際に異なり
  ます。結合された区間は `maxClickSamples` を超えることがあります。
- **declip** は両チャンネルのクリップ区間の和集合を取りますが、クリップしたサンプルがない
  チャンネルはその区間で手つかずのまま残します。したがって片側だけがクリップした平坦部では
  `linkedRuns` は `0` になり、両側が異なる範囲でクリップしている箇所でのみ非ゼロになります。
  512 サンプルを超える区間は補間にフォールバックします。これは固定の上限で、`lpcOrder` や
  サンプリングレートから導かれる値ではありません。
- **decrackle** は何もリンクしません。クラックルは共通の事象を持たない表面的な損傷なので、
  チャンネルは完全に独立です。このエントリポイントはレポートとチャンネル長の契約をまとめる
  ためだけに存在します。選ばなかったモードに属するフィールドは `0` を返しますが、これは未設定
  ではなく想定どおりの値です。
- **dehum** は `adaptive` を指定したときにだけリンクします。このときトラッカーはチャンネル平均
  を読み、2 つのカスケードが 1 つの周波数に追従するため、`appliedFundamentalHz` と
  `fundamentalDriftHz` は構造上どちらのレポートでも同一になります。一方で `detected` は各自の
  チャンネルを計測したままです。既定である `adaptive` 無効時は、2 つのチャンネルは独立です。
- **denoise** と **dereverb** は**完全にリンク**します。ゲインマスクはチャンネル加算したパワー
  から作られ、そのまま全チャンネルに適用されるため、チャンネル間のレベルと位相は動きようが
  ありません。単一の `report` を返すのはこのためです。`Linked` 版は同じプロセッサを
  `channels: Float32Array[]` に対して適用したもので、1 チャンネルならモノラル版とビット単位で、
  2 チャンネルならステレオ版とプレーン単位で一致します。
- **無音トリム** は各チャンネルを走査し、残す範囲の**和集合**を取ります。トリムは破壊的な操作
  なので、残す方向に倒します。ダウンミックスを読むことはありません。

::: warning denoise と dereverb で挙動が食い違う 2 点
**短い入力。** `masteringRepairDenoiseClassical*` は `nFft` より短いバッファを**拒否**し、
`masteringRepairDereverbClassical*` は**ゼロ詰め**します。同じ短いテイクでも、一方では例外に
なり、もう一方では成功します。

**チャンネル数をまたいだレポートの比較。** `DenoiseReport.detected` は*絶対値*で、加算した集合
に対して計測されます。したがって同一内容の N チャンネルは 1 チャンネルより `10*log10(N)` だけ
高く読めます。2 チャンネルで約 +3.01 dB、3 チャンネルで約 +4.77 dB です。ステレオの
`floorDbfs` をモノラルのそれと比較することはできません。`DereverbReport` は比と割合だけで
構成されるためチャンネル数に依存せず、そのまま比較できます。
:::

`masteringRepairTrimSilenceStereo` は、入力を短くする**唯一の**リペアエントリポイントです。
`result.left.length` が出力長で、左右は同じ長さで返ります。どちらのチャンネルにも信号がない
ペアは、**空の配列 2 本を返して成功します**。例外も `null` も返りません。このとき
`report.range` は `(入力長, 入力長)` となるため、`removedHeadSamples` が入力全体、
`removedTailSamples` が 0 になります。合計は正しいままで、恣意的なのは内訳だけです。
オプションの有効性は `mode` に従い、`threshold` は `'peak'` でのみ、`gateLufs` と `windowMs` は
`'lufsGated'` でのみ作用します。無効なオプションを指定してもエラーにはならず、黙って無視され
ます。ゲートモードでは `windowMs` の窓にわたる**重み付けなしの RMS** を `gateLufs` と比較する
ため、ゲートの対象量は BS.1770 のラウドネスではなく dBFS です。

#### リペアを伴わない検出

以下はリペアプロセッサの解析部分だけを実行し、オーディオに触れる前に止まります。何もレンダ
リングせずに、リペアが必要かどうかを判断し、その理由をユーザーに示せます。いずれもレポート
だけを返します。オプションは対応するプロセッサと同じインターフェースで、リクエスト
オブジェクトと位置引数の両方を受け付けます。

```typescript
function masteringRepairDetectClicks(request: MasteringRepairDetectClicksRequest): ClickDetection
function masteringRepairDetectClipping(request: MasteringRepairDetectClippingRequest): ClipDetection
function masteringRepairDetectCrackle(request: MasteringRepairDetectCrackleRequest): CrackleDetection
function masteringRepairDetectHum(request: MasteringRepairDetectHumRequest): HumDetection
function masteringRepairDetectNoiseFloor(request: MasteringRepairDetectNoiseFloorRequest): NoiseDetection
function masteringRepairDetectReverb(request: MasteringRepairDetectReverbRequest): ReverbDetection
function masteringRepairDetectTrimRange(request: MasteringRepairDetectTrimRangeRequest): TrimRange
function masteringRepairDetectTrimRangeStereo(request: MasteringRepairDetectTrimRangeStereoRequest): TrimRange

interface TrimRange {
  first: number;          // 半開区間。入力バッファ側の座標
  lastExclusive: number;
}
```

それぞれが実際に測っているもののうち、直感と食い違う点は次のとおりです。

- **`masteringRepairDetectClicks`** はリペアと同じ LPC 解析を実行するため、数えられた区間は
  リペアが実際に手を入れる区間です。そして数はリペア用オプションに左右されます。`rejected` が
  大きい場合、素材がきれいなのではなく `maxClickSamples` や `neighborRatio` が厳しすぎます。
- **`masteringRepairDetectClipping`** がオプションから読むのは `clipThreshold` だけです。
  `lpcOrder`・`iterations`・`lpcBlend` は検証されたあと読まれず、`sampleRate` は検証されるだけで
  一度も読まれません。補間へのフォールバックを予測するには `longestRunSamples` を 512 サンプル
  の上限と比べてください。4 つのフラットトップ系フィールドは別の問題に答えています。ピークから
  1 dB 以内でビット単位に一致するサンプルが 3 個以上、という基準で、クリップ後に減衰された素材
  を捕まえます。失敗のしかたも 2 つとも現実に起こります。本当に平坦な波形は偽陽性になり、
  ダウンミックス・リサンプル・非可逆圧縮といったサンプル単位の変化は本物のフラットトップを
  消します。**ステレオはダウンミックス前にチャンネルごとに検出し、ミックスダウン後の信号に
  対しては決して実行しないでください。**
- **`masteringRepairDetectCrackle`** は `mode` の指定にかかわらず常にメディアン基準で計測します。
  ウェーブレット収縮はサンプルがクラックルで*ある*という判定を一切下さないからです。したがって
  この数値は、ウェーブレットモードのリペアが何を除去するかを説明しません。その代わり、モードを
  決める前でも同じ答えが得られます。
- **`masteringRepairDetectHum`** は `adaptive` の指定にかかわらず常に推定パスを実行します。固定
  パスはハムを探さないためです。`fundamentalProminence` は勝った候補の射影エネルギーを候補の
  中央値で割った値なので、**`1.0` はピークがまったく見つからなかったことを意味します**。ロック
  状態のフラグではなく、1 に近い値こそが陰性の結果です。`harmonicDbfs` はノッチされたものだけ
  でなく、そのサンプリングレートが表現できる `k*f0` すべてを含み、ナイキスト以上の倍音は
  dB のフロア値を返します。
- **`masteringRepairDetectNoiseFloor`** はゲインマスクの手前で止まるため、減衰量の値はありま
  せん。`nFft` より短いバッファでは**例外を投げます**。`floorDbfs` は絶対値なので、同じチャンネル
  数で取った値とだけ比較してください。
- **`masteringRepairDetectReverb`** は **ISO 3382 の RT60 ではありません**。それには
  `estimateRoom(...)` を使ってください。これは、どれだけ減算するかを決める過程でディリバーブ
  自身が計測している値を報告します。`nFft` より短いバッファは**ゼロ詰め**され、ノイズフロア検出
  とは逆の挙動になります。`lateDecayRatioDb` は直感と逆向きで、*負の度合いが小さい*ほど残響が
  *多い*ことを表します。既定の設定では WPE 段が `wpeEnabled` を指定したときにしか動かないため、
  `latePredictability` はちょうど `0` になります。
- **`masteringRepairDetectTrimRange`** は、リペアが「そこまでカットする」範囲を返します。
  `paddingSamples` はすでにその範囲の内側に含まれており、検出された信号の範囲そのものではあり
  ません。しきい値を超えるものが何もなければ `(長さ, 長さ)` が返ります。
- **`masteringRepairDetectTrimRangeStereo`** はチャンネルごとに走査して和集合を取りますが、
  しきい値を超えるものがないチャンネルは、バッファ端にエッジを置くのではなく**エッジを一切
  提供しません**。そのため無音チャンネルと有音チャンネルの和集合は、有音チャンネルの範囲その
  ものになります。単純な min/max なら末尾全体を残してしまうところです。

#### `masteringRepairDereverbConfigForRoom(...)`

室内音響の測定結果をディリバーブ設定に変換します。

```typescript
function masteringRepairDereverbConfigForRoom(
  request: MasteringRepairDereverbConfigForRoomRequest,
): Required<DereverbClassicalOptions>
function masteringRepairDereverbConfigForRoom(
  estimate: RoomEstimateResult,
  config?: DereverbClassicalOptions,
): Required<DereverbClassicalOptions>
```

`estimateRoom(...)` の結果から読むのは `volume` と `rt60Bands` だけで、返るのは**完全な**設定
です。すべてのフィールドが揃っており、省略可能なものはありません。そのため実行前にユーザーへ
内容を提示できます。変更されて返ってくるのはちょうど 2 つのフィールドで、`t60Sec`（中音域の
残響時間。500 Hz と 1 kHz のオクターブバンドの平均）と `lateDelayMs`（Polack の混合時間、
`sqrt(volume)` ミリ秒）です。

`attenuation`・`threshold`・`overSubtraction`・`spectralFloor` は**一切書き換えられません**。
残響をどれだけ取り除くかは測定ではなく好みの問題であり、この関数は推測を避けます。収束しな
かったバンドは自分のフィールドをそのまま残し、`confidence` が低い推定であっても適用されます。
これが望ましくない場合は、推定結果を自分で選別してください。省略した設定フィールドは 0 では
なくライブラリの既定値に解決されます。注意点が 1 つあります。中音域のどちらのバンドも収束
しなかった場合、`t60Sec` は収束したバンドの平均にフォールバックするため、その時点でもはや
中音域の値ではありません。

#### `masteringRepairNoiseBandBins(...)`

```typescript
function masteringRepairNoiseBandBins(request?: MasteringRepairNoiseBandBinsRequest): Int32Array
function masteringRepairNoiseBandBins(nFft?: number, sampleRate?: number): Int32Array

interface MasteringRepairNoiseBandBinsRequest {
  nFft?: number;        // 既定 1024。正の 2 の冪であること
  sampleRate?: number;  // 既定 22050。正であること
}
```

`NoiseDetection.bandFloorDbfs` の背後にあるビン添字を **33 個**返します。32 バンド分に終端の
1 個を加えたもので、単調非減少です。バンド `k` は片側スペクトルのビン `[bins[k], bins[k+1])` を
覆い、ビン `b` は `b * sampleRate / nFft` Hz に位置します。グリッドを決めるのは解析側の幾何
だけなので、ノイズリダクションの設定は受け取りません。

これは 1 つの特定のあいまいさを解消するために存在します。等比で決まるバンド境界はビンに丸め
られるため、ビン間隔より狭いバンドは**空**になり（`bins[k] === bins[k + 1]`）、その
`bandFloorDbfs[k]` はフロアのセンチネル値を返します。そこが静かだったからではなく、ビンが
1 つも入らなかったからです。バンド配列だけでは両者を区別できず、バンド数からも復元できま
せんが、このグリッドなら判別できます。空のバンドはフロア値の棒としてプロットするのではなく、
「未計測」として表示してください。

### MasteringChainConfig

`masteringChain*` と `StreamingMasteringChain` は下のネスト構造の設定スキーマを使います。
各キーは任意で、指定されたステージだけが下の固定順で有効になります。

<FlowDiagram
  title="マスタリングチェーンの順序"
  :nodes="[
    { id: 'repair', label: 'リペア', col: 0, row: 0, variant: 'accent' },
    { id: 'eq', label: 'EQ', col: 1, row: 0 },
    { id: 'dynamics', label: 'ダイナミクス', col: 2, row: 0 },
    { id: 'saturation', label: 'サチュレーション', col: 3, row: 0 },
    { id: 'spectral', label: 'スペクトル', col: 4, row: 0 },
    { id: 'stereo', label: 'ステレオ', col: 5, row: 0 },
    { id: 'maximizer', label: 'マキシマイザー', col: 6, row: 0 },
    { id: 'loudness', label: 'ラウドネス', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'repair', to: 'eq' },
    { from: 'eq', to: 'dynamics' },
    { from: 'dynamics', to: 'saturation' },
    { from: 'saturation', to: 'spectral' },
    { from: 'spectral', to: 'stereo' },
    { from: 'stereo', to: 'maximizer' },
    { from: 'maximizer', to: 'loudness' }
  ]"
  caption="有効化したステージだけが処理されますが、有効なステージは常にこの順で実行されます。"
/>

`masterAudio*` はプリセットから開始し、同じキー名を
`"dynamics.compressor.thresholdDb"` のようなフラットなドット記法の
`overrides`（上書き値）として受け取ります。

`maximizer.truePeakLimiter.releaseMs` はポストリミッターのリリース時間です。省略するとプリセット／設定の既定値 50 ms を保ちます。フラットな上書き値として渡した場合、その値がそのまま適用されます。`maximizer.truePeakLimiter.applyGainAtInputRate` を有効にすると、静的なラウドネスゲインをオーバーサンプリング前の入力サンプルレートで適用します。ホスト間でゲイン段の位置を揃えたい場合に使います。

`repair.denoise.reductionDb`（フラットな `repair.reductionDb` エイリアスからも同じフィールドに到達できます）は、ゲインマスクが各ビンに適用できる最大の減衰量を dB で指定するもので、既定値は 26 です。以前の `gainFloor`（dB の深さではなく線形の下限値）という表記も引き続き受け付けられ、変換されます（`dB = -20*log10(gainFloor)`）。この変換は旧来の有効範囲も引き継ぐため、1 を超える下限値は負の深さになり、同様に拒否されます。

::: details インターフェース全文（クリックで展開）

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean;
    nFft?: number; hopLength?: number; ddAlpha?: number; reductionDb?: number;
    /** @deprecated `reductionDb` を使用してください（`dB = -20*log10(gainFloor)` で変換） */
    gainFloor?: number;
    declip?: { enabled?: boolean; clipThreshold?: number; lpcOrder?: number;
               iterations?: number; lpcBlend?: number; };
    decrackle?: { enabled?: boolean; threshold?: number;
                  /** 0 = メディアン、1 = ウェーブレット縮小 */
                  mode?: number; levels?: number; };
    dehum?: { enabled?: boolean; fundamentalHz?: number; harmonics?: number;
              q?: number; adaptive?: boolean; searchRangeHz?: number;
              adaptation?: number; frameSize?: number; pllBandwidth?: number; };
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number;
                 hopLength?: number; t60Sec?: number; lateDelayMs?: number;
                 overSubtraction?: number; spectralFloor?: number;
                 wpeEnabled?: boolean; wpeIterations?: number; wpeTaps?: number;
                 wpeStrength?: number; };
  };
  eq?: {
    /** 正規のネストされた tilt ステージ */
    tilt?: { enabled?: boolean; tiltDb?: number; pivotHz?: number };
    /** @deprecated `eq.tilt.tiltDb` を使用してください */
    tiltDb?: number;
    /** @deprecated `eq.tilt.pivotHz` を使用してください */
    pivotHz?: number;
  };
  dynamics?: {
    compressor?: { thresholdDb?: number; ratio?: number; attackMs?: number;
                   releaseMs?: number; kneeDb?: number; makeupGainDb?: number;
                   autoMakeup?: boolean; };
    deesser?: { frequencyHz?: number; thresholdDb?: number; ratio?: number;
                attackMs?: number; releaseMs?: number; rangeDb?: number;
                bandpassQ?: number; };
    transientShaper?: { attackGainDb?: number; sustainGainDb?: number;
                        fastAttackMs?: number; fastReleaseMs?: number;
                        slowAttackMs?: number; slowReleaseMs?: number;
                        sensitivity?: number; maxGainDb?: number;
                        gainSmoothingMs?: number; lookaheadMs?: number; };
    multibandComp?: { lowCutoffHz?: number; highCutoffHz?: number;
                      lowThresholdDb?: number;  lowRatio?: number;
                      lowAttackMs?: number;     lowReleaseMs?: number;
                      midThresholdDb?: number;  midRatio?: number;
                      midAttackMs?: number;     midReleaseMs?: number;
                      highThresholdDb?: number; highRatio?: number;
                      highAttackMs?: number;    highReleaseMs?: number; };
  };
  saturation?: {
    tape?: { driveDb?: number; saturation?: number; hysteresis?: number;
             outputGainDb?: number; speedIps?: number; headBumpDb?: number;
             bias?: number; gapLoss?: number; };
    exciter?: { frequencyHz?: number; driveDb?: number; amount?: number;
                q?: number; evenOddMix?: number; };
  };
  spectral?: {
    airBand?: { amount?: number; shelfFrequencyHz?: number;
                dynamicThresholdDb?: number; dynamicRangeDb?: number; };
  };
  stereo?: {
    imager?: { width?: number; outputGainDb?: number;
               decorrelationAmount?: number; preserveEnergy?: boolean; };
    monoMaker?: { amount?: number; frequencyHz?: number };
  };
  maximizer?: {
    truePeakLimiter?: { ceilingDb?: number; lookaheadMs?: number;
                        releaseMs?: number; oversampleFactor?: number;
                        applyGainAtInputRate?: boolean; };
  };
  loudness?: { targetLufs?: number; ceilingDb?: number;
               truePeakOversample?: number; };
}

interface MasteringResult {
  samples: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  loudnessTargetLimited?: boolean;
  latencySamples?: number;
}
interface MasteringChainResult extends MasteringResult {
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
interface MasteringStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples: number;
}
// masteringChainStereo / masterAudioStereo（および WithProgress 変種）の
// 戻り値。MasteringStereoResult は masteringProcessStereo の戻り値。
// latencySamples フィールドはない — オフラインチェーンの出力はすでに
// レイテンシ補正済み。
interface MasteringChainStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
// MasteringStereoChainResult は MasteringChainStereoResult の
// @deprecated エイリアス。Node/Python バインディングとのソース互換性のために
// 維持されている。
```

:::

各ステージの使いどころは用語集の各ページに対応しています:
[リペア](./glossary/mastering/repair.md)、
[トーンと Air](./glossary/mastering/tone-air.md)、
[ダイナミクス](./glossary/mastering/dynamics.md)、
[ステレオ・リミッター・ラウドネス](./glossary/mastering/stereo-limiter-loudness.md)。

## ミキシング API

WASM パッケージから libsonare のミキシングエンジンを使えます。`mixStereo(...)` はステム配列を手早くレンダーする一括処理用の入口です。`Mixer` は、チャンネルストリップ、バス、センド、VCA グループ、オートメーション、ストリップメーター、ゴニオメーターバッファを持つ、シーンベースのミキサーです。

```typescript
import {
  Mixer,
  mixStereo,
  mixingScenePresetJson,
  mixingScenePresetNames,
} from '@libraz/libsonare';

mixingScenePresetNames(); // ['vocalReverbSend', ...]

const offline = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  inputTrimDb: [3, 0],
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
  muted: [false, false],
});

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512);
mixer.sceneWarnings(); // シーン読み込み時の非致命的な警告（どのプロセッサも読まない insert パラメータ＝タイプミス）
const latency = mixer.latencySamples(); // ドライ／ウェット整列用のコンパイル済みグラフ遅延
const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR]);
const meter = mixer.stripMeter(0, 'postFader');

mixer.scheduleFaderAutomation(0, sampleRate * 8, -6, 's-curve');
mixer.schedulePanAutomation(0, sampleRate * 8, -0.25, 'linear');
mixer.scheduleSendAutomation(0, 0, sampleRate * 12, -12, 'hold');

const goniometer = mixer.readGoniometerLatest(0, 256);
const sceneJson = mixer.toSceneJson();
mixer.delete();
```

AudioWorklet のようにレンダーブロックごとのアロケーションを避けたいループでは、`Mixer.createRealtimeBuffer()` と `processStereoInto(...)` を使います。シーンやルーティングの詳細は [ミキシングエンジン](./mixing.md) を参照してください。
