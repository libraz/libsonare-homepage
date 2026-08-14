# Benchmarks

Performance comparison of libsonare against librosa (Python) for audio analysis tasks.

Use this page as performance context, not as a functional tutorial. If you need to learn the API first, read [Getting Started](./getting-started.md), [Feature Map](./api-surface.md), and the runtime page for your language.

::: info How to read benchmark numbers
Lower latency means the operation finished faster for this exact workload. A speedup such as `2x` means "twice as fast in this benchmark," not "twice as fast for every file." Hardware, sample rate, clip length, codec decode time, and whether intermediate features are reused can all change the result.
:::

## What You Will Learn

By the end of this page you should be able to:

- interpret benchmark numbers as workload-specific measurements rather than universal speed claims;
- distinguish all-in-one pipeline speedups from per-feature comparisons;
- understand why shared intermediates, native execution, and pipeline design matter;
- find the benchmark source and reproduce or update the measurements when hardware, inputs, or implementations change.

::: info Methodology
All numbers below are measured **standalone from raw audio** — every call rebuilds whatever intermediate state it needs (STFT, Mel, etc.) from the original samples. This is the same code path a one-shot user of either API exercises, so the comparison is apples-to-apples. The full benchmark source and results JSON live in [`benchmarks/`](https://github.com/libraz/libsonare/tree/main/benchmarks) inside the libsonare repo.

Every case runs **3 times and the tables report the median**, on both sides — `bench_cpp.cpp` takes the median of 3 for libsonare, `run_bench.py` does the same for librosa. The individual run times are not written to the results JSON, so no spread is published here; with 3 samples a standard deviation would not say much anyway.
:::

::: info Hardware
Measured on Apple M5 Max (18 hardware threads, 128 GB unified memory), on an idle machine — both halves of the benchmark record the load average they ran under, here 2.0. Absolute times scale with your hardware; the ratios are what carries over.
:::

::: info Comparison versions
The Python side ran the versions pinned in `benchmarks/requirements.lock`:

- **librosa** 0.11.0
- **scipy** 1.17.1
- **numpy** 2.4.4
- **numba** 0.65.1

on CPython 3.11 or later — `benchmarks/pyproject.toml` sets the floor and the exact interpreter is not recorded in the results. Two of these move the numbers directly: librosa delegates its FFT to scipy, and numba JIT-compiles the inner loop of pYIN.
:::

## All-In-One Pipeline Analysis

All-in-one music analysis: BPM + key + beats + chords + sections + timbre + dynamics + rhythm + melody.

Test audio: synthetic WAV, 73 seconds, 44100 Hz stereo, generated locally by the committed `benchmarks/generate_audio.py` rather than shipped as a binary. Generation is deterministic, so your copy is the same bytes as the one these timings were measured on — the script prints its SHA-256 and warns if it does not match:

```
3be88171eb87f8569189b9acef994e18263f89e7adf05119cbb48591c4953cb3
```

<BenchChart
  title="All-In-One Analysis Latency (lower is better)"
  :data="[
    { label: 'All-in-one analyze', librosa: 34545, libsonare: 1153 },
  ]"
/>

| Library | Language | Time | Relative |
|---------|----------|------|----------|
| libsonare | C++ | 1.15s | 1x |
| bpm-detector 1.1.0 `--comprehensive` (librosa-based) | Python | 34.5s | ~30x slower |

