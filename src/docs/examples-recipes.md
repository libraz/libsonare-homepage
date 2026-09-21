---
title: Feature Recipes
description: Copy-paste recipes for every libsonare feature — BPM/key detection, all-in-one analysis, room acoustics, HPSS, audio effects, feature extraction, pitch detection, and streaming analysis — shown across the browser, Python, and CLI runtimes.
---

# Feature Recipes

This page continues [Usage Examples](./examples.md) with a deeper recipe per feature, shown across runtimes.

## Feature Recipes

Each recipe shows the same task across runtimes — pick the tab for where you run
libsonare. Browser examples pass decoded mono `Float32Array` samples; use Web
Audio, another JavaScript decoder, or `Audio.fromMemory*` before that step when
your input is encoded bytes. The Python package and `sonare` CLI load WAV/MP3
files directly. C++ programs are collected separately in the C++ section below.

### Basic BPM and Key Detection

::: code-group

```typescript [Browser]
import { init, detectBpm, detectKey } from '@libraz/libsonare';

async function quickAnalysis(url: string) {
  await init();

  const audioCtx = new AudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const bpm = detectBpm(samples, sampleRate);
  const key = detectKey(samples, sampleRate);

  console.log(`BPM: ${bpm}`);
  console.log(`Key: ${key.name} (confidence: ${(key.confidence * 100).toFixed(1)}%)`);
}
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    bpm = audio.detect_bpm()
    key = audio.detect_key()

print(f"BPM: {bpm}")
print(f"Key: {key.name} (confidence: {key.confidence * 100:.1f}%)")
```

```bash [CLI]
sonare bpm song.mp3
sonare key song.mp3
```

:::

### All-In-One Music Analysis

In both the browser and Python, `analyze()` returns chords, sections, and form
(plus timbre, dynamics, rhythm, and melody) in one call. `detect_chords()` and
`analyze_sections()` stay available as standalone calls for when you want only
that one element without running the all-in-one analysis.

::: tip Python: function vs. method
The module-level `analyze(samples, sample_rate)` returns the all-in-one analysis result.
The `Audio.analyze()` method returns only the core summary (BPM, key, time
signature, beats), so pass the samples to the function when you need chords,
sections, and form together.
:::

::: warning `analyze()` reports triads
The all-in-one path runs chord detection with `useTriadsOnly` set to `true`, so `result.chords` comes back as triads — a seventh in the music is reported as the triad inside it. Pass `useTriadsOnly: false` to `analyze()` if you want the extended vocabulary there, or call `detectChords()` on its own, which searches the extended vocabulary by default.
:::

::: code-group

```typescript [Browser]
import { init, analyze } from '@libraz/libsonare';

await init();

const result = analyze(samples, sampleRate);

console.log('=== Music Analysis ===');
console.log(`BPM: ${result.bpm} (confidence: ${(result.bpmConfidence * 100).toFixed(0)}%)`);
console.log(`Key: ${result.key.name}`);
console.log(`Time Signature: ${result.timeSignature.numerator}/${result.timeSignature.denominator}`);

console.log('\nChords:');
for (const chord of result.chords) {
  console.log(`  ${chord.name} [${chord.start.toFixed(2)}s - ${chord.end.toFixed(2)}s]`);
}

console.log('\nSections:');
for (const section of result.sections) {
  console.log(`  ${section.name} [${section.start.toFixed(2)}s - ${section.end.toFixed(2)}s]`);
}

console.log(`\nForm: ${result.form}`);
```

```python [Python]
from libsonare import Audio, analyze

with Audio.from_file("song.mp3") as audio:
    result = analyze(audio.data, audio.sample_rate)

print("=== Music Analysis ===")
print(f"BPM: {result.bpm} (confidence: {result.bpm_confidence * 100:.0f}%)")
print(f"Key: {result.key.name}")
print(f"Time Signature: {result.time_signature}")

print("\nChords:")
for chord in result.chords:
    print(f"  {chord.name} [{chord.start:.2f}s - {chord.end:.2f}s]")

print("\nSections:")
for section in result.sections:
    print(f"  {section.name} [{section.start:.2f}s - {section.end:.2f}s]")

print(f"\nForm: {result.form}")

# Want only one element? Call it standalone instead of the all-in-one analysis:
#   chords = audio.detect_chords().chords
#   sections = analyze_sections(audio.data, audio.sample_rate).sections
```

```bash [CLI]
sonare analyze song.mp3 --json > analysis.json
```

:::

::: details What are "sections" and "form"?
**Sections** are the structural parts of a song — intro, verse, chorus, bridge, outro — found from where the music's character changes. **Form** is the whole arrangement expressed as a compact pattern of those sections (for example `intro–verse–chorus–verse–chorus–outro`, sometimes written with letters such as `ABABCB`). Together they answer "how is this song laid out over time?"
:::

### Room Acoustic Metrics

Start from the input you have:

| Input or goal | Use |
|---------------|-----|
| Measured impulse response | `analyzeImpulseResponse()` |
| Ordinary music or speech recording | `detectAcoustic()` |
| Practical room model inferred from audio | `estimateRoom()` |
| Room dimensions you want to turn into an impulse response | `synthesizeRir()` |
| Creative effect that pushes audio toward a target room | `roomMorph()` |

