---
title: JavaScript/TypeScript マスタリング API
description: libsonare JavaScript/TypeScript パッケージのマスタリングチェーン、名前付きプロセッサ、プリセット、単体のダイナミクス／リペアプロセッサ、ミキシング API のリファレンスです。ストリーミングプロセッサとチェーン設定スキーマは別ページにあります。
---

# JavaScript/TypeScript マスタリング API

このページは libsonare JavaScript/TypeScript パッケージのオフラインマスタリングの入口を扱います。チェーンとプリセットの呼び出し、説明可能なマスタリングのヘルパー、単体のダイナミクス／リペアプロセッサです。関連する 2 つのリファレンスが並んで存在します。[ストリーミング／リアルタイム API](./js-api-streaming.md) は `StreamingEqualizer`、`StreamingRetune`、`RealtimeVoiceChanger`、`voiceChangeRealtime(...)`、`StreamingMasteringChain` を扱い、`MasteringChainConfig` のスキーマと結果型は [型と列挙型](./js-api-types.md#masteringchainconfig) にあります。

## マスタリング API

ブラウザ向けパッケージには、`/ja/mastering` デモがリアルタイムエンジンのインサートとして動かしているのと同じ名前付きマスタリングプロセッサが含まれます。Web Audio API などでデコードした `Float32Array` のチャンネルバッファを渡し、戻り値のサンプルをアプリ側で WAV などに書き出します。

この節では JS の入口と、その結果／設定の型を一覧します。各プロセッサの働き、プリセット一覧、解析／アシスタントが返す JSON は、[マスタリングプロセッサ](./mastering-processors.md) と [マスタリングアシスタント](./mastering-assistant.md) を参照してください。

### どの入口を使うか

| 手元にあるもの | 使うもの |
|---|---|
| 名前付きプロセッサ 1 つ | `masteringProcess()` |
| プリセット（必要なら上書き付き） | `masterAudio()` / `masterAudioStereo()` |
| 完全なステージ設定 | `masteringChain()` / `masteringChainStereo()` |
| ブロック単位で届く音声 | `StreamingMasteringChain`（ラウドネス段には `streamingLoudnessGain()`） |
| どこから始めるか分からない | `masteringAssistantSuggestChain()` の後に `masterAudio({ overrides })` |

### 名前付きの関数

| 目的 | 関数 |
|------|----------|
| シンプルなラウドネスマスタリングを実行 | `mastering()` |
| 組み込みプリセットの一覧 | `masteringPresetNames()` |
| 1 つのプリセットをフラットなチェーンパラメータへ展開 | `masteringPresetParams(preset)` |
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
| ストリーミングチェーンに渡すラウドネス値を測定 | `streamingLoudnessGain()` / `streamingLoudnessGainStereo()` |
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
| 構築用キーとリアルタイムインサートパラメータを記述 | `masteringInsertParamInfo(name, sampleRate?)` |
| 構成済みインサートのレイテンシとテールを測定 | `masteringInsertTiming(name, params, sampleRate)` |
| モノラル音声を処理 | `masteringProcess()` |
| ステレオ音声を処理 | `masteringProcessStereo()` |
| ペアプロセッサ一覧 | `masteringPairProcessorNames()` |
| ソース／リファレンスのペアを処理 | `masteringPairProcess()` / `masteringPairProcessStereo()` |
| ペア解析の一覧 | `masteringPairAnalysisNames()` |
| ソース／リファレンスのペアを解析 | `masteringPairAnalyze()` |
| ステレオ解析の一覧 | `masteringStereoAnalysisNames()` |
| ステレオチャンネルを解析 | `masteringStereoAnalyze()` |
| 任意のチャンネル数を 1 回の呼び出しで解析・リペア | `masteringRepairAnalyze()` / `masteringRepairApply()`（[オーディオリペアの流れ](./audio-repair.md#測定とリペアを-1-回の呼び出しで行う)を参照） |

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

::: warning リクエストオブジェクト形式では、ステージ設定を `config` の下に置く
`masteringChain({ samples, sampleRate, config: { loudness: { targetLufs: -14 } } })` なら目標が反映されます。`samples` と並べて `loudness` キーを書いた場合（`masteringChain({ samples, sampleRate, loudness: { targetLufs: -14 } })`）は、そのキーを挙げて `config` の下に置くよう案内する `TypeError` になります。`masteringChainStereo` と `*WithProgress` 変種も同様です。位置引数形式では設定を最後の引数に渡し、`masterAudio` は上書きを `overrides` として受け取ります。
:::

これらにはそれぞれ `(progress, stage) => void` のコールバックを取る `*WithProgress` 変種があります。`masteringProcess(...)` / `masteringProcessStereo(...)` は名前付きプロセッサを 1 つ実行し、`masteringStereoAnalyze(...)` は JSON レポートを返します。

オフラインのチェーン／プリセット結果には、`outputTruePeakDbtp`、`outputLra`、`loudnessTargetLimited`、`stageGainReductions` が含まれます。

`loudnessTargetLimited` が true なら、True Peak 上限のため要求した LUFS 目標には届いていません。目標ではなく実際の `outputLufs` を報告してください。各 `StageGainReduction` は、ダイナミクスまたはマキシマイザーの直近のゲインリダクションを示します。

#### `report` — 処理前後を 1 つのオブジェクトで

オフラインチェーンの結果は `report` も持ちます。これは「実際に何が起きたか」の要約で、自分で入力を測り直して組み立てる必要がなくなります。

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

同じオブジェクトが C ABI・ctypes・Node・Python・両 CLI のレポートファイルにも同じ形で含まれるため、CLI から書き出したレポートとブラウザで読むレポートは同じ形になります。

説明可能なマスタリングのヘルパー（`masteringAudioProfile(...)`、`masteringAssistantSuggest(...)`、`masteringStreamingPreview(...)`）は、それぞれ `TypedJson<MasteringAudioProfile>`、`TypedJson<MasteringAssistantResult>`、`TypedJson<MasteringStreamingPreviewResult>` として型付けされた JSON 文字列を返します（パース後の型は `JsonResult<J>` で取り出せます）。正確な形、受け付けるオプション、提案をレンダー済みマスターに変換する方法は [マスタリングアシスタント](./mastering-assistant.md) を参照してください。リファレンストラック用途では `masteringPairProcessorNames()` と `masteringPairAnalyze()` を使います（サンプルレートを揃え、長さも近づける）。`masteringPairProcess()` はモノラルの 2 入力 `match.*` プロセッサを実行し、そのステレオ版である `masteringPairProcessStereo()` は後述します。

#### 説明可能なヘルパーのステレオ版

この 3 つには、チャンネルペアを直接計測するステレオ版があります。いずれも、**リクエストオブジェクト専用です**。位置引数のオーバーロードはなく、位置引数で呼ぶと `TypeError` になります。

```typescript
function masteringAudioProfileStereo(request: MasteringStereoParamsRequest): TypedJson<MasteringAudioProfile>
function masteringAssistantSuggestStereo(request: MasteringAssistantStereoParamsRequest): TypedJson<MasteringAssistantResult>
function masteringStreamingPreviewStereo(request: MasteringStreamingPreviewStereoRequest): TypedJson<MasteringStreamingPreviewResult>

interface MasteringStereoParamsRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringProcessorParams;
}

type MasteringAssistantParams = Record<string, number | boolean | string>;

interface MasteringAssistantStereoParamsRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringAssistantParams;
}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}
```

`MasteringAssistantParams` のアシスタント設定値は `number | boolean | string` です。ターゲットプラットフォームやプリセットなど、文字列を取る設定も渡せます。`MasteringStereoParamsRequest` はプロファイル用の形で、`params` の値は `number | boolean` のままです。

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

ステレオ素材ならこちらを使ってください。モノラル版は `0.5 * (left + right)` のダウンミックスを計測するため、相関の低い素材では約 6 dB 低く出ます。積分ラウドネス、そこから導かれる正規化ゲイン、天井に当たるリスクの判断が、そろって同じぶんだけ過小に報告されます。相関の低いピンクノイズのペア（48 kHz、4 秒）での実測値は、ダウンミックス経由が **-18.45 LUFS**、ステレオ版が **-12.43 LUFS** で、差は **6.03 dB** でした。-14 LUFS ターゲットの `normalizationGainDb` もダウンミックス経由が **+4.45**、ステレオ版が **-1.57** です。相関の高いペアでは差が 3.01 dB まで縮みますが、これは単純に半分になったぶんで、残りの約 3 dB がデコリレーションによるものです。

ステレオプロファイルのうち、左右両チャンネルから計測されるのは `loudness` ブロックだけです。積分 LUFS と LRA はチャンネル加算したプログラムから求め、True Peak は左右の大きいほうを採ります。スペクトル、ダイナミクス、テンポの各フィールドは絶対レベルではなく形と時間を表すため、引き続きダウンミックス上で計測され、`masteringAudioProfile` の値とそのまま比較できます。

#### ドキュメント全体ではなくチェーンだけを受け取る

`masteringAssistantSuggest(...)` はアシスタントのドキュメント全体を JSON 文字列で返し、提案されたチェーンはそのなかの 1 ブロックです。チェーンだけが必要なときは、こちらが `{ キー: number | boolean }` のフラットなマップをそのまま返します。JSON のパースも、目的のブロックを掘り出す手間も要りません。

```typescript
function masteringAssistantSuggestChain(
  request: MasteringAssistantParamsRequest,
): Record<string, number | boolean>

function masteringAssistantSuggestChainStereo(
  request: MasteringAssistantStereoParamsRequest,
): Record<string, number | boolean>
```

このマップは `mastering(...)` や `masterAudio(...)`、ステレオなら `masterAudioStereo(...)` が `overrides` として受け取る形そのものなので、変換をはさまずに適用できます。

```typescript
const chain = masteringAssistantSuggestChainStereo({ left, right, sampleRate });
const mastered = masterAudioStereo({ left, right, sampleRate, overrides: chain });
```

どちらもリクエストオブジェクト専用です。ステレオ版が左右のペアを直接計測するのは、ほかのステレオ用エントリポイントと同じ理由によります。Python での綴りは `mastering_assistant_suggest_chain` と `mastering_assistant_suggest_chain_stereo` です。

#### `streamingLoudnessGain(request)`

`StreamingMasteringChain` は信号全体のラウドネスを測れないため、ラウドネス段には事前に計算した固定ゲインが必要です。`streamingLoudnessGain` は `config` が表すオフラインチェーンをラウドネス段の手前まで実行してそこで測定するので、返るゲインは天井クランプを含めて `masteringChain` が適用するゲインと一致します。

```typescript
function streamingLoudnessGain(request: StreamingLoudnessGainRequest): StreamingLoudnessGainResult
function streamingLoudnessGainStereo(request: StreamingLoudnessGainStereoRequest): StreamingLoudnessGainResult
// request: { samples | left + right: Float32Array; sampleRate?: number; config?: MasteringChainConfig }

interface StreamingLoudnessGainResult {
  loudnessStaticGainDb: number;  // オフラインのラウドネス段が適用するゲイン
  truePeakDb: number;            // ラウドネス段の入力の dBTP。デジタル無音では -120
  integratedLufs: number;        // その入力の LUFS。絶対ゲート未満では -Infinity
}
```

```typescript
const config = { loudness: { enabled: true, targetLufs: -14, ceilingDb: -1 } };
const { loudnessStaticGainDb, truePeakDb } = streamingLoudnessGain({ samples, sampleRate, config });
const chain = new StreamingMasteringChain({
  ...config,
  loudnessStaticGainDb,
  loudnessStaticGainPeakDb: truePeakDb,
});
```

測定はソースではなく、オフラインチェーンが測るのと同じ、ラウドネス段の入力で行われます。ゲインはラウドネス段が有効かどうかにかかわらず `config.loudness` から計算され、無音またはゲート未満の入力では 0 dB です。-9.47 LUFS のソフトクリップした合成ループを、ターゲット -14 LUFS、天井 -1 dBTP で測るとゲインは -4.53 dB で、チェーンの `report.appliedGainDb` と一致しました。ステレオ版は BS.1770 の重みで 2 チャンネルを合算します。Python では `streaming_loudness_gain` と `streaming_loudness_gain_stereo` で、`loudness_static_gain_db`、`true_peak_db`、`integrated_lufs` を持つ `StreamingLoudnessGain` を返します。

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
  referenceSampleRate?: number; // 既定は sampleRate。計測の前に sampleRate へリサンプルされる
}

interface LoudnessMatchResult {
  samples: Float32Array;        // reference のラウドネスに合わせた source
  sampleRate: number;
  referenceLufs: number;        // BS.1770 の積分値
  sourceLufs: number;           // ゲイン適用前
  appliedGainDb: number;        // 再計測したソースを referenceLufs に合わせるゲイン
  matchedTruePeakDbtp: number;  // ゲイン適用後の True Peak
}
```

受け取るのはリクエストオブジェクトのみです。2 つのバッファは長さが異なっていても構いません。それぞれ自身のプログラムとして計測され、リファレンスは `referenceSampleRate` で独自のレートのまま渡せます。

::: warning ゲインに上限はなく、結果が 0 dBTP を超えることがある
`appliedGainDb` は、再計測したソースを `referenceLufs` に合わせるゲインです。ゲインによってブロックが絶対ゲートをまたぐ場合を除けば `referenceLufs - sourceLufs` に等しく、またぐ場合はターゲットに合うように解いた値になります。上限がなく、ヘッドルームのクランプも行われないため、`matchedTruePeakDbtp` が **`0` を超える**ことがあります。これは意図的です。ヘッドルームのためにクランプすると、すでにフルスケール近くにある音源ではマッチングが暗黙に無効化されてしまい、それこそ A/B でもっとも調べたいケースだからです。レンダリングする場合は、試聴とは別に `matchedTruePeakDbtp` を自分で確認し、ペアごとまとめて減衰させてください。

どちらかのテイクが無音、または計測ゲートを下回る場合、その LUFS フィールドは**非有限値**になり、`appliedGainDb` は `0`、source はそのまま返ります。値を表示する前に `Number.isFinite(result.sourceLufs)` を確認してください。
:::

`masteringStreamingPreviewStereo` の `platforms` の扱いはモノラル版と同じです。省略するか空配列を渡すと、組み込みの Spotify / Apple Music / YouTube のセットにフォールバックし、例外ではなく 3 行分の結果を返します。

#### `masteringAbMatchLoudnessStereo(request)`

```typescript
function masteringAbMatchLoudnessStereo(request: MasteringAbMatchLoudnessStereoRequest): LoudnessMatchStereoResult
// request: { sourceLeft, sourceRight, referenceLeft, referenceRight: Float32Array; sampleRate?: number; referenceSampleRate?: number } -> { left, right, sampleRate, referenceLufs, sourceLufs, appliedGainDb, matchedTruePeakDbtp }
```

`masteringAbMatchLoudness` のステレオ版です。ステレオプログラムで計測した 1 つのゲインを両方のソースチャンネルに適用するため、左右のバランスは変わりません。受け取るのはリクエストオブジェクトのみです。同じペアの 2 チャンネルは同じ長さでなければ `RangeError` になり、ソースのペアとリファレンスのペアは互いに長さが異なっていても構いません。相関のないピンクノイズでの実測では、-12.43 LUFS を -1.99 LUFS に合わせると 10.44 dB が適用され、両チャンネルとも入力の RMS の 3.3256 倍で返りました。`matchedTruePeakDbtp` は両チャンネルの最大値です。ゲインに上限がないことと、無音のテイクで LUFS が非有限値になることはモノラル版と同じで、無音のソースでは `sourceLufs` が `-Infinity`、`appliedGainDb` が `0` になり、サンプルは変わりません。

#### `masteringPairProcessStereo(request)`

```typescript
function masteringPairProcessStereo(request: MasteringPairProcessStereoRequest): MasteringStereoResult
// request: { processorName: 'match.abCrossfade', sourceLeft, sourceRight, referenceLeft, referenceRight, sampleRate?, referenceSampleRate?, params? }; 位置引数は同じ順で、リファレンスのレートは持たない
```

`StereoPairProcessor` は `match.abCrossfade` のみで、ほかの名前は `SonareError`（`unsupported stereo pair processor`）で例外になります。結果は静的なリニアブレンド `(1 - mix) * source + mix * reference` で、長さは短いほうのペアに揃います。`mix` の既定値は `0.5` で、範囲は `[0, 1]` です（範囲外は `SonareError`）。`0` なら source、`1` なら reference が返ります。同位相のトーンでの実測（source の RMS 0.0707、reference の RMS 0.2828）では、既定値で 0.1768、`mix: 0.25` で 0.1237、4 秒の source と 2 秒の reference では 2 秒分が返り、`latencySamples` は 0 でした。

#### 独自のサンプルレートのリファレンス

`masteringPairProcess`、`masteringPairProcessStereo`、`masteringPairAnalyze`、`masteringAbMatchLoudness`、`masteringAbMatchLoudnessStereo` のリクエスト形式と、`StreamingEqualizer.match` のオプション（`EqMatchOptions`）は `referenceSampleRate` を受け取ります。省略時のリファレンスは `sampleRate` のレートです。別のレートのリファレンスは、処理や計測の前にソースのレートへリサンプルされ、レートが同じなら手を加えずに処理されます。遅延推定（`match.estimateReferenceDelaySamples`）はソースのレートのサンプル数で返ります。`StreamingEqualizer.match` は同じ長さのバッファを必要としません。位置引数の形式はリファレンスのレートを持たず、両方のバッファを `sampleRate` のものとして扱います。

#### `lufsSeriesInterleaved(...)`

マルチチャンネルのプログラムに対するモーメンタリー（400 ms）とショートターム（3 s）の LUFS 系列を、BS.1770-4 のチャンネル合算で求めます。[特徴抽出](./js-api-features.md)のモノラル版 `momentaryLufs`／`shortTermLufs` は 1 チャンネルずつを計測するもので、これはそのマルチチャンネル版です。

```typescript
function lufsSeriesInterleaved(request: LufsSeriesInterleavedRequest): LufsSeriesResult
function lufsSeriesInterleaved(samples: Float32Array, channels: number, sampleRate?: number, options?: ValidateOptions): LufsSeriesResult

interface LufsSeriesInterleavedRequest {
  samples: Float32Array;   // インターリーブ: frames * channels 個の値
  channels: number;        // 正の整数
  sampleRate?: number;     // 既定 22050。バッファの実際のレートを渡すこと
  validate?: boolean;
}

interface LufsSeriesResult {
  momentary: Float32Array;  // 400 ms の系列
  shortTerm: Float32Array;  // 3 s の系列
}
```

バッファは `lufsInterleaved` と同じインターリーブ配置（`L0, R0, L1, R1, …`）で、デコーダが渡してくるものそのままなので、計測前にチャンネルごとへ分ける必要はありません。フレーム数はそこから `samples.length / channels` として導かれます。長さが `channels` の倍数でなければ `RangeError` になります。一方、長さを割り切れてしまう *誤った* `channels` は例外にならず、間違った配置でバッファを読んでしまうため、ステレオと決めつけずデコーダからチャンネル数を取ってください。

この関数があるのは、マルチチャンネルの系列はモノラルの系列から組み立てられないからです。BS.1770 は K 特性で重み付けしたチャンネルごとのブロックエネルギーを合算してから LUFS に変換するため、`momentaryLufs` をチャンネルごとに走らせて dB で合成すると別の数値になります。`0.5 * (left + right)` のダウンミックスも、相関の低い素材では低く出ます。これは上のステレオ版ヘルパーが避けようとしているのと同じ罠です。2 つの系列は 1 回の K 特性処理からまとめて得られるため、結果は常に両方を持ちます。片方だけを求めても節約にはなりません。`channels: 1` なら 2 つの系列はモノラルのメーターと要素ごとに一致します。

`sampleRate` はバッファの実際のレートでなければなりません。K 特性はサンプルレートに依存するため、既定値の `22050` のままだと実際の音声に対してはエラーではなく誤った答えが返ります。ウィンドウより短い信号では、その系列はエラーではなく空配列になります。したがって `momentary` が空でなくても `shortTerm` は空になり得ます。

### アンププリセットのカタログ

`masteringAmpPresetCatalog()` は、内蔵アンプシミュレーターの設定を `{ index, name, params }` の配列で返します。`index` は `saturation.ampSim` の `presetIndex` に渡す番号、`params` は上書き前の数値・真偽値の設定です。プロジェクトには番号と明示的な上書きを保存すると、読み込み時にエンジンがプリセットの既定値を補えます。

### プリセットパラメータと構成済みインサートのタイミング

`masteringPresetNames()` は簡潔な名前一覧です。`capabilityCatalog().masteringPresets` は名前ごとにメタデータを返します。`kind` は `mastering` または `restoration` で、レストレーション用の項目では `targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` が `null` です。

```typescript
function masteringPresetParams(preset: MasteringPreset): Record<string, number | boolean>
```

`masteringPresetParams` は、アシスタントのチェーンが使い、`masterAudio` と `masterAudioStereo` の `overrides` 引数が受け取る、数値／真偽値のフラットなマップを返します。存在しないプリセット名は例外になり、プリセット名・プロセッサ名・解析名・プラットフォーム名に NUL 文字が含まれる場合は、該当フィールド名を示した `RangeError` で拒否されます。

カタログの `latencySamples` と `tailSamples` は代表的な既定構成の値です。ルーティングやスケジューリングで構成後の値が必要なら、prepare する構成を問い合わせてください。

```typescript
function masteringInsertTiming(
  name: string,
  params: Record<string, number | boolean | string | number[]>,
  sampleRate: number,
): { latencySamples: number; tailSamples: number }
```

`masteringInsertTiming` は指定した構築用パラメータを適用し、そのサンプルレートでの正確なレイテンシとテールを返します。インサートのパラメータ記述子が宣言するあらゆる値の型を受け付けます。数値、真偽値、列挙名のほか、アンプシミュレータの `preset` / `cabIrF32Base64`、コンボリューションの `irF32Base64`、ルームモーフの `bandAbsorption` / `bandScattering` といった文字列・配列キーも対象で、記述子の `type` に照らして検査されるため、シーンやストリップが組み立てるインサートをそのまま再現できます。型の違う値は `TypeError`、有限でない数値は `RangeError` です。未知のキーと不正なサンプルレートは `SonareError` で拒否され、プロセッサを prepare できない場合も例外になります。48 kHz で `{}` を渡すとプロセッサカタログの既定構成に相当します。トポロジーやスロットでタイミングが変わる場合は、実際のインサートパラメータを渡してください。

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

<SonareDemo id="compressor-curve" />

単発のリペアヘルパーとチェーン設定のリペア段はオフライン処理です。`StreamingMasteringChain` は `repair.declick`、`repair.declip`、`repair.decrackle`、`repair.dehum`、`repair.dereverb` を拒否し、`repair.denoise` は因果的なノイズ推定器（`mcra`、`imcra`、既定の `spp`）で受け付けます。`quantile` は名前を示して拒否されます。`repair.decrackle`、`repair.dehum`、`repair.denoiseClassical`、`repair.dereverbClassical` の 4 つは、同じ id の因果的なリアルタイムインサートとしても使えます（[リアルタイムインサート](./audio-repair.md#リアルタイムインサート)を参照）。[ダイナミクス](./glossary/mastering/dynamics.md)と[リペア](./glossary/mastering/repair.md)を参照してください。

<SonareDemo id="repair-denoise" />

#### ステレオ／リンクされたリペア

各リペアプロセッサには、チャンネルペアをまとめて受け取るステレオ版があります。リペアの判断は常にチャンネルごとに下せるとは限らないからです。クリックは左右に共通する 1 つの物理的事象ですし、チャンネルごとに異なるマスクを作るノイズリダクションは、処理しながらステレオイメージを動かしてしまいます。以下のエントリポイントはいずれもリクエストオブジェクト**と**位置引数の両方を受け付けます。位置引数形式では `sampleRate` が必須で、リクエスト形式では既定値 `22050` が使われます。チャンネル長は一致している必要があり、オプションはモノラル版と同じインターフェースです。

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

結果の**形がリンクの度合いを表します**。レポートが 2 つなら、チャンネルを別々に処理したためにそれぞれ必要だったということで、1 つなら 1 つの判断が両チャンネルに及んだということです。

| プロセッサ | 共有するもの | 結果の形 | 補足 |
|---|---|---|---|
| declick | *選択*。どちらかのチャンネルが検出した区間は両方でリペアされ、埋める処理は各チャンネル自身のサンプルと AR モデルを使います | `{ left, right, leftReport, rightReport }` | 2 つのレポートは実際に異なります。結合された区間は `maxClickSamples` を超えることがあります |
| declip | 両チャンネルのクリップ区間の和集合。クリップしたサンプルがないチャンネルは手つかずのまま残します | `{ left, right, leftReport, rightReport }` | 片側だけがクリップした平坦部では `linkedRuns` は `0` です。512 サンプルを超える区間は補間にフォールバックします。固定の上限で、`lpcOrder` やサンプルレートから導かれる値ではありません |
| decrackle | 何も共有しません。クラックルは共通の事象を持たない表面的な損傷だからです | `{ left, right, leftReport, rightReport }` | このエントリポイントは、レポートとチャンネル長の検査を 1 回の呼び出しにまとめるためにあります。選ばなかったモードに属するフィールドは `0` を返します |
| dehum | `adaptive` を指定したときだけ。トラッカーがチャンネル平均を読み、2 つのカスケードが 1 つの周波数に追従します | `{ left, right, leftReport, rightReport }` | `appliedFundamentalHz` と `fundamentalDriftHz` はどちらのレポートでも同一になりますが、`detected` は各チャンネルを計測したままです。既定の `adaptive` 無効時は 2 つのチャンネルは独立です |
| denoise, dereverb | すべて。ゲインマスクはチャンネル加算したパワーから作られ、そのまま全チャンネルに適用されます | `{ left, right, report }` | チャンネル間のレベルと位相は動きません。`Linked` 版は `channels: Float32Array[]` を受け取り、1 チャンネルならモノラル版とビット単位で、2 チャンネルならステレオ版とプレーン単位で一致します |
| 無音トリム | 各チャンネルの残す範囲の和集合。トリムは破壊的なので残す方向に倒します。ダウンミックスは読みません | `{ left, right, report, leftRange, rightRange }` | `leftRange` と `rightRange` は検査用の、各チャンネル自身の検出範囲です |

すべてのリペアプロセッサと検出関数は、`nFft` より短い入力を拒否せずにゼロ詰めします。

::: warning チャンネル数をまたいだレポートの比較
`DenoiseReport.detected` は*絶対値*で、加算した集合に対して計測されます。したがって同一内容の N チャンネルは 1 チャンネルより `10*log10(N)` だけ高く読めます。2 チャンネルで約 +3.01 dB、3 チャンネルで約 +4.77 dB です。ステレオの `floorDbfs` をモノラルのそれと比較することはできません。`DereverbReport` は比と割合だけで構成されるためチャンネル数に依存せず、そのまま比較できます。
:::

`masteringRepairTrimSilenceStereo` は、入力を短くする**唯一の**リペアエントリポイントです。`result.left.length` が出力長で、左右は同じ長さで返ります。どちらのチャンネルにも信号がないペアは、**空の配列 2 本を返して成功します**。例外も `null` も返りません。このとき `report.range` は `(入力長, 入力長)` となるため、`removedHeadSamples` が入力全体、`removedTailSamples` が 0 になります。合計は正しいままで、恣意的なのは内訳だけです。オプションの有効性は `mode` に従い、`threshold` は `'peak'` でのみ、`gateLufs` と `windowMs` は `'lufsGated'` でのみ作用します。無効なオプションを指定してもエラーにはならず、黙って無視されます。ゲートモードでは `windowMs` の窓にわたる**重み付けなしの RMS** を `gateLufs` と比較するため、ゲートの対象量は BS.1770 のラウドネスではなく dBFS です。

#### リペアを伴わない検出

以下はリペアプロセッサの解析部分だけを実行し、オーディオに触れる前に止まります。何もレンダリングせずに、リペアが必要かどうかを判断し、その理由をユーザーに示せます。いずれもレポートだけを返します。オプションは対応するプロセッサと同じインターフェースで、リクエストオブジェクトと位置引数の両方を受け付けます。

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

| 関数 | 測るもの | 注意点 |
|---|---|---|
| `masteringRepairDetectClicks` | リペアと同じ LPC 解析。ただし区間は局所的なトランジェントのレベルを上回る場所でだけ数えるので、ドラムのヒットはクリックになりません | 数はリペア用オプションに左右されます。リペア自体はトランジェントの内側でも処理するため、置き換えられるサンプル数は検出数を超えることがあります。`rejected` が大きい場合、素材がきれいなのではなく `maxClickSamples` や `neighborRatio` が厳しすぎます |
| `masteringRepairDetectClipping` | オプションから読むのは `clipThreshold` だけ。`lpcOrder`・`iterations`・`lpcBlend` は検証されたあと読まれず、`sampleRate` は検証されるだけで一度も読まれません | 補間へのフォールバックを予測するには `longestRunSamples` を 512 サンプルの上限と比べます。4 つのフラットトップ系フィールドは、ピークから 1 dB 以内でビット単位に一致するサンプルが 3 個以上、という基準で、クリップ後に減衰された素材を捕まえます |
| `masteringRepairDetectCrackle` | `mode` の指定にかかわらず常にメディアン基準。ウェーブレット収縮はサンプルがクラックルで*ある*という判定を一切下さないからです。サンプルは局所的なトランジェントのレベルを上回る場所でだけ数えるので、パーカッションはクリーンと読まれます | この数値は、ウェーブレットモードのリペアが何を除去するかを説明しません。その代わり、モードを決める前でも同じ答えが得られます |
| `masteringRepairDetectHum` | `adaptive` の指定にかかわらず常に推定パス。固定パスはハムを探さないためです。ハムの候補は各解析フレームの大部分を貫く定常的な線でなければならず、繰り返すキックは候補になりません | `fundamentalProminence` は最も強い候補の射影エネルギーを候補の中央値で割った線形の比なので、**`1.0` はピークがまったく見つからなかったことを意味します**（繰り返すキックはちょうど `1.0` と読まれます）。ロック状態のフラグではありません。`harmonicDbfs` はノッチをかけた帯域だけでなく、そのサンプルレートが表現できる `k*f0` すべてを含み、ナイキスト以上の倍音は dB のフロア値を返します |
| `masteringRepairDetectNoiseFloor` | ゲインマスクの手前で止まるため、減衰量の値はありません | `floorDbfs` は絶対値なので、同じチャンネル数で取った値とだけ比較してください |
| `masteringRepairDetectReverb` | どれだけ減算するかを決める過程でデリバーブ自身が計測している値。**ISO 3382 の RT60 ではありません**（それには `estimateRoom(...)` を使います） | `lateDecayRatioDb` は直感と逆向きで、*負の度合いが小さい*ほど残響が*多い*ことを表します。既定の設定では WPE 段が `wpeEnabled` を指定したときにしか動かないため、`latePredictability` はちょうど `0` になります |
| `masteringRepairDetectTrimRange` | リペアが「そこまでカットする」範囲。`paddingSamples` はすでにその内側に含まれており、検出された信号の範囲そのものではありません | しきい値を超えるものが何もなければ `(長さ, 長さ)` が返ります |
| `masteringRepairDetectTrimRangeStereo` | チャンネルごとの範囲の和集合 | しきい値を超えるものがないチャンネルは、バッファ端を範囲の端とするのではなく、**範囲の計算に一切加わりません**。そのため無音チャンネルと有音チャンネルの和集合は、有音チャンネルの範囲そのものになります |

フラットトップの検出には失敗のしかたが 2 つあります。本当に平坦な波形は偽陽性になり、ダウンミックス・リサンプル・非可逆圧縮といったサンプル単位の変化は本物のフラットトップを消します。**ステレオはダウンミックス前にチャンネルごとに検出し、ダウンミックス後の信号に対しては決して実行しないでください。**

#### `masteringRepairDereverbConfigForRoom(...)`

ルーム音響の測定結果をデリバーブ設定に変換します。

```typescript
function masteringRepairDereverbConfigForRoom(
  request: MasteringRepairDereverbConfigForRoomRequest,
): Required<DereverbClassicalOptions>
function masteringRepairDereverbConfigForRoom(
  estimate: RoomEstimateResult,
  config?: DereverbClassicalOptions,
): Required<DereverbClassicalOptions>
```

`estimateRoom(...)` の結果から読むのは `volume` と `rt60Bands` だけで、返るのは**完全な**設定です。すべてのフィールドが揃っており、省略可能なものはありません。そのため実行前にユーザーへ内容を提示できます。変更されて返ってくるのはちょうど 2 つのフィールドで、`t60Sec`（中音域の残響時間。500 Hz と 1 kHz のオクターブバンドの平均）と `lateDelayMs`（Polack の混合時間、`sqrt(volume)` ミリ秒）です。

`attenuation`・`threshold`・`overSubtraction`・`spectralFloor` は**一切書き換えられません**。残響をどれだけ取り除くかは測定ではなく好みの問題であり、この関数は推測を避けます。収束しなかったバンドは自分のフィールドをそのまま残し、`confidence` が低い推定であっても適用されます。これが望ましくない場合は、推定結果を自分で選別してください。省略した設定フィールドは 0 ではなくライブラリの既定値に解決されます。注意点が 1 つあります。中音域のどちらのバンドも収束しなかった場合、`t60Sec` は収束したバンドの平均にフォールバックするため、その時点でもはや中音域の値ではありません。

#### `masteringRepairNoiseBandBins(...)`

```typescript
function masteringRepairNoiseBandBins(request?: MasteringRepairNoiseBandBinsRequest): Int32Array
function masteringRepairNoiseBandBins(nFft?: number, sampleRate?: number): Int32Array

interface MasteringRepairNoiseBandBinsRequest {
  nFft?: number;        // 既定 1024。正の 2 の冪であること
  sampleRate?: number;  // 既定 22050。正であること
}
```

`NoiseDetection.bandFloorDbfs` の背後にあるビン添字を **33 個**返します。32 バンド分に終端の 1 個を加えたもので、単調非減少です。バンド `k` は片側スペクトルのビン `[bins[k], bins[k+1])` を覆い、ビン `b` は `b * sampleRate / nFft` Hz に位置します。グリッドを決めるのは解析側の FFT 設定だけなので、ノイズリダクションの設定は受け取りません。

この関数は、ある特定のあいまいさを解消するためにあります。等比で決まるバンド境界はビンに丸められるため、ビン間隔より狭いバンドは**空**になり（`bins[k] === bins[k + 1]`）、その `bandFloorDbfs[k]` はフロアのセンチネル値を返します。そこが静かだったからではなく、ビンが 1 つも入らなかったからです。バンド配列だけでは両者を区別できず、バンド数からも復元できませんが、このグリッドなら判別できます。空のバンドはフロア値の棒としてプロットするのではなく、「未計測」として表示してください。
