# ネイティブバインディング

libsonare はデスクトップ環境向けのネイティブバインディングを提供しています。各言語の詳細は個別の API ページを参照してください。

- **[Python API](/ja/docs/python-api)** — ctypes ベースのバインディング、PyPI でホイールを配布
- **Node.js（N-API）** — C++ の性能を直接活用するネイティブアドオン（以下に記載）

## 比較

| | WebAssembly | Python | Node.js（N-API） |
|---|---|---|---|
| **プラットフォーム** | ブラウザ | デスクトップ | デスクトップ |
| **配布** | npm (`@libraz/libsonare`) | PyPI (`pip install libsonare`) | ソース (`bindings/node`) |
| **ビルド** | Emscripten | ビルド済みホイール（または CMake + pip） | CMake + cmake-js |
| **パフォーマンス** | ネイティブに近い | ネイティブ | ネイティブ |
| **ストリーミング** | 対応 | 非対応 | 非対応 |
| **ファイル I/O** | 非対応。デコード済みサンプルを渡す | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 | 標準は WAV/MP3。FFmpeg 有効ビルドでは FFmpeg 対応形式 |
| **エフェクト** | 対応 | 対応 | 対応 |
| **特徴抽出** | 対応 | 対応 | 対応 |
| **単位変換** | 対応 | 対応 | 対応 |

---

## Node.js（N-API）

Node.js バインディングは **N-API** を使用したネイティブアドオンで、WebAssembly のオーバーヘッドなしに C++ の性能を直接活用できます。

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
  init,
  masterAudioStereo,
  masteringChainStereo,
  masteringChainStereoWithProgress,
  masteringPresetNames,
  masteringPairAnalyze,
  masteringProcessorNames,
} from '@libraz/libsonare'

await init()

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

const masteredWithProgress = masteringChainStereoWithProgress(left, right, sampleRate, {
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
}, (progress, stage) => {
  console.log(`render ${(progress * 100).toFixed(0)}%: ${stage}`)
})
console.log(masteredWithProgress.outputLufs)
```

長尺のオフラインレンダリングでは `masteringChainWithProgress()` あるいは `masteringChainStereoWithProgress()` を使い、進捗コールバックから Node やブラウザの UI を更新します。

WASM パッケージは、ブラウザデモと同じ camelCase の関数群を公開しています。具体的には `mastering()`、`masteringPresetNames()`、`masterAudio()`、`masterAudioStereo()`、`masteringChain()`、`masteringChainStereo()`、`masteringChainWithProgress()`、`masteringChainStereoWithProgress()`、`masteringProcessorNames()`、`masteringProcess()`、`masteringProcessStereo()`、`masteringPairProcessorNames()`、`masteringPairProcess()`、`masteringPairAnalysisNames()`、`masteringPairAnalyze()`、`masteringStereoAnalysisNames()`、`masteringStereoAnalyze()`、およびブロック単位でレンダリングする `StreamingMasteringChain` クラスです。

### StreamingMasteringChain

ネイティブアドオン（および WASM パッケージ）は、ブロック単位でレンダリングする
`StreamingMasteringChain` クラスも公開しています。Electron アプリや
ワーカー、音声入力パイプラインなどから、`masteringChain()` と同じ
ネスト構造の設定を使ってブロックごとに処理を進められます。

```typescript
import { StreamingMasteringChain } from '@libraz/libsonare-native';

