# Benchmarks

Performance comparison of libsonare against librosa (Python) for audio analysis tasks.

::: info Methodology
All numbers below are measured **standalone from raw audio** — every call rebuilds whatever intermediate state it needs (STFT, Mel, etc.) from the original samples. This is the same code path a one-shot user of either API exercises, so the comparison is apples-to-apples. The full benchmark source and results JSON live in [`benchmarks/`](https://github.com/libraz/libsonare/tree/main/benchmarks) inside the libsonare repo.
:::

::: info Hardware
Measured on Apple M5 Max (16 cores, 128 GB unified memory). Absolute times scale with hardware; relative differences are stable.
:::

## Full Pipeline Analysis

Complete music analysis: BPM + key + beats + chords + sections + timbre + dynamics + rhythm + melody.

Test audio: synthetic WAV, 73 seconds, 44100 Hz stereo (committed in `benchmarks/generate_audio.py`).

<BenchChart
  title="Full Analysis Latency (lower is better)"
  :data="[
    { label: 'Full analyze', librosa: 36400, libsonare: 674 },
  ]"
/>

| Library | Language | Time | Relative |
|---------|----------|------|----------|
| libsonare | C++ | 0.67s | 1x |
| bpm-detector `--comprehensive` (librosa-based) | Python | 36.4s | ~54x slower |

The full-pipeline figure is where libsonare's design pays off most: shared spectrograms, parallel feature paths, automatic 44.1 → 22.05 kHz downsampling, and no Python boundary inside the pipeline.

## Per-Feature Comparison

Individual feature extraction on the same 73-second audio (resampled to 22050 Hz). librosa measured with `time.perf_counter`, libsonare measured with `chrono::steady_clock` inside C++ via the `sonare_bench` binary.

<BenchChart
  title="Per-Feature Latency (lower is better)"
  :data="[
    { label: 'STFT', librosa: 13.3, libsonare: 13.85 },
    { label: 'Mel Spectrogram', librosa: 20.35, libsonare: 23.01 },
    { label: 'HPSS', librosa: 1761.85, libsonare: 89.35 },
    { label: 'Onset Strength', librosa: 21.46, libsonare: 23.54 },
    { label: 'Chroma', librosa: 44.55, libsonare: 15.36 },
    { label: 'Beat Track', librosa: 35.64, libsonare: 23.77 },
    { label: 'MFCC', librosa: 21.55, libsonare: 23.82 },
    { label: 'pYIN', librosa: 5824.64, libsonare: 474.22 },
    { label: 'Spectral Centroid', librosa: 24.76, libsonare: 16.54 },
  ]"
/>

| Feature | librosa | libsonare | Speedup |
|---------|---------|-----------|---------|
| STFT (2048, hop 512) | 13.3ms | 13.9ms | 0.96x (tied) |
| Mel Spectrogram (128 bands) | 20.4ms | 23.0ms | 0.88x (tied) |
| HPSS (kernel 31) | 1,762ms | 89ms | **19.7x** |
| Onset Strength | 21.5ms | 23.5ms | 0.91x (tied) |
| Chroma (STFT-based) | 44.6ms | 15.4ms | **2.9x** |
| Beat Track | 35.6ms | 23.8ms | 1.5x |
| MFCC (13 coefficients) | 21.6ms | 23.8ms | 0.90x (tied) |
| pYIN | 5,825ms | 474ms | **12.3x** |
| Spectral Centroid | 24.8ms | 16.5ms | 1.5x |

::: tip Honest take
For the cheap STFT-dominated features (STFT, Mel, Onset, MFCC) libsonare is **roughly tied** with librosa. librosa delegates the FFT to scipy.fft (heavily optimized C/Fortran), so once you account for the FFT cost there isn't much room to win on a single call.

The clear wins are in (1) **compute-heavy operations** where libsonare's multithreaded median filter (HPSS) and parallelized Viterbi decoding (pYIN) leave the Python pipeline far behind, and (2) **pipeline-level analysis** where shared intermediates and the elimination of the Python boundary dominate.
:::

## Where the Big Wins Come From

