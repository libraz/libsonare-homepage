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
| プロジェクト | `AssistSidecar`（`project.get_assist_sidecar(index)` / `project.assist_sidecars()` の戻り値 — [プロジェクト編集](./project-editing-midi.md#アシストサイドカー) を参照）、`NotePairValidation` |
| リアルタイムエンジンのジョブ／テレメトリ | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `MeterTelemetryRecord`, `MeterTelemetryRecordWide`, `ScopeTelemetryRecord` |
| ビルド情報 | `Capabilities`, `CapabilityCatalog`, `CapabilityCatalogPresets`, `MasteringPresetCatalogEntry`, `MasteringInsertParamInfo`, `MasteringInsertSlot`, `MasteringInsertTiming`, `MasteringProcessorCatalogEntry`（[API サーフェス](./api-surface.md#機能カタログが返すもの) で説明している JSON ドキュメントに対応する `TypedDict`） |

`CapabilityCatalog["masteringPresets"]` は `name`、`kind`、`targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` を持つ `MasteringPresetCatalogEntry` を返します。修復プリセットでは 3 つの数値フィールドが `None` です。`MasteringProcessorCatalogEntry` の `slots` は条件付きキー群を列挙します。`MasteringInsertParamInfo` の記述子は `id`、`rtSafe`、`type`、`min`、`max`、`default`、`unit`、`choices`、`slot` を持ち、`MasteringInsertTiming` は指定したインサート構成の `latencySamples` と `tailSamples` を持ちます。

### 例外

失敗はすべて 2 つのクラスで表します。後者は前者を継承しているので、2 本ではなく 1 本の階層です。

```python
class SonareError(RuntimeError):
    code: int          # C ABI のエラーコード（ErrorCode の値）
    code_name: str     # プロパティ -> "InvalidParameter"、"FileNotFound" など
    # str(e) -> "[4] Invalid parameter": メッセージの先頭にコードが付く

class SonareValueError(SonareError, ValueError):
    code: int          # 送出側が別のコードを渡さないかぎり ErrorCode.INVALID_PARAMETER
    # str(e) -> "spectral_centroid: samples contains NaN or Inf at index 0": 接頭辞なし
```

`SonareValueError` は、呼び出しがネイティブコードへ渡る前にバインディングが引数を拒否したときに送出されます。基底クラスの組み合わせが、既存のハンドラに何が見えるかを決めます。

| ハンドラ | バインディングの拒否（`SonareValueError`） | コアの拒否（`SonareError`、コード 4） |
|---------|---|---|
| `except ValueError` | 捕捉する | 捕捉しない |
| `except SonareError` または `except RuntimeError` | 捕捉する | 捕捉する |
| `except SonareValueError` | 捕捉する | 捕捉しない |
| `.code == ErrorCode.INVALID_PARAMETER` で分岐 | 一致する | 一致する |

インスタンスが持つのはメッセージだけです。問題のパラメータ名を持つ属性も、受理範囲を持つ属性もありません。構造化されたフィールドは `.code` のみで、どの拒否でも `INVALID_PARAMETER` を返します。パラメータ名と、あるなら範囲は本文に含まれます。バッファの拒否はエントリポイントと引数を名指しし（`master_audio_stereo: right must not be empty`）、スカラーの拒否はフィールド名と C 型が表現できる区間を示します（`sample_rate must be an integer within [-2147483648, 2147483647]`）。名前が必要なコードは `str(e)` から読み取るしかありません。文言と、文言でのマッチが壊れやすい理由は [Python API](./python-api.md#エラーハンドリング) を参照してください。

#### 検証層はどこで止まるか

バインディングの検証は 2 層で、それぞれの形を知っていれば、呼び出し側で `SonareValueError` が出たときに何が除外できたかが分かります。

**サンプルバッファは 169 の公開エントリポイントで事前検査されます。** 126 は共通の事前検査ガードを通り、43 は同じ検査を本体に直接書いています。検査対象のバッファは連続した 1 次元 `float32` 配列へ変換され、空なら拒否され、NaN と Inf を走査されます。走査を省くのは、エントリポイントが `validate` を公開していて呼び出しが `validate=False` を渡したときだけです（空チェックは省かれません）。ノート系関数に渡す F0 トラックは形だけを検査します。pYIN は無声フレームを `nan` で表すからです。この集合は手で管理せず導出しています。バインディングのテストが、先頭パラメータにバッファの型注釈を持つ公開関数をすべて列挙し、ガードのないものがあれば失敗します。

**スカラーは関数ごとではなく、変換の時点で絞り込まれます。** バインディングの ctypes 読み取りや設定構造体のフィールドを通る整数・浮動小数は、C 型が値を黙って変えてしまう場合に拒否されます。数値を期待する箇所への `bool`、ラップする整数（`c_int` のサンプルレートに渡した `2**32 + 8000`）、`c_float` で飽和する倍精度値、NaN や無限大がそれです。メッセージにはフィールド名と区間が入ります。検査が変換の位置にあるため、その値を渡すエントリポイントすべてに効き、関数ごとの数を管理する必要がありません。

**5 つのエントリポイントは、答えを返さず拒否します。** 拒否は「検査して続行する」とは別の契約です。以下は、定義済みの空の結果を返す代わりに入力をそのまま拒否するものです。`trim_silence`、`split_silence`、`fix_frames` は空のバッファで送出します。`tempogram_ratio` は空の行列と、有限の正数でない `factors` の要素で送出します。`mix_stereo` はストリップがすべて空か、非有限のサンプルを含むシーンで送出します。それぞれの理由は [受け付けなくなった入力](./python-api.md#受け付けなくなった入力) にあります。

この層が **しない** ことは次の通りです。

- **値の意味を判断すること。** 絞り込みは数値が表現可能かを確かめるだけで、プロセッサが受け入れるかは見ません。`dynamics.compressor` の `ratio=0.5` はコアまで届き、`SonareError` コード 4 とメッセージ `compressor ratio must be at least 1` で返ってきます。`effects.modulation.chorus` の `dryWet=5` のようにプロセッサ側がクランプする値は、何も言われずに受理されます。一部のエントリポイントは Python 側でドメイン規則も検査します。古典的リペア関数の `n_fft` が 2 の冪であること、`hpss` のカーネルが奇数であること、`time_stretch` と `pitch_shift` の FFT ジオメトリがそれで、メッセージの読み方は同じです。それ以外の値の意味は、コアが判断します。
- **`params` 辞書を読むこと。** `mastering_process`、チェーン、インサートに渡すパラメータ辞書は、そのまま直列化されます。未知のキーはプロセッサに無視され、非有限の値はバインディングではなくコアが拒否します（`mastering parameters must be finite and representable`）。呼び出し側で拒否したいなら、事前に [機能カタログ](./api-surface.md#機能カタログが返すもの) と照合してください。
- **免除対象を事前検査すること。** 空のバッファが定義済みの結果になるエントリポイント（要素ごとの変換、パディング補助、テンポグラム系）は空を受け取って空を返します。一覧は [検査されないもの](./python-api.md#検査されないもの) にあります。
- **CLI 自身の引数を扱うこと。** コマンドラインの使い方の誤りは通常の `ValueError` です。API の引数ではなくコマンドの誤りを報告するものだからです。
