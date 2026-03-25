# ネイティブバインディング

libsonareは**Python**と**Node.js**向けのネイティブバインディングを提供し、デスクトップ環境で高速な音声解析を実現します。

## Python

### インストール

PyPI からインストールできます（推奨）。ビルド済みホイールが Linux (x86_64, aarch64) と macOS (Apple Silicon) に対応しています。

```bash
pip install libsonare
```

`sonare` コマンドもあわせてインストールされます。詳しくは [CLI リファレンス](/ja/docs/cli) をご覧ください。

### ソースからビルド（上級者向け）

PyPI のホイールが利用できない環境では、ソースからビルドすることも可能です。

**要件:**
- Python 3.11以上
- CMake 3.16以上
- C++17対応コンパイラ（GCC 9+、Clang 10+、MSVC 2019+）

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED=ON
cmake --build build -j

cd bindings/python
pip install -e .
```

### 使用例

```python
from libsonare import Audio, analyze, detect_bpm, detect_key, detect_beats

# ファイルから音声を読み込み
audio = Audio.from_file("music.mp3")

# 個別の解析
bpm = detect_bpm(audio.data, audio.sample_rate)
key = detect_key(audio.data, audio.sample_rate)
beats = detect_beats(audio.data, audio.sample_rate)

# フル解析
result = analyze(audio.data, audio.sample_rate)
print(f"BPM: {result.bpm} ({result.bpm_confidence:.0%})")
print(f"キー: {result.key}")
print(f"拍子: {result.time_signature}")
print(f"ビート数: {len(result.beat_times)}")
```

### APIリファレンス

#### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.from_file(path)` | WAV/MP3ファイルを読み込み |
| `Audio.from_buffer(data, sample_rate)` | floatサンプルから作成 |
| `Audio.from_memory(data)` | バイナリWAV/MP3をデコード |
| `audio.data` | 生のfloatサンプル |
| `audio.sample_rate` | サンプルレート（Hz） |
| `audio.duration` | 長さ（秒） |
| `audio.length` | サンプル数 |

#### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detect_bpm(samples, sample_rate)` | `float` | テンポ（BPM） |
| `detect_key(samples, sample_rate)` | `Key` | ルート、モード、確信度 |
| `detect_beats(samples, sample_rate)` | `list[float]` | ビート位置（秒） |
| `detect_onsets(samples, sample_rate)` | `list[float]` | オンセット位置（秒） |
| `analyze(samples, sample_rate)` | `AnalysisResult` | フル解析 |
| `version()` | `str` | ライブラリバージョン |

#### 型定義

```python
class PitchClass(IntEnum):
    C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B

class Mode(IntEnum):
    MAJOR = 0
    MINOR = 1

@dataclass(frozen=True)
class Key:
    root: PitchClass
    mode: Mode
    confidence: float

@dataclass(frozen=True)
class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
```

---

## Node.js（N-API）

Node.jsバインディングは**N-API**を使用したネイティブアドオンで、WebAssemblyのオーバーヘッドなしにC++の性能を直接活用できます。

### 要件

- Node.js 22以上
- CMake 3.16以上
- C++17対応コンパイラ
- Yarn 4以上

### インストール

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
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

// メモリ解放
audio.destroy();
```

### APIリファレンス

#### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.fromFile(path)` | WAV/MP3ファイルを読み込み |
| `Audio.fromBuffer(samples, sampleRate?)` | `Float32Array`から作成 |
| `Audio.fromMemory(data)` | `Buffer` / `Uint8Array`をデコード |
| `audio.getData()` | サンプルの`Float32Array` |
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

デフォルトの`sampleRate`は`22050`です。

#### 型定義

```typescript
interface Key {
  root: string;        // "C", "C#", "D", ...
  mode: string;        // "major" | "minor"
  confidence: number;
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
}
```

---

## 比較

| | WebAssembly | Python | Node.js（N-API） |
|---|---|---|---|
| **プラットフォーム** | ブラウザ | デスクトップ | デスクトップ |
| **配布** | npm | PyPI / ソース | ソース |
| **ビルド** | Emscripten | CMake + pip | CMake + cmake-js |
| **パフォーマンス** | ネイティブに近い | ネイティブ | ネイティブ |
| **ストリーミング** | 対応 | 非対応 | 非対応 |
| **ファイルI/O** | 非対応 | 対応 | 対応 |