### Full pipeline (54x): shared intermediates + no Python

libsonare's `analyze()` computes the STFT and Mel spectrogram **once** and reuses them across every downstream analyzer — chord detection reads the same chromagram the key analyzer uses; the beat tracker reads the same onset envelope the section detector consumes. Independent paths run in parallel across CPU cores. None of this crosses the Python boundary, so per-call dispatch overhead is gone.

bpm-detector (and any other librosa-based pipeline) rebuilds these intermediates per analyzer and orchestrates everything from Python — the cost adds up.

### HPSS (19.7x): cache-friendly multithreaded median filter

librosa's HPSS calls `scipy.ndimage.median_filter` once horizontally and once vertically — a general-purpose C implementation processed sequentially per pixel.

libsonare replaces this with a custom sliding median:
- **Sorted flat array** with O(log k) binary search + O(k) memmove instead of a tree, which fits in L1 cache for typical kernel sizes
- **Multi-threaded execution** — rows and columns processed in parallel across all cores
- Result: ~20x faster end-to-end than the scipy version on this hardware

### pYIN (12.3x): native Viterbi + parallelized candidates

pYIN's bottleneck is per-frame candidate evaluation and the Viterbi decoding step. libsonare implements both in C++ with parallelized frame processing, replacing librosa's Numba-JIT'd inner loop. The candidate evaluation in particular benefits from C++'s tighter loops and SIMD vectorization through Eigen3.

### Chroma (2.9x): tighter STFT → filterbank path

Chroma derives a 12-pitch-class representation from the spectrogram via a constant-Q-like filterbank. libsonare's STFT and the filterbank multiplication run as Eigen3-vectorized matrix operations on a single contiguous buffer, avoiding the dispatch overhead of librosa's stack of NumPy operations.

## What's Not Faster (And Why)

- **STFT itself**: librosa delegates to `scipy.fft`, which is implemented in C/Fortran. The two are within noise of each other.
- **Mel / MFCC / Onset Strength**: dominated by their underlying STFT cost — once that's paid, the per-frame Mel filterbank multiplication and DCT are too cheap for a different language to matter.
- **Pipeline use cases**: inside `analyze()` these same features run in <1 ms apiece because the STFT/Mel is computed once and shared. The standalone numbers above represent the "what does it cost to call this in isolation" view, not the in-pipeline cost.

## Reproduce These Numbers Yourself

The benchmark lives under [`libsonare/benchmarks/`](https://github.com/libraz/libsonare/tree/main/benchmarks) and is fully reproducible:

```bash
# in your local libsonare checkout
cmake -B build-bench -DCMAKE_BUILD_TYPE=Release \
                     -DBUILD_BENCH=ON -DBUILD_TESTING=OFF -DBUILD_CLI=OFF
cmake --build build-bench -j

rye sync --pyproject benchmarks/pyproject.toml
rye run --pyproject benchmarks/pyproject.toml python benchmarks/generate_audio.py

./build-bench/bin/sonare_bench \
    benchmarks/fixtures/bench_73s_44100.wav \
    benchmarks/results_cpp.json

rye run --pyproject benchmarks/pyproject.toml python benchmarks/run_bench.py
```

The merged `benchmarks/results.json` contains both the C++ libsonare numbers and the librosa numbers, plus the bpm-detector full-pipeline timing if `bpm-detector` is on `PATH`.

::: tip Calling libsonare from Python
The numbers above measure libsonare's native C++ performance. If you call individual feature functions through the Python binding (e.g. `libsonare.stft(samples, sr)`), every call marshals the sample buffer across the FFI boundary, which dominates the runtime for cheap features. The full-pipeline `analyze()` is unaffected — it runs end-to-end in C++ and only the small result struct crosses the boundary.
:::

## Notes

- Numbers are hardware-dependent. Apple M5 Max here; relative gaps are stable across machines.
- Synthetic test audio (deterministic chord progression + percussive bursts) is generated locally rather than committed to the repo.
- WASM builds are single-threaded — the HPSS and pYIN speedups shrink there but the pipeline-level win remains.
