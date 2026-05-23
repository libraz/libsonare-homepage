# Python API

libsonare はネイティブ C API を **ctypes** 経由で呼び出す Python バインディングを提供し、デスクトップ環境で高速な音声解析を実現します。対応対象の Linux/macOS 向けに PyPI ホイールを配布しています。

## インストール

Python 3.11 以上が必要です（3.11、3.12、3.13）。

```bash
pip install libsonare
```

`sonare` コマンドもあわせてインストールされます。詳しくは [CLI リファレンス](/ja/docs/cli) をご覧ください。

標準の PyPI ホイールは WAV と MP3 をデコードします。読み込まれているビルドが
FFmpeg デコードに対応しているかは `libsonare.has_ffmpeg_support()` で確認できます。
M4A/AAC/FLAC/OGG/Opus を直接読み込みたい場合は、FFmpeg を有効にしてソースから
インストールします。

```bash
SONARE_FFMPEG=1 pip install libsonare --no-binary libsonare
```

FFmpeg 有効ビルドには FFmpeg の開発ライブラリが必要です。macOS では `brew install ffmpeg`、Debian/Ubuntu 系では `libavformat-dev libavcodec-dev libavutil-dev libswresample-dev` をインストールしてください。

### ソースからビルド（上級者向け）

PyPI のホイールが利用できない環境では、ソースからビルドすることもできます。

**要件:**
- Python 3.11 以上
- CMake 3.16 以上
- C++17 対応コンパイラ（対応対象の Linux/macOS では GCC または Clang）
- `SONARE_FFMPEG=1` でビルドする場合は FFmpeg 開発ライブラリ

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

# HPSS（倍音成分／打撃成分の分離）
hpss_result = audio.hpss()
harmonic = audio.harmonic()
percussive = audio.percussive()

# タイムストレッチ / ピッチシフト
stretched = audio.time_stretch(rate=1.5)       # 1.5倍速
shifted = audio.pitch_shift(semitones=2.0)     # 2半音上げ

# ノーマライズと無音トリム
normalized = audio.normalize(target_db=-3.0)
trimmed = audio.trim(threshold_db=-60.0)

# リサンプリング
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

## API リファレンス

### Audio

| メソッド | 説明 |
|---------|------|
| `Audio.from_file(path)` | WAV/MP3 ファイルを読み込み。FFmpeg 有効ビルドでは FFmpeg が対応する形式も読み込めます |
| `Audio.from_buffer(data, sample_rate)` | floatサンプルから作成 |
| `Audio.from_memory(data)` | `from_file` と同じ形式対応で、メモリ上のエンコード済み音声をデコード |
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
| `detect_chords(samples, sample_rate, ...)` | `ChordAnalysisResult` | コードセグメント（テンプレートマッチング） |
| `analyze(samples, sample_rate)` | `AnalysisResult` | フル解析（BPM・キー・コード・セクション・音色 ほか） |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | 上位候補付きの BPM 解析 |
| `analyze_rhythm(samples, sample_rate)` | `RhythmResult` | シンコペーション・グルーヴ・規則性 |
| `analyze_dynamics(samples, sample_rate)` | `DynamicsResult` | ダイナミックレンジ・ラウドネスレンジ・クレストファクター |
| `analyze_timbre(samples, sample_rate)` | `TimbreResult` | ブライトネス・ウォームス・密度・粗さ・複雑さ |
| `version()` | `str` | ライブラリバージョン |
| `has_ffmpeg_support()` | `bool` | 読み込まれたネイティブライブラリが FFmpeg デコードに対応しているか |

すべての関数は `Audio` インスタンスメソッドとしても使えます（例: `audio.detect_bpm()`）。

### エフェクト関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `hpss(samples, sr, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | 倍音成分／打撃成分の分離（HPSS） |
| `harmonic(samples, sr)` | `list[float]` | 倍音成分を抽出 |
| `percussive(samples, sr)` | `list[float]` | 打撃成分を抽出 |
| `time_stretch(samples, sr, rate)` | `list[float]` | ピッチを変えずにテンポ変更 |
| `pitch_shift(samples, sr, semitones)` | `list[float]` | テンポを変えずにピッチ変更 |
| `normalize(samples, sr, target_db?)` | `list[float]` | 目標 dB にノーマライズ（デフォルト: -3.0） |
| `trim(samples, sr, threshold_db?)` | `list[float]` | 無音区間をトリム（デフォルト: -60.0 dB） |
| `resample(samples, src_sr, target_sr)` | `list[float]` | 目標サンプルレートへリサンプリング |

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

