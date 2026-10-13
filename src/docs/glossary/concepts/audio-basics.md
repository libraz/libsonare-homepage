---
title: Audio Basics
description: Samples and sample rate, bit depth, mono/stereo, frequency and harmonics, time vs frequency domain, amplitude and dB, clipping, headroom, and latency in one practical guide.
---

# Audio Basics

These are the audio terms you need before reading analysis or mastering pages. They are grouped here because they explain the same signal path: how sound is represented, measured, clipped, delayed, and played back.

## Sample Rate

Sound is a continuous pressure wave. Digital audio stores it as a list of numbers, each one a **sample**: the wave's value measured at one instant. Sample rate is how many audio samples are stored per second. `44.1 kHz` and `48 kHz` are common delivery rates. The highest frequency a rate can represent is half of it (the Nyquist limit), so 44.1 kHz covers up to 22.05 kHz. Higher rates also use more CPU and memory.

For most browser analysis and mastering work, the best first choice is the file's original sample rate. Avoid unnecessary conversion unless a tool requires it.

::: warning Always pass the file's real sample rate
Analysis functions assume 22050 Hz when `sampleRate` is omitted. Audio recorded at 44.1 kHz and analyzed without it is read at half speed: a 120 BPM click track reports 60 BPM, and no error is raised. In Python, `Audio.from_file` reads the rate from the file, but the free functions (`detect_bpm(samples)`) share the same 22050 default.
:::

## Bit Depth

Bit depth describes the resolution of stored sample values. More bits do not raise the ceiling (full scale is `0 dBFS` at any word length). They lower the quantization noise floor underneath it, roughly 6 dB per bit. That is what lets quiet detail survive and what makes it cheap to work well below full scale. Final consumer files are often 16-bit or compressed formats, while production files are commonly 24-bit or floating point.

<SamplingFigure
  title="Sampling, quantization and aliasing"
  caption="Left: the wave is read once per sample period, and each reading is rounded to the nearest of eight levels (3 bits), so the dots sit slightly off the curve. Every extra bit halves the step. Right: a 30 kHz tone sampled at 44.1 kHz gives exactly the samples a 14.1 kHz tone would, so once it is sampled nothing can tell the two apart."
/>

When a file is reduced to a fixed-point format, **dither** (a very small amount of noise added before rounding) keeps the rounding error from turning into distortion on quiet passages. Floating-point files are not rounded, so they need none.

Inside Web Audio and libsonare processing, samples are represented as floating-point values. Floating point is the one case where the format itself has room *above* full scale, so an intermediate stage can overshoot `1.0` without clipping; the final export back to fixed-point still needs sensible peak safety.

## Mono and Stereo

Mono has one channel. Stereo has left and right channels. Stereo can create width and spatial placement, but it also introduces [mono-compatibility](./mono-compatibility.md) questions.

One **sample frame** is one sample from every channel at the same instant: a stereo frame is a left and a right sample. Positions and lengths in audio are counted in sample frames, so one second of 48 kHz stereo is 48,000 frames holding 96,000 samples. Most analysis calls take a single channel; `Audio.fromMemory` and `Audio.from_file` fold stereo to mono by averaging the two channels.

