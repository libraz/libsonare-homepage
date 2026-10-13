# FAQ

The table answers the questions that come up in a first session. The sections after it cover what the music-analysis results mean and how far to trust them. For what is tested and how, see [Implementation Validation](./implementation-validation.md); for where libsonare agrees with librosa, see [librosa Compatibility](./librosa-compatibility.md).

## Quick answers

| Question | Answer | Page |
|----------|--------|------|
| Which formats open without FFmpeg? | WAV and MP3, in every runtime. The browser can decode AAC, OGG, and FLAC through its own codecs with `Audio.fromMemoryWithBrowserFallback`; Python and the CLI need an FFmpeg-enabled build for those. `sonare doctor` lists what the installed build decodes. | [Installation](./installation.md#python-pip), [File Input](./wasm.md#file-input) |
| The BPM is half or double what I expected. | Both readings are usually supported by the same periodicity. `result.bpmCandidates` labels each candidate `primary`, `half`, `double`, or `other`, and `analyzeBpm` accepts a narrower `bpmMin` / `bpmMax` range. | [Tempo](./analysis.md#tempo), [Tempo and BPM](./glossary/analysis/tempo-bpm.md) |
| What happens to a stereo file? | `Audio.fromMemory` and `Audio.from_file` fold it to mono, which is what the analysis expects. Mixing, mastering, and `roomMorphStereo` keep both channels. | [Stereo to Mono Conversion](./wasm.md#stereo-to-mono-conversion) |
| Is my audio uploaded anywhere? | No. Every binding runs the engine in your own process, and the browser build runs it in the page. The demos on this site upload nothing. | [Browser Local Processing](./glossary/concepts/browser-local-processing.md) |
| Do I have to call `.delete()` in JavaScript? | Not on `Audio` or on the plain objects functions return; they hold no WASM memory. Stateful classes such as `StreamAnalyzer`, `Mixer`, `Project`, and `RealtimeEngine` do: call `delete()` when you are done, or declare them with `using`. | [Memory Issues](./wasm.md#memory-issues) |
| Is it ready for production? | It is past 1.0 with semantic-version tags and is maintained by one developer. Pin the version, read the release notes before upgrading, and validate the features you depend on against your own material. | [Project Status & Support](./introduction.md#project-status-support) |

## How accurate is the music analysis?

There is no published figure yet, and the librosa agreement is not one.

Matching librosa means the two libraries compute the same thing. Whether the thing they compute names the right key, or finds the right chord, is a different question, and only annotated recordings answer it. A chroma vector that both libraries agree on can still be a chroma vector the key estimator reads wrongly.

What exists instead is the apparatus for measuring it. `tests/fixtures/music_eval/` in the library repository holds manifests for key, BPM, beat, downbeat, meter and chord accuracy, and `tools/eval/summarize_accuracy.py` rolls a run of them into per-dataset figures: key accuracy and MIREX weighted score, chord weighted symbol recall, beat F-measure. The corpora those manifests point at (GiantSteps, Isophonics, Billboard, Ballroom, SMC and friends) are licensed for research use and cannot be redistributed, so the manifests ship empty and the measurement runs against a corpus you hold. `make accuracy-report` runs it end to end.

Until that measurement exists, the honest position is that the analysis is a competent classical-DSP implementation with no measured accuracy attached.

## What does `confidence` mean?

It is the model's own belief, not an accuracy estimate. The two are easy to conflate and the distinction matters for anything that branches on the number.

For key detection specifically, `confidence` is a posterior: a softmax over the profile correlations of every candidate key that was scored. So it falls as the runner-up closes in, and a relative major and minor that split the same chroma evidence each report about half rather than both reporting a high score. That is useful — it tells you when the estimate is contested — but it says how decisively the chroma picked one candidate out of the set, not how often that pick is right.

Nothing in the library has been calibrated against annotated recordings, so a confident wrong answer is entirely possible. A pipeline that thresholds on confidence should pick its threshold against its own material, and treat a high value as "the evidence was one-sided", not as "this is probably correct".

Section confidence and chord confidence are different quantities again, each documented at its own type. They are not comparable with each other or with the key posterior.

## Why did it report the relative minor instead of the major (or the other way round)?

Because a chord and its relative share most of their notes, and a chromagram folds every octave into twelve numbers. A major and the minor a third below have two of three tones in common, and once the register information is gone there is very little left to say which note is the root.

The chord recognizer addresses this by weighing the low register separately: the bass names the root far more reliably than the folded chroma does, so a candidate whose root the bass sounds is preferred over one whose root it does not. The weighting is deliberately a tie-breaker rather than an override, because the bass names the root only in root position — a strong bass prior would relabel every inversion after its own bass note.

If a specific track still comes back on the relative, the useful levers are: give the analyzer material that has a bass part (a stem with the bass removed loses exactly the cue this depends on), enable chord–key context so the progression constrains the reading, and look at the runner-up candidates rather than only the winner. `detectKeyCandidates` (Python: `detect_key_candidates`; C++: `KeyAnalyzer`) returns all 24 candidates, each with its profile correlation and its posterior share in `key.confidence`, and a contested relative pair is visible there as two near-equal shares.

## Which chords can it recognize?

Triads (major, minor, diminished, augmented), sevenths (dominant, major, minor, diminished, half-diminished), suspended chords (sus2, sus4, sus2add4), added ninths, ninths, sixth chords, the minor-major seventh, 7sus4 and the altered dominants (11th, 13th, 7♭9, 7♯9).

The vocabulary beyond the four triads is only searched when the full template set is enabled — `useTriadsOnly` off. The standalone chord API has it off already, so the full set is what you get. The unified `analyze()` path has it **on**, so it searches triads alone until you ask for more: pass `useTriadsOnly: false`, or `--with-seventh` on either command line. A chord outside the vocabulary is reported as the nearest member of it, not rejected.

Three of those qualities are worth knowing about because they are genuinely ambiguous rather than merely hard. A major sixth chord and the minor seventh a third below spell the same four pitch classes; so do a minor sixth and the half-diminished seventh below it, and a 7sus4 and the sus2add4 a fourth below. No chromagram can separate them, because there is nothing in the chroma to separate. What separates them is the bass, and the recognizer leans on the commoner reading unless the low register says otherwise. On material with no bass part, expect the commoner name.

## Why are the section labels wrong, or all `Unknown`?

Structure labeling is a fixed-threshold heuristic, not a trained segmenter, and it says so. Boundary positions are generally usable; the labels (Verse, Chorus, Bridge) are best-effort and will be wrong on material that does not follow a conventional pop form.

`Unknown` is a deliberate answer rather than a failure code. It appears when no boundary was detected at all, when a segment matched none of the positive branches, or when the evidence for a musical function was too weak to assert one — in the last case the sub-threshold score is kept, so you can see how close it came.

Two guards make `Unknown` more common, on purpose. Adjacent segments whose chroma is indistinguishable are merged before anything is labeled, so a novelty peak inside one continuous stretch of music does not split it into two "repeating" sections. And when nearly every pair of sections counts as a repetition of every other — which is what uniform material looks like — repetition is treated as carrying no information rather than as evidence for a verse/chorus alternation. Without that rule, uniform material would yield a full song form out of bars that never changed.

For downstream algorithms, prefer the raw signals over the labels: `boundaryTimes` and the chroma cosine self-similarity matrix are exposed precisely so a caller can apply their own thresholds.

## What if the recording is not tuned to A = 440 Hz?

Pass `tuning: 'auto'` to `analyze`, `detectChords`, or `detectKey` (Python: `tuning="auto"`) and the library measures the tuning from the audio before it reads pitch classes. `tuning` is a fraction of a semitone in `[-0.5, 0.5)` with 0 meaning A440, and every result reports the value it used, given or measured: `KeyDetection.tuning`, `AnalysisResult.tuning`, `ChordAnalysisResult.tuning`.

```typescript
const key = detectKey({ samples, sampleRate, tuning: 'auto' });
console.log(key.name, key.tuning, tuningToReferenceHz(key.tuning));
```

A test chord generated 40 cents sharp read as C major with a measured `tuning` of 0.42, which `tuningToReferenceHz` turns into 450.8 Hz; without the option the key was still C major and `tuning` stayed 0. `referenceHzToTuning(hz)` converts the other way when you know the reference pitch.

## Are the modal keys as reliable as major and minor?

No, and the difference is in where the profiles come from.

The major and minor key profiles are published ones — Krumhansl–Kessler, Temperley, Sha'ath, Faraldo, Bellman–Budge — each derived from listening experiments or from a corpus. The five modal profiles (Dorian, Phrygian, Lydian, Mixolydian, Locrian) are not. They are a construction in the same shape: the tonic weighted highest, its fifth and third confirming it, the degree that separates the mode from its major or minor neighbor standing above the remaining scale tones, and everything outside the scale suppressed. The ordering is what carries the meaning; the exact numbers place each weight between its neighbors and are otherwise arbitrary.

That construction is validated against synthetic scale histograms built independently of it, so it is not circular — but no probe-tone study or annotated corpus stands behind it. Modal detection is a plausible heuristic, and modal candidates are opt-in for that reason.

## How do I measure accuracy on my own material?

Fill in the manifests under `tests/fixtures/music_eval/` with rows naming your audio, its annotation and the expected answer, then:

```sh
export SONARE_MUSIC_FIXTURE_ROOT=/path/to/corpus
make accuracy-report
```

Two things to know before reading the output.

Rows that gate CI and rows that produce a measurement are not the same rows. A gating row asserts and prints nothing, so it contributes no observation; a measurement row is marked `report_only`, which turns the assertion into a printed figure. A manifest can hold both.

And the summary refuses to score an empty set. A dimension with no observations reports `unmeasured`, never 0% and never 100%. This matters more than it sounds: a metric that skips unusable data points and averages the rest scores an empty set as perfect, and the fixture runner deliberately skips a row whose audio is missing rather than failing it, so a typo in a path otherwise looks exactly like a pass. Pass `--require <dimension>` to the summarizer when a pipeline must not publish a page of `unmeasured` rows as if they were results.

`tools/eval/README.md` in the library repository lists the corpora and the full procedure.