const chain = new StreamingMasteringChain({
  eq: { tiltDb: 0.5 },
  dynamics: { compressor: { thresholdDb: -20 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames(), chain.latencySamples());
chain.reset();   // 状態だけクリア（prepare し直さない）
```

`numChannels === 1` のときはステレオ専用ステージはスキップされます。
WASM ビルドは追加で `chain.delete()` を公開しておりハンドルを解放できます。
ネイティブアドオンは GC で自動的に解放します。

関連するマスタリングガイド: [ブラウザ内ローカル処理](./glossary/concepts/browser-local-processing.md)、[リファレンスマッチ](./glossary/mastering/reference-match.md)、[品質チェックリスト](./glossary/mastering/quality-checklist.md)。

`@libraz/libsonare-native` は現在、ソースツリー内の `bindings/node` でビルドして使う前提です。別プロジェクトから使う場合は、ビルド済みのローカルパッケージをワークスペースや `file:` 依存として参照してください。

ネイティブビルドは `pkg-config` で FFmpeg 開発ライブラリを自動検出します。
FFmpeg がない場合は WAV/MP3 のみをデコードします。明示的に指定する場合は次の環境変数を使います。

```bash
SONARE_FFMPEG=1 yarn build  # FFmpeg デコードを必須にする
SONARE_FFMPEG=0 yarn build  # WAV/MP3 のみに固定する
```

### 使用例

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

### API リファレンス

#### Audio

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

#### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detectBpm(samples, sampleRate?)` | `number` | テンポ（BPM） |
| `detectKey(samples, sampleRate?)` | `Key` | ルート、モード、確信度 |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | ビート位置 |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | オンセット位置 |
| `detectChords(samples, sampleRate?, minDuration?, smoothingWindow?, threshold?, useTriadsOnly?, nFft?, hopLength?, useBeatSync?)` | `ChordAnalysisResult` | コード進行（開始／終了時刻付き） |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | フル解析（BPM／キー／ビート／コード／セクション／音色／ダイナミクス／リズム／構成） |
| `analyzeBpm(samples, sampleRate?, bpmMin?, bpmMax?, startBpm?, nFft?, hopLength?, maxCandidates?)` | `BpmAnalysisResult` | 確信度と候補付きテンポ |
| `analyzeRhythm(samples, sampleRate?, bpmMin?, bpmMax?, startBpm?, nFft?, hopLength?)` | `RhythmResult` | 拍子・グルーブ・シンコペーション |
| `analyzeDynamics(samples, sampleRate?, windowSec?, hopLength?, compressionThreshold?)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター |
| `analyzeTimbre(samples, sampleRate?, nFft?, hopLength?, nMels?, nMfcc?, windowSec?)` | `TimbreResult` | 明るさ・暖かさ・密度・粗さ・複雑さ |
| `version()` | `string` | ライブラリバージョン |
| `hasFfmpegSupport()` | `boolean` | 読み込まれたネイティブアドオンが FFmpeg デコードに対応しているか |

デフォルトの `sampleRate` は `22050` です。すべての関数は `Audio` インスタンスメソッドとしても利用できます。

#### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS） |
| `harmonic(samples, sr?)` | `Float32Array` | 倍音成分の抽出 |
| `percussive(samples, sr?)` | `Float32Array` | 打撃成分の抽出 |
| `timeStretch(samples, sr?, rate)` | `Float32Array` | ピッチを変えずにテンポを変更 |
| `pitchShift(samples, sr?, semitones)` | `Float32Array` | 長さを変えずにピッチを変更 |
| `normalize(samples, sr?, targetDb?)` | `Float32Array` | 目標 dB にノーマライズ（デフォルト: 0.0） |
| `trim(samples, sr?, thresholdDb?)` | `Float32Array` | 無音区間をトリム（デフォルト: -60.0 dB） |
| `resample(samples, srcSr, targetSr)` | `Float32Array` | 目標サンプルレートへリサンプリング |

#### librosa 互換ヘルパー

libsonare 1.1.0 で追加された関数群です。対応する `librosa` 関数の挙動に
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
| `trimSilence(samples, topDb?, frameLength?, hopLength?)` | `{ audio: Float32Array; startSample: number; endSample: number }` | `librosa.effects.trim` |
| `splitSilence(samples, topDb?, frameLength?, hopLength?)` | `Int32Array` | `librosa.effects.split`。`[start0, end0, start1, end1, ...]` のフラット配列 |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame`（row-major） |
| `padCenter(values, size, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, size, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`。`normType`: 0=inf, 1=L1, 2=L2, 3=power |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen`（row-major のメル入力） |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz`（`[6 x nFrames]`） |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

#### 変換関数

| 関数 | 説明 |
|------|------|
| `hzToMel(hz)` | ヘルツ → Mel スケール |
| `melToHz(mel)` | Mel スケール → ヘルツ |
| `hzToMidi(hz)` | ヘルツ → MIDI ノート番号 |
| `midiToHz(midi)` | MIDI ノート番号 → ヘルツ |
| `hzToNote(hz)` | ヘルツ → 音名（例: "A4"） |
| `noteToHz(note)` | 音名 → ヘルツ |
| `framesToTime(frames, sr, hopLength)` | フレームインデックス → 秒 |
| `timeToFrames(time, sr, hopLength)` | 秒 → フレームインデックス |
| `framesToSamples(frames, hopLength?, nFft?)` | フレームインデックス → サンプルインデックス（`librosa.frames_to_samples`） |
| `samplesToFrames(samples, hopLength?, nFft?)` | サンプルインデックス → フレームインデックス（`librosa.samples_to_frames`） |
| `powerToDb(values, ref?, amin?, topDb?)` | パワー → dB（`librosa.power_to_db`） |
| `amplitudeToDb(values, ref?, amin?, topDb?)` | 振幅 → dB（`librosa.amplitude_to_db`） |
| `dbToPower(values, ref?)` | dB → パワー |
| `dbToAmplitude(values, ref?)` | dB → 振幅 |

#### 型定義

```typescript
interface Key {
  root: number;        // PitchClass: 0=C, 1=C#, ..., 11=B
  mode: number;        // Mode: 0=Major, 1=Minor
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
  beatTimes: Float32Array;
  beats: Array<{ time: number; strength: number }>;
  chords: Chord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  form: string;  // 例: "IABABCO"
}
```