::: warning What the 30x is against
The comparison target is **not librosa**. It is [bpm-detector](https://github.com/libraz/bpm-detector) 1.1.0 run with `--comprehensive`, a pipeline built on top of librosa — and it is written by the same author as libsonare, which libsonare supersedes. Read the ratio knowing that both sides of it are ours.

librosa is a feature library rather than a one-shot analyzer — there is no `librosa.analyze()` to time — so any full-pipeline comparison has to pick some pipeline built on it. bpm-detector computes the same feature set end to end, which makes it comparable.

Read 30x as "against this Python pipeline, on this fixture". A different librosa-based pipeline gives a different ratio, and the per-feature table below is the better guide to what libsonare will do for your own code.
:::

The all-in-one pipeline figure is where libsonare's design pays off most: shared spectrograms, parallel feature paths, automatic 44.1 → 22.05 kHz downsampling done once inside the C++ pipeline (the librosa pipeline resamples too, so the comparison stays apples-to-apples), and no Python boundary inside the pipeline.

Most of that gap is structural rather than a language win — the per-feature table below shows C++ against Python on identical work, and there librosa is slightly ahead on the cheap features.

## Per-Feature Comparison

Individual feature extraction on the same 73-second audio (resampled to 22050 Hz). librosa measured with `time.perf_counter`, libsonare measured with `chrono::steady_clock` inside C++ via the `sonare_bench` binary.

<BenchChart
  title="Per-Feature Latency (lower is better)"
  :data="[
    { label: 'STFT', librosa: 12.61, libsonare: 13.52 },
    { label: 'Mel Spectrogram', librosa: 19.45, libsonare: 22.23 },
    { label: 'HPSS', librosa: 1680.69, libsonare: 81.94 },
    { label: 'Onset Strength', librosa: 20.54, libsonare: 22.72 },
    { label: 'Chroma', librosa: 41.99, libsonare: 14.78 },
    { label: 'Beat Track', librosa: 32.88, libsonare: 54.95 },
    { label: 'MFCC', librosa: 20.80, libsonare: 23.01 },
    { label: 'pYIN', librosa: 5461.02, libsonare: 427.89 },
    { label: 'Spectral Centroid', librosa: 24.86, libsonare: 18.12 },
  ]"
/>

| Feature | librosa | libsonare | Speedup |
|---------|---------|-----------|---------|
| STFT (2048, hop 512) | 12.6ms | 13.5ms | 0.93x — slower |
| Mel Spectrogram (128 bands) | 19.5ms | 22.2ms | 0.88x — slower |
| HPSS (kernel 31) | 1,681ms | 81.9ms | **20.5x** |
| Onset Strength | 20.5ms | 22.7ms | 0.90x — slower |
| Chroma (STFT-based) | 42.0ms | 14.8ms | **2.84x** |
| Beat Track | 32.9ms | 55.0ms | **0.60x — slower** |
| MFCC (13 coefficients) | 20.8ms | 23.0ms | 0.90x — slower |
| pYIN | 5,461ms | 428ms | **12.8x** |
| Spectral Centroid | 24.9ms | 18.1ms | 1.37x |

::: warning Beat tracking is slower standalone
`Beat Track` is the row where libsonare loses by the widest margin: 55.0 ms against librosa's 32.9 ms on the same audio. Note also that `sonare beats` returns a time signature and downbeats alongside the beat grid, so it is not doing the same work as `librosa.beat.beat_track` — but if beat times are all you want, that extra work is cost with no return.

If you need beats along with anything else, call `analyze()` instead. The pipeline computes the onset envelope once and shares it, so beat tracking there does not pay the standalone cost in this table. Calling `sonare beats` on its own is the case where libsonare has nothing to offer over librosa today.
:::

## Is It Right? Accuracy On The Same Fixture

Speed says how fast an answer arrives, not whether it is correct. The fixture is synthesised from an explicit tempo, beat grid, chord progression and key, and `generate_audio.py` writes that description out beside the WAV — so unlike a real recording, this benchmark comes with an answer key.

| What | Reference | Result |
|------|-----------|--------|
| Tempo | 120.00 BPM | 119.80 BPM — 0.17% error, inside the MIREX 4% window |
| Beats | 146 beats | 145 detected, F-measure **0.997** at the standard ±70 ms tolerance, median offset +25 ms |
| Key | A minor | `analyze()` → A minor (exact) |
| Key | A minor | `sonare key` → C major (the relative — see below) |
| Chords | 16 bars | `analyze()` **0.940** frame-wise, on root and on root+quality alike |
| Chords | 16 bars | `sonare chords` **0.643**, likewise on root and root+quality |

```bash
python3 benchmarks/generate_audio.py
python3 benchmarks/measure_accuracy.py --cli build-release/bin/sonare-cli
```

Two of those rows affect how you should call the library:

- **Use the pipeline for chords.** `analyze()` scores 0.940; the standalone `sonare chords` command scores 0.643. The pipeline has a beat grid and bar segmentation to settle chord boundaries against, and the standalone command does not.
- **The two key detectors can disagree.** Here `analyze()` returns A minor and `sonare key` returns C major — the relative major. Both are defensible for a progression diatonic to both, but if you need one answer, take it from `analyze()`.

::: warning This is a floor, not a benchmark
Synthetic audio has no performance timing, no timbral ambiguity, no production and no ambiguity about where a bar begins. Scoring well here means the analyzers recover a signal that was constructed to be recoverable.

It does not predict accuracy on real recordings. That needs annotated real music, which cannot be redistributed here.

