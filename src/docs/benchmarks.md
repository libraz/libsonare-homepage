# Benchmarks

Performance comparison of libsonare against librosa (Python) for audio analysis tasks.

::: info Reproducible
All benchmarks can be reproduced locally. See [Run Benchmarks Yourself](#run-benchmarks-yourself) at the bottom of this page.
:::

::: info Note on hardware
Measured on Apple M4 Max (16 cores, 128GB unified memory). On different hardware, absolute times will vary, but relative performance differences remain consistent.
:::

## Full Analysis

Complete music analysis: BPM + key + beats + chords + sections + timbre + dynamics.

Test audio: MP3, 73 seconds, 44100 Hz stereo.

<BenchChart
  title="Full Analysis Latency (lower is better)"
  :data="[
    { label: 'Full analyze', librosa: 43940, libsonare: 810 },
  ]"
/>

| Library | Language | Time | Relative |
|---------|----------|------|----------|
| libsonare | C++ | 0.81s | 1x |
| bpm-detector (librosa-based) | Python | 44s | ~54x slower |

## Per-Feature Comparison

Individual feature extraction on the same 73-second audio (22050 Hz after resampling).

<BenchChart
  title="Per-Feature Latency (lower is better)"
  :data="[
    { label: 'STFT', librosa: 19, libsonare: 17 },
    { label: 'Mel Spectrogram', librosa: 36, libsonare: 10 },
    { label: 'HPSS', librosa: 2207, libsonare: 70 },
    { label: 'Onset Strength', librosa: 25, libsonare: 1 },
    { label: 'Chroma', librosa: 50, libsonare: 1 },
    { label: 'Beat Track', librosa: 527, libsonare: 26 },
    { label: 'MFCC', librosa: 24, libsonare: 1 },
    { label: 'pYIN', librosa: 7033, libsonare: 510 },
    { label: 'Spectral Centroid', librosa: 28, libsonare: 1 },
  ]"
/>

| Feature | librosa | libsonare | Speedup |
|---------|---------|-----------|---------|
| STFT (2048, hop 512) | 19ms | 17ms | 1.1x |
| Mel Spectrogram (128 bands) | 36ms | 10ms | 3.6x |
| HPSS (kernel 31) | 2,207ms | 70ms | 32x |
| Onset Strength | 25ms | 1ms | 25x |
| Chroma (STFT-based) | 50ms | 1ms | 50x |
| Beat Track / BPM | 527ms | 26ms | 20x |
| MFCC (13 coefficients) | 24ms | 1ms | 24x |
| pYIN | 7,033ms | 510ms | 14x |
| Spectral Centroid | 28ms | 1ms | 28x |

::: tip STFT
STFT is nearly identical because librosa delegates to scipy.fft (C/Fortran). The advantage shows in higher-level operations that build on STFT.
:::

::: tip HPSS
HPSS shows the largest speedup (32x) due to libsonare's multi-threaded median filter with cache-friendly sorted arrays, replacing librosa's sequential scipy.ndimage.median_filter.
:::

::: tip pYIN
pYIN now runs 14x faster than librosa, a major improvement from the earlier 1.9x. Optimized C++ viterbi decoding and parallelized candidate evaluation make libsonare's pYIN competitive even against librosa's Numba JIT.
:::

## Why is libsonare Faster?

### 1. No interpreter overhead

librosa runs in the Python interpreter. Even though it delegates heavy math to NumPy/SciPy (C/Fortran), every function call, array creation, and control flow decision passes through Python. libsonare compiles directly to native machine code.

```
librosa:   Python → NumPy dispatch → BLAS/LAPACK (C) → result → Python
libsonare: C++ → Eigen3 SIMD → result
```

### 2. STFT: framing and windowing

librosa's STFT (`librosa.core.spectrum.stft`) performs framing via `numpy.lib.stride_tricks` and applies windowing with NumPy operations. Each step involves Python-level array dispatch.

libsonare's STFT uses KissFFT with direct pointer arithmetic and Eigen3 vectorized windowing -- no intermediate array allocations or Python dispatch.

### 3. HPSS: median filter optimization

librosa uses `scipy.ndimage.median_filter` -- a general-purpose C implementation that processes each pixel independently.

libsonare uses a custom sliding median with:
- **Sorted flat array** (O(log k) binary search + O(k) memmove) instead of tree-based structures -- fits in CPU cache for typical kernel sizes
- **Multi-threaded execution**: rows/columns processed in parallel across all CPU cores
- Result: 11x faster than the original implementation, 32x faster than scipy

### 4. Parallel feature precomputation

librosa processes features sequentially. libsonare runs independent computation paths concurrently:

```
libsonare (parallel):
  Thread 1: STFT → Mel Spectrogram → Onset Strength
  Thread 2: HPSS → CQT → Harmonic Chroma
  (both complete before analysis begins)
```

### 5. Automatic downsampling

libsonare downsamples 44100 Hz input to 22050 Hz once in the MusicAnalyzer constructor, halving the data for all spectral analysis paths. librosa processes at the original sample rate unless the user explicitly resamples.

### 6. Eigen3 SIMD vectorization

All matrix operations (Mel filterbank, chroma folding, spectral features) use Eigen3, which auto-vectorizes to SSE/AVX/NEON instructions. librosa uses NumPy's einsum which, while optimized, involves additional dispatch overhead.

### 7. Zero-copy architecture

libsonare's spectrograms, Mel features, and onset strength are computed once and cached as `unique_ptr` members. Downstream analyzers access them by reference. librosa recomputes features on each function call (though `@cache` decorators help in some cases).

## Run Benchmarks Yourself

### Full Analysis

```bash
pip install libsonare
time sonare analyze path/to/audio.mp3 --json > /dev/null
```

### Per-Feature Comparison

```python
import time
import librosa
from libsonare import Audio, resample, stft, mel_spectrogram, mfcc, chroma
from libsonare import hpss, detect_beats, pitch_pyin, spectral_centroid, analyze

audio = Audio.from_file("audio.mp3")
samples = resample(audio.data, audio.sample_rate, 22050)
sr = 22050
y, _ = librosa.load("audio.mp3", sr=22050, mono=True)

def bench(name, fn, runs=3):
    times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        fn()
        times.append((time.perf_counter() - t0) * 1000)
    import statistics
    print(f"{name:<30s} {statistics.median(times):>8.1f}ms")

print("--- libsonare ---")
bench("Full Analyze", lambda: analyze(samples, sr))
bench("HPSS", lambda: hpss(samples, sr))
bench("pYIN", lambda: pitch_pyin(samples, sr))
bench("Beat Track", lambda: detect_beats(samples, sr))

print("--- librosa ---")
bench("HPSS", lambda: librosa.effects.hpss(y))
bench("pYIN", lambda: librosa.pyin(y, fmin=65, fmax=2093, sr=sr))
bench("Beat Track", lambda: librosa.beat.beat_track(y=y, sr=sr))
```

::: tip
Per-feature numbers in the table above are measured using C++ internal timing (`chrono::steady_clock`). When calling individual functions through the Python cffi binding, data marshalling adds overhead. Full analysis (`analyze()`) runs the entire pipeline in C++ and returns only the result, so its performance matches the C++ CLI.
:::

## Notes

- librosa timings measured via `time.perf_counter`, libsonare per-feature via `chrono::steady_clock`
- Results vary by hardware, audio duration, and content complexity
- WASM builds are single-threaded (no parallelization) but still significantly faster than Python
