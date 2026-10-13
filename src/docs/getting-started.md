# Getting Started

libsonare is a dependency-free C++17 audio engine for music information retrieval (MIR), mastering, mixing, editing, creative FX, and browser-native music tools. This page takes you from nothing installed to a printed BPM, key, and chord list in the runtime you already use.

If you are unsure which feature you need, start with the [Learning Path](./learning-path.md).

## What You Will Learn

By the end of this page you should be able to:

- explain the sample/sample-rate/mono/stereo vocabulary every API uses;
- pick the runtime that matches your project;
- install libsonare and print a first analysis result in the browser, Node.js, Python, or a terminal;
- know which reference to open next.

## Before You Choose A Runtime

Most examples follow the same pattern: load or decode audio, pass `Float32Array` samples plus a sample rate, then read the result.

| Term | Plain meaning |
|------|---------------|
| Sample | One amplitude value in the audio waveform |
| Sample rate | How many samples exist per second, such as 44,100 or 48,000 |
| Mono | One channel of audio |
| Stereo | Two channels, left and right |
| WASM | WebAssembly, the runtime the npm package compiles to; it runs in browsers and in Node.js |

[Audio Basics](./glossary/concepts/audio-basics.md) explains these terms at more length.

::: info Separate the file from the samples
MP3 and WAV are file formats. Most libsonare APIs receive decoded PCM samples, such as a `Float32Array` in JavaScript or a sample array in Python. Every runtime below can decode WAV and MP3 for you; for other formats, the browser decodes the file first, and Python needs an FFmpeg-enabled build.
:::

## Where Does It Run?