You can score against your own corpus: `tests/fixtures/music_eval/` holds manifests for BPM, beat, downbeat, chord, key and meter. Point `SONARE_MUSIC_FIXTURE_ROOT` at your annotated audio, add rows, and build with `SONARE_ENABLE_OPTIONAL_FIXTURE_TESTS=ON`.

Otherwise, judge accuracy on your own audio with the [browser demo](/demos) or the CLI.
:::

## WASM Mastering ISP Guard

An inter-sample peak (ISP) is a peak that falls *between* two samples — silent in
the raw numbers but real once a DAC reconstructs the waveform — so the limiter
must oversample to catch it. This benchmark confirms that detector is fast enough
to run in the browser.

The mastering true-peak path is also checked in WebAssembly with a 48 kHz stereo
1 ms block, 4x oversampling, and the same sliding-max guard used by the final
limiter.

| Benchmark | Runtime | Median per 1 ms audio | Threshold | Result |
|-----------|---------|-----------------------|-----------|--------|
| `mastering_isp_4x_stereo_1ms` | WASM / Node | 0.0062ms | 5.0ms | Pass |

This verifies the inter-sample peak detector has enough headroom for browser
rendering. Reproduce with `cd bindings/wasm && yarn bench:wasm:isp` in the
libsonare repository.

## What WebAssembly Costs

The browser build is single-threaded, so the features that use multiple cores lose their advantage there. Native and WASM measured on the same fixture in the same run:

| Feature | Native | WASM | WASM penalty |
|---------|--------|------|--------------|
| All-in-one analyze | 1,153ms | 3,159ms | 2.7x |
| STFT | 13.5ms | 16.4ms | 1.2x |
| Mel Spectrogram | 22.2ms | 47.3ms | 2.1x |
| HPSS | 81.9ms | 422ms | **5.2x** |
| Onset Strength | 22.7ms | 48.5ms | 2.1x |
| Chroma | 14.8ms | 20.5ms | 1.4x |
| Beat Track | 55.0ms | 80.4ms | 1.5x |
| MFCC | 23.0ms | 48.9ms | 2.1x |
| pYIN | 428ms | 437ms | **1.02x** |
| Spectral Centroid | 18.1ms | 23.3ms | 1.3x |

The penalty is not uniform, so what the browser costs you depends on which features you use. HPSS is the routine that fans out across cores, so it loses the most when there is only one: budget roughly 5x for harmonic-percussive separation in the browser. The mel-filterbank features sit around 2x.

pYIN is the outlier in the other direction — it costs essentially the same in a tab as it does natively. Its runtime is dominated by the Viterbi lattice, which is compare-and-add over doubles with the transition weights already stored as logarithms, and WASM runs that at close to native speed.

For the all-in-one pipeline, expect around 2.7x. On this fixture that is 73 seconds of audio analyzed in 3.2 seconds — still around 23x faster than the audio plays.

::: tip What this means for choosing a library
If you only need one cheap feature — an STFT, a Mel spectrogram, MFCCs, an onset envelope — librosa is **slightly faster**, by around 10%. That is not a reason to switch to libsonare, and not a reason to leave it either. librosa delegates the FFT to scipy.fft (heavily optimized C/Fortran), and once the FFT is paid for there is little left for either side to win on a single call.

libsonare is worth it when you need **HPSS** (20x), **pitch tracking** (13x), **chroma** (2.8x), or **several features at once** — the last being where shared intermediates and the absence of a Python boundary dominate. For standalone beat tracking, librosa is faster.
:::

## Where the Big Wins Come From

### All-in-one pipeline (30x): shared intermediates + no Python

libsonare's `analyze()` computes the STFT and Mel spectrogram **once**, then reuses them across downstream analyzers.

That reuse matters:

| Analyzer | Shared input it can reuse |
|----------|---------------------------|
| Chord detection | The same chromagram used by key detection. |
| Beat tracking | The same onset envelope consumed by section detection. |

Independent paths run in parallel across CPU cores. None of this crosses the Python boundary, so per-call dispatch overhead is gone.

bpm-detector (and any other librosa-based pipeline) rebuilds these intermediates per analyzer and orchestrates everything from Python — the cost adds up.

### HPSS (20.5x): cache-friendly multithreaded median filter

librosa's HPSS calls `scipy.ndimage.median_filter` once horizontally and once vertically — a general-purpose C implementation processed sequentially per pixel.

