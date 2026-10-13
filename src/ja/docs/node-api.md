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
const key = detectKey(samples, sampleRate);   // key.root はピッチクラス 0..11（C = 0）、key.mode は 'major'、'minor' など
const beats = detectBeats(samples, sampleRate);

// フル解析
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`キー: ${result.key.name}`);     // "C major" など
console.log(`ビート数: ${result.beatTimes.length}`);
```

`detect*` 関数は、呼び出しごとにサンプルから自前でスペクトログラムを計算します。下のデモがたどるのがその変換です。`analyze()` はパイプライン全体で一度だけ計算するため、1 つのバッファから複数の結果が欲しいときは `analyze()` を使ってください。

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

// 正規化と無音トリム
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

hzToMel(440);        // → 6.6（Slaney 式の Mel スケール）
melToHz(6.6);        // → 440
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

トップレベルの単発解析・エフェクト・マスタリング・メータリング・特徴量・ミキサー・ボイスチェンジャー関数は、Node でも名前付きリクエストオブジェクトを標準の呼び出し形式として受け取れます。位置引数のオーバーロードも互換性のため残り、同じ検証、既定値、結果、エラー、進捗処理へ正規化されます。

```ts
const bpm = detectBpm({ samples, sampleRate });
const result = masterAudio({ samples, sampleRate, preset: 'pop' });
```

対応する `*Request` TypeScript 型もパッケージからエクスポートされます。

### エラー

ライブラリ側の失敗は `SonareError` として投げられます。`name` が `'SonareError'` の標準 `Error` に、数値の `code`（`ErrorCode` の値）と正規名の `codeName`（例: `'InvalidParameter'`）が付いたものです。

`SonareError` は型宣言だけの存在ではなく実行時のクラスです。そのため値として import しても実体が得られ、このパッケージでも WASM パッケージでも同じ種類のものが返ります。共通の TypeScript モジュールがどちらのパッケージから import しても、実行時に同じものを受け取れます。

`instanceof SonareError` はプロトタイプではなく形状（ブランド）で判定します。そのため、形状だけを備えてクラスを生成しないアドオン由来のエラーも、Worker や `structuredClone` の境界を越えてプロトタイプを失ったエラーも絞り込めます。`isSonareError(value)` は同じ判定を型ガードとして書いたもので、両者は互いに結び付いているため食い違いません。どちらを使っても構いません。

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

ライブラリへ届く前に弾かれる引数の問題はネイティブの `TypeError` または `RangeError` として投げられ、`isSonareError` では捕捉できません。メッセージは関数名と引数名を挙げます（`<function>: request must be an object`、`detectBpm: samples must be a Float32Array`、`detectBpm: sampleRate out of supported range [8000, 384000]`）。どの失敗がどのクラスとコードになるかは、ほかのランタイムの分も含めて[エラー契約](./binding-parity.md#エラー契約)にあります。パッケージと別のツリーからビルドされたアドオンは、パッケージの require 時に `AbiMismatch`（コード 10）を投げます。対処は[インストール](./installation.md#ライブラリ読み込み時の-abimismatch)を参照してください。

ほかにも、次の 3 つの拒否があります。

- 埋め込み NUL を含む文字列（名前、ID、キー、JSON テキスト、ファイルパス）は、フィールド名を挙げた `RangeError` になります。
- `destroy()` 後のハンドルに対する呼び出しは、`SonareError` の `InvalidState` です。
- `RealtimeEngine` の末尾の `renderFrame` はすべて省略可能で、省略すると即時に適用されます。`-1` を含む負の値は `RangeError` です。

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

`Audio` インスタンスは、主要な解析・エフェクト・特徴量・ラウドネス・マスタリングのヘルパーをメソッドとしても公開しています（例: `audio.detectBpm()`、`audio.masteringChain(config)`）。

`analyzeSections(...)`、`analyzeMelody(...)`、`cqt(...)`、`vqt(...)` などの一部の詳細ヘルパーはスタンドアロン関数のままです。これらには `audio.getData()` と `audio.getSampleRate()` を渡します。

::: warning `getData()` はコピーを返します
呼び出すたびに新しい `Float32Array` を確保するため、返された配列に書き込んでもインスタンスが保持する音声は変わりません。あとから `audio.detectBpm()` や `audio.masteringChain(...)` を呼んでも、読み取られるのは元のサンプルです。編集後のサンプルを処理するには `Audio.fromBuffer(edited, sampleRate)` で新しいインスタンスを作ってください。ループ内で読む場合は配列を自分でキャッシュします。WASM でも同じ挙動です。
:::

### 全チャンネルのデコード

`Audio.fromMemory(data)` と `Audio.fromFile(path)` はマルチチャンネルのソースをモノラルに畳み込みます。`decodeChannels(data)` はバイト列を一度デコードして全チャンネルを保持し、`{ sampleRate, channels }` を返します。`channels` は元のチャンネル順（5.1 は L R C LFE Ls Rs）の `Float32Array` の配列です。`downmix(channels, targetLayout)` は、デコーダーと同じ ITU-R BS.775 の規則（センターとサラウンドを -3 dB、LFE は除外）で、より狭いレイアウト（`0` モノラル、`1` ステレオ、`2` 5.1、`3` 7.1）へ折りたたみます。アップミックスはできません。省略可能な第 3 引数 `{ normalize, includeLfe }` は、最悪ケースでもフルスケール以下に収まるよう折りたたみをスケールし（`normalize`、既定 `false`）、LFE を捨てずに -3 dB でフロントペアへ加えます（`includeLfe`、既定 `false`）。`normalize` なしの折りたたみはフルスケールを超えることがあります。

```typescript
import { decodeChannels, downmix } from '@libraz/libsonare-native';

