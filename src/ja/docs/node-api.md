# Node.js ネイティブ API

Node ネイティブバインディングの概要と選び方については、[ネイティブバインディング](./native-bindings.md) を参照してください。

このページは `@libraz/libsonare-native` アドオンの関数ごとのリファレンスです。import パスが明示的に `@libraz/libsonare` でない限り、例はネイティブパッケージを使います。

## 使用例

```typescript
import {
  Audio, analyze, detectBpm, detectKey, detectBeats, version
} from '@libraz/libsonare-native';

// 音声を読み込み
const audio = Audio.fromFile('music.mp3');
const samples = audio.getData();
const sampleRate = audio.getSampleRate();

// 個別の解析
const bpm = detectBpm(samples, sampleRate);
const key = detectKey(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);

// フル解析
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`キー: ${result.key.name}`);     // "C major" など
console.log(`ビート数: ${result.beatTimes.length}`);
```

上のアナライザーはどれも同じスペクトログラムを共有して読み出します。下のデモがたどるのがその変換で、BPM とキーをまとめて求めても片方だけの場合とコストがほとんど変わらないのは、これが理由です。

<SonareDemo id="stft-basics" />

### オーディオエフェクト

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// 倍音成分／打撃成分の分離（HPSS）
const hpssResult = audio.hpss();
const harmonic = audio.harmonic();
const percussive = audio.percussive();

// タイムストレッチ／ピッチシフト
const stretched = audio.timeStretch(1.5);      // 1.5 倍速
const shifted = audio.pitchShift(2.0);         // 2 半音上げ

// ノーマライズと無音トリム
const normalized = audio.normalize(0.0);        // 0 dB
const trimmed = audio.trim(-60.0);
```

### 特徴抽出

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// スペクトログラム特徴量
const stftResult = audio.stft(2048, 512);
const mel = audio.melSpectrogram(2048, 512, 128);
const mfcc = audio.mfcc(2048, 512, 128, 13);
const chroma = audio.chroma(2048, 512);

// スペクトル特徴量
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();

// ピッチ検出
const pitchYin = audio.pitchYin();
const pitchPyin = audio.pitchPyin();
console.log(`Median F0: ${pitchPyin.medianF0.toFixed(1)} Hz`);
```

### 単位変換

```typescript
import {
  hzToMel, melToHz, hzToMidi, midiToHz,
  hzToNote, noteToHz, framesToTime, timeToFrames
} from '@libraz/libsonare-native';

hzToMel(440);        // → Mel スケール値
melToHz(549.64);     // → Hz
hzToMidi(440);       // → 69
midiToHz(69);        // → 440
hzToNote(440);       // → "A4"
noteToHz('A4');      // → 440

framesToTime(100, 22050, 512);  // → 秒
timeToFrames(2.32, 22050, 512); // → フレームインデックス
```

## API リファレンス

このリファレンスは 3 ページに分かれています。このページでは単発 API のリクエストオブジェクト、エラー、`Audio` クラス、クリーンアップ、逆再構成、librosa 互換ヘルパー、変換、メータリング、マスタリング解析、スケール量子化、ストリーミング／リアルタイムクラスを扱います。解析・エフェクト・特徴抽出関数は [Node.js ネイティブ 解析・エフェクト API](./node-api-analysis.md) に、型定義は [Node.js ネイティブ 型定義](./node-api-types.md) にあります。

### 単発 API のリクエストオブジェクト

トップレベルの単発解析・エフェクト・マスタリング・メータリング・特徴量・ミキサー・ボイスチェンジャー関数は、Node でも名前付きリクエストオブジェクトを標準の呼び出し形式として受け取れます。新規コードではこちらを優先してください。位置引数のオーバーロードも互換性のため残り、同じ検証、既定値、結果、エラー、進捗処理へ正規化されます。

```ts
const bpm = detectBpm({ samples, sampleRate });
const result = masterAudio({ samples, sampleRate, preset: 'pop' });
```