libsonare replaces this with a custom sliding median:
- **Sorted flat array** with O(log k) binary search + O(k) memmove instead of a tree, which fits in L1 cache for typical kernel sizes
- **Multi-threaded execution** — rows and columns processed in parallel across all cores
- Result: ~20x faster end-to-end than the scipy version on this hardware, and the routine that loses the most when the browser build takes the threads away

::: details What is a median filter (and a sliding median)?
A **median filter** replaces each value with the *median* of its neighbors in a small window. Unlike averaging, it removes spikes and outliers while keeping edges sharp — which is exactly why HPSS uses it: a horizontal median pass keeps steady (harmonic) lines, a vertical pass keeps sharp (percussive) hits. A **sliding median** computes this efficiently as the window moves across the data, instead of re-sorting from scratch at every step.
:::

<SonareDemo id="waveform-harmonics" />

### pYIN (12.8x): native YIN difference and Viterbi decoding

pYIN's cost is per-frame candidate evaluation and the Viterbi decoding step. libsonare implements both in C++, replacing librosa's Numba-JIT'd inner loop, and computes the YIN difference function through an FFT rather than directly.

Decoding dominates: with the default 65–2093 Hz range the lattice has 1,202 states and roughly 100 reachable transitions per state, so a 73-second clip visits the inner update several hundred million times. Everything that can leave that loop has left it — the transition weights are stored as logarithms and the voiced/unvoiced switch costs are constants — leaving a compare-and-add over doubles.

This path is single-threaded. Unlike HPSS it gains nothing from extra cores, and for the same reason it loses nothing in a browser: the WASM penalty is 1.02x.

### Chroma (2.84x): tighter STFT → filterbank path

Chroma derives a 12-pitch-class representation from the spectrogram via a constant-Q-like filterbank. libsonare's STFT and the filterbank multiplication run as Eigen3-vectorized matrix operations on a single contiguous buffer, avoiding the dispatch overhead of librosa's stack of NumPy operations.

## What's Not Faster (And Why)

- **STFT itself**: librosa delegates to `scipy.fft`, which is implemented in C/Fortran, and comes out about 7% ahead. Being written in C++ buys nothing here because the work was already in C.
- **Mel / MFCC / Onset Strength**: dominated by their underlying STFT cost — once that's paid, the per-frame Mel filterbank multiplication and DCT are too cheap for a different language to matter. librosa is around 10% ahead on all three.
- **Beat tracking**: *slower* than librosa when called standalone, and by the widest margin of any row. Use `analyze()`, which shares the onset envelope, if you need beats alongside anything else.
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

The merged `benchmarks/results.json` contains both the C++ libsonare numbers and the librosa numbers, plus the bpm-detector all-in-one pipeline timing and version if `bpm-detector` is on `PATH`.

The same benchmark builds for WebAssembly, so the browser cost of the threaded paths is something you can measure rather than take on trust:

```bash
emcmake cmake -S . -B build-wasm-bench -DBUILD_WASM=ON -DBUILD_BENCH=ON \
              -DBUILD_TESTING=OFF -DBUILD_CLI=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm-bench --target sonare_bench
node build-wasm-bench/bin/sonare_bench.js benchmarks/fixtures/bench_73s_44100.wav
```

::: tip Run it on an idle machine
Both halves record the one-minute load average before and after the run — `sonare_bench` for the C++ side, `run_bench.py` for the librosa side. Contention does not scale the two evenly, so a busy machine changes the ratios rather than just inflating both columns. Check `load_average_before` in `results.json` before trusting a comparison, including the one on this page. The WASM bench reports no load average, so check that one yourself.
:::

::: tip Calling libsonare from Python
The numbers above measure libsonare's native C++ performance. If you call individual feature functions through the Python binding (e.g. `libsonare.stft(samples, sr)`), every call marshals the sample buffer across the FFI boundary, which dominates the runtime for cheap features. The all-in-one pipeline `analyze()` is unaffected — it runs end-to-end in C++ and only the small result struct crosses the boundary.
:::

## Notes

- Numbers are hardware-dependent. Apple M5 Max here; relative gaps are stable across machines, absolute milliseconds are not. Ratios are the part worth carrying to your own hardware.
- Synthetic test audio (deterministic chord progression + percussive bursts) is generated locally by a committed script rather than shipped as a binary, along with the ground truth the accuracy section scores against.
- WASM builds are single-threaded, so the speedups that come from fanning out across cores shrink there — HPSS most of all. The single-threaded paths, pYIN among them, carry over almost unchanged. Build the WASM bench above and measure it on the runtime you care about rather than scaling the native figures by guesswork.