When a stereo signal is summed to mono, some side information can weaken or cancel ([Phase and Polarity](#phase-and-polarity) below shows why). This is why the mastering demo shows correlation (a `-1` to `+1` reading of how in-phase the left and right channels are) and stereo image.

## Frequency, Pitch, and Harmonics

**Frequency** is how many times per second a wave repeats, in hertz (Hz). A4 repeats 440 times a second, so one cycle (its **period**) lasts 1/440 s, about 2.27 ms. Human hearing spans roughly 20 Hz to 20 kHz. Each doubling of frequency is one octave higher: 220 Hz, 440 Hz, and 880 Hz are all A.

**Pitch** is the musical height you hear. For most instrument and vocal notes it follows the **fundamental frequency** (F0), the rate at which the whole waveform repeats.

A note is rarely a single frequency. A sung or played note also contains **harmonics** at whole-number multiples of the fundamental: a 110 Hz note has energy at 220, 330, 440 Hz, and so on. The general word for any single frequency component is a **partial**; harmonics are the partials that fall on exact multiples. Bells, cymbals, and piano strings also have **inharmonic** partials that sit off those multiples. The balance among the partials is a large part of what makes two instruments sound different on the same note ([timbre](../analysis/mel-mfcc-timbre.md)).

<SonareDemo id="waveform-harmonics" />

## Time Domain and Frequency Domain

The samples in a file are the **time domain**: the wave's value moment by moment, the picture a waveform display draws. The same sound can be described in the **frequency domain** instead, as how strong each frequency is: its **spectrum**. The Fourier transform converts one view into the other, and the demo above shows both at once.

Analysis works in the frequency domain because pitch, chords, and timbre live there. It cuts the audio into short overlapping blocks and takes a spectrum of each. One block is an **analysis frame**, which is a different thing from a sample frame. With the common settings `nFft = 2048` and `hopLength = 512` at 44.1 kHz, each analysis frame spans 2048 samples (46.4 ms), a new one starts every 512 samples (11.6 ms, about 86 frames per second), and the spectrum has one bin every 44100 / 2048 ≈ 21.5 Hz. [Spectrogram and STFT](../analysis/spectrogram-stft.md) covers the window function and the time/frequency trade-off.

### Nyquist and aliasing

A sample rate can only describe frequencies below half of itself, the **Nyquist frequency**. A tone above it does not disappear when it is sampled; it folds back and shows up as a false lower frequency, which is called **aliasing**. At 44.1 kHz, a 30 kHz tone would read as 44.1 − 30 = 14.1 kHz. Converters filter out everything above Nyquist before sampling, and resampling filters again before it lowers the rate, for this reason.

### Phase and polarity

**Phase** is where in its cycle a wave is at a given moment, measured in degrees (360° is one full cycle). Two copies of the same wave add up or cancel depending on their phase offset:

| Two equal copies of one sine | Their sum |
|------------------------------|-----------|
| In phase (0°) | Twice the amplitude, +6.02 dB |
| 90° apart | +3.01 dB |
| 180° apart | Silence: they cancel completely |

**Polarity** is the sign of the whole signal: inverting it multiplies every sample by `-1`. A polarity-inverted copy cancels the original at every frequency at once, while a time delay shifts phase by a different amount at each frequency, so it cancels some frequencies and reinforces others. Both are the mechanisms behind mono cancellation.

<SonareDemo id="mono-fold" />

## Amplitude and dB

Amplitude is the instantaneous sample value. dB is a logarithmic way to describe level. Audio work uses dB because human loudness perception is closer to logarithmic than linear.

Fixed-point PCM sample values are usually normalized to the range `-1.0` to `1.0`. When level is measured against that digital ceiling, it is written in **dBFS** (decibels relative to full scale): a full-scale sample is `0 dBFS`, and fixed-point values below it are negative. Floating-point intermediate buffers can exceed `1.0` before final export, so their dBFS can be above `0` until the signal is constrained.

| Level | Sample value |
|-------|--------------|
| 0 dBFS | 1.0 |
| -6.02 dBFS | 0.5 |
| -20 dBFS | 0.1 |
| -60 dBFS | 0.001 |

The conversion depends on what the number measures:

| Quantity | Formula | Doubling it adds |
|----------|---------|------------------|
| Amplitude (a sample value, peak, or RMS) | `dB = 20 · log10(amplitude)` | +6.02 dB |
| Power or energy (a mean square, the inside of LUFS) | `dB = 10 · log10(power)` | +3.01 dB |

Both give the same answer for the same signal, because power is amplitude squared. So every 6 dB halves or doubles the amplitude, and every 3 dB halves or doubles the power. A difference in LUFS is counted in LU, and 1 LU is the same step as 1 dB. One signal also has several levels, depending on what is being measured:

| Reading | Measures | Call | 0.5-amplitude 1 kHz sine |
|---------|----------|------|--------------------------|
| Peak | The highest single sample | `meteringPeakDb` | -6.02 dBFS |
| RMS | Average energy | `meteringRmsDb` | -9.03 dBFS |
| Loudness | Gated, frequency-weighted perceived level | `lufs().integratedLufs` | -9.02 LUFS |

For a sine, peak minus RMS is always 3.01 dB. That gap is the [crest factor](./crest-factor.md), and real music has a much larger one.

## Clipping and Headroom

Clipping happens when a signal asks for more level than the system can represent. Digital clipping can sound harsh because waveform peaks are cut flat.

Headroom is the margin between the current peak level and the ceiling. Mastering needs enough headroom before final limiting, and enough [true-peak](../true-peak.md) safety after final rendering. True peak counts the higher peaks that appear *between* the stored samples once playback or lossy encoding reconstructs the waveform, so it can sit above the plain sample peak. Mastering targets are written in [LUFS](../lufs.md); the ceiling is a separate, peak-based limit.

## Latency

Latency is delay. Some processing, especially lookahead limiting and spectral repair, needs future samples before it can decide what to do. Offline rendering can tolerate latency. Live monitoring and interactive tools need it kept low.

Latency in seconds is the delay in sample frames divided by the sample rate. The true-peak limiter's default 1 ms lookahead is 48 samples at 48 kHz. Where latency constrains a design, see [Realtime Safety](../realtime/realtime-safety.md) and [True Peak Safety](./true-peak-safety.md).

## Measure it in libsonare

Peak, RMS, loudness, and clipping each have a direct call.

::: code-group

```typescript [Browser]
import { init, meteringPeakDb, meteringRmsDb, meteringDetectClipping, lufs } from '@libraz/libsonare';

await init();

// samples: mono Float32Array; sampleRate: the file's real rate
const peak = meteringPeakDb(samples, sampleRate);              // highest sample, dBFS
const rms = meteringRmsDb(samples, sampleRate);                // average energy, dBFS
const { integratedLufs } = lufs(samples, sampleRate);          // gated, weighted loudness
const { clippingRatio } = meteringDetectClipping(samples, sampleRate);
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("song.wav")
peak = audio.peak_db()
rms = audio.rms_db()
integrated = audio.lufs().integrated_lufs
clipping_ratio = audio.detect_clipping().clipping_ratio
```

```bash [CLI]
sonare lufs song.wav      # integrated, momentary and short-term LUFS, and loudness range
sonare meter song.wav     # native CLI only: peak, RMS, crest, true peak, clipping, DC offset, silence
sonare clipping song.wav  # native CLI only: clipped samples and regions
```

:::

:::: details Implementation notes

The browser demo decodes files through Web Audio, processes floating-point buffers through libsonare WASM, and exports a WAV: 16-bit or 24-bit PCM (24-bit by default, with TPDF dither unless you turn it off or choose noise-shaped), or 32-bit float, which is never dithered. The mastering worker keeps heavy rendering away from the UI thread. Object URLs for source, rendered audio, reports, and settings are revoked when replaced to avoid accumulating browser memory.

::::

Related: [Mono Compatibility](./mono-compatibility.md), [True Peak Safety](./true-peak-safety.md), [Reading Mastering Meters](../mastering/meter-reading.md)
