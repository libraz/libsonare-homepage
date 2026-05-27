import { describe, expect, it, vi } from 'vitest';
import { MAX_DURATION_SECONDS, REVERB_SEND_FLOOR } from '@/components/mixing/mixingConstants';
import {
  applySceneTrack,
  buildCurrentSceneJson,
  createMixTrack,
  currentGates,
  resetMixTrack,
  toRenderTrack,
  toSceneStrip,
  toSceneTrack,
} from '@/components/mixing/mixingTrackState';
import type { DecodedStereoAudio } from '@/utils/audio';

function audio(duration = 2, sampleRate = 48_000): DecodedStereoAudio {
  const length = Math.round(duration * sampleRate);
  return {
    fileName: 'clip.wav',
    duration,
    sampleRate,
    channels: 2,
    left: new Float32Array(length).fill(0.1),
    right: new Float32Array(length).fill(-0.1),
  };
}

describe('mixing track state helpers', () => {
  it('creates default tracks with derived names, staggered offsets and waveform data', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const first = createMixTrack('Lead Vocal.wav', audio(1), 0);
    const second = createMixTrack('Guitar.aiff', audio(1), 2);

    expect(first.id).toBe('123-8');
    expect(first.name).toBe('Lead Vocal');
    expect(first.offsetSeconds).toBe(0);
    expect(first.reverbSendDb).toBe(REVERB_SEND_FLOOR);
    expect(first.waveform.length).toBeGreaterThan(0);
    expect(second.name).toBe('Guitar');
    expect(second.offsetSeconds).toBe(4);

    vi.restoreAllMocks();
  });

  it('resets all editable mix track controls to defaults', () => {
    const track = createMixTrack('Track.wav', audio(), 0);
    Object.assign(track, {
      inputTrimDb: 4,
      faderDb: -8,
      pan: 0.7,
      width: 1.5,
      panLaw: 2,
      panMode: 1,
      dualPanLeft: -0.5,
      dualPanRight: 0.5,
      channelDelayMs: 20,
      eqEnabled: true,
      eqTiltDb: 2,
      eqAirDb: 3,
      reverbSendDb: -6,
      vcaGroup: 'A',
      automation: [{ id: 'a', param: 'fader', timeSec: 1, value: -3, curve: 'linear' }],
      offsetSeconds: 3,
      muted: true,
      soloed: true,
      soloSafe: true,
      polarityLeft: true,
      polarityRight: true,
    });

    resetMixTrack(track);

    expect(track).toMatchObject({
      inputTrimDb: 0,
      faderDb: 0,
      pan: 0,
      width: 1,
      panLaw: 0,
      panMode: 0,
      dualPanLeft: -1,
      dualPanRight: 1,
      channelDelayMs: 0,
      eqEnabled: false,
      eqTiltDb: 0,
      eqAirDb: 0,
      reverbSendDb: REVERB_SEND_FLOOR,
      vcaGroup: '',
      automation: [],
      offsetSeconds: 0,
      muted: false,
      soloed: false,
      soloSafe: false,
      polarityLeft: false,
      polarityRight: false,
    });
  });

  it('applies scene settings with clamps and sanitized automation', () => {
    vi.spyOn(Date, 'now').mockReturnValue(456);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const track = createMixTrack('Scene.wav', audio(10), 0);

    applySceneTrack(track, {
      id: track.id,
      name: 'Imported',
      inputTrimDb: 99,
      faderDb: -99,
      pan: 2,
      width: 9,
      panLaw: 99,
      panMode: 99,
      dualPanLeft: -9,
      dualPanRight: 9,
      channelDelayMs: 99,
      eqEnabled: true,
      eqTiltDb: -99,
      eqAirDb: 99,
      reverbSendDb: -99,
      vcaGroup: 'A',
      automation: [
        { id: 'old', param: 'fader', timeSec: -1, value: -99, curve: 'bad' as never },
        { id: 'old2', param: 'pan', timeSec: 2, value: 9, curve: 's-curve' },
        { id: 'old3', param: 'unknown' as never, timeSec: 1, value: 0, curve: 'linear' },
      ],
      offsetSeconds: 999,
      muted: true,
      soloed: true,
      soloSafe: true,
      polarityLeft: true,
      polarityRight: false,
    });

    expect(track).toMatchObject({
      name: 'Imported',
      inputTrimDb: 24,
      faderDb: -60,
      pan: 1,
      width: 2,
      panLaw: 3,
      panMode: 2,
      dualPanLeft: -1,
      dualPanRight: 1,
      channelDelayMs: 50,
      eqEnabled: true,
      eqTiltDb: -12,
      eqAirDb: 12,
      reverbSendDb: REVERB_SEND_FLOOR,
      vcaGroup: 'A',
      offsetSeconds: MAX_DURATION_SECONDS - track.audio.duration,
      muted: true,
      soloed: true,
      soloSafe: true,
      polarityLeft: true,
      polarityRight: false,
    });
    expect(track.automation).toHaveLength(2);
    expect(track.automation[0]).toMatchObject({
      id: '456-4',
      param: 'fader',
      timeSec: 0,
      value: -60,
      curve: 'linear',
    });
    expect(track.automation[1]).toMatchObject({
      param: 'pan',
      timeSec: 2,
      value: 1,
      curve: 's-curve',
    });

    vi.restoreAllMocks();
  });

  it('serializes scene tracks and render tracks without sharing audio buffers', () => {
    const track = createMixTrack('Render.wav', audio(1, 1_000), 0);
    track.channelDelayMs = 12.4;
    track.automation = [
      { id: 'late', param: 'pan', timeSec: 3, value: 0.5, curve: 'hold' },
      { id: 'early', param: 'fader', timeSec: 1, value: -6, curve: 'linear' },
    ];

    const sceneTrack = toSceneTrack(track);
    expect(sceneTrack.automation).not.toBe(track.automation);
    expect(sceneTrack.automation?.[0]).not.toBe(track.automation[0]);

    const render = toRenderTrack(track);
    expect(render.left).toEqual(track.audio.left);
    expect(render.left).not.toBe(track.audio.left);
    expect(render.right).not.toBe(track.audio.right);
    expect(render.channelDelaySamples).toBe(12);
    expect(render.automation).toEqual([
      { param: 'fader', timeSec: 1, value: -6, curve: 'linear' },
      { param: 'pan', timeSec: 3, value: 0.5, curve: 'hold' },
    ]);

    const strip = toSceneStrip(track);
    expect(strip.channelDelaySamples).toBe(12);
  });

  it('builds current scene json with VCA groups and computes gates from mute/solo state', () => {
    const a = createMixTrack('A.wav', audio(), 0);
    const b = createMixTrack('B.wav', audio(), 1);
    a.vcaGroup = 'A';
    b.vcaGroup = 'B';
    b.muted = true;

    expect(currentGates([a, b])).toEqual([true, false]);

    b.soloSafe = true;
    a.soloed = true;
    expect(currentGates([a, b])).toEqual([true, true]);

    const scene = JSON.parse(
      buildCurrentSceneJson(
        [a, b],
        { enabled: true, decaySec: 3, preDelayMs: 30 },
        { A: -2, B: 1, C: 0 },
      ),
    );
    expect(scene.strips).toHaveLength(2);
    expect(scene.vcaGroups).toEqual(
      expect.arrayContaining([
        { id: 'A', gainDb: -2, members: [a.id] },
        { id: 'B', gainDb: 1, members: [b.id] },
      ]),
    );
  });
});