### librosa 互換ヘルパー

libsonare 1.1.0 で追加された関数群です。対応する `librosa` 関数の挙動に
合わせています。各ヘルパーが対応する librosa 関数は
[librosa 互換性](./librosa-compatibility.md) を参照してください。

::: tip 各ヘルパーの位置づけ
- **`preemphasis` / `deemphasis`** — 高域を持ち上げる／戻す古典的な 1 タップ IIR の前処理。
- **`trim_silence` / `split_silence`** — 前後無音のトリムや、無音区間での区切り出し。
- **`frame_signal` / `pad_center` / `fix_length` / `fix_frames`** — 固定フレーム DSP に通す前のフレーミング・サイズ揃え。
- **`peak_pick` / `vector_normalize`** — オンセット強度のような 1 次元信号からのピーク検出と、ベクトルのノルム正規化。
- **`pcen`** — メルスペクトログラム向けの動的レンジ圧縮（ノイズ・音量変動に強い特徴量）。
- **`tonnetz`** — クロマグラムを 6 次元のハーモニック空間へ射影。コード関係や転調解析に有効。
- **`tempogram` / `plp`** — オンセット包絡線から構築するテンポ表現と、支配的なパルスの抽出。
:::

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `preemphasis(samples, coef?, zi?)` | `list[float]` | プリエンファシス（librosa.effects.preemphasis）|
| `deemphasis(samples, coef?, zi?)` | `list[float]` | ディエンファシス（librosa.effects.deemphasis）|
| `trim_silence(samples, top_db?, frame_length?, hop_length?)` | `tuple[list[float], int, int]` | `librosa.effects.trim`。`(audio, start_sample, end_sample)` を返す |
| `split_silence(samples, top_db?, frame_length?, hop_length?)` | `list[tuple[int, int]]` | `librosa.effects.split`。非無音区間をサンプル単位で返す |
| `frame_signal(samples, frame_length, hop_length)` | `tuple[int, list[float]]` | `librosa.util.frame`。`(n_frames, row-major フレーム)` を返す |
| `pad_center(values, size, pad_value?)` | `list[float]` | `librosa.util.pad_center` |
| `fix_length(values, size, pad_value?)` | `list[float]` | `librosa.util.fix_length` |
| `fix_frames(frames, x_min?, x_max?, pad?)` | `list[int]` | `librosa.util.fix_frames` |
| `peak_pick(values, pre_max, post_max, pre_avg, post_avg, delta, wait)` | `list[int]` | `librosa.util.peak_pick`。ピーク位置のインデックスを返す |
| `vector_normalize(values, norm_type?, threshold?)` | `list[float]` | `librosa.util.normalize`。`norm_type`: 0=inf, 1=L1, 2=L2, 3=power |
| `pcen(values, n_bins, n_frames, sample_rate?, hop_length?, time_constant?, gain?, bias?, power?, eps?)` | `list[float]` | `librosa.pcen`。入力は row-major の `[n_bins x n_frames]` メル |
| `tonnetz(chromagram, n_chroma, n_frames)` | `list[float]` | `librosa.feature.tonnetz`。row-major の `[6 x n_frames]` を返す |
| `tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?)` | `tuple[int, list[float]]` | `librosa.feature.tempogram`（自己相関ベース）|
| `plp(onset_envelope, sample_rate?, hop_length?, tempo_min?, tempo_max?, win_length?)` | `list[float]` | `librosa.beat.plp`。Predominant Local Pulse |

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
| `frames_to_samples(frames, hop_length?, n_fft?)` | フレームインデックス → サンプルインデックス（librosa.frames_to_samples）|
| `samples_to_frames(samples, hop_length?, n_fft?)` | サンプルインデックス → フレームインデックス（librosa.samples_to_frames）|
| `power_to_db(values, ref?, amin?, top_db?)` | パワー → dB（librosa.power_to_db）|
| `amplitude_to_db(values, ref?, amin?, top_db?)` | 振幅 → dB（librosa.amplitude_to_db）|
| `db_to_power(values, ref?)` | dB → パワー |
| `db_to_amplitude(values, ref?)` | dB → 振幅 |

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
    name: str          # "C major"、"A minor" など
    short_name: str    # "C"、"Am" など

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
    beats: list[Beat]              # 各拍の強度
    chords: list[Chord]            # コードセグメント
    sections: list[Section]        # イントロ / Aメロ / サビ など
    timbre: TimbreResult
    dynamics: DynamicsResult
    rhythm: RhythmResult
    form: str                      # 例: "IABABCO"

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