const { sampleRate, channels } = decodeChannels(fs.readFileSync('surround.wav'));
const stereo = channels.length > 2 ? downmix(channels, 1) : channels;
```

### `using` によるクリーンアップ

ネイティブハンドルを持つクラス（`Audio`、`RealtimeEngine`、`Project`、`Mixer`、`ClipPageProvider`）はすべて `[Symbol.dispose]` を実装しています。そのため `using` 宣言を使うと、スコープを抜けるときに例外発生時でも安全に自動でクリーンアップできます。

```typescript
import { RealtimeEngine } from '@libraz/libsonare-native';

function render() {
  using engine = new RealtimeEngine(48000, 128);
  engine.setTempo(120);
  // 例外が起きても、このスコープを抜けるときにハンドルが解放されます。
}
```

`using` 構文には TypeScript 5.2 以降（または構文を変換する別のツール）か、ネイティブに解釈できるランタイムが必要です。Node 22 は解釈できないので、その場合は `try/finally` で `destroy()` を呼んでください。ハンドルクラスの解放メソッドは `destroy()` です（`ProjectTimeline` は `dispose()`）。`Project`、`Mixer`、`SampleBank` は WASM 互換のエイリアスとして `delete()` も公開します。ハンドルは最終的に GC でも回収されますが、`using` や明示的な解放のほうが決定的なクリーンアップになるため、長時間動くプロセスではそちらを推奨します。

`RealtimeVoiceChanger` も明示的な `destroy()` に加えて `[Symbol.dispose]` を実装しているため、`using` を使えます。`StreamingMasteringChain`、`StreamingEqualizer`、`StreamAnalyzer` も同様に冪等な `destroy()` と `[Symbol.dispose]` を公開しており、決定的に解放できます。

### 逆再構成関数

メルスペクトログラムや MFCC 行列から、スペクトルや音声を再構成します。位相は Griffin-Lim で推定するため往復はロスを伴います。詳細は [逆変換特徴量](./inverse-features.md) を参照してください。

<SonareDemo id="griffin-lim" />

6 つすべてがリクエストオブジェクトも受け付けます。メルと MFCC のリクエストは、行列を `power` / `coefficients` と名付けるか、順変換の `result` を渡します。どちらもないリクエストは、欠けているフィールドを挙げた `TypeError` になります（`melToStft: power is required (or pass result)`）。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `melToStft(power, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `InverseStftResult` | メルスペクトログラムから線形 STFT 振幅（`magnitude`）へ |
| `melToAudio(power, nMels, nFrames, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | メルスペクトログラムから音声へ（Griffin-Lim） |
| `mfccToMel(coefficients, nMfcc, nFrames, nMels?, lifter?)` | `InverseMelResult` | MFCC 係数からメルスペクトログラムへ |
| `mfccToAudio(coefficients, nMfcc, nFrames, nMels?, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?, lifter?)` | `Float32Array` | MFCC 係数から音声へ。`lifter` の既定値は 0 |
| `cqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, nIter?)` | `Float32Array` | row-major CQT 振幅行列から音声へ（Griffin-Lim） |
| `vqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, gamma?, nIter?)` | `Float32Array` | row-major VQT 振幅行列から音声へ（Griffin-Lim） |

### librosa 互換ヘルパー

対応する `librosa` 関数の挙動に合わせています。マッピングの全体像は [librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`**：高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trimSilence` / `splitSilence`**：前後無音のトリムや、無音区間での区切り出し。
- **`frameSignal` / `padCenter` / `fixLength` / `fixFrames`**：固定フレーム DSP に通すためのフレーミング・サイズ揃え。
- **`peakPick` / `vectorNormalize`**：1 次元信号のピーク検出と、ベクトルのノルム正規化。
- **`pcen`**：メルスペクトログラム向けの動的レンジ圧縮。
- **`tonnetz`**：クロマを 6 次元のハーモニック空間へ射影。
- **`tempogram` / `plp`**：オンセット包絡線から構築するテンポ表現と支配的なパルスの抽出。
:::

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `preemphasis(samples, coef?, zi?)` | `Float32Array` | プリエンファシス |
| `deemphasis(samples, coef?, zi?)` | `Float32Array` | ディエンファシス |
| `trimSilence(samples, topDb?, frameLength?, hopLength?)` | `{ audio: Float32Array; startSample: number; endSample: number }` | `librosa.effects.trim`。しきい値 `trim(...)` とは別物 |
| `splitSilence(samples, topDb?, frameLength?, hopLength?)` | `Int32Array` | `librosa.effects.split`。`[start0, end0, start1, end1, ...]` のフラット配列 |
| `splitSilenceCommon(request)` | `Int32Array` | 同じパートの複数テイクがすべて無音になっている区切り位置。`request`: `signals`、`topDb`、`frameLength`、`hopLength`。配列の形は同じで、テイクの長さが揃っていなくてもパディングは不要 |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame`（row-major） |
| `padCenter(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`。`normType`: 0=inf, 1=L1, 2=L2, 3=power。`threshold` の既定値は `0`（ライブラリが持つ微小ノルムのガード） |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen`（row-major のメル入力） |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz`（`[6 x nFrames]`） |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?, mode?, center?, norm?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram`。`mode` は `'autocorrelation'`（既定）または `'cosine'` |
| `fourierTempogram(onsetEnvelope, sr?, hopLength?, winLength?, center?, norm?)` | `{ nBins: number; nFrames: number; data: Float32Array }` | `librosa.feature.fourier_tempogram` |
| `cyclicTempogram(onsetEnvelope, sr?, hopLength?, winLength?, bpmMin?, nBins?)` | `{ nFrames: number; nBins: number; data: Float32Array }` | 巡回（テンポオクターブ不変）テンポグラム。既定は `winLength=384`、`bpmMin=60`、`nBins=60` |
| `tempogramRatio(tempogramData, winLength?, sr?, hopLength?, factors?)` | `Float32Array` | `librosa.feature.tempogram_ratio`。factors の既定値は `[0.5, 1, 2, 3, 4]` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

### 変換関数

| 関数 | 説明 |
|------|------|
| `hzToMel(hz)` | ヘルツ → Mel（Slaney 式。`librosa` の既定と同じ） |
| `melToHz(mel)` | Mel（Slaney 式） → ヘルツ |
| `hzToMidi(hz)` | ヘルツ → MIDI ノート番号 |
| `midiToHz(midi)` | MIDI ノート番号 → ヘルツ |
| `hzToNote(hz)` | ヘルツ → 音名（例: "A4"）。有限でも正でもない周波数は `SonareError`（`InvalidParameter`）を投げる |
| `noteToHz(note)` | 音名 → ヘルツ。解釈できない名前や -1〜9 の外のオクターブは `SonareError`（`InvalidParameter`）を投げる |
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

説明可能なマスタリングのヘルパーは JSON 文字列を返します。正確な形は [マスタリングアシスタント](./mastering-assistant.md) を参照してください。下のステレオ版はいずれもリクエスト専用で、リクエストオブジェクト 1 つだけを受け取ります。位置引数のオーバーロードはなく、位置引数で呼ぶと、リクエストオブジェクトを名指しした `TypeError` になります。

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

ステレオ素材ならステレオ版を使ってください。モノラル版は `0.5 * (left + right)` のダウンミックスを計測するため、相関の低い素材では約 6 dB 低く出ます。積分ラウドネス、そこから導かれる正規化ゲイン、シーリングに当たるリスクの判断が、そろって同じぶんだけ過小に報告されます。相関の低いピンクノイズのペア（48 kHz、4 秒）での実測値は、ダウンミックス経由が -22.55 LUFS、ステレオ版が -16.44 LUFS で、差は 6.11 dB でした。Spotify の `normalizationGainDb` もダウンミックス経由が +8.55、ステレオ版が +2.44 です。

ステレオプロファイルのうち、左右両チャンネルから計測されるのは `loudness` ブロックだけです。積分 LUFS と LRA はチャンネル加算したプログラムから求め、True Peak は左右の大きいほうを採ります。スペクトル、ダイナミクス、テンポの各フィールドはダウンミックス上で計測されるため、`masteringAudioProfile` の値とそのまま比較できます。

::: warning リクエスト型の名前がバインディングごとに違います
Node はプロファイル用と提案用で 2 つの型名を宣言しています。`MasteringAudioProfileStereoRequest` は `MasteringAssistantSuggestStereoRequest` を継承し、フィールドを追加しません。WASM パッケージは両方に共通の `MasteringStereoParamsRequest` を使います。フィールドは同一なので、両者の間でコードを移植するときに変えるのは型名だけです。
:::

### ストリーミング用ラウドネスゲインとリペア

`streamingLoudnessGain({ samples, sampleRate, config })`（ステレオは `streamingLoudnessGainStereo({ left, right, ... })`）は、`StreamingMasteringChain` の構築に使うラウドネスの値を、オフラインのチェーンが測るのと同じ位置、つまりラウドネス段の入力で測定します。結果は `{ loudnessStaticGainDb, truePeakDb, integratedLufs }` で、ゲインはシーリングのクランプを含めてオフラインのチェーンが適用するものと等しく、無音では 0 dB です。`loudnessStaticGainDb` と `truePeakDb`（`loudnessStaticGainPeakDb` として）をチェーンのコンストラクタに渡します。

`masteringRepairAnalyze({ channels, sampleRate })` は任意のチャンネル数のリペア対象の欠陥を測定し、設定付きで段を推奨します。`masteringRepairApply({ channels, sampleRate, stages, onProgress?, cancel? })` は `stages`（各段は最大 1 回、未知の設定は拒否）を、配列の順序によらず declip、declick、decrackle、dehum、denoise、dereverb の固定順で適用します。declip・declick・dehum はチャンネル全体で判断してチャンネルごとに報告し、decrackle は各チャンネルを単独で処理し、denoise と dereverb は連動した 1 つのマスクを適用して 1 回だけ報告します。

```typescript
const analysis = masteringRepairAnalyze({ channels: [left, right], sampleRate: 48000 });
const { channels, reports } = masteringRepairApply({
  channels: [left, right],
  sampleRate: 48000,
  stages: analysis.recommended,
});
```

### スケール量子化

ピッチ補正ターゲットを構築するための 12-TET（12 平均律）スケールヘルパーです。

`modeMask` は 12 ビットのマスクです。ビット *i* が、`root`（`PitchClass`、C = 0）を基準とした *i* 番目のピッチクラスを有効化します。自然な長調は `0b101010110101` です。

`referenceMidi` はチューニング基準音です。A4 = 69 にするには `0` を渡します。`pitchCorrectToMidi(...)` と組み合わせて最も近いスケール構成音へリチューンします。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `scaleQuantizeMidi(root, modeMask, midi, referenceMidi?)` | `number` | 小数を含む MIDI 番号を最も近い有効なピッチクラスへ丸める |
| `scaleCorrectionSemitones(root, modeMask, midi, referenceMidi?)` | `number` | 補正量（量子化後 − 入力）をセミトーンで返す |
| `scalePitchClassEnabled(root, modeMask, pitchClass)` | `boolean` | `pitchClass`（0..11）が `root` を基準に有効か |
| `scaleMaskForMode(root, mode)` | `number` | 教会旋法名（`'major'`、`'minor'`、`'dorian'` など）または `Mode` の序数に対応する 12 ビットの `modeMask`。`scaleMaskForMode(0, 'major')` は `0b101010110101` |

### ストリーミング／リアルタイムクラス

一括処理の関数に加えて、ネイティブアドオンは WASM ビルドと同じストリーミング／リアルタイムクラスを公開します。

| クラス | 用途 |
|--------|------|
| `StreamAnalyzer` | ブロック単位の解析。時間とともに更新される BPM/キー推定と `readFramesSoa`／`readFramesI16`／`readFramesU8`。[リアルタイムストリーミング](./realtime-streaming.md) を参照。 |
| `StreamingEqualizer` | リアルタイム安全なブロック EQ。 |
| `StreamingMasteringChain` | ブロックごとに進めるマスタリングレンダリング（[ネイティブバインディング](./native-bindings.md#streamingmasteringchain) で解説）。 |
| `RealtimeVoiceChanger` | プリセット式のライブ音声チェーン。ブロック処理向け。 |
| `Mixer` | JSON シーンから構築する永続マルチストリップミキサー。[ミキシングエンジン](./mixing.md) を参照。 |
| `RealtimeEngine` | DAW 風ホスティング向けのトランスポート／クリップ／オートメーションエンジン。 |

```typescript
import { StreamAnalyzer } from '@libraz/libsonare-native';