::: info RIR and equivalent room
**RIR** means room impulse response: audio samples that describe how a room reacts to a short sound. An **equivalent room** is a useful inferred model, not a scan of the exact physical room.
:::

Blind estimates and equivalent-room estimates are useful for tagging or monitoring. Use `confidence` to decide how strongly your UI should present them.

::: code-group

```typescript [Browser]
import { init, analyzeImpulseResponse, detectAcoustic, estimateRoom, synthesizeRir, roomMorph } from '@libraz/libsonare';

await init();

const measured = analyzeImpulseResponse(irSamples, sampleRate);
console.log(`RT60: ${measured.rt60.toFixed(2)} s`);
console.log(`C80: ${measured.c80.toFixed(1)} dB`);

const blind = detectAcoustic(samples, sampleRate);
console.log(`Blind RT60: ${blind.rt60.toFixed(2)} s`);
console.log(`Confidence: ${(blind.confidence * 100).toFixed(0)}%`);

const estimate = estimateRoom(samples, sampleRate);
console.log(`Estimated room: ${estimate.length.toFixed(1)} x ${estimate.width.toFixed(1)} x ${estimate.height.toFixed(1)} m`);

const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2 });
const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

```python [Python]
from libsonare import Audio, analyze_impulse_response, estimate_room, synthesize_rir, room_morph

with Audio.from_file("room-ir.wav") as ir:
    measured = analyze_impulse_response(ir.data, sample_rate=ir.sample_rate)

print(f"RT60: {measured.rt60:.2f} s")
print(f"C80: {measured.c80:.1f} dB")

with Audio.from_file("recording.wav") as audio:
    blind = audio.detect_acoustic()
    estimate = estimate_room(audio.data, audio.sample_rate)
    rir = synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=audio.sample_rate)
    morphed = room_morph(audio.data, audio.sample_rate, 12.0, 9.0, 4.0, wet=0.6)

print(f"Blind RT60: {blind.rt60:.2f} s")
print(f"Confidence: {blind.confidence * 100:.0f}%")
print(f"Estimated room: {estimate.length:.1f} x {estimate.width:.1f} x {estimate.height:.1f} m")
```

```bash [CLI]
# Treat the file as a measured impulse response:
sonare acoustic room-ir.wav --ir --json

# Estimate acoustic parameters from ordinary audio:
sonare acoustic recording.wav --json

# Estimate, synthesize, or morph a geometric room:
sonare estimate-room recording.wav --json
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav
sonare room-morph recording.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

### Harmonic-Percussive Separation

::: code-group

```typescript [Browser]
import { init, hpss, detectKey } from '@libraz/libsonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic - melodic content
// result.percussive - drums/percussion

// Drums and transients smear the chroma estimate; running key
// detection on just the harmonic part gives a cleaner result.
const key = detectKey(result.harmonic, result.sampleRate);
```

```python [Python]
from libsonare import Audio, detect_key

with Audio.from_file("song.mp3") as audio:
    result = audio.hpss()
    # result.harmonic - melodic content
    # result.percussive - drums/percussion

# Drums and transients smear the chroma estimate, so running key
# detection on just the harmonic component gives a cleaner result.
key = detect_key(result.harmonic, result.sample_rate)
```

```bash [CLI]
# The pip-installed Python CLI writes both stems and reports their energies:
sonare hpss song.mp3 -o separated --json

# The native release executable supports the same operation under its own name:
#   sonare-cli hpss song.wav -o separated --json
```

:::

### Audio Effects

::: code-group

```typescript [Browser]
import { init, timeStretch, pitchShift, normalize, trim } from '@libraz/libsonare';

await init();

// Slow down to 80% speed
const slower = timeStretch(samples, sampleRate, 0.8);

// Transpose up 2 semitones
const higher = pitchShift(samples, sampleRate, 2);

// Normalize to -3dB
const normalized = normalize(samples, sampleRate, -3);

// Trim silence
const trimmed = trim(samples, sampleRate, -60);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    slower = audio.time_stretch(0.8)        # slow down to 80% speed
    higher = audio.pitch_shift(2)           # transpose up 2 semitones
    normalized = audio.normalize(-3)        # normalize to -3 dB
    trimmed = audio.trim(-60)               # trim silence below -60 dB
```

```bash [CLI]
# These commands work with the pip-installed Python CLI.
sonare time-stretch song.wav --rate 0.8 -o slower.wav
sonare pitch-shift song.wav --semitones 2 -o higher.wav
sonare normalize song.wav --target-db -3 -o normalized.wav
sonare trim-silence song.wav -o trimmed.wav
```

:::

### Feature Extraction

::: code-group

