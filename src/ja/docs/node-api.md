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

### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.fromFile(path)` | WAV/MP3 ファイルを読み込み。FFmpeg 有効ビルドでは FFmpeg 対応形式も読み込めます |
| `Audio.fromBuffer(samples, sampleRate?)` | `Float32Array` から作成 |
| `Audio.fromMemory(data)` | `fromFile` と同じ形式対応で、`Buffer` / `Uint8Array` をデコード |
| `audio.getData()` | サンプルの `Float32Array` |
| `audio.getSampleRate()` | サンプルレート（Hz） |
| `audio.getDuration()` | 長さ（秒） |
| `audio.getLength()` | サンプル数 |
| `audio.destroy()` | ネイティブハンドルを解放。GC でも回収されますが、長時間動くプロセスで確実に解放したい場合に呼び出します |

`Audio` インスタンスは、以下の解析・エフェクト・特徴量関数を同じデフォルト値で
メソッドとしても呼び出せます（例: `audio.detectBpm()`、`audio.masteringChain(config)`）。

`analyzeSections(...)`、`analyzeMelody(...)`、`cqt(...)`、`vqt(...)` などの一部の詳細ヘルパーは
スタンドアロン関数のままです。これらには `audio.getData()` と `audio.getSampleRate()` を渡します。

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
`using` を使えます。一方、ストリーミング／解析クラスの `StreamingMasteringChain`、
`StreamingEqualizer`、`StreamAnalyzer` は `destroy()` も `[Symbol.dispose]` も公開しておらず、
ネイティブ状態は GC のファイナライズで回収されるため、決定的に解放することはできません。

### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detectBpm(samples, sampleRate?)` | `number` | テンポ（BPM） |
| `detectKey(samples, sampleRate?)` | `Key` | ルート、モード、確信度 |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | ビート位置 |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | オンセット位置 |
| `detectChords(samples, sampleRate?, minDuration?, smoothingWindow?, threshold?, useTriadsOnly?, nFft?, hopLength?, useBeatSync?, useHmm?, hmmBeamWidth?, useKeyContext?, keyRoot?, keyMode?, detectInversions?, chromaMethod?)` | `ChordAnalysisResult` | コード進行（開始／終了時刻付き）。末尾の引数で HMM 平滑化・キーコンテキスト・転回形・クロマ手法（既定 `'stft'`）を制御 |
| `detectDownbeats(samples, sampleRate?)` | `Float32Array` | 小節頭（ダウンビート）の位置 |
| `detectKeyCandidates(samples, sampleRate?, options?)` | `KeyCandidate[]` | 相関スコア付きのキー候補ランキング |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | 1 回の呼び出しでフル解析: `bpm`、`bpmConfidence`、`key`、`timeSignature`、`beatTimes`、`beats` に加えて `chords`、`sections`、`timbre`、`dynamics`、`rhythm`、`melody`、`form`。以下の専用 `detect*`／`analyze*` 関数は、個別解析やパラメータ指定の解析向けに引き続き利用できます |
| `analyzeWithProgress(samples, sampleRate?, onProgress?)` | `AnalysisResult` | `analyze` と同じ。長尺入力向けに `(progress, stage)` コールバックを受け取ります |
| `analyzeBpm(samples, sampleRate?, options?)` | `BpmAnalysisResult` | 確信度と候補付きテンポ。`options`: `bpmMin`、`bpmMax`、`startBpm`、`nFft`、`hopLength`、`maxCandidates` |
| `analyzeRhythm(samples, sampleRate?, options?)` | `RhythmResult` | 拍子・グルーブ・シンコペーション。`options`: `bpmMin`、`bpmMax`、`startBpm`、`nFft`、`hopLength` |
| `analyzeDynamics(samples, sampleRate?, options?)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター。`options`: `windowSec`、`hopLength`、`compressionThreshold` |
| `analyzeTimbre(samples, sampleRate?, options?)` | `TimbreResult` | 明るさ・暖かさ・密度・粗さ・複雑さと、窓ごとの `timbreOverTime`。`options`: `nFft`、`hopLength`、`nMels`、`nMfcc`、`windowSec` |
| `analyzeSections(samples, sampleRate?, options?)` | `Section[]` | 構造セクション（イントロ／ヴァース／コーラスなど）と時刻。`options`: `nFft`、`hopLength`、`minSectionSec`。長尺入力では境界グリッドがプーリングされる場合があるため、配置には各セクションの `start` / `end` を使います |
| `analyzeMelody(samples, sampleRate?, options?)` | `MelodyResult` | 主旋律の輪郭（フレームごとの F0）。`options`: `fmin`、`fmax`、`frameLength`、`hopLength`、`threshold`、`usePyin`、`center` |
| `detectAcoustic(samples, sampleRate?, options?)` | `AcousticResult` | 録音からの室内音響（RT60 など）。`options`: `nOctaveBands`、`nThirdOctaveSubbands`、`minDecayDb`、`noiseFloorMarginDb` |
| `analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?)` | `AcousticResult` | 測定済みインパルス応答からの室内音響 |
| `estimateRoom(samples, sampleRate?, options?)` | `RoomEstimateResult` | 体積、寸法、DRR、吸音率バンド、RT60 バンド、信頼度を含む等価ルーム推定 |
| `synthesizeRir(options?)` | `RirResult` | シューボックス形状からのモノラル RIR |
| `roomMorph(samples, sampleRate, options?)` | `Float32Array` | 目標ルームへ寄せるオフラインのルームモーフィング |
| `lufs(samples, sampleRate?)` | `LufsResult` | 統合・モーメンタリー・ショートタームラウドネスとラウドネスレンジ（ITU-R BS.1770） |
| `lufsInterleaved(samples, channels, sampleRate?)` | `LufsResult` | インターリーブサンプルからチャンネル重み付きマルチチャンネルラウドネスを測定 |
| `ebur128LoudnessRange(samples, sampleRate?)` | `number` | EBU R128 loudness range（LRA、LU 単位） |
| `momentaryLufs(samples, sampleRate?)` | `Float32Array` | モーメンタリーラウドネス（400ms）の時系列 |
| `shortTermLufs(samples, sampleRate?)` | `Float32Array` | ショートタームラウドネス（3s）の時系列 |
| `version()` | `string` | ライブラリバージョン |
| `voiceChangerAbiVersion()` | `number` | リアルタイムボイスチェンジャー POD 設定の ABI バージョン。プリセット JSON の `schemaVersion` とは別 |
| `voiceCharacterPresetId(preset)` | `VoicePresetId \| null` | 序数または ID から正規の voice-character プリセット ID を返す |
| `realtimeVoiceChangerPresetConfig(preset)` | `RealtimeVoiceChangerConfig` | JSON 解析なしで、組み込みボイスプリセットの解決済みフラット POD 設定を返す。未知のプリセット名や範囲外の序数では例外を投げる |
| `hasFfmpegSupport()` | `boolean` | 読み込まれたネイティブアドオンが FFmpeg デコードに対応しているか |

デフォルトの `sampleRate` は、ヘルパーの種類によって異なります。

| ヘルパー | デフォルト `sampleRate` |
|----------|-------------------------|
| 楽曲解析、エフェクト、特徴量、ラウドネス系ヘルパー | `22050` |
| ネイティブ版の `analyzeImpulseResponse`、`detectAcoustic`、`estimateRoom`、`synthesizeRir` | `48000` |

主要なヘルパーは `Audio` インスタンスメソッドとしても利用できます。ただし、`analyzeSections(...)`、`analyzeMelody(...)`、`cqt(...)`、`vqt(...)` など一部の詳細ヘルパーは、スタンドアロン関数として `audio.getData()` と `audio.getSampleRate()` を渡します。

下の表は Node ネイティブ版のシグネチャです。WASM パッケージも同じ camelCase 名を使いますが、`sampleRate` の後ろに必須引数がある関数では、その `sampleRate` 位置も渡す必要があります。ブラウザ向けの正確なシグネチャは [JavaScript API](./js-api.md) を参照してください。

#### 非同期版（Node 専用）

Node アドオンは、Promise 返却版も公開しています。これらは DSP パイプラインを libuv のワーカースレッドで実行するため、JS イベントループをブロックしません。

戻り値の形は同期版と同じです。ただし Node ネイティブ専用で、WASM ビルドにワーカースレッド相当はありません。

非同期版では進捗コールバックを使えません。進捗が必要な場合は `onProgress` 付きの同期版を使います。並行実行だけが目的なら、複数の非同期呼び出しを同時に走らせます。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `analyzeAsync(samples, sampleRate?)` | `Promise<AnalysisResult>` | `analyze(...)` の非同期版 |
| `masterAudioAsync(samples, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainResult>` | `masterAudio(...)` の非同期版 |
| `masterAudioStereoAsync(left, right, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainStereoResult>` | `masterAudioStereo(...)` の非同期版 |

### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS） |
| `hpssWithResidual(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssWithResidualResult` | 倍音、打撃、残差を返す HPSS |
| `harmonic(samples, sr?)` | `Float32Array` | 倍音成分の抽出 |
| `percussive(samples, sr?)` | `Float32Array` | 打撃成分の抽出 |
| `timeStretch(samples, sampleRate, rate)` | `Float32Array` | ピッチを変えずにテンポを変更 |
| `phaseVocoder(samples, rate, sr?, nFft?, hopLength?)` | `Float32Array` | 直接のフェーズボコーダー時間伸縮 |
| `pitchShift(samples, sampleRate, semitones)` | `Float32Array` | 長さを変えずにピッチを変更 |
| `remix(samples, intervals, sr?, alignZeros?)` | `Float32Array` | サンプル区間の並べ替え／連結 |
| `normalize(samples, sr?, targetDb?)` | `Float32Array` | 目標 dB にノーマライズ（デフォルト: 0.0） |
| `trim(samples, sr?, thresholdDb?)` | `Float32Array` | 無音区間をトリム（デフォルト: -60.0 dB） |
| `resample(samples, srcSr, targetSr)` | `Float32Array` | 目標サンプルレートへリサンプリング |
| `pitchCorrectToMidi(samples, sr, currentMidi, targetMidi)` | `Float32Array` | 保持された音を MIDI ピッチ間で補正 |
| `noteStretch(samples, sr?, options?)` | `Float32Array` | 1 つの音の区間をその場でタイムストレッチ。`options` は `{ onsetSample, offsetSample, stretchRatio }` |
| `voiceChange(samples, sr?, options?)` | `Float32Array` | ボイス変換のためのピッチ＋フォルマントシフト。`options` は `{ pitchSemitones, formantFactor }` |

`trim(...)` は単純なしきい値ベースの編集ヘルパーです。下の `trimSilence(...)` は
librosa 互換のフレーム RMS ベースのヘルパーで、元音源上のサンプル範囲も返します。

`hpss(...)` と `hpssWithResidual(...)` は、メディアンフィルタのカーネルを既定で
`kernelHarmonic=31`、`kernelPercussive=31` とします。

### 特徴抽出関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `stft(samples, sr?, nFft?, hopLength?)` | `StftResult` | 短時間フーリエ変換 |
| `stftDb(samples, sr?, nFft?, hopLength?)` | `StftDbResult` | dB 単位の STFT |
| `melSpectrogram(samples, sr?, nFft?, hopLength?, nMels?)` | `MelSpectrogramResult` | メルスペクトログラム |
| `mfcc(samples, sr?, nFft?, hopLength?, nMels?, nMfcc?, fmin?, fmax?, htk?, lifter?)` | `MfccResult` | メル周波数ケプストラム係数（`lifter` 既定 0 = リフタリングなし） |
| `chroma(samples, sr?, nFft?, hopLength?)` | `ChromaResult` | クロマ特徴量 |
| `spectralCentroid(samples, sr?, nFft?, hopLength?)` | `Float32Array` | フレームごとのスペクトル重心 |
| `spectralBandwidth(samples, sr?, nFft?, hopLength?)` | `Float32Array` | フレームごとのスペクトル帯域幅 |
| `spectralRolloff(samples, sr?, nFft?, hopLength?, rollPercent?)` | `Float32Array` | フレームごとのスペクトルロールオフ |
| `spectralFlatness(samples, sr?, nFft?, hopLength?)` | `Float32Array` | フレームごとのスペクトル平坦度 |
| `spectralContrast(samples, sr?, nFft?, hopLength?, nBands?, fmin?, quantile?)` | `Matrix2dResult` | スペクトルコントラスト。形状は `(nBands + 1) x nFrames` |
| `spectralEdit(samples, sr, ops?, options?)` | `Float32Array` | `gain`、`attenuate`、`mute`、`heal` を使う領域指定 STFT 編集 |
| `polyFeatures(samples, sr?, nFft?, hopLength?, order?)` | `Matrix2dResult` | フレームごとの多項式スペクトル係数 |
| `zeroCrossingRate(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | フレームごとのゼロ交差率 |
| `zeroCrossings(samples, threshold?, refMagnitude?, pad?, zeroPos?)` | `Int32Array` | ゼロ交差サンプル位置 |
| `rmsEnergy(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | フレームごとの RMS エネルギー |
| `pitchYin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | YIN ピッチ推定。無声音の `f0` は `fillNa` が true でない限り `NaN` |
| `pitchPyin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | pYIN ピッチ推定。無声音の `f0` は `fillNa` が true でない限り `NaN` |
| `pitchTuning(frequencies, resolution?, binsPerOctave?)` | `number` | 周波数列からチューニングずれを推定 |
| `estimateTuning(samples, sr?, nFft?, hopLength?, resolution?, binsPerOctave?)` | `number` | 音声からチューニングずれを推定 |
| `cqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | 定 Q 変換の振幅 |
| `vqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?, gamma?)` | `CqtResult` | 可変 Q 変換の振幅（`gamma` で Q を制御） |
| `chromaCqt(samples, sr?, hopLength?, nChroma?)` | `{ nChroma, nFrames, data }` | Constant-Q クロマグラム（`librosa.feature.chroma_cqt` 相当） |
| `nnlsChroma(samples, sr?)` | `{ nChroma, nFrames, data }` | NNLS クロマグラム（音符活性化クロマ） |
| `decompose(s, nFeatures, nFrames, nComponents, nIter?, beta?)` | `DecomposeResult` | 行優先スペクトログラムから NMF 分解行列を返す |
| `hybridCqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | ハイブリッド CQT 振幅（低域は真の CQT、高域は擬似 CQT） |
| `pseudoCqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | 近似（擬似）CQT 振幅（単一 FFT） |
| `bassChroma(samples, sr?, hopLength?, nChroma?)` | `ChromaResult` | 低域重視クロマ（低音域のピッチクラス分布） |
| `chromaCens(samples, sr?, hopLength?, nChroma?)` | `ChromaResult` | CENS エネルギー正規化・平滑化クロマ |
| `onsetStrengthMulti(samples, sr?, nFft?, hopLength?, nMels?, nBands?)` | `{ nBands, nFrames, data }` | マルチバンドオンセット強度（`nBands` 既定 3、`data` は行優先 `[nBands x nFrames]`） |
| `decomposeWithInit(s, nFeatures, nFrames, nComponents, nIter?, beta?, init?)` | `DecomposeResult` | `init` を選択できる NMF 分解行列（`'random'` 既定、`'nndsvd'`） |
| `nnFilter(s, nFeatures, nFrames, aggregate?, k?, width?)` | `Matrix2dResult` | 近傍フィルタ |
| `onsetEnvelope(samples, sr?, nFft?, hopLength?, nMels?)` | `Float32Array` | オンセット強度包絡（テンポグラム系の入力） |

デフォルトパラメータ: `nFft=2048`、`hopLength=512`、`nMels=128`、`nMfcc=20`、ピッチ検出の `fmin=65.0`、`fmax=2093.0`、`threshold=0.3`、`rollPercent=0.85`。CQT/VQT は `fmin=32.70319566` Hz（C1）、`nBins=84`、`binsPerOctave=12` を使います。`chromaCqt`／`bassChroma`／`chromaCens` は `nChroma=12`、`chromaCqt` は `hopLength=512`、`onsetStrengthMulti` は `nBands=3`、`decomposeWithInit` は `nIter=50`・`beta=2`・`init='random'` が既定です。

### 逆再構成関数

メルスペクトログラムや MFCC 行列から、スペクトルや音声を再構成します。位相は Griffin-Lim で推定するため往復はロスを伴います。詳細は [逆変換特徴量](./inverse-features.md) を参照してください。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `melToStft(mel, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `InverseStftResult` | メルスペクトログラムから線形 STFT パワーへ |
| `melToAudio(mel, nMels, nFrames, sr?, nFft?, hopLength?, nIter?, fmin?, fmax?)` | `Float32Array` | メルスペクトログラムから音声へ（Griffin-Lim） |
| `mfccToMel(mfcc, nMfcc, nFrames, nMels?)` | `InverseMelResult` | MFCC 係数からメルスペクトログラムへ |
| `mfccToAudio(mfcc, nMfcc, nFrames, nMels?, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | MFCC 係数から音声へ |

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
| `cyclicTempogram(onsetEnvelope, sr, hopLength?, winLength?, bpmMin?, nBins?)` | `{ nFrames: number; nBins: number; data: Float32Array }` | 巡回（テンポオクターブ不変）テンポグラム |
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

レベル・ダイナミクス・ステレオイメージを測る単体メーターです。各関数は `validate` フラグ(既定 `true`)を持つ `options` を任意で受け取ります。ホットパスでは `{ validate: false }` を渡して NaN/Inf 入力チェックを省略できます。ステレオメーターは `left` と `right` が同じ長さである必要があります。

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `meteringPeakDb(samples, sr?, options?)` | `number` | サンプルピーク(dBFS) |
| `meteringRmsDb(samples, sr?, options?)` | `number` | RMS レベル(dBFS) |
| `meteringCrestFactorDb(samples, sr?, options?)` | `number` | クレストファクター、ピーク − RMS(dB) |
| `meteringDcOffset(samples, sr?, options?)` | `number` | 平均(DC)オフセット、リニア振幅 |
| `meteringTruePeakDb(samples, sr?, oversampleFactor?, options?)` | `number` | インターサンプル(トゥルー)ピーク(dBFS)。`oversampleFactor` は 1..16 の 2 の冪(既定 4) |
| `meteringDetectClipping(samples, sr?, options?)` | `ClippingReport` | クリップしたサンプルの連続区間。`options` で `threshold`(既定 `0.999`)と `minRegionSamples`(既定 `1`)を指定 |
| `meteringDynamicRange(samples, sr?, options?)` | `DynamicRangeReport` | スライディングウィンドウのダイナミックレンジ。`options` で `windowSec`・`hopSec`・`lowPercentile`・`highPercentile` を指定(省略時は既定値の窓 3 秒・ホップ 1 秒・low 0.10・high 0.95) |
| `meteringStereoCorrelation(left, right, sr?, options?)` | `number` | ピアソン相関、−1..1 |
| `meteringStereoWidth(left, right, sr?, options?)` | `number` | ミッド/サイドのステレオ幅 |
| `meteringVectorscope(left, right, sr?, options?)` | `VectorscopeReport` | サンプルごとのミッド/サイド点列 |
| `meteringPhaseScope(left, right, sr?, options?)` | `PhaseScopeReport` | フェーズスコープの点列と要約統計 |
| `meteringSpectrum(samples, sr?, options?)` | `SpectrumReport` | 単一フレームの振幅/パワー/dB スペクトラム。`options` で `nFft`・`applyOctaveSmoothing`・`octaveFraction`・`dbRef`・`dbAmin` を指定 |

### スケール量子化

ピッチ補正ターゲットを構築するための 12-TET スケールヘルパーです。

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

Node ネイティブでは float の Structure-of-Arrays 読み出し名は `readFramesSoa(...)` です。WASM パッケージは、ブラウザ向け例で同じ操作を `readFrames(...)` として公開しています。

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
| WASM | `engineCapabilities()` を追加し、構築前に ABI 互換性を確認します。キャプチャバッファは `setCaptureBuffer(numChannels, capacityFrames)` で設定します。 |
| Node ネイティブ | `engineAbiVersion()` を公開します。ブラウザ向けの機能確認ヘルパーはありません。キャプチャバッファは、事前確保したチャンネルバッファを `setCaptureBuffer(channels)` として渡します。 |

### 型定義

```typescript
interface Key {
  root: string;        // ピッチクラス名。例: "C"、"C#"、"A"
  mode: string;        // モード名。例: "major"、"minor"
  confidence: number;
  name: string;        // "C major"、"A minor" など
  shortName: string;   // "C"、"Am" など
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  key: Key;
  timeSignature: TimeSignature;
  beatTimes: Float32Array;                       // beats[].time から導出
  beats: Array<{ time: number; strength: number }>;
  chords: AnalysisChord[];                       // 検出したコード進行
  sections: AnalysisSection[];                   // 楽曲構造セクション
  timbre: AnalysisTimbre;                        // 音色の集約サマリー
  dynamics: AnalysisDynamics;                    // ダイナミクスの集約サマリー
  rhythm: AnalysisRhythm;                        // リズムの集約サマリー
  melody: AnalysisMelody;                        // 旋律輪郭のサマリー
  form: string;                                  // 楽曲形式ラベル。例: "AABA"
}
// analyze() は上記のフル結果を返します。専用の detect*／analyze* 関数は、
// 個別解析やパラメータ指定の解析向けに引き続き利用できます。

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;  // nBins × nFrames, row-major
  power: Float32Array;      // nBins × nFrames, row-major
}

interface StftDbResult {
  nBins: number;
  nFrames: number;
  db: Float32Array;         // dB 単位のパワー
}

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  power: Float32Array;      // nMels × nFrames, row-major
  db: Float32Array;         // nMels × nFrames, row-major
}

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  coefficients: Float32Array;  // nMfcc × nFrames, row-major
}

interface ChromaResult {
  nChroma: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;   // nChroma × nFrames, row-major
  meanEnergy: number[];     // nChroma 個の値
}

interface PitchResult {
  f0: Float32Array;         // フレームごとの基本周波数（Hz）
  voicedProb: Float32Array; // フレームごとの有声確率（0–1）
  voicedFlag: boolean[];    // フレームごとの有声／無声判定
  nFrames: number;
  medianF0: number;
  meanF0: number;
}
```

ネイティブパッケージは、オプション、コールバック、ストリーミングスナップショット、リアルタイムエンジンメッセージ用の TypeScript 補助型もエクスポートしています。アプリ側で同じ構造を再定義せず、これらの型名を使ってください。

| 分野 | エクスポートされる型 |
|------|----------------|
| 解析オプション／結果 | `AnalysisProgressCallback`, `BpmCandidate`, `ChordChromaMethod`, `KeyMode`, `KeyProfile`, `MelodyPoint`, `SectionTypeOrdinal`, `TempogramMode`, `TrimSilenceMode` |
| ストリーミング解析 | `StreamAnalyzerConfig`, `StreamAnalyzerStats`, `StreamFramesSoa`, `StreamProgressiveEstimate`, `StreamChordChange`, `StreamBarChord`, `StreamPatternScore` |
| マスタリングとメータリング | `MasteringPreset`, `SoloProcessor`, `StreamingPlatform`, `DynamicsProcessorResult`, `CompressorDetector`, `DecrackleMode`, `DenoiseClassicalMode`, `DenoiseClassicalNoiseEstimator`, `EqBandInput`, `EqPhaseMode`, `EqSpectrumSnapshot` |
| ミキシング | `AutomationCurve`, `GoniometerPoint`, `MeterTap`, `MixMeterSnapshot`, `MixResult`, `MixerProcessResult`, `PanLaw`, `PanMode`, `SendTiming` |
| リアルタイム音声 | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerConfig`, `RealtimeVoiceChangerOptions` |
| リアルタイムエンジングラフ | `EngineGraphSpec`, `EngineGraphNode`, `EngineGraphNodeType`, `EngineGraphConnection`, `EngineGraphMix`, `EngineGraphParameterBinding`, `EngineParameterInfo` |
| リアルタイムエンジントランスポート | `EngineTransportState`, `EngineMarker`, `EngineClip`, `EngineAutomationPoint`, `EngineAutomationPointCurve`, `EngineMetronomeConfig` |
| リアルタイムエンジンのジョブ／テレメトリ | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `EngineMeterTelemetry` |
