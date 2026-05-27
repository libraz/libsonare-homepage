import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as wasm from '@/wasm/index.js';

const SAMPLE_RATE = 22_050;
const SHORT_SAMPLE_RATE = 48_000;
const STEREO_ONLY_MASTERING_PROCESSORS = new Set([
  'eq.midSide',
  'multiband.compressor',
  'multiband.dynamicEq',
  'multiband.expander',
  'multiband.imager',
  'multiband.limiter',
  'multiband.saturation',
  'stereo.autoPan',
  'stereo.haasEnhancer',
  'stereo.imager',
  'stereo.monoMaker',
  'stereo.phaseAlign',
  'stereo.stereoBalance',
]);

function sine(frequency = 440, durationSeconds = 1, sampleRate = SAMPLE_RATE, amplitude = 0.3) {
  const samples = new Float32Array(Math.floor(durationSeconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function pulseTrain(bpm = 120, durationSeconds = 2, sampleRate = SAMPLE_RATE) {
  const samples = new Float32Array(Math.floor(durationSeconds * sampleRate));
  const period = Math.round((60 / bpm) * sampleRate);
  for (let i = 0; i < samples.length; i += period) {
    samples[i] = 1;
    if (i + 1 < samples.length) samples[i + 1] = 0.5;
  }
  return samples;
}

function stereoBlock(length = 512, sampleRate = SHORT_SAMPLE_RATE) {
  const left = sine(220, length / sampleRate, sampleRate, 0.2);
  const right = sine(330, length / sampleRate, sampleRate, 0.15);
  return { left, right };
}

function expectFiniteArray(values: ArrayLike<number>, minLength = 1) {
  expect(values.length).toBeGreaterThanOrEqual(minLength);
  for (let i = 0; i < values.length; i++) {
    expect(Number.isFinite(values[i])).toBe(true);
  }
}

describe('wasm package integration', () => {
  beforeAll(async () => {
    const wasmPath = join(process.cwd(), 'src/wasm/sonare.wasm');
    await wasm.init({ wasmBinary: readFileSync(wasmPath) });
  }, 30_000);

  it('initializes once and reports compatible engine metadata', async () => {
    await expect(wasm.init()).resolves.toBeUndefined();

    expect(wasm.isInitialized()).toBe(true);
    expect(wasm.version()).toMatch(/^\d+\.\d+\.\d+/);
    expect(wasm.engineAbiVersion()).toBe(wasm.EXPECTED_ENGINE_ABI_VERSION);
    expect(wasm.engineCapabilities()).toMatchObject({
      abiCompatible: true,
      engineAbiVersion: wasm.EXPECTED_ENGINE_ABI_VERSION,
      expectedEngineAbiVersion: wasm.EXPECTED_ENGINE_ABI_VERSION,
      atomics: true,
    });
  });

  it('exports stable enum values and compatibility aliases', () => {
    expect(wasm.PitchClass.C).toBe(0);
    expect(wasm.Pitch.C).toBe(wasm.PitchClass.C);
    expect(wasm.Mode.Major).toBe(0);
    expect(wasm.Mode.Minor).toBe(1);
    expect(wasm.KeyProfile.KrumhanslSchmuckler).toBe(0);
    expect(wasm.ChordQuality.Major).toBe(0);
    expect(wasm.ChordQuality.Unknown).toBeGreaterThan(wasm.ChordQuality.Major);
    expect(wasm.SectionType.Intro).toBe(0);
    expect(wasm.SectionType.Unknown).toBeGreaterThan(wasm.SectionType.Intro);

    const preset = wasm.mixingScenePresetNames()[0];
    expect(wasm.mixerScenePresetJson(preset)).toBe(wasm.mixingScenePresetJson(preset));
  });

  it('keeps the runtime export surface aligned with the generated type bundle', () => {
    const dtsPath = join(process.cwd(), 'src/wasm/index.d.ts');
    const dts = readFileSync(dtsPath, 'utf8');
    const exportBlock = dts.match(/export \{([\s\S]+)\};\s*$/)?.[1];
    expect(exportBlock).toBeTruthy();

    const runtimeExports = new Set(Object.keys(wasm));
    const missing = exportBlock!
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry && !entry.startsWith('type '))
      .map((entry) => entry.replace(/\s+as\s+.+$/, ''))
      .filter((name) => !runtimeExports.has(name));

    expect(missing).toEqual([]);
  });

  it('detects tempo, key, onsets, beats, chords, sections, melody and full analysis', () => {
    const tone = sine();
    const pulses = pulseTrain();
    const progress: Array<{ progress: number; stage: string }> = [];

    expect(wasm.detectBpm(pulses, SAMPLE_RATE)).toBeGreaterThan(80);

    const key = wasm.detectKey(tone, SAMPLE_RATE, { modes: 'major-minor', profile: 'ks' });
    expect(key).toMatchObject({ root: expect.any(Number), mode: expect.any(Number) });
    expect(key.confidence).toBeGreaterThanOrEqual(0);
    expect(key.name).toBeTruthy();

    const candidates = wasm.detectKeyCandidates(tone, SAMPLE_RATE, { modes: 'modal' });
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0].key.name).toBeTruthy();

    expectFiniteArray(wasm.detectOnsets(pulses, SAMPLE_RATE));
    expectFiniteArray(wasm.detectBeats(pulses, SAMPLE_RATE));
    expectFiniteArray(wasm.detectDownbeats(pulses, SAMPLE_RATE));

    const chords = wasm.detectChords(tone, SAMPLE_RATE, { detectInversions: true });
    expect(chords.chords.length).toBeGreaterThan(0);
    expect(chords.chords[0].name).toBeTruthy();

    const sections = wasm.analyzeSections(tone, SAMPLE_RATE, 512, 128, 0.2);
    expect(sections.length).toBeGreaterThan(0);

    const melody = wasm.analyzeMelody(tone, SAMPLE_RATE, 65, 1_000, 512, 128);
    expect(melody.points.length).toBeGreaterThan(0);
    expect(melody.meanFrequency).toBeGreaterThan(300);
    expect(melody.meanFrequency).toBeLessThan(600);

    const analysis = wasm.analyzeWithProgress(tone, SAMPLE_RATE, (p, stage) => {
      progress.push({ progress: p, stage });
    });
    expect(analysis.bpm).toBeGreaterThan(0);
    expect(analysis.key.name).toBeTruthy();
    expect(analysis.timeSignature.numerator).toBeGreaterThan(0);
    expect(analysis.form).toBeTruthy();
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)?.progress).toBeGreaterThanOrEqual(0);
  });

  it('extracts librosa-style spectral, rhythm, pitch and loudness features', () => {
    const tone = sine();

    const stft = wasm.stft(tone, SAMPLE_RATE, 512, 128);
    expect(stft).toMatchObject({ nBins: 257, nFft: 512, hopLength: 128, sampleRate: SAMPLE_RATE });
    expectFiniteArray(stft.magnitude);
    expectFiniteArray(wasm.stftDb(tone, SAMPLE_RATE, 512, 128).db);

    const mel = wasm.melSpectrogram(tone, SAMPLE_RATE, 512, 128, 32);
    expect(mel.nMels).toBe(32);
    expectFiniteArray(mel.power);

    const mfcc = wasm.mfcc(tone, SAMPLE_RATE, 512, 128, 32, 13);
    expect(mfcc.nMfcc).toBe(13);
    expectFiniteArray(mfcc.coefficients);

    for (const values of [
      wasm.spectralCentroid(tone, SAMPLE_RATE, 512, 128),
      wasm.spectralBandwidth(tone, SAMPLE_RATE, 512, 128),
      wasm.spectralRolloff(tone, SAMPLE_RATE, 512, 128),
      wasm.spectralFlatness(tone, SAMPLE_RATE, 512, 128),
      wasm.zeroCrossingRate(tone, SAMPLE_RATE, 512, 128),
      wasm.rmsEnergy(tone, SAMPLE_RATE, 512, 128),
      wasm.onsetEnvelope(tone, SAMPLE_RATE, 512, 128, 32),
    ]) {
      expectFiniteArray(values);
    }

    expect(wasm.chroma(tone, SAMPLE_RATE, 512, 128).nChroma).toBe(12);
    expect(wasm.nnlsChroma(tone, SAMPLE_RATE).nChroma).toBe(12);
    expect(wasm.cqt(tone, SAMPLE_RATE, 256, 32.7, 24, 12).nBins).toBe(24);
    expect(wasm.vqt(tone, SAMPLE_RATE, 256, 32.7, 24, 12, 10).nBins).toBe(24);

    const pitch = wasm.pitchYin(tone, SAMPLE_RATE, 512, 128, 65, 1_000, 0.3);
    expectFiniteArray(pitch.f0);
    expect(pitch.medianF0).toBeGreaterThan(300);
    expect(pitch.medianF0).toBeLessThan(600);

    const pyin = wasm.pitchPyin(tone, SAMPLE_RATE, 512, 128, 65, 1_000, 0.3);
    expectFiniteArray(pyin.f0);

    const onset = new Float32Array([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(wasm.tempogram(onset, SAMPLE_RATE, 512, 4).nFrames).toBe(onset.length);
    expect(wasm.cyclicTempogram(onset, SAMPLE_RATE, 512, 4, 60, 12).nBins).toBe(12);
    expectFiniteArray(wasm.plp(onset, SAMPLE_RATE, 512, 30, 300, 4));
    expect(wasm.fourierTempogram(onset, SAMPLE_RATE, 512, 4).nFrames).toBe(onset.length);

    const loudness = wasm.lufs(tone, SAMPLE_RATE);
    expect(Number.isFinite(loudness.integratedLufs)).toBe(true);
    expectFiniteArray(wasm.momentaryLufs(tone, SAMPLE_RATE));
    expectFiniteArray(wasm.shortTermLufs(tone, SAMPLE_RATE));
  });

  it('performs editing transforms and utility conversions with valid output', () => {
    const tone = sine();

    const hpss = wasm.hpss(tone, SAMPLE_RATE, 7, 7);
    expect(hpss.harmonic.length).toBe(tone.length);
    expect(hpss.percussive.length).toBe(tone.length);
    expect(wasm.harmonic(tone, SAMPLE_RATE).length).toBe(tone.length);
    expect(wasm.percussive(tone, SAMPLE_RATE).length).toBe(tone.length);
    expect(wasm.pitchShift(tone, SAMPLE_RATE, 2).length).toBeGreaterThan(0);
    expect(wasm.pitchCorrectToMidi(tone, SAMPLE_RATE, 69, 72).length).toBeGreaterThan(0);
    expect(wasm.noteStretch(tone, SAMPLE_RATE, 0, tone.length, 1.1).length).toBeGreaterThan(0);
    expect(wasm.voiceChange(tone, SAMPLE_RATE, 1, 1.05).length).toBeGreaterThan(0);
    expect(wasm.timeStretch(tone, SAMPLE_RATE, 1.25).length).toBeLessThan(tone.length);
    expect(wasm.normalize(tone, SAMPLE_RATE, -3).length).toBe(tone.length);
    expect(wasm.resample(tone, SAMPLE_RATE, SAMPLE_RATE / 2).length).toBe(
      Math.floor(tone.length / 2),
    );

    expect(wasm.hzToMidi(440)).toBeCloseTo(69, 5);
    expect(wasm.midiToHz(69)).toBeCloseTo(440, 5);
    expect(wasm.melToHz(wasm.hzToMel(1_000))).toBeCloseTo(1_000, 3);
    expect(wasm.noteToHz('A4')).toBeCloseTo(440, 5);
    expect(wasm.hzToNote(440)).toContain('A');
    expect(wasm.framesToSamples(4, 512)).toBe(2048);
    expect(wasm.samplesToFrames(2048, 512)).toBe(4);
    expect(wasm.framesToTime(4, SAMPLE_RATE, 512)).toBeCloseTo(2048 / SAMPLE_RATE, 6);
    expect(wasm.timeToFrames(2048 / SAMPLE_RATE, SAMPLE_RATE, 512)).toBe(4);

    const amplitudes = new Float32Array([1, 0.5, 0.25]);
    expect(wasm.dbToAmplitude(wasm.amplitudeToDb(amplitudes))).toHaveLength(amplitudes.length);
    expect(wasm.dbToPower(wasm.powerToDb(amplitudes))).toHaveLength(amplitudes.length);

    expect(wasm.preemphasis(new Float32Array([1, 2, 3]))).toHaveLength(3);
    expect(wasm.deemphasis(new Float32Array([1, 2, 3]))).toHaveLength(3);
    expect(wasm.trimSilence(new Float32Array([0, 0, 1, 0, 0]), 60, 2, 1).startSample).toBe(2);
    expect(wasm.splitSilence(new Float32Array([0, 1, 1, 0, 1]), 60, 2, 1).length).toBeGreaterThan(
      0,
    );
    expect(wasm.frameSignal(new Float32Array([1, 2, 3, 4]), 2, 1).nFrames).toBe(3);
    expect(Array.from(wasm.padCenter(new Float32Array([1, 2]), 4))).toEqual([0, 1, 2, 0]);
    expect(Array.from(wasm.fixLength(new Float32Array([1, 2]), 4))).toEqual([1, 2, 0, 0]);
    expect(Array.from(wasm.fixFrames(new Int32Array([1, 2, 5]), 0, 4))).toEqual([0, 1, 2, 4]);
    expect(
      Array.from(wasm.peakPick(new Float32Array([0, 1, 0, 2, 0]), 1, 1, 1, 1, 0.1, 1)),
    ).toEqual([1, 3]);
    expectFiniteArray(wasm.vectorNormalize(new Float32Array([3, 4]), 2));
  });

  it('covers inverse feature transforms, acoustic analysis and the Audio wrapper', () => {
    const tone = sine();
    const impulse = new Float32Array(SHORT_SAMPLE_RATE);
    impulse[0] = 1;
    for (let i = 1; i < impulse.length; i++) {
      impulse[i] = 0.5 * Math.exp(-i / (SHORT_SAMPLE_RATE * 0.2));
    }

    const impulseResponse = wasm.analyzeImpulseResponse(impulse, SHORT_SAMPLE_RATE, 6);
    expect(impulseResponse.rt60).toBeGreaterThan(0);
    expect(impulseResponse.rt60Bands).toHaveLength(6);
    expect(impulseResponse.isBlind).toBe(false);

    const blindAcoustic = wasm.detectAcoustic(impulse, SHORT_SAMPLE_RATE, 6, 24, 20, 10);
    expect(blindAcoustic.rt60).toBeGreaterThan(0);
    expect(blindAcoustic.rt60Bands).toHaveLength(6);
    expect(blindAcoustic.isBlind).toBe(true);

    const mel = wasm.melSpectrogram(tone, SAMPLE_RATE, 512, 128, 32);
    const stftPower = wasm.melToStft(mel.power, mel.nMels, mel.nFrames, SAMPLE_RATE, 512, 128);
    expect(stftPower.nBins).toBe(257);
    expect(stftPower.nFrames).toBe(mel.nFrames);
    expectFiniteArray(stftPower.power);
    expectFiniteArray(wasm.melToAudio(mel.power, mel.nMels, mel.nFrames, SAMPLE_RATE, 512, 128, 2));

    const mfcc = wasm.mfcc(tone, SAMPLE_RATE, 512, 128, 32, 13);
    const reconstructedMel = wasm.mfccToMel(mfcc.coefficients, mfcc.nMfcc, mfcc.nFrames, 32);
    expect(reconstructedMel.nMels).toBe(32);
    expect(reconstructedMel.nFrames).toBe(mfcc.nFrames);
    expectFiniteArray(reconstructedMel.power);
    expectFiniteArray(
      wasm.mfccToAudio(mfcc.coefficients, mfcc.nMfcc, mfcc.nFrames, 32, SAMPLE_RATE, 512, 128, 2),
    );

    expectFiniteArray(wasm.pcen(mel.power, mel.nMels, mel.nFrames));

    const chroma = wasm.chroma(tone, SAMPLE_RATE, 512, 128);
    const tonnetz = wasm.tonnetz(chroma.features, chroma.nChroma, chroma.nFrames);
    expect(tonnetz.length).toBe(6 * chroma.nFrames);
    expectFiniteArray(tonnetz);

    const tempogram = wasm.tempogram(
      new Float32Array([0, 1, 0, 1, 0, 1, 0, 1]),
      SAMPLE_RATE,
      512,
      4,
    );
    expectFiniteArray(wasm.tempogramRatio(tempogram.data, tempogram.winLength, SAMPLE_RATE, 512));

    const trimmed = wasm.trim(new Float32Array([0, 0, 1, 0, 0]), SAMPLE_RATE, -60);
    expect(trimmed).toHaveLength(5);

    const audio = wasm.Audio.fromBuffer(tone, SAMPLE_RATE);
    expect(audio.data).toBe(tone);
    expect(audio.length).toBe(tone.length);
    expect(audio.sampleRate).toBe(SAMPLE_RATE);
    expect(audio.duration).toBeCloseTo(1, 6);
    expect(audio.detectBpm()).toBeGreaterThan(0);
    expect(audio.detectKey().name).toBeTruthy();
    expect(audio.detectKeyCandidates().length).toBeGreaterThan(0);
    const rhythmicAudio = wasm.Audio.fromBuffer(pulseTrain(), SAMPLE_RATE);
    expectFiniteArray(rhythmicAudio.detectOnsets());
    expectFiniteArray(rhythmicAudio.detectBeats());
    expect(audio.detectChords().chords.length).toBeGreaterThan(0);
    expect(audio.analyze().key.name).toBeTruthy();
    expect(audio.hpss(7, 7).harmonic.length).toBe(tone.length);
    expect(audio.harmonic()).toHaveLength(tone.length);
    expect(audio.percussive()).toHaveLength(tone.length);
    expect(audio.timeStretch(1.25).length).toBeLessThan(tone.length);
    expect(audio.pitchShift(1).length).toBeGreaterThan(0);
    expect(audio.pitchCorrectToMidi(69, 72)).toHaveLength(tone.length);
    expect(audio.noteStretch(0, tone.length, 1.1).length).toBeGreaterThan(tone.length);
    expect(audio.voiceChange(1, 1.05).length).toBeGreaterThan(0);
    expect(audio.normalize(-3)).toHaveLength(tone.length);
    expect(audio.mastering(-14, -1).samples).toHaveLength(tone.length);
    expect(audio.masteringProcess('eq.tilt', { tiltDb: 1 }).samples).toHaveLength(tone.length);
    expect(audio.trim(-60)).toHaveLength(tone.length);
    expect(audio.stft(512, 128).nBins).toBe(257);
    expect(audio.stftDb(512, 128).nBins).toBe(257);
    expect(audio.melSpectrogram(512, 128, 32).nMels).toBe(32);
    expect(audio.mfcc(512, 128, 32, 13).nMfcc).toBe(13);
    expect(audio.chroma(512, 128).nChroma).toBe(12);
    expect(audio.nnlsChroma().nChroma).toBe(12);
    expectFiniteArray(audio.onsetEnvelope(512, 128, 32));
    expect(Number.isFinite(audio.lufs().integratedLufs)).toBe(true);
    expectFiniteArray(audio.momentaryLufs());
    expectFiniteArray(audio.shortTermLufs());
    expectFiniteArray(audio.spectralCentroid(512, 128));
    expectFiniteArray(audio.spectralBandwidth(512, 128));
    expectFiniteArray(audio.spectralRolloff(512, 128));
    expectFiniteArray(audio.spectralFlatness(512, 128));
    expectFiniteArray(audio.zeroCrossingRate(512, 128));
    expectFiniteArray(audio.rmsEnergy(512, 128));
    expectFiniteArray(audio.pitchYin(512, 128, 65, 1_000, 0.3).f0);
    expectFiniteArray(audio.pitchPyin(512, 128, 65, 1_000, 0.3).f0);
    expect(audio.resample(SAMPLE_RATE / 2)).toHaveLength(tone.length / 2);
  });

  it('runs mastering processors, stereo analysis, assistant reports and preset paths', () => {
    const mono = sine();
    const { left, right } = stereoBlock(2048, SAMPLE_RATE);

    expect(wasm.masteringProcessorNames()).toContain('eq.tilt');
    expect(wasm.masteringPairProcessorNames()).toContain('match.applyMatchEq');
    expect(wasm.masteringPairAnalysisNames()).toContain('match.referenceLoudness');
    expect(wasm.masteringStereoAnalysisNames()).toContain('stereo.monoCompatCheck');
    expect(wasm.masteringPresetNames()).toContain('pop');

    const oneShot = wasm.mastering(mono, SAMPLE_RATE, -14, -1);
    expect(oneShot.samples.length).toBe(mono.length);
    expect(Number.isFinite(oneShot.outputLufs)).toBe(true);

    const processed = wasm.masteringProcess('eq.tilt', mono, SAMPLE_RATE, { tiltDb: 1 });
    expect(processed.samples.length).toBe(mono.length);

    const stereoProcessed = wasm.masteringProcessStereo('stereo.imager', left, right, SAMPLE_RATE, {
      width: 1.1,
    });
    expect(stereoProcessed.left.length).toBe(left.length);
    expect(stereoProcessed.right.length).toBe(right.length);

    const pair = wasm.masteringPairProcess('match.applyMatchEq', mono, sine(880), SAMPLE_RATE, {
      maxGainDb: 3,
    });
    expect(pair.samples.length).toBe(mono.length);

    expect(
      JSON.parse(
        wasm.masteringPairAnalyze('match.referenceLoudness', mono, sine(880), SAMPLE_RATE),
      ),
    ).toBeTruthy();
    expect(
      JSON.parse(wasm.masteringStereoAnalyze('stereo.monoCompatCheck', left, right, SAMPLE_RATE)),
    ).toBeTruthy();
    expect(JSON.parse(wasm.masteringAssistantSuggest(mono, SAMPLE_RATE))).toBeTruthy();
    expect(JSON.parse(wasm.masteringAudioProfile(mono, SAMPLE_RATE))).toBeTruthy();
    expect(
      JSON.parse(
        wasm.masteringStreamingPreview(mono, SAMPLE_RATE, [
          { name: 'Test', targetLufs: -14, ceilingDb: -1 },
        ]),
      ).platforms,
    ).toHaveLength(1);

    const config = {
      eq: { tiltDb: 0.5, pivotHz: 1_000 },
      loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
    };
    expect(wasm.masteringChain(mono, SAMPLE_RATE, config).samples.length).toBe(mono.length);
    expect(wasm.masteringChainStereo(left, right, SAMPLE_RATE, config).left.length).toBe(
      left.length,
    );
    expect(
      wasm.masteringChainWithProgress(mono, SAMPLE_RATE, config, () => {}).samples.length,
    ).toBe(mono.length);
    expect(
      wasm.masteringChainStereoWithProgress(left, right, SAMPLE_RATE, config, () => {}).right
        .length,
    ).toBe(right.length);

    expect(wasm.masterAudio(mono, SAMPLE_RATE, 'pop').samples.length).toBe(mono.length);
    expect(wasm.masterAudioStereo(left, right, SAMPLE_RATE, 'pop').left.length).toBe(left.length);
    expect(() =>
      wasm.masteringProcessStereo('stereo.imager', left, right.slice(1), SAMPLE_RATE),
    ).toThrow(/Stereo channel lengths must match/);
  });

  it('smoke-tests every registered mastering processor and preset', () => {
    const mono = sine(440, 2048 / SAMPLE_RATE);
    const reference = sine(880, 2048 / SAMPLE_RATE);
    const { left, right } = stereoBlock(2048, SAMPLE_RATE);

    for (const processorName of wasm.masteringProcessorNames()) {
      if (STEREO_ONLY_MASTERING_PROCESSORS.has(processorName)) {
        const result = wasm.masteringProcessStereo(processorName, left, right, SAMPLE_RATE, {});
        expect(result.left, processorName).toHaveLength(left.length);
        expect(result.right, processorName).toHaveLength(right.length);
      } else {
        const result = wasm.masteringProcess(processorName, mono, SAMPLE_RATE, {});
        expectFiniteArray(result.samples, 1);
      }
    }

    for (const processorName of wasm.masteringPairProcessorNames()) {
      const result = wasm.masteringPairProcess(processorName, mono, reference, SAMPLE_RATE, {});
      expect(result.samples, processorName).toHaveLength(mono.length);
    }

    for (const analysisName of wasm.masteringPairAnalysisNames()) {
      expect(
        JSON.parse(wasm.masteringPairAnalyze(analysisName, mono, reference, SAMPLE_RATE, {})),
        analysisName,
      ).toBeTruthy();
    }

    const stereoAnalysis = JSON.parse(
      wasm.masteringStereoAnalyze('stereo.monoCompatCheck', left, right, SAMPLE_RATE, {}),
    );
    expect(stereoAnalysis).toBeTruthy();

    for (const presetName of wasm.masteringPresetNames()) {
      const result = wasm.masterAudio(mono, SAMPLE_RATE, presetName, {
        'loudness.targetLufs': -14,
      });
      expect(result.samples, presetName).toHaveLength(mono.length);
      expect(result.stages.length, presetName).toBeGreaterThan(0);
    }
  });

  it('mixes stereo stems and exercises persistent mixer controls', () => {
    const { left, right } = stereoBlock(512, SHORT_SAMPLE_RATE);
    const mixed = wasm.mixStereo([left, left], [right, right], SHORT_SAMPLE_RATE, {
      faderDb: [0, -6],
      pan: [0, -0.25],
      width: [1, 0.8],
    });
    expect(mixed.left.length).toBe(left.length);
    expect(mixed.right.length).toBe(right.length);

    const presetNames = wasm.mixingScenePresetNames();
    expect(presetNames.length).toBeGreaterThan(0);
    expect(JSON.parse(wasm.mixingScenePresetJson(presetNames[0]))).toBeTruthy();

    const scene = JSON.stringify({
      version: 1,
      strips: [
        { id: 'a', name: 'A', faderDb: 0, pan: 0, width: 1 },
        { id: 'b', name: 'B', faderDb: -6, pan: 0.2, width: 1 },
      ],
      buses: [{ id: 'master', role: 'master' }],
      connections: [],
    });
    const mixer = wasm.Mixer.fromSceneJson(scene, SHORT_SAMPLE_RATE, left.length);
    try {
      expect(mixer.stripCount()).toBe(2);
      expect(mixer.stripById('a')).toBe(0);
      expect(mixer.stripById('missing')).toBeNull();

      mixer.setSoloed(0, true);
      mixer.setSoloSafe(1, true);
      mixer.setPolarityInvert(1, true, false);
      mixer.setPanLaw(0, 'const4.5dB');
      mixer.setDualPan(1, -0.1, 0.1);
      mixer.scheduleFaderAutomation(0, 0, -3, 'linear');
      mixer.schedulePanAutomation(0, 0, 0.1, 's-curve');
      mixer.scheduleWidthAutomation(0, 0, 0.9, 'hold');

      const rendered = mixer.processStereo([left, left], [right, right]);
      expect(rendered.left.length).toBe(left.length);
      expect(Number.isFinite(mixer.stripMeter(0).peakDbL)).toBe(true);
      expect(Number.isFinite(mixer.meterTap(0, 'preFader').rmsDbL)).toBe(true);
      expect(mixer.readGoniometerLatest(0, 8).length).toBeGreaterThan(0);
      expect(JSON.parse(mixer.toSceneJson()).strips).toHaveLength(2);

      const realtime = mixer.createRealtimeBuffer();
      realtime.leftInputs[0].set(left);
      realtime.rightInputs[0].set(right);
      realtime.leftInputs[1].set(left);
      realtime.rightInputs[1].set(right);
      realtime.process(left.length);
      expectFiniteArray(realtime.outLeft);
      expectFiniteArray(realtime.outRight);
    } finally {
      mixer.delete();
    }

    expect(() => wasm.mixStereo([], [], SHORT_SAMPLE_RATE)).toThrow(/same non-zero length/);
  });

  it('exercises mixer buses, sends, VCA groups, aliases and automation errors', () => {
    const { left, right } = stereoBlock(256, SHORT_SAMPLE_RATE);
    const scene = JSON.stringify({
      version: 1,
      strips: [{ id: 'a', name: 'A', faderDb: 0, pan: 0, width: 1 }],
      buses: [{ id: 'master', role: 'master' }],
      connections: [],
    });

    const mixer = wasm.Mixer.fromSceneJson(scene, SHORT_SAMPLE_RATE, left.length);
    try {
      mixer.addBus('verb', 'aux');
      expect(mixer.busCount()).toBe(2);

      const sendIndex = mixer.addSend(0, 's1', 'verb', -12, 'preFader');
      expect(sendIndex).toBe(0);
      mixer.setSendDb(0, sendIndex, -6);
      mixer.scheduleSendAutomation(0, sendIndex, 0, -9, 'exponential');

      mixer.addVcaGroup('band', -3, ['a']);
      expect(mixer.vcaGroupCount()).toBe(1);
      mixer.setVcaOffsetDb(0, -1);

      const rendered = mixer.processStereo([left], [right]);
      expect(rendered.left).toHaveLength(left.length);

      const serialized = JSON.parse(mixer.toSceneJson());
      expect(serialized.buses.map((bus: { id: string }) => bus.id)).toContain('verb');
      expect(serialized.strips[0].sends[0]).toMatchObject({
        id: 's1',
        destinationBusId: 'verb',
        sendDb: -6,
        timing: 'pre',
      });
      expect(serialized.vcaGroups[0]).toMatchObject({ id: 'band', gainDb: -3 });

      expect(() => mixer.scheduleFaderAutomation(0, 0, -3, 'bad-curve' as never)).toThrow(
        /Invalid automation curve/,
      );

      mixer.removeVcaGroup('band');
      mixer.removeBus('verb');
      expect(mixer.vcaGroupCount()).toBe(0);
      expect(mixer.busCount()).toBe(1);
    } finally {
      mixer.destroy();
    }
  });

  it('loads and renders every built-in mixing scene preset', () => {
    for (const presetName of wasm.mixingScenePresetNames()) {
      const sceneJson = wasm.mixingScenePresetJson(presetName);
      expect(JSON.parse(sceneJson), presetName).toBeTruthy();

      const mixer = wasm.Mixer.fromSceneJson(sceneJson, SHORT_SAMPLE_RATE, 128);
      try {
        const stripCount = mixer.stripCount();
        expect(stripCount, presetName).toBeGreaterThan(0);
        const leftInputs = Array.from({ length: stripCount }, (_, index) => {
          const samples = new Float32Array(128);
          samples.fill(index === 0 ? 0.05 : 0.025);
          return samples;
        });
        const rightInputs = leftInputs.map((samples) => new Float32Array(samples));
        const rendered = mixer.processStereo(leftInputs, rightInputs);
        expect(rendered.left, presetName).toHaveLength(128);
        expect(rendered.right, presetName).toHaveLength(128);
        expect(JSON.parse(mixer.toSceneJson()).strips.length, presetName).toBe(stripCount);
      } finally {
        mixer.delete();
      }
    }
  });

  it('processes streaming analyzer, equalizer and realtime engine blocks', () => {
    const { left, right } = stereoBlock(512, SHORT_SAMPLE_RATE);

    const analyzer = new wasm.StreamAnalyzer({
      sampleRate: SHORT_SAMPLE_RATE,
      nFft: 256,
      hopLength: 128,
      nMels: 16,
      computeMagnitude: true,
      computeMel: true,
      computeChroma: true,
      computeOnset: true,
      computeSpectral: true,
    });
    try {
      analyzer.process(left);
      expect(analyzer.availableFrames()).toBeGreaterThan(0);
      expect(analyzer.readFrames(4).nFrames).toBeGreaterThan(0);
      analyzer.processWithOffset(left, left.length);
      expect(analyzer.stats().totalSamples).toBeGreaterThan(0);
      expect(analyzer.frameCount()).toBeGreaterThan(0);
      expect(analyzer.sampleRate()).toBe(SHORT_SAMPLE_RATE);
      expect(analyzer.currentTime()).toBeGreaterThan(0);
      analyzer.setExpectedDuration(2);
      analyzer.setNormalizationGain(0.5);
      analyzer.setTuningRefHz(442);
      expect(analyzer.readFramesU8(2).nFrames).toBeGreaterThanOrEqual(0);
      expect(analyzer.readFramesI16(2).nFrames).toBeGreaterThanOrEqual(0);
      analyzer.reset();
      expect(analyzer.frameCount()).toBe(0);
    } finally {
      analyzer.dispose();
    }

    const eq = new wasm.StreamingEqualizer({});
    try {
      eq.setBand(0, { enabled: true, type: 'peak', frequencyHz: 1_000, gainDb: 3, q: 1 });
      eq.setAutoGain(true);
      eq.setGainScale(1);
      eq.setOutputGainDb(-1);
      eq.setOutputPan(0.1);
      eq.setSidechainMono(left);
      eq.setSidechainStereo(left, right);
      eq.clearSidechain();
      eq.match(left, right, { sampleRate: SHORT_SAMPLE_RATE, maxBands: 4 });
      expect(eq.processMono(left).length).toBe(left.length);
      expect(eq.processStereo(left, right).left.length).toBe(left.length);
      expect(eq.spectrum().seq).toBeGreaterThan(0);
      expect(Number.isFinite(eq.lastAutoGainDb())).toBe(true);
      expect(eq.latencySamples()).toBeGreaterThanOrEqual(0);
      expect(() => eq.setSidechainStereo(left, right.slice(1))).toThrow(
        /Sidechain channel lengths must match/,
      );
      eq.clear();
    } finally {
      eq.delete();
    }

    const retune = new wasm.StreamingRetune({ semitones: 12, mix: 1 });
    try {
      retune.prepare(SHORT_SAMPLE_RATE, left.length);
      expect(retune.grainSize()).toBeGreaterThanOrEqual(left.length);
      retune.setConfig({ semitones: -7, mix: 0.9 });
      expect(retune.config().semitones).toBe(-7);
      const shifted = retune.processMono(left);
      expect(shifted).toHaveLength(left.length);
      expectFiniteArray(shifted);
      retune.reset();
    } finally {
      retune.delete();
    }

    const engine = new wasm.RealtimeEngine(SHORT_SAMPLE_RATE, 128);
    try {
      engine.prepare(SHORT_SAMPLE_RATE, 128);
      engine.setTempo(128);
      engine.setTimeSignature(3, 4);
      engine.setLoop(0, 4, true);
      engine.play();
      engine.seekSample(256);
      engine.seekPpq(1);
      expect(engine.getTransportState().bpm).toBe(128);
      expect(engine.process([left, right])).toHaveLength(2);
      const monitored = engine.processWithMonitor([left, right]);
      expect(monitored.output).toHaveLength(2);
      expect(monitored.monitor).toHaveLength(2);
      expect(Array.isArray(engine.drainTelemetry(16))).toBe(true);
      expect(Array.isArray(engine.drainMeterTelemetry(16))).toBe(true);
      expect(engine.renderOffline([left, right], 128)).toHaveLength(2);
      engine.stop();
    } finally {
      engine.destroy();
    }
  });

  it('covers realtime engine parameters, markers, graph, clips, capture and offline renders', () => {
    const { left, right } = stereoBlock(256, SHORT_SAMPLE_RATE);
    const engine = new wasm.RealtimeEngine(SHORT_SAMPLE_RATE, 128);

    try {
      engine.prepare(SHORT_SAMPLE_RATE, 128);

      engine.addParameter({
        id: 1,
        name: 'gain',
        unit: 'dB',
        minValue: -60,
        maxValue: 6,
        defaultValue: 0,
        rtSafe: true,
        defaultCurve: 0,
      });
      engine.setParameter(1, -3);
      engine.setParameterSmoothed(1, -6);
      engine.setAutomationLane(1, [
        { ppq: 0, value: 0 },
        { ppq: 1, value: -6, curveToNext: 1 },
      ]);
      expect(engine.parameterCount()).toBe(1);
      expect(engine.parameterInfoByIndex(0).name).toBe('gain');
      expect(engine.parameterInfo(1).unit).toBe('dB');
      expect(engine.automationLaneCount()).toBe(1);

      engine.setMarkers([
        { id: 1, ppq: 0, name: 'A' },
        { id: 2, ppq: 4, name: 'B' },
      ]);
      engine.seekMarker(1);
      engine.setLoopFromMarkers(1, 2);
      expect(engine.markerCount()).toBe(2);
      expect(engine.markerByIndex(0).name).toBe('A');
      expect(engine.marker(2).ppq).toBe(4);
      expect(engine.getTransportState().looping).toBe(true);

      engine.setMetronome({ enabled: true, beatGain: 0.1, accentGain: 0.2, clickSamples: 64 });
      expect(engine.metronome()).toMatchObject({ enabled: true, clickSamples: 64 });
      expect(engine.countInEndSample(0, 2)).toBe(4 * SHORT_SAMPLE_RATE);

      engine.setGraph({
        nodes: [
          { id: 'in', type: 0, numPorts: 2 },
          { id: 'out', type: 1, numPorts: 2 },
        ],
        connections: [
          { sourceNode: 'in', sourcePort: 0, destNode: 'out', destPort: 0 },
          { sourceNode: 'in', sourcePort: 1, destNode: 'out', destPort: 1 },
        ],
        inputNode: 'in',
        outputNode: 'out',
        numChannels: 2,
        parameterBindings: [{ paramId: 1, nodeId: 'out' }],
      });
      expect(engine.graphNodeCount()).toBe(2);
      expect(engine.graphConnectionCount()).toBe(2);

      engine.setClips([
        { id: 7, channels: [left, right], startPpq: 0, lengthSamples: left.length, gain: 1 },
      ]);
      expect(engine.clipCount()).toBe(1);

      engine.setCaptureBuffer(2, 512);
      engine.armCapture(true);
      engine.setCapturePunch(0, 512, true);
      expect(engine.process([left, right])).toHaveLength(2);
      expect(engine.captureStatus()).toMatchObject({ armed: true, punchEnabled: true });
      expect(engine.capturedAudio()).toHaveLength(2);
      engine.resetCapture();
      expect(engine.captureStatus().overflowCount).toBe(0);

      const bounce = engine.bounceOffline({ totalFrames: 256, blockSize: 128, numChannels: 2 });
      expect(bounce).toMatchObject({ frames: 256, numChannels: 2, sampleRate: SHORT_SAMPLE_RATE });
      expect(bounce.interleaved).toHaveLength(512);
      expect(Number.isFinite(bounce.integratedLufs)).toBe(true);

      expect(
        engine.freezeOffline({ totalFrames: 256, blockSize: 128, numChannels: 2, clipId: 9 }),
      ).toMatchObject({
        clipId: 9,
        frames: 256,
        numChannels: 2,
      });
    } finally {
      engine.destroy();
    }
  });
});