対応する `*Request` TypeScript 型もパッケージからエクスポートされます。

### エラー

ライブラリ側の失敗は `SonareError` として投げられます。`name` が `'SonareError'` の
標準 `Error` に、数値の `code`（`ErrorCode` の値）と正規名の `codeName`（例:
`'InvalidParameter'`）が付いたものです。

`SonareError` は型宣言だけの存在ではなく実行時のクラスです。そのため値として
import しても実体が得られ、このパッケージでも WASM パッケージでも同じ種類のものが
返ります。共通の TypeScript モジュールがどちらの面から import しても、実行時に同じ
ものを受け取れます。

`instanceof SonareError` はプロトタイプではなく形状（ブランド）で判定します。その
ため、形状だけを備えてクラスを生成しないアドオン由来のエラーも、Worker や
`structuredClone` の境界を越えてプロトタイプを失ったエラーも絞り込めます。
`isSonareError(value)` は同じ判定を型ガードとして書いたもので、両者は互いに結び付いて
いるため食い違いません。どちらを使っても構いません。

```typescript
import { Audio, ErrorCode, isSonareError } from '@libraz/libsonare-native';

try {
  const audio = Audio.fromFile('missing.wav');
  audio.destroy();
} catch (err) {
  if (isSonareError(err)) {
    console.error(err.codeName, err.code === ErrorCode.FileNotFound);
  }
}
```

ライブラリへ届く前に弾かれる引数の形の問題（長さの食い違う 2 本の配列、許可されて
いない文字列の `mode` など）は素の `RangeError` や `TypeError` で投げられるため、
`isSonareError` では捕捉できません。

### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.fromFile(path)` | WAV/MP3 ファイルを読み込み。FFmpeg 有効ビルドでは FFmpeg 対応形式も読み込めます |
| `Audio.fileChannelCount(path)` | デコードせずに音声ファイルのチャンネル数を取得。モノラルへダウンミックスする `fromFile` とは別物 |
| `Audio.fromBuffer(samples, sampleRate?)` | `Float32Array` から作成。`sampleRate` の既定値は `48000` |
| `Audio.fromMemory(data)` | `fromFile` と同じ形式対応で、`Buffer` / `Uint8Array` をデコード |
| `audio.getData()` | サンプルのコピーを `Float32Array` で返します |
| `audio.getSampleRate()` | サンプルレート（Hz） |
| `audio.getDuration()` | 長さ（秒） |
| `audio.getLength()` | サンプル数 |
| `audio.destroy()` | ネイティブハンドルを解放。GC でも回収されますが、長時間動くプロセスで確実に解放したい場合に呼び出します |

`Audio` インスタンスは、以下の解析・エフェクト・特徴量関数を同じデフォルト値で
メソッドとしても呼び出せます（例: `audio.detectBpm()`、`audio.masteringChain(config)`）。

`analyzeSections(...)`、`analyzeMelody(...)`、`cqt(...)`、`vqt(...)` などの一部の詳細ヘルパーは
スタンドアロン関数のままです。これらには `audio.getData()` と `audio.getSampleRate()` を渡します。

::: warning `getData()` はコピーを返します
呼び出すたびに新しい `Float32Array` を確保するため、返された配列に書き込んでも
インスタンスが保持する音声は変わりません。あとから `audio.detectBpm()` や
`audio.masteringChain(...)` を呼んでも、読み取られるのは元のサンプルです。
編集後のサンプルを処理するには `Audio.fromBuffer(edited, sampleRate)` で
新しいインスタンスを作ってください。ループ内で読む場合は配列を自分でキャッシュします。
WASM でも同じ挙動です。
:::

### `using` によるクリーンアップ（Node 22 以上）

ネイティブハンドルを持つクラス（`Audio`、`RealtimeEngine`、`Project`、`Mixer`、
`ClipPageProvider`）はすべて `[Symbol.dispose]` を実装しています。そのため
Node 22 以上では `using` キーワードを使うと、スコープを抜けるときに例外発生時でも
安全に自動でクリーンアップできます。

