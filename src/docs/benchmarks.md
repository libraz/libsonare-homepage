# Benchmarks

Performance comparison of libsonare against librosa (Python) for audio analysis tasks.

Use this page as performance context, not as a functional tutorial. If you need to learn the API first, read [Getting Started](./getting-started.md), [Feature Map](./api-surface.md), and the runtime page for your language.

::: info How to read benchmark numbers
Lower latency means the operation finished faster for this exact workload. A speedup such as `2x` means "twice as fast in this benchmark," not "twice as fast for every file." Hardware, sample rate, clip length, codec decode time, and whether intermediate features are reused can all change the result.
:::

::: danger Native numbers are not browser numbers
Every figure on this page is labelled **native** or **browser (WebAssembly)**, and they are not interchangeable.

The native build runs its transforms on SIMD FFT kernels: PFFFT serves every transform length it can factor, and KissFFT keeps the rest. The WebAssembly configuration keeps KissFFT alone — `CMakeLists.txt` forces `SONARE_USE_PFFFT=OFF` under `BUILD_WASM`, because carrying both FFTs costs the analysis-only module more than its size budget allows.

So the transform-bound speedups below do not reach a browser. Anything whose cost lives in the FFT — the STFT, and everything built on top of it — is a native figure only. [What WebAssembly Costs](#what-webassembly-costs) is where the browser side is measured, and [Wins That Do Reach the Browser](#wins-that-do-reach-the-browser) covers the two that carry over unchanged.
:::

## What You Will Learn

By the end of this page you should be able to:

- interpret benchmark numbers as workload-specific measurements rather than universal speed claims;
- tell a native figure from a browser figure, and know why the transform-bound ones do not carry from one to the other;
- distinguish all-in-one pipeline speedups from per-feature comparisons;
- understand why shared intermediates, native execution, and pipeline design matter;
- find the benchmark source and reproduce or update the measurements when hardware, inputs, or implementations change.

::: info Methodology
All numbers below are measured **standalone from raw audio** — every call rebuilds whatever intermediate state it needs (the short-time Fourier transform (STFT), the mel spectrogram, and so on) from the original samples. This is the same code path a one-shot user of either API exercises, so the comparison is apples-to-apples. The full benchmark source and results JSON live in [`benchmarks/`](https://github.com/libraz/libsonare/tree/main/benchmarks) inside the libsonare repo.

Every case runs **3 times and the tables report the median**, on both sides — `bench_cpp.cpp` takes the median of 3 for libsonare, `run_bench.py` does the same for librosa. The individual run times are not written to the results JSON, so no spread is published here; with 3 samples a standard deviation would not say much anyway.
:::

::: info Hardware
Measured on Apple M5 Max (18 hardware threads, 128 GB unified memory). Both halves of the benchmark record the load average they ran under, and this run was not idle: the C++ half spanned 2.29 to 2.43, the librosa half 2.49 to 3.09. `benchmarks/README.md` says not to publish a run from a busy machine, because contention does not scale the two sides evenly — so read these as a run under light background load, and re-measure on a quiet machine before settling an argument with them. Absolute times scale with your hardware; the ratios are what carries over.
:::

::: info Comparison versions
The Python side ran the versions pinned in `benchmarks/requirements.lock`:

- **librosa** 0.11.0
- **scipy** 1.17.1
- **numpy** 2.4.6
- **numba** 0.67.0

on CPython 3.11 or later — `benchmarks/pyproject.toml` sets the floor and the exact interpreter is not recorded in the results. Two of these move the numbers directly: librosa delegates its FFT to scipy, and numba JIT-compiles the inner loop of pYIN.
:::

## All-In-One Pipeline Analysis (Native)

All-in-one music analysis: BPM + key + beats + chords + sections + timbre + dynamics + rhythm + melody. Both sides run natively — libsonare as a native C++ binary, the Python pipeline on CPython.

Test audio: synthetic WAV, 73 seconds, 44100 Hz stereo, generated locally by the committed `benchmarks/generate_audio.py` rather than shipped as a binary. Generation is deterministic, so your copy is the same bytes as the one these timings were measured on — the script prints its SHA-256 and warns if it does not match:

```
3be88171eb87f8569189b9acef994e18263f89e7adf05119cbb48591c4953cb3
```

<BenchChart
  title="All-In-One Analysis Latency (lower is better)"
  :data="[
    { label: 'All-in-one analyze', librosa: 38950, libsonare: 541 },
  ]"
/>

| Library | Language | Runtime | Time | Relative |
|---------|----------|---------|------|----------|
| libsonare | C++ | native | 0.54s | 1x |
| bpm-detector 1.1.0 `--comprehensive` (librosa-based) | Python | CPython | 38.9s | ~72x slower |

::: warning What the 72x is against
The comparison target is **not librosa**. It is [bpm-detector](https://github.com/libraz/bpm-detector) 1.1.0 run with `--comprehensive`, a pipeline built on top of librosa — and it is written by the same author as libsonare, which libsonare supersedes. Read the ratio knowing that both sides of it are ours.

librosa is a feature library rather than a one-shot analyzer — there is no `librosa.analyze()` to time — so any full-pipeline comparison has to pick some pipeline built on it. bpm-detector computes the same feature set end to end, which makes it comparable.

Read 72x as "against this Python pipeline, on this fixture, natively". A different librosa-based pipeline gives a different ratio, and the per-feature table below is the better guide to what libsonare will do for your own code.
:::

The all-in-one pipeline figure is where libsonare's design pays off most: shared spectrograms, parallel feature paths, automatic 44.1 → 22.05 kHz downsampling done once inside the C++ pipeline (the librosa pipeline resamples too, so the comparison stays apples-to-apples), and no Python boundary inside the pipeline.

Much of that gap is structural rather than a language win — the per-feature table below shows C++ against Python on identical work, and the individual margins there are far smaller than 72x.

## Per-Feature Comparison (Native)

Individual feature extraction on the same 73-second audio (resampled to 22050 Hz). librosa measured with `time.perf_counter`, libsonare measured with `chrono::steady_clock` inside a native `sonare_bench` build — this is the SIMD-transform configuration, so these rows do not describe the browser. The browser equivalents are further down.

<BenchChart
  title="Per-Feature Latency (lower is better)"
  :data="[
    { label: 'STFT', librosa: 12.63, libsonare: 6.81 },
    { label: 'Mel Spectrogram', librosa: 19.89, libsonare: 15.87 },
    { label: 'HPSS', librosa: 1715.77, libsonare: 64.41 },
    { label: 'Onset Strength', librosa: 20.98, libsonare: 16.76 },
    { label: 'Chroma', librosa: 42.90, libsonare: 8.46 },
    { label: 'Beat Track', librosa: 34.69, libsonare: 44.44 },
    { label: 'MFCC', librosa: 21.29, libsonare: 16.91 },
    { label: 'pYIN', librosa: 5745.04, libsonare: 364.38 },
    { label: 'Spectral Centroid', librosa: 24.67, libsonare: 12.10 },
  ]"
/>

| Feature | librosa | libsonare (native) | Speedup |
|---------|---------|--------------------|---------|
| STFT (2048, hop 512) | 12.6ms | 6.81ms | **1.85x** |
| Mel Spectrogram (128 bands) | 19.9ms | 15.9ms | 1.25x |
| HPSS (harmonic/percussive separation, kernel 31) | 1,716ms | 64.4ms | **26.6x** |
| Onset Strength | 21.0ms | 16.8ms | 1.25x |
| Chroma (STFT-based) | 42.9ms | 8.46ms | **5.07x** |
| Beat Track | 34.7ms | 44.4ms | **0.78x — slower** |
| MFCC (13 coefficients) | 21.3ms | 16.9ms | 1.26x |
| pYIN | 5,745ms | 364ms | **15.8x** |
| Spectral Centroid | 24.7ms | 12.1ms | **2.04x** |

::: warning Beat tracking is slower standalone
`Beat Track` is the one row where libsonare still loses natively: 44.4 ms against librosa's 34.7 ms on the same audio. Note also that `sonare beats` returns a time signature and downbeats alongside the beat grid, so it is not doing the same work as `librosa.beat.beat_track` — but if beat times are all you want, that extra work is cost with no return.

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
the raw numbers but real once a DAC (digital-to-analog converter) reconstructs
the waveform — so the limiter must oversample to catch it. This benchmark
confirms that detector is fast enough to run in the browser.

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

Two things separate the browser build from the native one. It is single-threaded, so the features that fan out across cores lose that advantage; and it keeps KissFFT alone, so it does not get the SIMD transform either. Both columns are the same fixture and the same benchmark, but the browser column comes from its own WebAssembly run rather than from the same pass as the native one — so read the penalty as the shape of the gap, not as a paired measurement.

| Feature | Native | Browser (WASM) | Browser penalty |
|---------|--------|----------------|-----------------|
| All-in-one analyze | 541ms | 3,159ms | **5.8x** |
| STFT | 6.81ms | 16.4ms | 2.4x |
| Mel Spectrogram | 15.9ms | 47.3ms | 3.0x |
| HPSS | 64.4ms | 422ms | **6.6x** |
| Onset Strength | 16.8ms | 48.5ms | 2.9x |
| Chroma | 8.46ms | 20.5ms | 2.4x |
| Beat Track | 44.4ms | 80.4ms | 1.8x |
| MFCC | 16.9ms | 48.9ms | 2.9x |
| pYIN | 364ms | 437ms | **1.20x** |
| Spectral Centroid | 12.1ms | 23.3ms | 1.9x |

The penalty is not uniform, so what the browser costs you depends on which features you use. HPSS pays both prices at once — it is the routine that fans out across cores, and it sits on the transform — so budget roughly 6.6x for harmonic-percussive separation in a tab. The mel-filterbank features sit around 3x.

pYIN is the outlier in the other direction, at 1.20x — the smallest penalty in the table. Its runtime is dominated by the Viterbi lattice, which is compare-and-add over doubles with the transition weights already stored as logarithms, and WASM runs that at close to native speed. Only the FFT-based YIN difference in front of the lattice notices which transform it got, and that is the smaller half of the work.

For the all-in-one pipeline, expect around 5.8x. On this fixture that is 73 seconds of audio analyzed in 3.2 seconds — still around 23x faster than the audio plays.

::: tip What this means for choosing a library
The answer splits by runtime, and that split is the useful part.

**Natively**, there is no cheap feature on this fixture where librosa comes out ahead: the SIMD transform puts libsonare 1.85x up on the STFT and about 1.25x up on everything that sits on top of it — Mel, MFCC, onset strength. Those three margins are small enough that they are not on their own a reason to switch, but they are no longer a reason against.

**In the browser**, that advantage is absent — no SIMD transform, no threads — and the two tables above put the WebAssembly STFT and mel-filterbank features behind librosa running natively on the same machine. Choosing libsonare for a tab is choosing it because librosa is not available there at all, not because it is the faster of the two.

Either way, libsonare is worth it when you need **HPSS** (27x native), **pitch tracking** (16x native), **chroma** (5.1x native), or **several features at once** — the last being where shared intermediates and the absence of a Python boundary dominate, and the one reason that survives the trip into a browser. For standalone beat tracking, librosa is faster on both.
:::

## Where the Big Wins Come From (Native)

### All-in-one pipeline (72x): shared intermediates + no Python

libsonare's `analyze()` computes the STFT and Mel spectrogram **once**, then reuses them across downstream analyzers.

That reuse matters:

| Analyzer | Shared input it can reuse |
|----------|---------------------------|
| Chord detection | The same chromagram used by key detection. |
| Beat tracking | The same onset envelope consumed by section detection. |

Independent paths run in parallel across CPU cores. None of this crosses the Python boundary, so per-call dispatch overhead is gone.

bpm-detector (and any other librosa-based pipeline) rebuilds these intermediates per analyzer and orchestrates everything from Python — the cost adds up.

### HPSS (26.6x): cache-friendly multithreaded median filter

librosa's HPSS calls `scipy.ndimage.median_filter` once horizontally and once vertically — a general-purpose C implementation processed sequentially per pixel.

libsonare replaces this with a custom sliding median:
- **Sorted flat array** with O(log k) binary search + O(k) memmove instead of a tree, which fits in L1 cache for typical kernel sizes
- **Multi-threaded execution** — rows and columns processed in parallel across all cores
- Result: ~27x faster end-to-end than the scipy version on this hardware natively, and the routine that loses the most when the browser build takes the threads away

::: details What is a median filter (and a sliding median)?
A **median filter** replaces each value with the *median* of its neighbors in a small window. Unlike averaging, it removes spikes and outliers while keeping edges sharp — which is exactly why HPSS uses it: a horizontal median pass keeps steady (harmonic) lines, a vertical pass keeps sharp (percussive) hits. A **sliding median** computes this efficiently as the window moves across the data, instead of re-sorting from scratch at every step.
:::

<SonareDemo id="hpss-separation" />

### pYIN (15.8x): native YIN difference and Viterbi decoding

pYIN's cost is per-frame candidate evaluation and the Viterbi decoding step. libsonare implements both in C++, replacing librosa's Numba-JIT'd inner loop, and computes the YIN difference function through an FFT rather than directly.

Decoding dominates: with the default 65–2093 Hz range the lattice has 1,202 states and roughly 100 reachable transitions per state, so a 73-second clip visits the inner update several hundred million times. Everything that can leave that loop has left it — the transition weights are stored as logarithms and the voiced/unvoiced switch costs are constants — leaving a compare-and-add over doubles.

The lattice is single-threaded. Unlike HPSS it gains nothing from extra cores, and for the same reason it gives up almost nothing in a browser — the WASM penalty is 1.20x, and what there is of it comes from the FFT in front of the lattice rather than from the decoding.

### Chroma (5.07x): tighter STFT → filterbank path

Chroma derives a 12-pitch-class representation from the spectrogram via a constant-Q-like filterbank. libsonare's STFT and the filterbank multiplication run as Eigen3-vectorized matrix operations on a single contiguous buffer, avoiding the dispatch overhead of librosa's stack of NumPy operations.

## Wins That Do Reach the Browser

The FFT backend is why most of the table above is native-only. These two are not: they are properties of how the work is organised rather than of the instruction set, so a tab gets them in full.

**Offline LUFS does not scale its working set with the clip length.** Materializing the K-weighted signal whole costs one `double` per sample per channel, which for a long file is gigabytes of scratch that the measurement never needs all of at once. Instead the signal is filtered in chunks into a sliding window holding only what the earliest unfinished gating block still owes — bounded by the 3-second short-term window no matter how long the input is. Over an hour of 48 kHz mono, peak resident memory is 706 MB rather than the 2.09 GB the whole-signal form requires, and the remainder is the caller's own input buffer. The filter state carries across chunks and every block is still summed in one pass over its own window, so the reported loudness is bit-for-bit the same either way.

**True peak interpolates only where a higher peak is still reachable.** Each polyphase phase bounds its output by the largest input magnitude its stencil can reach, so a group of output samples whose bound cannot exceed the peak found so far is skipped instead of computed. The measurement stays exact — only interpolations that provably cannot win are dropped. Material with a transient standing above its own body, which is most material, gets the whole benefit: a 10-second 48 kHz signal measured at 4x takes 0.6 ms where exhaustive interpolation of the same signal takes 6.1 ms. A signal sitting at full scale throughout has nothing to prune and costs what exhaustive interpolation costs.

## What's Not Faster (And Where)

- **STFT itself**: natively libsonare comes out 1.85x ahead, because its transform runs on SIMD kernels while librosa delegates to `scipy.fft`. In the browser there is no SIMD backend to run on, and the tables above put the WebAssembly STFT behind librosa on the same fixture — so this row reverses depending on where you run it.
- **Mel / MFCC / Onset Strength**: dominated by their underlying STFT cost — once that is paid, the per-frame Mel filterbank multiplication and DCT are too cheap for a different language to matter. They therefore inherit whatever the transform does: natively about 1.25x in libsonare's favour on all three, and in the browser roughly 3x the native cost, which puts them behind librosa there.
- **Beat tracking**: *slower* than librosa when called standalone, on either runtime, and by the widest margin of any row. Use `analyze()`, which shares the onset envelope, if you need beats alongside anything else.
- **Pipeline use cases**: inside `analyze()` these same features cost between 0.47 ms and 8.75 ms apiece natively — onset strength 0.47 ms, MFCC 0.89 ms, chroma 1.10 ms, spectral centroid 2.65 ms, mel spectrogram 8.75 ms — because the STFT and Mel are computed once and shared. The standalone numbers above represent the "what does it cost to call this in isolation" view, not the in-pipeline cost.

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
The native column above measures libsonare's C++ performance directly. If you call individual feature functions through the Python binding (e.g. `libsonare.stft(samples, sr)`), every call marshals the sample buffer across the FFI (foreign function interface) boundary, which dominates the runtime for cheap features. The all-in-one pipeline `analyze()` is unaffected — it runs end-to-end in C++ and only the small result struct crosses the boundary.
:::

## Notes

- Numbers are hardware-dependent. Apple M5 Max here; relative gaps are stable across machines, absolute milliseconds are not. Ratios are the part worth carrying to your own hardware.
- Synthetic test audio (deterministic chord progression + percussive bursts) is generated locally by a committed script rather than shipped as a binary, along with the ground truth the accuracy section scores against.
- WASM builds are single-threaded, so the speedups that come from fanning out across cores shrink there — HPSS most of all. They also keep KissFFT alone, so the transform-bound rows shrink for a second, independent reason. The paths that are neither threaded nor transform-bound, the pYIN lattice among them, carry over almost unchanged. Build the WASM bench above and measure it on the runtime you care about rather than scaling the native figures by guesswork.
- The offline LUFS and true-peak behaviour described under [Wins That Do Reach the Browser](#wins-that-do-reach-the-browser) is the exception: it is algorithmic, so it holds on every runtime.
