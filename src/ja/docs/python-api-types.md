---
title: Python 型定義
description: libsonare Python パッケージの結果型と設定型のリファレンスです。属性名、行列の形状、JS 互換の別名を掲載します。
---

# Python 型定義

libsonare Python パッケージの結果型と設定型のリファレンスです。これらを返す関数は [Python API](./python-api.md) の索引ページと、その姉妹ページを参照してください。

## 型定義

結果オブジェクトは属性アクセスできる通常のクラスです。多くは JS との対応の
ため camelCase のプロパティ別名（例: `bpm_confidence` / `bpmConfidence`）も
公開します。以下はデータフィールドの形です。

::: tip 行優先（row-major）の行列レイアウト
このページで「row-major」と記した平坦化フィールドは、`[rows x n]` の行列を行ごとに並べたものです。先頭の `n` 個が 0 行目、次の `n` 個が 1 行目…と続きます。行数で reshape すると 2 次元の NumPy 配列に戻せます。

```python
import numpy as np
mat = np.asarray(flat).reshape(rows, n)   # 例: 12 ピッチクラスのクロマグラムなら reshape(12, n_frames)
```
:::

```python
class PitchClass(IntEnum):
    C, CS, D, DS, E, F, FS, G, GS, A, AS, B

class Mode(IntEnum):
    MAJOR = 0
    MINOR = 1
    DORIAN = 2
    PHRYGIAN = 3
    LYDIAN = 4
    MIXOLYDIAN = 5
    LOCRIAN = 6

class KeyProfile(IntEnum):
    KRUMHANSL_SCHMUCKLER = 0
    TEMPERLEY = 1
    SHAATH = 2
    FARALDO_EDMT = 3
    FARALDO_EDMA = 4
    FARALDO_EDMM = 5
    BELLMAN_BUDGE = 6

class Key:
    root: PitchClass
    mode: Mode
    confidence: float  # スコアリングされた候補全体のソフトマックス配分。[0, 1)
    name: str          # プロパティ -> "C major"、"A minor" など
    short_name: str    # プロパティ -> "C"、"Am" など

class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

class BpmHypothesis:
    value: float
    confidence: float
    relation: Literal["primary", "half", "double", "other"]

class Chord:
    root: PitchClass
    quality: str             # "major"、"minor"、"diminished"、"augmented"、
                             #   "dominant7"、"major7"、"minor7"、"sus2"、"sus4"、
                             #   "add9"、"minorAdd9"、"dim7"、"halfDim7"、
                             #   "major9"、"dominant9"、"sus2Add4"、
                             #   "major6"、"minor6"、"minorMajor7"、
                             #   "dominant7Sus4"、"dominant11"、"dominant13"、
                             #   "dominant7Flat9"、"dominant7Sharp9"、"unknown"
    start: float             # セグメント開始（秒）
    end: float               # セグメント終了（秒）
    confidence: float
    bass: PitchClass | None  # スラッシュコードのベース音。root と同じなら None
    name: str                # プロパティ -> "Cmaj7"、"Am"、"G/B"
    duration: float          # プロパティ -> end - start

class ChordAnalysisResult:
    chords: list[Chord]      # detect_chords(...) の戻り値の型

class AnalysisBeatObservations:
    onset_strength: list[float]        # 拍ごとの、窓処理済みアクセント値
    low_frequency_energy: list[float]
    chord_change: list[float]

class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
    beat_strengths: list[float]    # 拍ごとの、生で上限のないオンセットエンベロープ 1 フレーム
    downbeat_indices: list[int]    # beat_times のうち小節頭にあたる位置
    downbeat_phase: int            # 解析が第 1 小節の何拍目から始まるか
    beat_local_bpm: list[float]    # beat_times と平行。compute_tempo_curve=True
                                   #   でないかぎり空
    bpm_candidates: list[BpmHypothesis]
    time_signature_candidates: list[TimeSignature]
    beats: list[Beat]              # プロパティ: 各拍の強度を持つオブジェクト
                                   #   (Beat はパッケージ直下ではなく libsonare.types にある)
    chords: list[Chord]
    sections: list[Section]
    timbre: AnalysisTimbre | None
    dynamics: AnalysisDynamics | None
    rhythm: AnalysisRhythm | None
    melody: AnalysisMelody | None
    beat_observations: AnalysisBeatObservations | None
    form: str
    # 専用の detect_chords() / analyze_sections() / analyze_timbre() / ... は、
    # 1 つの側面だけ、または呼び出しごとのオプション指定に使えます。

class MeterEstimate:
    time_signature: TimeSignature
    downbeat_phase: int
    searched: bool                 # False = 系列が短すぎてスコアリングできなかった
    grouping: list[int]            # アクセントグループ（例 [3, 2, 2]）。合計は分子
    candidate_scores: list[float]  # 指定した分子の並びと平行
    candidates: list[TimeSignature]  # 支持度の降順

class NormalizeStereoResult:
    left: list[float]
    right: list[float]
    length: int
    applied_gain_db: float         # 両チャンネルに適用された単一のゲイン

class HpssResult:
    harmonic: list[float]
    percussive: list[float]
    length: int
    sample_rate: int

class StftResult:
    n_bins: int
    n_frames: int
    n_fft: int
    hop_length: int
    sample_rate: int
    magnitude: list[float]   # n_bins × n_frames, row-major
    power: list[float]       # n_bins × n_frames, row-major

class MelSpectrogramResult:
    n_mels: int
    n_frames: int
    sample_rate: int
    hop_length: int
    power: list[float]       # n_mels × n_frames, row-major
    db: list[float]          # n_mels × n_frames, row-major

class MfccResult:
    n_mfcc: int
    n_frames: int
    coefficients: list[float]  # n_mfcc × n_frames, row-major

class ChromaResult:
    n_chroma: int
    n_frames: int
    sample_rate: int
    hop_length: int
    features: list[float]    # n_chroma × n_frames, row-major
    mean_energy: list[float] # n_chroma values

class PitchResult:
    n_frames: int
    f0: list[float]          # フレームごとの基本周波数（Hz）
    voiced_prob: list[float] # フレームごとの有声確率（0–1）
    voiced_flag: list[bool]  # フレームごとの有声/無声判定
    median_f0: float
    mean_f0: float

class WaveformPeaksReport:
    min: NDArray[np.float32]   # チャンネルメジャー: channel * bucket_count + bucket
    max: NDArray[np.float32]   # チャンネルメジャー
    channels: int
    bucket_count: int
    samples_per_bucket: int

class StreamConfig:
    sample_rate: int = 44100
    n_fft: int = 2048
    hop_length: int = 512
    n_mels: int = 128
    fmin: float = 0.0
    fmax: float = 0.0
    tuning_ref_hz: float = 440.0
    compute_magnitude: bool = False
    compute_mel: bool = True
    compute_chroma: bool = True
    compute_onset: bool = True
    compute_spectral: bool = True
    emit_every_n_frames: int = 1
    magnitude_downsample: int = 1
    max_pending_frames: int = 4096  # 上限到達時は新たに生成されたフレームを破棄
    max_progression_entries: int = 4096  # 進行データそれぞれの保持上限
    key_update_interval_sec: float = 5.0
    bpm_update_interval_sec: float = 10.0
    window: int = 0          # 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
    output_format: int = 0  # レガシー。省略するか Float32 の値（0）を維持

class StreamFrames:
    n_frames: int
    n_mels: int
    n_chroma: int             # クロマがあれば 12、なければ 0
    feature_flags: int        # MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
    timestamps: list[float]
    mel: list[float]        # n_frames × n_mels。MEL がなければ空
    chroma: list[float]     # n_frames × n_chroma。CHROMA がなければ空
    onset_strength: list[float]  # ONSET がなければ空
    rms_energy: list[float]
    spectral_centroid: list[float]  # SPECTRAL がなければ空
    spectral_flatness: list[float]  # SPECTRAL がなければ空
    chord_root: list[int]            # CHROMA がなければ空
    chord_quality: list[int]         # CHROMA がなければ空
    chord_confidence: list[float]    # CHROMA がなければ空

class StreamChordChange:
    root: int
    quality: int
    start_time: float
    confidence: float

class StreamBarChord:
    bar_index: int
    root: int
    quality: int
    start_time: float
    confidence: float

class StreamPatternScore:
    name: str
    score: float

class StreamStats:
    total_frames: int
    total_samples: int
    duration_seconds: float
    pending_frames: int
    dropped_output_frames: int
    dropped_chord_progression_entries: int
    dropped_bar_progression_entries: int
    bpm: float
    bpm_confidence: float
    bpm_candidate_count: int
    key: int
    key_minor: bool
    key_confidence: float
    chord_root: int
    chord_quality: int
    chord_confidence: float
    chord_start_time: float
    current_bar: int
    bar_duration: float
    chord_progression: list[StreamChordChange]
    bar_chord_progression: list[StreamBarChord]
    voted_pattern: list[StreamBarChord]
    pattern_length: int
    detected_pattern_name: str
    detected_pattern_score: float
    all_pattern_scores: list[StreamPatternScore]
    accumulated_seconds: float
    used_frames: int
    updated: bool
```

個別 API が返す追加の Python result class:

| 分野 | クラス |
|------|--------|
| メータリング | `ClippingRegion`, `StreamFramesU8`, `StreamFramesI16`, `WaveformPeaksReport` |
| マスタリング | `MasteringResult`, `MasteringStereoResult` |
| ミキシング | `MixerStereoResult` |
| プロジェクト | `AssistSidecar`（`project.get_assist_sidecar(index)` / `project.assist_sidecars()` の戻り値 — [プロジェクト編集](./project-editing.md#アシストサイドカー) を参照）、`NotePairValidation` |
| リアルタイムエンジンのジョブ／テレメトリ | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `MeterTelemetryRecord`, `MeterTelemetryRecordWide`, `ScopeTelemetryRecord` |