```typescript
import { RealtimeEngine } from '@libraz/libsonare-native';

function render() {
  using engine = new RealtimeEngine(48000, 128);
  engine.setTempo(120);
  // 例外が起きても、このスコープを抜けるときにハンドルが解放されます。
}
```

Node 22 未満では、これまでどおり `try/finally` で明示的に解放するパターンを使ってください。
すべてのハンドルクラスでネイティブの正規の解放メソッドは `destroy()` です。`Project` と
`Mixer` は WASM 互換のエイリアスとして `delete()` も公開します。ハンドルは最終的に GC でも
回収されますが、`using` や明示的な解放のほうが決定的なクリーンアップになるため、
長時間動くプロセスではそちらを推奨します。

`RealtimeVoiceChanger` も明示的な `destroy()` に加えて `[Symbol.dispose]` を実装しているため、
`using` を使えます。`StreamingMasteringChain`、`StreamingEqualizer`、`StreamAnalyzer` も同様に
冪等な `destroy()` と `[Symbol.dispose]` を公開しており、決定的に解放できます。

### 逆再構成関数

メルスペクトログラムや MFCC 行列から、スペクトルや音声を再構成します。位相は Griffin-Lim で推定するため往復はロスを伴います。詳細は [逆変換特徴量](./inverse-features.md) を参照してください。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `melToStft(mel, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `InverseStftResult` | メルスペクトログラムから線形 STFT パワーへ |
| `melToAudio(mel, nMels, nFrames, sr?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | メルスペクトログラムから音声へ（Griffin-Lim） |
| `mfccToMel(mfcc, nMfcc, nFrames, nMels?, lifter?)` | `InverseMelResult` | MFCC 係数からメルスペクトログラムへ |
| `mfccToAudio(mfcc, nMfcc, nFrames, nMels?, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | MFCC 係数から音声へ |
| `cqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, nIter?)` | `Float32Array` | row-major CQT 振幅行列から音声へ（Griffin-Lim） |
| `vqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, gamma?, nIter?)` | `Float32Array` | row-major VQT 振幅行列から音声へ（Griffin-Lim） |

### librosa 互換ヘルパー

対応する `librosa` 関数の挙動に
合わせています。マッピングの全体像は
[librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`** — 高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trimSilence` / `splitSilence`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frameSignal` / `padCenter` / `fixLength` / `fixFrames`** — 固定フレーム DSP に通すためのフレーミング・サイズ揃え。
- **`peakPick` / `vectorNormalize`** — 1 次元信号のピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮。
- **`tonnetz`** — クロマを 6 次元のハーモニック空間へ射影。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現と支配的なパルスの抽出。
:::

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `preemphasis(samples, coef?, zi?)` | `Float32Array` | プリエンファシス |
| `deemphasis(samples, coef?, zi?)` | `Float32Array` | ディエンファシス |
| `trimSilence(samples, topDb?, frameLength?, hopLength?)` | `{ audio: Float32Array; startSample: number; endSample: number }` | `librosa.effects.trim`。しきい値 `trim(...)` とは別物 |
| `splitSilence(samples, topDb?, frameLength?, hopLength?)` | `Int32Array` | `librosa.effects.split`。`[start0, end0, start1, end1, ...]` のフラット配列 |
| `splitSilenceCommon(request)` | `Int32Array` | 同じパートの複数テイクが揃って無音だと認める切れ目。`request`: `signals`、`topDb`、`frameLength`、`hopLength`。配列の形は同じで、テイクの長さが揃っていなくてもパディングは不要 |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame`（row-major） |
| `padCenter(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`。`normType`: 0=inf, 1=L1, 2=L2, 3=power。Node wrapper の `threshold` 既定値は `0.0`、WASM は `1e-12` |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen`（row-major のメル入力） |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz`（`[6 x nFrames]`） |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?, mode?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram`。`mode` は `'autocorrelation'`（既定）または `'cosine'` |
| `fourierTempogram(onsetEnvelope, sr?, hopLength?, winLength?)` | `{ nBins: number; nFrames: number; data: Float32Array }` | `librosa.feature.fourier_tempogram` |
| `cyclicTempogram(onsetEnvelope, sr?, hopLength?, winLength?, center?, norm?, bpmMin?, nBins?)` | `{ nFrames: number; nBins: number; data: Float32Array }` | 巡回（テンポオクターブ不変）テンポグラム |
| `tempogramRatio(tempogramData, winLength?, sr?, hopLength?, factors?)` | `Float32Array` | `librosa.feature.tempogram_ratio`。factors の既定値は `[0.5, 1, 2, 3, 4]` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

### 変換関数

| 関数 | 説明 |
|------|------|
| `hzToMel(hz)` | ヘルツ → Mel スケール |
| `melToHz(mel)` | Mel スケール → ヘルツ |
| `hzToMidi(hz)` | ヘルツ → MIDI ノート番号 |
| `midiToHz(midi)` | MIDI ノート番号 → ヘルツ |
| `hzToNote(hz)` | ヘルツ → 音名（例: "A4"） |
| `noteToHz(note)` | 音名 → ヘルツ |
| `framesToTime(frames, sr?, hopLength?)` | フレームインデックス → 秒（`sr` 既定 `22050`、`hopLength` 既定 `512`） |
| `timeToFrames(time, sr?, hopLength?)` | 秒 → フレームインデックス（`sr` 既定 `22050`、`hopLength` 既定 `512`） |
| `framesToSamples(frames, hopLength?, nFft?)` | フレームインデックス → サンプルインデックス（`librosa.frames_to_samples`） |
| `samplesToFrames(samples, hopLength?, nFft?)` | サンプルインデックス → フレームインデックス（`librosa.samples_to_frames`） |
| `powerToDb(values, ref?, amin?, topDb?)` | パワー → dB（`librosa.power_to_db`） |
| `amplitudeToDb(values, ref?, amin?, topDb?)` | 振幅 → dB（`librosa.amplitude_to_db`） |
| `dbToPower(values, ref?)` | dB → パワー |
| `dbToAmplitude(values, ref?)` | dB → 振幅 |

### メータリング関数

レベル・ダイナミクス・ステレオイメージを測る単体メーターです。各関数は `validate` フラグ（既定 `true`）を持つ `options` を任意で受け取ります。ホットパスでは `{ validate: false }` を渡して NaN/Inf 入力チェックを省略できます。ステレオメーターは `left` と `right` が同じ長さである必要があります。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `meteringPeakDb(samples, sr?, options?)` | `number` | サンプルピーク（dBFS） |
| `meteringRmsDb(samples, sr?, options?)` | `number` | RMS レベル（dBFS） |
| `meteringCrestFactorDb(samples, sr?, options?)` | `number` | クレストファクター（ピーク − RMS、dB）。値が大きいほどピークとレベルの差が大きく、圧縮されていない信号を意味します |
| `meteringCrestFactorDbStereo(request)` | `number` | チャンネルペアのクレストファクター（dB）。ピークは左右をまたいで取り、RMS は左右まとめて測ります。リクエスト専用で、`MeteringStereoRequest`（`{ left, right, sampleRate?, validate? }`）だけを受け取り、位置引数のオーバーロードはありません |
| `meteringDcOffset(samples, sr?, options?)` | `number` | 平均（DC）オフセット、リニア振幅 |
| `meteringTruePeakDb(samples, sr?, oversampleFactor?, options?)` | `number` | サンプル間ピーク（ISP、いわゆる True Peak。サンプル点の間で波形が到達する最大値、dBFS）。`oversampleFactor` は 1..16 の 2 の冪（既定 4） |
| `meteringDetectClipping(samples, sr?, options?)` | `ClippingReport` | クリップしたサンプルの連続区間。`options` で `threshold`（既定 `0.999`）と `minRegionSamples`（既定 `1`）を指定 |
| `meteringDynamicRange(samples, sr?, options?)` | `DynamicRangeReport` | スライディングウィンドウのダイナミックレンジ。`options` で `windowSec`・`hopSec`・`lowPercentile`・`highPercentile` を指定（省略時は既定値の窓 3 秒・ホップ 1 秒・low 0.10・high 0.95） |
| `meteringStereoCorrelation(left, right, sr?, options?)` | `number` | 非中心化相関（コサイン類似度）、−1..1 |
| `meteringStereoWidth(left, right, sr?, options?)` | `number` | サイド／ミッドのエネルギー比。0 = モノラル、約 1 = 広いステレオ。上限なし（ミッドが無音なら `Infinity`） |
| `meteringVectorscope(left, right, sr?, options?)` | `VectorscopeReport` | サンプルごとのミッド/サイド点列 |
| `meteringPhaseScope(left, right, sr?, options?)` | `PhaseScopeReport` | フェーズスコープの点列と要約統計 |
| `meteringSpectrum(samples, sr?, options?)` | `SpectrumReport` | 信号全体に対する Welch 平均の振幅/パワー/dB スペクトラム（50% 重複する Hann フレームで平均）。`options` で `nFft`・`applyOctaveSmoothing`・`octaveFraction`・`dbRef`・`dbAmin` を指定 |
| `meteringSpectrumFrame(samples, sr?, frameOffset?, options?)` | `SpectrumReport` | 単一フレーム（Hann 窓 1 回分）の振幅/パワー/dB スペクトラム。`meteringSpectrum` と異なり時間平均しません。`frameOffset` で解析フレームの開始位置を指定 |
| `meteringSilenceRatio(samples, sr?, thresholdDb?, frameLength?, hopLength?, options?)` | `number` | RMS が `thresholdDb` を下回るフレームの割合（既定: `-45` dBFS、`frameLength=1024`、`hopLength=256`） |
| `waveformPeaks(samples, channels, options?)` | `WaveformPeaksReport` | インターリーブ音声からチャンネルごとの min/max 波形バケットを算出。`options.samplesPerBucket` の既定値は `512` |
| `waveformPeakPyramid(samples, channels, options?)` | `WaveformPeaksReport[]` | 複数のズームレベル向けの波形ピークバケット。`options.samplesPerBucketLevels` の既定値は `[512, 1024, 2048, 4096]` |

左右が逆相になりうる素材では `meteringCrestFactorDbStereo(...)` を使ってください。逆相のペアは `meteringCrestFactorDb(...)` が必要とする `0.5 * (left + right)` のダウンミックスで打ち消し合い、RMS が小さく出るぶんクレストファクターが過大に出ます。完全な逆相ペアでの実測値は、ステレオ版が 11.64 dB、ダウンミックス経由が 0.00 dB でした。

### マスタリング解析関数

説明可能なマスタリングのヘルパーは JSON 文字列を返します。正確な形は [マスタリングアシスタント](./mastering-assistant.md) を参照してください。下のステレオ版はいずれもリクエスト専用で、リクエストオブジェクト 1 つだけを受け取ります。位置引数のオーバーロードはなく、位置引数で呼ぶと例外になります。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `masteringAudioProfileStereo(request)` | `string` | チャンネルペアのマスタリングアシスタントプロファイルを JSON で返す。`MasteringAudioProfileStereoRequest` を受け取る |
| `masteringAssistantSuggestStereo(request)` | `string` | チャンネルペアに対するマスタリングの提案を JSON で返す。`MasteringAssistantSuggestStereoRequest` を受け取る |
| `masteringStreamingPreviewStereo(request)` | `string` | チャンネルペアの配信ラウドネスのプレビューを JSON で返す。`MasteringStreamingPreviewStereoRequest` を受け取る。`platforms` を省略するか空配列を渡すと、例外ではなく組み込みの Spotify / Apple Music / YouTube のセット（3 行）にフォールバックする |

```typescript
import { masteringAudioProfileStereo, masteringStreamingPreviewStereo } from '@libraz/libsonare-native';

const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
const preview = JSON.parse(
  masteringStreamingPreviewStereo({
    left,
    right,
    sampleRate,
    platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
  }),
);
```

ステレオ素材ならステレオ版を使ってください。モノラル版は `0.5 * (left + right)` のダウンミックスを計測するため、相関の低い素材では約 6 dB 低く出ます。積分ラウドネス、そこから導かれる正規化ゲイン、天井に当たるリスクの判断が、そろって同じぶんだけ過小に報告されます。相関の低いピンクノイズのペア（48 kHz、4 秒）での実測値は、ダウンミックス経由が -22.55 LUFS、ステレオ版が -16.44 LUFS で、差は 6.11 dB でした。Spotify の `normalizationGainDb` もダウンミックス経由が +8.55、ステレオ版が +2.44 です。

ステレオプロファイルのうち、左右両チャンネルから計測されるのは `loudness` ブロックだけです。積分 LUFS と LRA はチャンネル加算したプログラムから求め、True Peak は左右の大きいほうを採ります。スペクトル、ダイナミクス、テンポの各フィールドはダウンミックス上で計測されるため、`masteringAudioProfile` の値とそのまま比較できます。

::: warning リクエスト型の名前がバインディングごとに違います
Node はプロファイル用と提案用で 2 つの型名を宣言しています。`MasteringAudioProfileStereoRequest` は `MasteringAssistantSuggestStereoRequest` を継承し、フィールドを追加しません。WASM パッケージは両方に共通の `MasteringStereoParamsRequest` を使います。フィールドは同一なので、両者の間でコードを移植するときに変えるのは型名だけです。
:::

### スケール量子化

ピッチ補正ターゲットを構築するための 12-TET（12 平均律）スケールヘルパーです。

`modeMask` は 12 ビットのマスクです。ビット *i* が、`root`（`PitchClass`、C = 0）を基準とした *i* 番目のピッチクラスを有効化します。自然な長調は `0b101010110101` です。

`referenceMidi` はチューニング基準音です。A4 = 69 にするには `0` を渡します。`pitchCorrectToMidi(...)` と組み合わせて最も近いスケール構成音へリチューンします。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `scaleQuantizeMidi(root, modeMask, midi, referenceMidi?)` | `number` | 小数を含む MIDI 番号を最も近い有効なピッチクラスへスナップ |
| `scaleCorrectionSemitones(root, modeMask, midi, referenceMidi?)` | `number` | 補正量（量子化後 − 入力）をセミトーンで返す |
| `scalePitchClassEnabled(root, modeMask, pitchClass)` | `boolean` | `pitchClass`（0..11）が `root` を基準に有効か |

### ストリーミング／リアルタイムクラス

一括処理の関数に加えて、ネイティブアドオンは WASM ビルドと同じストリーミング／リアルタイムクラスを公開します。

| クラス | 用途 |
|--------|------|
| `StreamAnalyzer` | ブロック単位の解析。時間とともに更新される BPM/キー推定と `readFramesSoa`／`readFramesI16`／`readFramesU8`。[リアルタイムストリーミング](./realtime-streaming.md) を参照。 |
| `StreamingEqualizer` | リアルタイムセーフなブロック EQ。 |
| `StreamingMasteringChain` | ブロックごとに進めるマスタリングレンダリング（[ネイティブバインディング](./native-bindings.md#streamingmasteringchain) で解説）。 |
| `RealtimeVoiceChanger` | プリセット式のライブ音声チェーン。ブロック処理向け。 |
| `Mixer` | JSON シーンから構築する永続マルチストリップミキサー。[ミキシングエンジン](./mixing.md) を参照。 |
| `RealtimeEngine` | DAW 風ホスティング向けのトランスポート／クリップ／オートメーションエンジン。 |

```typescript
import { StreamAnalyzer } from '@libraz/libsonare-native';

const analyzer = new StreamAnalyzer({ sampleRate: 48000, computeMel: true, computeOnset: true });
analyzer.process(block);                 // Float32Array のブロックを渡す
const frames = analyzer.readFramesSoa(analyzer.availableFrames());
const stats = analyzer.stats();          // stats.estimate.bpm / .key（PitchClass の整数）
```

Node ネイティブでは float の Structure-of-Arrays 読み出しの正式名は `readFramesSoa(...)` です。バインディング間の命名を揃えるためのエイリアス `readFrames(...)` も公開しており、これは WASM パッケージが同じ操作に使う名前と一致します。

Node ネイティブの `RealtimeVoiceChanger` は `{ sampleRate, maxBlockSize, channels, preset }` で構築します。

処理には `processMono(...)`、`processMonoInto(...)`、`processInterleaved(...)`、`processPlanarStereo(...)` を使います。

オフラインの便利用途では、`voiceChangeRealtime(...)` が同じプリセットチェーンでモノラルバッファ全体を 512 サンプルブロック単位に処理します。

```typescript
import {
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetConfig,
  realtimeVoiceChangerPresetNames,
  voiceCharacterPresetId,
  voiceChangeRealtime,
} from '@libraz/libsonare-native';

const changer = new RealtimeVoiceChanger({
  sampleRate: 48000,
  maxBlockSize: 128,
  channels: 1,
  preset: 'bright-idol',
});

const blockOut = changer.processMono(inputBlock);
const rendered = voiceChangeRealtime(vocal, 48000, 'soft-whisper');
const presetConfig = realtimeVoiceChangerPresetConfig('bright-idol');
console.log(
  voiceCharacterPresetId(1),
  realtimeVoiceChangerPresetNames(),
  presetConfig,
  changer.latencySamples(),
  blockOut,
  rendered,
);
changer.destroy();
```

`RealtimeEngine` はクラスとしては共有されていますが、実行環境ごとに細部が異なります。

| Runtime | 違い |
|---------|------|
| WASM | `engineCapabilities()` を追加し、構築前に ABI 互換性を確認します。キャプチャバッファは正規形の `setCaptureBuffer(numChannels, capacityFrames)` で設定します。 |
| Node ネイティブ | `engineAbiVersion()` を公開します。ブラウザ向けの機能確認ヘルパーはありません。キャプチャバッファは WASM と同じ正規形 `setCaptureBuffer(numChannels, capacityFrames)` に加えて、後方互換のために非推奨の `setCaptureBuffer(channels: Float32Array[])` も残しています。 |

`Project.create()` は空のプロジェクトを作成します。`setAssistSidecar(...)` と
`assistSidecars()` でモジュール固有の不透明なメタデータを保持でき、
`ProjectAutomationTargetKind` と `targetKind` でオートメーションレーンの対象種別を付けられます。
`RealtimeEngine.setTrackMonitorMode(laneIndex, mode, renderFrame?)` は `'off'`、
`'pfl'`（pre-fader listen＝フェーダー前で試聴）、`'afl'`（after-fader listen＝フェーダー後で試聴）、
および対応する数値序数を受け取ります。トラック／ミキサーのパン則セッターは、下記の
`PanLawInput` エイリアスを受け取ります。

## 各節の移動先

| 節 | 移動先ページ |
|----|--------------|
| 解析関数 | [Node.js ネイティブ 解析・エフェクト API](./node-api-analysis.md) |
| エフェクト関数 | [Node.js ネイティブ 解析・エフェクト API](./node-api-analysis.md) |
| 特徴抽出関数 | [Node.js ネイティブ 解析・エフェクト API](./node-api-analysis.md) |
| 型定義 | [Node.js ネイティブ 型定義](./node-api-types.md) |
