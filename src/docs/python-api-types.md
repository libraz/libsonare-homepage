---
title: Python Types
description: Result and option types of the libsonare Python package, with attribute names, matrix shapes, and JS parity aliases.
---

# Python Types

Result and option types of the libsonare Python package; the functions that return them are on the [Python API](./python-api.md) index and its sibling pages.

## Types

Result objects are plain classes with attribute access; many also expose
camelCase property aliases (e.g. `bpm_confidence` / `bpmConfidence`) for
JS-parity. Shapes below show the data fields.

::: tip Row-major matrix layout
Flattened matrix fields (marked "row-major" throughout this page) store a `[rows x n]` matrix one row after another: the first `n` values are row 0, the next `n` are row 1, and so on. Reshape the flat list by the row count to recover a 2-D NumPy array:

```python
import numpy as np
mat = np.asarray(flat).reshape(rows, n)   # e.g. reshape(12, n_frames) for a 12-pitch-class chromagram
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
    confidence: float  # softmax share over the scored candidates, in [0, 1)
    name: str          # property -> "C major", "A minor"
    short_name: str    # property -> "C", "Am"

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
    quality: str             # "major", "minor", "diminished", "augmented",
                             #   "dominant7", "major7", "minor7", "sus2", "sus4",
                             #   "add9", "minorAdd9", "dim7", "halfDim7",
                             #   "major9", "dominant9", "sus2Add4",
                             #   "major6", "minor6", "minorMajor7",
                             #   "dominant7Sus4", "dominant11", "dominant13",
                             #   "dominant7Flat9", "dominant7Sharp9", "unknown"
    start: float             # segment start (seconds)
    end: float               # segment end (seconds)
    confidence: float
    bass: PitchClass | None  # slash-chord bass, or None when it equals root
    name: str                # property -> "Cmaj7", "Am", "G/B"
    duration: float          # property -> end - start

class ChordAnalysisResult:
    chords: list[Chord]      # return type of detect_chords(...)

class AnalysisBeatObservations:
    onset_strength: list[float]        # windowed accent value, one per beat
    low_frequency_energy: list[float]
    chord_change: list[float]

class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
    beat_strengths: list[float]    # one raw, unbounded onset-envelope frame per beat
    downbeat_indices: list[int]    # positions within beat_times that are bar starts
    downbeat_phase: int            # which beat of the first bar the analysis starts on
    beat_local_bpm: list[float]    # parallel to beat_times; empty unless
                                   #   compute_tempo_curve=True
    bpm_candidates: list[BpmHypothesis]
    time_signature_candidates: list[TimeSignature]
    beats: list[Beat]              # property: per-beat objects with strength
                                   #   (Beat lives in libsonare.types, not the package root)
    chords: list[Chord]
    sections: list[Section]
    timbre: AnalysisTimbre | None
    dynamics: AnalysisDynamics | None
    rhythm: AnalysisRhythm | None
    melody: AnalysisMelody | None
    beat_observations: AnalysisBeatObservations | None
    form: str
    # The focused detect_chords() / analyze_sections() / analyze_timbre() / ...
    # functions remain useful for a single facet or per-call options.

class MeterEstimate:
    time_signature: TimeSignature
    downbeat_phase: int
    searched: bool                 # False = the series was too short to score
    grouping: list[int]            # accent groups, e.g. [3, 2, 2]; sums to numerator
    candidate_scores: list[float]  # parallel to the numerators you requested
    candidates: list[TimeSignature]  # ordered by descending support

class NormalizeStereoResult:
    left: list[float]
    right: list[float]
    length: int
    applied_gain_db: float         # one gain, applied to both channels

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
    f0: list[float]          # Fundamental frequency per frame (Hz)
    voiced_prob: list[float] # Voicing probability per frame (0–1)
    voiced_flag: list[bool]  # Voiced/unvoiced decision per frame
    median_f0: float
    mean_f0: float

class WaveformPeaksReport:
    min: NDArray[np.float32]   # channel-major: channel * bucket_count + bucket
    max: NDArray[np.float32]   # channel-major
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
    max_pending_frames: int = 4096  # newly produced frames are dropped at the cap
    max_progression_entries: int = 4096  # per-progression history cap
    key_update_interval_sec: float = 5.0
    bpm_update_interval_sec: float = 10.0
    window: int = 0          # 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
    output_format: int = 0  # legacy; omit it or keep the Float32 value (0)

class StreamFrames:
    n_frames: int
    n_mels: int
    n_chroma: int             # 12 when chroma is present; otherwise 0
    feature_flags: int        # MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
    timestamps: list[float]
    mel: list[float]        # n_frames × n_mels; empty if MEL is absent
    chroma: list[float]     # n_frames × n_chroma; empty if CHROMA is absent
    onset_strength: list[float]  # empty if ONSET is absent
    rms_energy: list[float]
    spectral_centroid: list[float]  # empty if SPECTRAL is absent
    spectral_flatness: list[float]  # empty if SPECTRAL is absent
    chord_root: list[int]            # empty if CHROMA is absent
    chord_quality: list[int]         # empty if CHROMA is absent
    chord_confidence: list[float]    # empty if CHROMA is absent

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

Additional Python result classes used by focused APIs:

| Area | Classes |
|------|---------|
| Metering | `ClippingRegion`, `StreamFramesU8`, `StreamFramesI16`, `WaveformPeaksReport` |
| Mastering | `MasteringResult`, `MasteringStereoResult` |
| Mixing | `MixerStereoResult` |
| Projects | `AssistSidecar` (return type of `project.get_assist_sidecar(index)` / `project.assist_sidecars()` — see [Project Editing](./project-editing-midi.md#assist-sidecars)), `NotePairValidation` |
| Realtime engine jobs/telemetry | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `MeterTelemetryRecord`, `MeterTelemetryRecordWide`, `ScopeTelemetryRecord` |
| Build introspection | `Capabilities`, `CapabilityCatalog`, `CapabilityCatalogPresets`, `MasteringPresetCatalogEntry`, `MasteringInsertParamInfo`, `MasteringInsertSlot`, `MasteringInsertTiming`, `MasteringProcessorCatalogEntry` (`TypedDict`s over the JSON documents described on [API Surface](./api-surface.md#what-the-capability-catalog-reports)) |

`CapabilityCatalog["masteringPresets"]` contains `MasteringPresetCatalogEntry` values with `name`, `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; restoration entries use `None` for the three numeric fields. `MasteringProcessorCatalogEntry` includes `slots` for conditional key groups. `MasteringInsertParamInfo` descriptors include `id`, `rtSafe`, `type`, `min`, `max`, `default`, `unit`, `choices`, and `slot`, while `MasteringInsertTiming` contains `latencySamples` and `tailSamples` for the requested insert configuration.

