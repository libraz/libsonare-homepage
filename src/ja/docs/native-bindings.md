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
console.log(`キー: ${result.key.root} ${result.key.mode}`);
console.log(`ビート数: ${result.beatTimes.length}`);

// TTS 向けユーティリティ
const quality = audio.analyzeTtsQuality();
const prepared = audio.prepareTts();
const compressed = audio.compressPauses(0.6);

// メモリ解放
audio.destroy();
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
| `audio.destroy()` | ネイティブメモリを解放 |

#### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detectBpm(samples, sampleRate?)` | `number` | テンポ（BPM） |
| `detectKey(samples, sampleRate?)` | `Key` | ルート、モード、確信度 |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | ビート位置 |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | オンセット位置 |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | フル解析 |
| `version()` | `string` | ライブラリバージョン |
| `hasFfmpegSupport()` | `boolean` | 読み込まれたネイティブアドオンが FFmpeg デコードに対応しているか |

デフォルトの `sampleRate` は `22050` です。すべての関数は `Audio` インスタンスメソッドとしても利用できます。

#### エフェクト / TTS 関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `timeStretch(samples, sr?, rate)` | `Float32Array` | ピッチを変えずに時間伸縮 |
| `pitchShift(samples, sr?, semitones)` | `Float32Array` | 長さを変えずにピッチ変更 |
| `normalize(samples, sr?, targetDb?)` | `Float32Array` | 目標 dB にノーマライズ |
| `trim(samples, sr?, thresholdDb?)` | `Float32Array` | 無音をトリミング |
| `analyzeTtsQuality(samples, sr?, silenceThresholdDb?)` | `TtsQualityResult` | TTS 音声の客観的な性質を測定 |
| `prepareTts(samples, sr?, targetRmsDb?, silenceThresholdDb?, peakLimitDb?, fadeSec?)` | `Float32Array` | TTS 音声を無音トリム、RMS ノーマライズ、ピークリミットし、短いフェードを付与 |
| `compressPauses(samples, sr?, maxPauseSec?, silenceThresholdDb?)` | `Float32Array` | 長い低レベル無音を短縮 |

#### 型定義

```typescript
interface Key {
  root: string;        // "C", "C#", "D", ...
  mode: string;        // "major" | "minor"
  confidence: number;
  name: string;        // "C major", "A minor"
  shortName: string;   // "C", "Am"
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
  beats: Array<{ time: number; strength: undefined }>;
}
```