```typescript [Browser]
import { init, melSpectrogram, mfcc, chroma } from '@libraz/libsonare';

await init();

// Mel spectrogram
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
console.log(`Mel shape: ${mel.nMels} x ${mel.nFrames}`);

// MFCC
const mfccResult = mfcc(samples, sampleRate, 2048, 512, 128, 13);
console.log(`MFCC shape: ${mfccResult.nMfcc} x ${mfccResult.nFrames}`);

// Chroma
const chromaResult = chroma(samples, sampleRate);
console.log('Pitch class distribution:', chromaResult.meanEnergy);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    # Mel spectrogram
    mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
    print(f"Mel shape: {mel.n_mels} x {mel.n_frames}")

    # MFCC
    mfcc_result = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=13)
    print(f"MFCC shape: {mfcc_result.n_mfcc} x {mfcc_result.n_frames}")

    # Chroma
    chroma_result = audio.chroma()
    print("Pitch class distribution:", chroma_result.mean_energy)
```

```bash [CLI]
sonare mel song.mp3 --json
sonare chroma song.mp3 --json
# MFCC has no dedicated CLI command; use the browser or Python API.
```

:::

### Pitch Detection

Pitch tracking reports F0 — the fundamental frequency, the lowest frequency of a
periodic sound and the one you hear as its pitch — frame by frame, which is how
you get a melody line out of monophonic audio.

::: code-group

```typescript [Browser]
import { init, pitchPyin } from '@libraz/libsonare';

await init();

const pitch = pitchPyin(samples, sampleRate);

console.log(`Median F0: ${pitch.medianF0.toFixed(1)} Hz`);
console.log(`Mean F0: ${pitch.meanF0.toFixed(1)} Hz`);
console.log(`Voiced frames: ${pitch.voicedFlag.filter(v => v).length}/${pitch.nFrames}`);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    pitch = audio.pitch_pyin()

voiced = sum(1 for v in pitch.voiced_flag if v)
print(f"Median F0: {pitch.median_f0:.1f} Hz")
print(f"Mean F0: {pitch.mean_f0:.1f} Hz")
print(f"Voiced frames: {voiced}/{pitch.n_frames}")
```

```bash [CLI]
sonare pitch song.mp3 --algorithm pyin --json
```

:::

::: details What do "voiced" frames mean?
Pitch trackers label each frame as **voiced** or **unvoiced**. *Voiced* means a clear periodic pitch was found (a sung vowel, a held note); *unvoiced* means there is no definite pitch (silence, breaths, consonants like "s"/"t", or noisy/percussive sound). `voicedFlag` / `voiced_flag` is that per-frame boolean, so counting the `true` values tells you how much of the clip actually carried a trackable melody.
:::

<SonareDemo id="melody-contour" />

### Streaming Analysis

Real-time audio analysis for visualizations and live monitoring.

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

await init();

// Create analyzer for 44.1kHz audio
const analyzer = new StreamAnalyzer({
  sampleRate: 44100,
  nFft: 2048,
  hopLength: 512,
  nMels: 128,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
  emitEveryNFrames: 4, // emit one frame per 4 hops (~21 fps at 44.1 kHz with hopLength 512)
});

// Process incoming audio chunks
function onAudioData(samples: Float32Array) {
  analyzer.process(samples);

  // Check for available frames
  const available = analyzer.availableFrames();
  if (available > 0) {
    const frames = analyzer.readFrames(available);

    // frames.nFrames        - number of frames
    // frames.timestamps     - [nFrames] Float32Array (stream time in seconds)
    // frames.mel            - [nFrames * nMels] Float32Array
    // frames.chroma         - [nFrames * nChroma] Float32Array (empty when CHROMA is disabled)
    // frames.featureFlags   - MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
    // frames.onsetStrength  - [nFrames] Float32Array
    // frames.rmsEnergy      - [nFrames] Float32Array
    // frames.spectralCentroid / spectralFlatness / chordRoot / chordQuality / chordConfidence

    updateVisualization(frames);
  }
}

// Get BPM/key estimates that update as audio arrives
function checkEstimates() {
  const stats = analyzer.stats();

  if (stats.estimate.bpm > 0) {
    console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(stats.estimate.bpmConfidence * 100).toFixed(0)}%)`);
  }

  if (stats.estimate.key >= 0) {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const mode = stats.estimate.keyMinor ? 'minor' : 'major';
    console.log(`Key: ${keys[stats.estimate.key]} ${mode}`);
  }
}
```

### Streaming with AudioWorklet

```typescript
// analyzer-processor.ts (AudioWorklet)
import { init, StreamAnalyzer } from '@libraz/libsonare';

class AnalyzerProcessor extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;

  constructor() {
    super();
    void init().then(() => {
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64,
        emitEveryNFrames: 4,
      });
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || !this.analyzer) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);
      this.port.postMessage({ type: 'frames', data: frames }, [
        frames.timestamps.buffer,
        frames.mel.buffer
      ]);
    }

    return true;
  }
}

registerProcessor('analyzer-processor', AnalyzerProcessor);
```

```typescript
// main.ts
const audioCtx = new AudioContext();
await audioCtx.audioWorklet.addModule('analyzer-processor.js');

const worklet = new AudioWorkletNode(audioCtx, 'analyzer-processor');
worklet.port.onmessage = (e) => {
  if (e.data.type === 'frames') {
    renderSpectrogram(e.data.data);
  }
};

const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
audioCtx.createMediaStreamSource(stream).connect(worklet);
```