## マスタリング API

Python からもブラウザデモと同じ名前付きマスタリングプロセッサを利用できます。まず一覧取得用のヘルパー関数で、現在のビルドに含まれるプロセッサ名を確認したうえで、モノラル／ステレオ／ペア／解析の各 API をパラメータ明示で呼び出します。

```python
import json
import libsonare as sonare

print(sonare.mastering_processor_names())
# 例: ['dynamics.compressor', 'eq.parametric', 'spectral.airBand', 'stereo.imager', ...]

result = sonare.mastering_process(
    "spectral.airBand",
    samples,
    sample_rate=sample_rate,
    params={
        "amount": 0.4,
        "shelfFrequencyHz": 14000,
    },
)

report = sonare.mastering_stereo_analyze(
    "stereo.monoCompatCheck",
    left,
    right,
    sample_rate=sample_rate,
)
print(json.loads(report))

# プリセット駆動のチェーン（一括処理）
sonare.mastering_preset_names()
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech']
chain_result = sonare.master_audio(
    samples,
    sample_rate=sample_rate,
    preset="aiMusic",
    overrides={"loudness.targetLufs": -13},
)
print(chain_result.output_lufs, chain_result.applied_gain_db)

# ブロック単位のストリーミング処理
with sonare.StreamingMasteringChain({
    "eq.tilt.tiltDb": 0.5,
    "dynamics.compressor.thresholdDb": -20.0,
}) as chain:
    chain.prepare(sample_rate=48000, max_block_size=512, num_channels=1)
    out_block = chain.process_mono([0.0] * 512)
```

リファレンストラックを使う処理では `mastering_pair_processor_names()`、`mastering_pair_process()`、`mastering_pair_analysis_names()`、`mastering_pair_analyze()` を使います。ペア入力はサンプルレートを揃え、長さもなるべく近づけてください。

### 進捗コールバック

`mastering_chain()`、`mastering_chain_stereo()`、`master_audio()`、
`master_audio_stereo()` はオプションの `on_progress=callable` キーワードを
受け取り、各ステージ完了時に `(progress: float, stage: str)` で呼び出します。
`progress` は `0.0`〜`1.0`、`stage` は完了した名前付きプロセッサ
（`eq.tilt`、`dynamics.compressor`、`loudness.targetLufs` など）です。
UI の進捗バー表示や、ステージごとの所要時間ロギングに利用できます。

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.mastering_chain(
    samples,
    sample_rate=sample_rate,
    config={"loudness": {"targetLufs": -14, "ceilingDb": -1}},
    on_progress=on_step,
)
```

マスタリング API は次の系統に分かれます。

| 目的 | 関数 |
|------|------|
| シンプルなラウドネスマスタリング | `mastering()` |
| 組み込みプリセット一覧 | `mastering_preset_names()` |
| プリセットをモノラルに適用 | `master_audio()` |
| プリセットをステレオに適用 | `master_audio_stereo()` |
| フルチェーン実行（モノラル） | `mastering_chain()` |
| フルチェーン実行（ステレオ） | `mastering_chain_stereo()` |
| ブロック単位のストリーミング | `StreamingMasteringChain` |
| 名前付きプロセッサ一覧（モノラル／ステレオ） | `mastering_processor_names()` |
| モノラルプロセッサを単体で実行 | `mastering_process()` |
| ステレオプロセッサを単体で実行 | `mastering_process_stereo()` |
| ペアプロセッサ一覧 | `mastering_pair_processor_names()` |
| ソース／リファレンスのペア処理 | `mastering_pair_process()` |
| ペア解析の一覧 | `mastering_pair_analysis_names()` |
| ソース／リファレンスのペア解析 | `mastering_pair_analyze()` |
| ステレオ解析の一覧 | `mastering_stereo_analysis_names()` |
| ステレオチャンネル解析 | `mastering_stereo_analyze()` |

関連するマスタリングガイド: [プリセット選択](./glossary/mastering/preset-selection.md)、[配信ターゲット](./glossary/mastering/delivery-targets.md)、[メーターの読み方](./glossary/mastering/meter-reading.md)、[品質チェックリスト](./glossary/mastering/quality-checklist.md)。