const analyzer = new StreamAnalyzer({ sampleRate: 48000, computeMel: true, computeOnset: true });
analyzer.process(block);                 // Float32Array のブロックを渡す
const frames = analyzer.readFramesSoa(analyzer.availableFrames());
const stats = analyzer.stats();          // stats.estimate.key（ピッチクラス。-1 は該当なし）、.keyName（"C major"）、.chordName
```

Node ネイティブでは float の Structure-of-Arrays 読み出しの正式名は `readFramesSoa(...)` です。バインディング間の命名を揃えるためのエイリアス `readFrames(...)` も公開しており、これは WASM パッケージが同じ操作に使う名前と一致します。

Node ネイティブの `RealtimeVoiceChanger` は `{ sampleRate, maxBlockSize, channels, preset }` で構築します。

処理には `processMono(...)`、`processMonoInto(...)`、`processInterleaved(...)`、`processPlanarStereo(...)` を使います。

オフラインで手軽に使う場合は、`voiceChangeRealtime(...)` が同じプリセットチェーンでモノラルバッファ全体を 512 サンプルブロック単位に処理します。

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

| 実行環境 | 違い |
|---------|------|
| WASM | `engineCapabilities()` を追加し、構築前に ABI 互換性を確認します。キャプチャバッファは正規形の `setCaptureBuffer(numChannels, capacityFrames)` で設定します。 |
| Node ネイティブ | パッケージの読み込み時にパックされた ABI を、構築時にエンジンの ABI を確認し（`AbiMismatch`）、`engineAbiVersion()` を公開します。ブラウザ向けの `engineCapabilities()` ヘルパーはありません。キャプチャバッファは WASM と同じ正規形 `setCaptureBuffer(numChannels, capacityFrames)` に加えて、後方互換のために非推奨の `setCaptureBuffer(channels: Float32Array[])` も残しています。 |

`Project.create()` は空のプロジェクトを作成します。`setAssistSidecar(...)` と `assistSidecars()` でモジュール固有の不透明なメタデータを保持でき、`ProjectAutomationTargetKind` と `targetKind` でオートメーションレーンの対象種別を付けられます。`RealtimeEngine.setTrackMonitorMode(laneIndex, mode, renderFrame?)` は `'off'`、`'pfl'`（pre-fader listen＝フェーダー前で試聴）、`'afl'`（after-fader listen＝フェーダー後で試聴）、および対応する数値序数を受け取ります。`renderFrame` を省略すると即時に適用されます。有効なキューは `process()` と `processPrepared()` が単一の出力へ畳み込むため、そこではタップしたレーンが二重に聞こえます。オフラインレンダー、バウンス、ステムバウンス、フリーズはモニターやソロの状態にかかわらずプログラム出力だけを含みます。トラック／ミキサーのパン則セッターは、下記の `PanLawInput` エイリアスを受け取ります。

### 状態を持つオブジェクトの追加メソッド

| オブジェクト | メソッドと契約 |
|--------------|----------------|
| `Project` のテンポと拍子 | `analyzeTempo(audio, sampleRate, options?)` はプロジェクトを変更せず、順位付き候補を返します。設定済みマップは `tempoSegmentByIndex(index)`、`timeSignatureByIndex(index)`、`timeSignatureCount()` で読み取ります。添字は 0 始まりです。 |
| `Project` の楽器付きバウンス | `bounceWithBuiltinInstruments(bindings, options?)`、`bounceWithSynthInstruments(bindings, options?)`、`bounceWithSf2Instruments(bindings, options?)` はデスティネーションごとに楽器を結び付けます。[プロジェクトのバウンス](./project-bounce.md)を参照してください。 |
| `Project` のメタデータ | `assistSidecarCount()` は `assistSidecars()` が返す不透明なサイドカーの件数です。 |
| `RealtimeEngine` のグラフ | `setGraph(spec)` は `EngineGraphSpec` を設定します。`graphNodeCount()` と `graphConnectionCount()` で規模を確認します。 |
| `RealtimeEngine` のキャプチャとページ供給 | `countInEndSample(startSample, bars)` はテンポマップからカウントインの終了サンプルを求めます。`createFileClipPageProvider(path, options)` はファイルからページを供給するプロバイダーを作成します。使用後にプロバイダーを破棄してください。 |
| `RealtimeEngine` のルーティング | `setTrackSends(trackId, sends)` と `setTrackOutputBus(trackId, busId)` は、1 本のレーンのセンドまたは出力バスを置き換えます（`busId` が 0 ならマスターミックス）。トラックは `setTrackLanes` で設定したレーン一覧にあらかじめ含まれている必要があります。`canSetLaneSidechain(trackId, insertIndex, sourceTrackId)`、`canSetBusSidechain(...)`、`canSetMasterSidechain(...)` は、何も変更せずに `SidechainCheck` を返します。 |
| `RealtimeEngine` のオフラインとクリップ | `primeOfflineParameters(numChannels, blockSize)`、`resetProcessorState(renderFrame?)`、`tailSamples()`、`graphLatencySamplesQ8()`（1/256 サンプル単位のレイテンシ）はオフラインレンダリングを支えます。`upsertClip(clip)` と `removeClip(clipId)` はクリップをその場で編集します。 |
| `RealtimeEngine` のオートメーション ID | `resolveTrackLaneAutomationId(trackId, 'faderDb' \| 'pan')` と `resolveBusAutomationId(busId, 'faderDb')` は、オートメーションの対象にする ID を返します。`resolveMasterAutomationId('faderDb' \| 'pan' \| 'width')` はマスターストリップについて同じことを行い、それ以外の名前では `-1` を返します。 |
| `RealtimeEngine` の MIDI | `pushMidiProgram(destinationId, group, channel, program, bankValid?, bankMsb?, bankLsb?, renderFrame?)` はプログラムチェンジをキューに積みます。 |
| `Mixer` のルーティング | `setOutputBus(sourceId, busId)` はソースをバスへルーティングします。`flushMeters()` は保留中の True Peak 区間をメータースナップショットへ反映します。オフラインレンダリングの最後のブロックのあとに呼びます。 |
| `Project` のバウンスとソース | `bounceWithInstruments(instruments, options?)` と `bounceWithInstrument(instrument, options?)` は外部楽器を使ってバウンスします。`unresolvedAudioSources()` は、まだデコード済み PCM が必要な音声ソースの記述子を、`unresolvedAudioSourceIds()` と同じ順序で返します。 |
| `Mixer` の診断 | `stripNonFiniteDiscardCount(strip)` と `busNonFiniteDiscardCount(busId)` は、非有限値を含む再帰 DSP 状態を破棄した処理ブロックの累積数です。バスの読み取りにはコンパイル済みバスが必要です。`vcaGroupCount()` は VCA グループ数を返します。 |
