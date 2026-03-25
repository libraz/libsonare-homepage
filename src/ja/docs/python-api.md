# Python API

libsonareは**cffi**を使用したPythonバインディングを提供し、デスクトップ環境で高速な音声解析を実現します。ビルド済みホイールが PyPI で Linux (x86_64, aarch64) と macOS (Apple Silicon) に対応しています。

## インストール

Python 3.11 以上が必要です（3.11、3.12、3.13）。

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

## クイックスタート

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

## オーディオエフェクト

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# Harmonic-Percussive Source Separation
hpss_result = audio.hpss()
harmonic = audio.harmonic()
percussive = audio.percussive()

# タイムストレッチ / ピッチシフト
stretched = audio.time_stretch(rate=1.5)       # 1.5倍速
shifted = audio.pitch_shift(semitones=2.0)     # 2半音上げ

# ノーマライズと無音トリミング
normalized = audio.normalize(target_db=-3.0)
trimmed = audio.trim(threshold_db=-60.0)

# リサンプル
resampled = audio.resample(target_sr=44100)
```

## 特徴抽出

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# スペクトログラム特徴
stft_result = audio.stft(n_fft=2048, hop_length=512)
mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
mfcc = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=20)
chroma = audio.chroma(n_fft=2048, hop_length=512)

# スペクトル特徴
centroid = audio.spectral_centroid()
bandwidth = audio.spectral_bandwidth()
rolloff = audio.spectral_rolloff(roll_percent=0.85)
flatness = audio.spectral_flatness()
zcr = audio.zero_crossing_rate()
rms = audio.rms_energy()

# ピッチ検出
pitch_yin = audio.pitch_yin(fmin=65.0, fmax=2093.0)
pitch_pyin = audio.pitch_pyin(fmin=65.0, fmax=2093.0)
print(f"中央値 F0: {pitch_pyin.median_f0:.1f} Hz")
```

## 単位変換

```python
from libsonare import hz_to_mel, mel_to_hz, hz_to_midi, midi_to_hz
from libsonare import hz_to_note, note_to_hz, frames_to_time, time_to_frames

hz_to_mel(440.0)       # → Melスケール値
mel_to_hz(549.64)      # → Hz
hz_to_midi(440.0)      # → 69.0
midi_to_hz(69.0)       # → 440.0
hz_to_note(440.0)      # → "A4"
note_to_hz("A4")       # → 440.0

frames_to_time(100, sr=22050, hop_length=512)  # → 秒
time_to_frames(2.32, sr=22050, hop_length=512) # → フレームインデックス
```

## APIリファレンス

### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.from_file(path)` | WAV/MP3ファイルを読み込み |
| `Audio.from_buffer(data, sample_rate)` | floatサンプルから作成 |
| `Audio.from_memory(data)` | バイナリWAV/MP3をデコード |
| `audio.data` | 生のfloatサンプル |
| `audio.sample_rate` | サンプルレート（Hz） |
| `audio.duration` | 長さ（秒） |
| `audio.length` | サンプル数 |
| `audio.close()` | ネイティブメモリを解放 |

コンテキストマネージャによる自動クリーンアップに対応:

```python
with Audio.from_file("music.mp3") as audio:
    result = audio.analyze()
```

### 解析関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `detect_bpm(samples, sample_rate)` | `float` | テンポ（BPM） |
| `detect_key(samples, sample_rate)` | `Key` | ルート、モード、確信度 |
| `detect_beats(samples, sample_rate)` | `list[float]` | ビート位置（秒） |
| `detect_onsets(samples, sample_rate)` | `list[float]` | オンセット位置（秒） |
| `analyze(samples, sample_rate)` | `AnalysisResult` | フル解析 |
| `version()` | `str` | ライブラリバージョン |

すべての関数は `Audio` インスタンスメソッドとしても利用可能です（例: `audio.detect_bpm()`）。

### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `harmonic(samples, sr)` | `list[float]` | 調和成分を抽出 |
| `percussive(samples, sr)` | `list[float]` | 打楽器成分を抽出 |
| `time_stretch(samples, sr, rate)` | `list[float]` | ピッチを変えずにテンポ変更 |
| `pitch_shift(samples, sr, semitones)` | `list[float]` | テンポを変えずにピッチ変更 |
| `normalize(samples, sr, target_db?)` | `list[float]` | 目標dBにノーマライズ（デフォルト: -3.0） |
| `trim(samples, sr, threshold_db?)` | `list[float]` | 無音をトリミング（デフォルト: -60.0 dB） |
| `resample(samples, src_sr, target_sr)` | `list[float]` | 目標サンプルレートにリサンプル |

### 特徴抽出関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `stft(samples, sr, n_fft?, hop_length?)` | `StftResult` | 短時間フーリエ変換 |
| `stft_db(samples, sr, n_fft?, hop_length?)` | `tuple` | デシベル単位のSTFT |
| `mel_spectrogram(samples, sr, n_fft?, hop_length?, n_mels?)` | `MelSpectrogramResult` | メルスペクトログラム |
| `mfcc(samples, sr, n_fft?, hop_length?, n_mels?, n_mfcc?)` | `MfccResult` | メル周波数ケプストラム係数 |
| `chroma(samples, sr, n_fft?, hop_length?)` | `ChromaResult` | クロマ特徴（ピッチクラス分布） |
| `spectral_centroid(samples, sr, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル重心 |
| `spectral_bandwidth(samples, sr, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル帯域幅 |
| `spectral_rolloff(samples, sr, n_fft?, hop_length?, roll_percent?)` | `list[float]` | フレームごとのスペクトルロールオフ |
| `spectral_flatness(samples, sr, n_fft?, hop_length?)` | `list[float]` | フレームごとのスペクトル平坦度 |
| `zero_crossing_rate(samples, sr, frame_length?, hop_length?)` | `list[float]` | フレームごとのゼロ交差率 |
| `rms_energy(samples, sr, frame_length?, hop_length?)` | `list[float]` | フレームごとのRMSエネルギー |
| `pitch_yin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | YINピッチ推定 |
| `pitch_pyin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | pYINピッチ推定 |

デフォルトパラメータ: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`。

### 変換関数

| 関数 | 説明 |
|------|------|
| `hz_to_mel(hz)` | ヘルツ → Melスケール |
| `mel_to_hz(mel)` | Melスケール → ヘルツ |
| `hz_to_midi(hz)` | ヘルツ → MIDIノート番号 |
| `midi_to_hz(midi)` | MIDIノート番号 → ヘルツ |
| `hz_to_note(hz)` | ヘルツ → 音名（例: "A4"） |
| `note_to_hz(note)` | 音名 → ヘルツ |
| `frames_to_time(frames, sr, hop_length)` | フレームインデックス → 秒 |
| `time_to_frames(time, sr, hop_length)` | 秒 → フレームインデックス |

### 型定義

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
class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

@dataclass(frozen=True)
class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]

@dataclass(frozen=True)
class HpssResult:
    harmonic: list[float]
    percussive: list[float]
    length: int
    sample_rate: int

@dataclass(frozen=True)
class StftResult:
    n_bins: int
    n_frames: int
    n_fft: int
    hop_length: int
    sample_rate: int
    magnitude: list[float]   # n_bins × n_frames, row-major
    power: list[float]       # n_bins × n_frames, row-major

@dataclass(frozen=True)
class MelSpectrogramResult:
    n_mels: int
    n_frames: int
    sample_rate: int
    hop_length: int
    power: list[float]       # n_mels × n_frames, row-major
    db: list[float]          # n_mels × n_frames, row-major

@dataclass(frozen=True)
class MfccResult:
    n_mfcc: int
    n_frames: int
    coefficients: list[float]  # n_mfcc × n_frames, row-major

@dataclass(frozen=True)
class ChromaResult:
    n_chroma: int
    n_frames: int
    sample_rate: int
    hop_length: int
    features: list[float]    # n_chroma × n_frames, row-major
    mean_energy: list[float] # n_chroma values

@dataclass(frozen=True)
class PitchResult:
    n_frames: int
    f0: list[float]          # フレームごとの基本周波数（Hz）
    voiced_prob: list[float] # フレームごとの有声確率（0–1）
    voiced_flag: list[bool]  # フレームごとの有声/無声判定
    median_f0: float
    mean_f0: float
```