| Runtime | Install | Reads files directly? | Reference |
|---------|---------|-----------------------|-----------|
| Browser | `npm install @libraz/libsonare`, or the [CDN build](./wasm.md#cdn) | Decodes WAV/MP3 bytes; other formats go through the browser's decoder | [WebAssembly Guide](./wasm.md) |
| Node.js (WASM) | `npm install @libraz/libsonare` (Node.js 22.12 or later) | Decodes WAV/MP3 bytes you read with `node:fs` | [JavaScript API](./js-api.md) |
| Python | `pip install libsonare` (Python 3.11 or later) | Yes, WAV and MP3; more formats with FFmpeg | [Python API](./python-api.md) |
| CLI | `pip install libsonare`, which installs the `sonare` command | Yes, the same formats as the Python package | [CLI Reference](./cli.md) |

The npm package does not install the `sonare` command. The Node.js native addon and the C++ library are built from source; see [Native Bindings](./native-bindings.md) and [C++ API](./cpp-api.md).

## First Result

Each tab is complete: an install line, the program, and the output it prints. The examples analyze `demo.mp3`, the track the [Music Analysis Studio](/music-analysis) loads, so you can compare your output with the demo.

::: code-group

```html [Browser]
<!-- first.html — serve the folder with any static server (for example `npx serve`)
     and pick demo.mp3 from https://libsonare.libraz.net/demo.mp3 -->
<input type="file" id="file" accept=".mp3,.wav" />
<pre id="out"></pre>
<script type="module">
  import { init, Audio } from 'https://unpkg.com/@libraz/libsonare';

  await init();
  document.getElementById('file').addEventListener('change', async (event) => {
    const bytes = new Uint8Array(await event.target.files[0].arrayBuffer());
    const result = Audio.fromMemory(bytes).analyze();
    document.getElementById('out').textContent = [
      `BPM: ${result.bpm.toFixed(1)}`,
      `Key: ${result.key.name}`,
      `First chords: ${result.chords.slice(0, 8).map((c) => c.name).join(' ')}`,
    ].join('\n');
  });
</script>

<!-- Shows:
BPM: 160.4
Key: C major
First chords: C Am C Bm G G#m Em C
-->
```

```js [Node.js (WASM)]
// npm install @libraz/libsonare
// curl -O https://libsonare.libraz.net/demo.mp3
// node first.mjs
import { readFileSync } from 'node:fs';
import { init, Audio } from '@libraz/libsonare';

await init();
const audio = Audio.fromMemory(new Uint8Array(readFileSync('demo.mp3')));
const result = audio.analyze();

console.log('BPM:', result.bpm.toFixed(1));
console.log('Key:', result.key.name);
console.log('First chords:', result.chords.slice(0, 8).map((c) => c.name).join(' '));

// BPM: 160.4
// Key: C major
// First chords: C Am C Bm G G#m Em C
```

```python [Python]
# pip install libsonare
# curl -O https://libsonare.libraz.net/demo.mp3
# python first.py
from libsonare import Audio

audio = Audio.from_file("demo.mp3")
result = audio.analyze()

print(f"BPM: {result.bpm:.1f}")
print(f"Key: {result.key.name}")
print("First chords:", " ".join(c.name for c in result.chords[:8]))

# BPM: 160.4
# Key: C major
# First chords: C Am C Bm G G#m Em C
```

```bash [CLI]
pip install libsonare
curl -O https://libsonare.libraz.net/demo.mp3
sonare analyze demo.mp3

# warning: 2-channel input is downmixed to mono by this CLI command; use the stereo library API for channel-preserving processing
#
#   > Estimated BPM : 160.42 BPM  (conf 80.7%)
#   > Estimated Key : C major  (conf 98.3%)
#   > Time Signature: 4/4
#   > Beats: 192
```

:::

`analyze()` returns the whole result in one call: beats, chords, sections and form alongside BPM and key, plus timbre, dynamics, rhythm, and melody. [Music Analysis](./analysis.md) explains each field and when to call a single estimator instead.

`Audio.fromMemory` and `Audio.from_file` fold a stereo file to mono, which is what the analysis expects. To decode AAC, OGG, or FLAC in the browser, use `Audio.fromMemoryWithBrowserFallback` ([File Input](./wasm.md#file-input)). A bundled app imports from `'@libraz/libsonare'` instead of the CDN URL.

::: details Node.js native addon
The N-API addon `@libraz/libsonare-native` runs libsonare as compiled machine code instead of WebAssembly and loads files from a path. It is not published to npm, so build it from a checkout:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

```typescript
import { Audio } from '@libraz/libsonare-native';

const result = Audio.fromFile('demo.mp3').analyze();
console.log('BPM:', result.bpm, 'Key:', result.key.name);
```

See [Node.js / Native Bindings](./native-bindings.md).
:::

## What libsonare Can Do

| Area | Example | Start page |
|------|---------|------------|
| Analysis | BPM, key, chords, beats and downbeats, sections, melody | [Music Analysis](./analysis.md) |
| Editing and repair | Pitch correction, time stretch, note edits, noise and hum reduction | [Editing DSP](./editing-dsp.md), [Audio Repair Workflow](./audio-repair.md) |
| Mixing and mastering | Channel strips, sends and buses; mastering chains with LUFS targets and true-peak limiting | [Mixing Engine](./mixing.md), [Mastering Assistant](./mastering-assistant.md) |
| Instruments and MIDI | A seventeen-engine synthesizer, a GM/GS fallback bank, a SoundFont 2 player | [Sound Sources](./sound-sources.md), [Built-in Synthesizer](./native-synth.md) |
| Projects and realtime | Headless-DAW projects with offline bounce, streaming analysis, a realtime engine | [Project Editing](./project-editing.md), [Realtime and Streaming](./realtime-streaming.md) |
| Room acoustics | RT60 and clarity, room estimates from audio, impulse-response synthesis | [Room Acoustics](./acoustic-analysis.md) |

The [Learning Path](./learning-path.md) lists every area with the page written for each goal.

::: details Acronyms in this table
- **BPM**: beats per minute, the tempo of the song.
- **LUFS / true peak**: mastering metrics. LUFS (Loudness Units relative to Full Scale) measures perceived loudness; true peak measures peak safety, including peaks between samples.
- **RT60**: the time a room's reverberation takes to fall by 60 dB.
:::

## Try It Now

The chords you just printed come from chroma frames matched against chord templates. This demo runs the same chord recognition on a short C–Am–F–G clip, computed by the WASM build you just installed:

<SonareDemo id="chord-track" />

The [Demos](/demos) page has the full browser tools; drop an audio file onto any of them, and nothing is uploaded.

## Next Steps

You have one example running. What comes next depends on which of two readers you are.

### If you want to build something

- [Examples](/docs/examples) — the working pattern closest to your task, in each runtime
- [Learning Path](/docs/learning-path) — a route by goal through the ten subject areas, from analysis to playback
- [Use Cases](/docs/use-cases) — a whole job carried from raw files to a deliverable, as a script you can run
- [Installation](/docs/installation) — FFmpeg decoding, source builds, and the Node native addon, once the defaults are not enough

### If you want to understand the engine

- [Introduction](/docs/introduction) — the analysis pipeline from waveform to chords, and the vocabulary every other page assumes
- [Music Analysis](/docs/analysis) — what each result you just printed means, and which call to reach for when `analyze()` is too coarse
- [Sound Sources](/docs/sound-sources) — why the engine ships no samples, and where its instruments' sound comes from instead
- [DSP Implementation Notes](/docs/dsp-implementation) — how the processors are structured, for when you need to expose their controls or explain a render