### Exceptions

Two classes cover every failure, and the second derives from the first, so they form one hierarchy rather than two:

```python
class SonareError(RuntimeError):
    code: int          # the C-ABI error code, an ErrorCode value
    code_name: str     # property -> "InvalidParameter", "FileNotFound", ...
    # str(e) -> "[4] Invalid parameter": the code is prefixed to the message

class SonareValueError(SonareError, ValueError):
    code: int          # ErrorCode.INVALID_PARAMETER unless the raiser passes another
    # str(e) -> "spectral_centroid: samples contains NaN or Inf at index 0": no prefix
```

`SonareValueError` is what the binding raises when it refuses an argument before the call crosses into native code. Its bases decide what an existing handler sees:

| Handler | A binding refusal (`SonareValueError`) | A core rejection (`SonareError`, code 4) |
|---------|---|---|
| `except ValueError` | Caught | Not caught |
| `except SonareError` or `except RuntimeError` | Caught | Caught |
| `except SonareValueError` | Caught | Not caught |
| Branching on `.code == ErrorCode.INVALID_PARAMETER` | Matches | Matches |

An instance is message-only. There is no attribute naming the offending parameter and none carrying the accepted range: `.code` is the only structured field, and it reads `INVALID_PARAMETER` for every refusal. The parameter name and, where one applies, the range are in the text — a buffer refusal names the entry point and the argument (`master_audio_stereo: right must not be empty`), a scalar refusal names the field and the interval the C type can hold (`sample_rate must be an integer within [-2147483648, 2147483647]`). Code that needs the name has to read it from `str(e)`; [Python API](./python-api.md#error-handling) covers the wording and why matching on it is fragile.

#### Where the validation layer stops

The binding validates in two layers, and the shape of each says what a `SonareValueError` at the call site rules out.

**Sample buffers are preflighted on 169 public entry points** — 126 through the shared preflight guard and 43 with the same check written into the body. Each preflighted buffer is coerced to a contiguous one-dimensional `float32` array, refused when empty, and scanned for NaN and Inf unless the entry point exposes `validate` and the call passes `validate=False` (the scan is skipped; the emptiness check is not). An F0 track handed to the note functions is checked for shape only, because pYIN spells an unvoiced frame as `nan`. The set is derived rather than maintained: a test in the binding discovers every public callable whose leading parameter is annotated as a buffer and fails when one ships without the guard.

**Scalars are narrowed at the conversion, not per function.** Every integer or float that passes through the binding's ctypes readers or a config-struct field is refused when the C type would silently change it: a `bool` where a number is expected, an integer that would wrap (`2**32 + 8000` handed to a `c_int` sample rate), a double that would saturate a `c_float`, or a NaN or infinity. The message names the field and the interval. Because the check sits at the conversion, it covers every entry point that hands the value on, and there is no per-function count to keep.

**Five entry points refuse rather than answer.** Refusing is a different contract from checking and continuing, and these are the ones whose input is refused outright instead of producing a defined empty result: `trim_silence`, `split_silence` and `fix_frames` raise on an empty buffer; `tempogram_ratio` raises on an empty matrix and on a `factors` entry that is not finite and positive; `mix_stereo` raises on a scene whose strips are all empty or carry a non-finite sample. [Input some entry points refuse](./python-api.md#input-some-entry-points-refuse) gives the reason for each.

What the layer does **not** do:

- **Judge a value's meaning.** Narrowing checks that a number is representable, not that the processor accepts it. `ratio=0.5` on `dynamics.compressor` reaches the core and comes back as `SonareError` code 4 with the message `compressor ratio must be at least 1`; a value the processor clamps instead, such as `dryWet=5` on `effects.modulation.chorus`, is accepted without a word. A handful of entry points do check a domain rule Python-side — the power-of-two `n_fft` of the classical repair functions, the odd kernel of `hpss`, the FFT geometry of `time_stretch` and `pitch_shift` — and their messages read the same way; everything else about a value's meaning is the core's to judge.
- **Read a `params` dict.** The parameter dictionaries handed to `mastering_process`, the chain and the inserts are serialised as given: an unknown key is ignored by the processor, and a non-finite value is rejected by the core (`mastering parameters must be finite and representable`), not by the binding. Check values against the [capability catalog](./api-surface.md#what-the-capability-catalog-reports) before the call if you want the refusal at the call site.
- **Preflight the exemptions.** The entry points for which an empty buffer is a defined result — the element-wise conversions, the padding helpers, the tempogram family — accept one and return one; they are listed under [What is not checked](./python-api.md#what-is-not-checked).
- **Cover the CLI's own arguments.** A command-line usage error is a plain `ValueError`, since it reports a mistake in the command rather than an API argument.
