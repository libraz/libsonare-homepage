import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { createMixBounceController } from '@/components/mixing/mixingBounce';
import {
  AUTOMATION_CURVES,
  AUTOMATION_PARAM_IDS,
  AUTOMATION_RANGES,
  MAX_DURATION_SECONDS,
  MAX_TRACKS,
  REVERB_SEND_FLOOR,
  VCA_GROUP_IDS,
} from '@/components/mixing/mixingConstants';
import { enCopy, jaCopy } from '@/components/mixing/mixingCopy';
import { MIXING_TERM_SLUGS, type MixingTermKey } from '@/components/mixing/mixingTerms';
import {
  applySceneTrack,
  buildCurrentSceneJson,
  createMixTrack,
  currentGates,
  resetMixTrack,
  toRenderTrack,
  toSceneTrack,
} from '@/components/mixing/mixingTrackState';
import type { AutomationNode, MixTrack, SceneTrackSettings } from '@/components/mixing/mixingTypes';
import { goniometerPoints, meterHeight, waveformPath } from '@/components/mixing/mixingVisuals';
import { useI18n } from '@/composables/useI18n';
import { useRealtimeMixer } from '@/composables/useRealtimeMixer';
import {
  calculatePeakRms,
  decodeAudioFile,
  encodeWavStereo,
  formatDb,
  formatDuration,
  formatSampleRate,
} from '@/utils/audio';
import { clamp, dbToLinear, invertedRangeToPercent } from '@/utils/scale';
import sonareJsUrl from '@/wasm/sonare.js?url';
import sonareWasmUrl from '@/wasm/sonare.wasm?url';
import type {
  AutomationCurve,
  AutomationParam,
  MixingBounceResult,
  StripMeter,
} from '@/workers/mixing.worker';

export function useMixingStudio() {
  const { locale } = useI18n();
  const copy = computed(() => (locale.value === 'ja' ? jaCopy : enCopy));
  const libVersion = ref('');
  const tracks = ref<MixTrack[]>([]);
  const selectedTrackId = ref<string | null>(null);
  const masterFaderDb = ref(0);
  const reverb = ref({ enabled: false, decaySec: 2.2, preDelayMs: 20 });
  const vcaGains = ref<Record<string, number>>({ A: 0, B: 0, C: 0 });
  const automationParam = ref<AutomationParam>('fader');
  const automationCurve = ref<AutomationCurve>('linear');
  const automationDrag = ref<{ trackId: string; pointId: string } | null>(null);

  const isLoading = ref(false);
  const isBouncing = ref(false);
  const progress = ref(0);
  const progressStage = ref('');
  const localError = ref<string | null>(null);
  const warning = ref<string | null>(null);
  const bounceResult = shallowRef<MixingBounceResult | null>(null);
  const outputUrl = ref<string | null>(null);
  const fileInput = ref<HTMLInputElement | null>(null);
  const sceneInput = ref<HTMLInputElement | null>(null);
  const timelineRef = ref<HTMLElement | null>(null);
  const autoLaneRef = ref<HTMLElement | null>(null);
  const zoomSeconds = ref(300);
  const playheadSeconds = ref(0);
  const isPlaying = ref(false);

  let audioContext: AudioContext | null = null;
  const bounceController = createMixBounceController();
  let sceneUrl: string | null = null;
  let previewSources: AudioBufferSourceNode[] = [];
  let previewStartedAt = 0;
  let previewStartPosition = 0;
  let playheadRaf = 0;
  let activeDrag: { trackId: string; startX: number; startOffset: number } | null = null;

  const docsPath = computed(() => (locale.value === 'ja' ? '/ja/docs/mixing' : '/docs/mixing'));
  const oppositeLocalePath = computed(() => (locale.value === 'ja' ? '/mixing' : '/ja/mixing'));

  const glossaryBase = computed(() =>
    locale.value === 'ja' ? '/ja/docs/glossary' : '/docs/glossary',
  );

  function term(key: MixingTermKey, compact = false) {
    const item = copy.value.terms.items[key];
    const slug = MIXING_TERM_SLUGS[key];
    return {
      eyebrow: copy.value.terms.eyebrow,
      title: item.title,
      body: item.body,
      tip: item.tip,
      tipLabel: copy.value.terms.tipLabel,
      defaultValue: 'default' in item ? (item as { default?: string }).default : undefined,
      defaultLabel: copy.value.terms.defaultLabel,
      href: slug ? `${glossaryBase.value}/${slug}` : undefined,
      linkLabel: copy.value.terms.linkLabel,
      compact,
    };
  }

  const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
    if (localError.value) return 'error';
    if (warning.value) return 'warning';
    if (tracks.value.length || isBouncing.value) return 'active';
    return 'idle';
  });

  const statusLabel = computed(() => {
    if (isBouncing.value) return copy.value.status.bouncing;
    if (tracks.value.length) return copy.value.status.ready;
    return copy.value.status.idle;
  });

  const selectedTrack = computed(
    () =>
      tracks.value.find((track) => track.id === selectedTrackId.value) || tracks.value[0] || null,
  );
  const slots = computed<Array<MixTrack | null>>(() => {
    const next: Array<MixTrack | null> = [...tracks.value];
    while (next.length < MAX_TRACKS) next.push(null);
    return next.slice(0, MAX_TRACKS);
  });

  const loadedDuration = computed(() =>
    tracks.value.reduce(
      (max, track) => Math.max(max, track.offsetSeconds + track.audio.duration),
      0,
    ),
  );
  const timelineDuration = computed(() =>
    Math.max(10, Math.min(MAX_DURATION_SECONDS, Math.max(loadedDuration.value, zoomSeconds.value))),
  );
  const timelineTicks = computed(() => {
    const duration = timelineDuration.value;
    const step = duration <= 30 ? 5 : duration <= 90 ? 10 : duration <= 180 ? 15 : 30;
    const ticks: Array<{ time: number; label: string; left: number }> = [];
    for (let time = 0; time <= duration + 0.01; time += step) {
      ticks.push({ time, label: formatDuration(time), left: timeToPercent(time) });
    }
    return ticks;
  });
  const sampleRateLabel = computed(() =>
    tracks.value[0] ? formatSampleRate(tracks.value[0].audio.sampleRate) : '-',
  );
  const memoryEstimateMb = computed(() => {
    const bytes = tracks.value.reduce(
      (sum, track) => sum + (track.audio.left.byteLength + track.audio.right.byteLength),
      0,
    );
    return bytes / 1024 / 1024;
  });

  const statusFields = computed(() => [
    { key: 'TRACKS', value: `${tracks.value.length}/${MAX_TRACKS}` },
    { key: 'LIMIT', value: '5:00' },
    { key: 'LEN', value: tracks.value.length ? formatDuration(loadedDuration.value) : '--:--' },
    { key: 'SR', value: sampleRateLabel.value },
    { key: 'MEM', value: `${memoryEstimateMb.value.toFixed(0)} MB` },
    { key: 'PEAK', value: bounceResult.value ? formatDb(bounceResult.value.peakDb) : '-' },
    { key: 'RMS', value: bounceResult.value ? formatDb(bounceResult.value.rmsDb) : '-' },
  ]);

  const stripMeterMap = computed(() => {
    const map = new Map<string, StripMeter>();
    for (const meter of bounceResult.value?.stripMeters || []) map.set(meter.id, meter);
    return map;
  });

  const selectedMeter = computed(() =>
    selectedTrack.value ? stripMeterMap.value.get(selectedTrack.value.id) || null : null,
  );

  const masterMonoCompatible = computed(() =>
    bounceResult.value ? bounceResult.value.correlation > -0.2 : true,
  );

  function stripMeterFor(track: MixTrack | null): StripMeter | null {
    return track ? stripMeterMap.value.get(track.id) || null : null;
  }

  onMounted(() => {
    const ric = (window as any).requestIdleCallback;
    if (ric) ric(initWasmVersion, { timeout: 2000 });
    else setTimeout(initWasmVersion, 100);
  });

  onUnmounted(() => {
    bounceController.dispose();
    revokeOutputUrl();
    if (sceneUrl) URL.revokeObjectURL(sceneUrl);
    stopPreview();
    void realtime.dispose();
  });

  async function initWasmVersion() {
    if (libVersion.value || typeof window === 'undefined') return;
    try {
      const wasm = await import('@/wasm/index.js');
      await wasm.init();
      libVersion.value = wasm.version();
    } catch (error) {
      console.warn('Failed to initialize WASM version:', error);
    }
  }

  function chooseFiles() {
    fileInput.value?.click();
  }

  async function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    await addFiles(input.files);
    input.value = '';
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    await addFiles(event.dataTransfer?.files || null);
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    localError.value = null;
    warning.value = null;
    isLoading.value = true;

    try {
      for (const file of Array.from(fileList)) {
        if (tracks.value.length >= MAX_TRACKS) {
          warning.value = copy.value.warnings.trackLimit;
          break;
        }

        const audio = await decodeAudioFile(file, getAudioContext());
        if (audio.duration > MAX_DURATION_SECONDS) {
          warning.value = copy.value.warnings.durationLimit.replace('{file}', file.name);
          continue;
        }

        const track = createMixTrack(file.name, audio, tracks.value.length);
        tracks.value.push(track);
        selectedTrackId.value = track.id;
      }

      if (memoryEstimateMb.value > 650) warning.value = copy.value.warnings.memory;
    } catch (error) {
      console.error(error);
      localError.value = copy.value.errors.loadFailed;
    } finally {
      isLoading.value = false;
    }
  }

  // Split a clip into two complementary frequency bands with a one-pole
  // crossover (high = original - low), so the bands sum back to the source at
  // unity. Cheap O(n) per channel — no STFT/WASM needed for the demo.
  function splitBands(samples: Float32Array, sampleRate: number, crossoverHz: number) {
    const coeff = 1 - Math.exp((-2 * Math.PI * crossoverHz) / sampleRate);
    const low = new Float32Array(samples.length);
    const high = new Float32Array(samples.length);
    let state = 0;
    for (let i = 0; i < samples.length; i++) {
      state += coeff * (samples[i] - state);
      low[i] = state;
      high[i] = samples[i] - state;
    }
    return { low, high };
  }

  async function loadDemo() {
    if (tracks.value.length) return;
    localError.value = null;
    warning.value = null;
    isLoading.value = true;
    try {
      const response = await fetch('/demo.mp3');
      const blob = await response.blob();
      const file = new File([blob], 'demo.mp3', { type: blob.type || 'audio/mpeg' });
      const audio = await decodeAudioFile(file, getAudioContext());
      const crossoverHz = 250;
      const leftBands = splitBands(audio.left, audio.sampleRate, crossoverHz);
      const rightBands = splitBands(audio.right, audio.sampleRate, crossoverHz);
      const base = {
        sampleRate: audio.sampleRate,
        duration: audio.duration,
        channels: audio.channels,
      };
      const lowAudio = {
        ...base,
        fileName: copy.value.import.demoLow,
        left: leftBands.low,
        right: rightBands.low,
      };
      const highAudio = {
        ...base,
        fileName: copy.value.import.demoHigh,
        left: leftBands.high,
        right: rightBands.high,
      };
      tracks.value.push(createMixTrack(copy.value.import.demoLow, lowAudio, 0));
      tracks.value.push(createMixTrack(copy.value.import.demoHigh, highAudio, 0));
      selectedTrackId.value = tracks.value[0]?.id || null;
    } catch (error) {
      console.error(error);
      localError.value = copy.value.errors.loadFailed;
    } finally {
      isLoading.value = false;
    }
  }

  function removeTrack(track: MixTrack) {
    tracks.value = tracks.value.filter((candidate) => candidate.id !== track.id);
    if (selectedTrackId.value === track.id) selectedTrackId.value = tracks.value[0]?.id || null;
    bounceResult.value = null;
    revokeOutputUrl();
  }

  function resetTrack(track: MixTrack) {
    resetMixTrack(track);
  }

  async function bounceMix() {
    if (!tracks.value.length || isBouncing.value) return;
    isBouncing.value = true;
    localError.value = null;
    progress.value = 0.01;
    progressStage.value = copy.value.progress.queued;
    revokeOutputUrl();

    const renderTracks = tracks.value.map(toRenderTrack);

    await bounceController
      .bounce({
        sampleRate: tracks.value[0]?.audio.sampleRate || 48000,
        masterFaderDb: masterFaderDb.value,
        tracks: renderTracks,
        reverb: { ...reverb.value },
        vcaGroups: VCA_GROUP_IDS.map((id) => ({ id, gainDb: vcaGains.value[id] })),
        onProgress: (nextProgress, stage) => {
          progress.value = nextProgress;
          progressStage.value = formatStage(stage);
        },
      })
      .then((result) => {
        bounceResult.value = result;
        const wav = encodeWavStereo(result.left, result.right, result.sampleRate);
        outputUrl.value = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        progress.value = 1;
        progressStage.value = copy.value.progress.complete;
      })
      .catch((error) => {
        console.error(error);
        localError.value = copy.value.errors.bounceFailed;
      })
      .finally(() => {
        isBouncing.value = false;
      });
  }

  function downloadMix() {
    if (!outputUrl.value) return;
    const anchor = document.createElement('a');
    anchor.href = outputUrl.value;
    anchor.download = 'libsonare-mix.wav';
    anchor.click();
  }

  function exportScene() {
    if (sceneUrl) URL.revokeObjectURL(sceneUrl);
    const scene = {
      version: 1,
      masterFaderDb: masterFaderDb.value,
      reverb: { ...reverb.value },
      vcaGains: { ...vcaGains.value },
      tracks: tracks.value.map(toSceneTrack),
    };
    sceneUrl = URL.createObjectURL(
      new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = sceneUrl;
    anchor.download = 'libsonare-mix-scene.json';
    anchor.click();
  }

  function chooseScene() {
    sceneInput.value?.click();
  }

  async function importScene(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const scene = JSON.parse(await file.text()) as {
        masterFaderDb?: number;
        reverb?: { enabled?: boolean; decaySec?: number; preDelayMs?: number };
        vcaGains?: Record<string, number>;
        tracks?: SceneTrackSettings[];
      };
      masterFaderDb.value = clamp(scene.masterFaderDb ?? 0, -24, 12);
      if (scene.reverb) {
        reverb.value = {
          enabled: Boolean(scene.reverb.enabled),
          decaySec: clamp(scene.reverb.decaySec ?? 2.2, 0.2, 8),
          preDelayMs: clamp(scene.reverb.preDelayMs ?? 20, 0, 120),
        };
      }
      if (scene.vcaGains) {
        for (const id of VCA_GROUP_IDS) {
          if (typeof scene.vcaGains[id] === 'number')
            vcaGains.value[id] = clamp(scene.vcaGains[id], -24, 12);
        }
      }
      for (const setting of scene.tracks || []) {
        const track = tracks.value.find(
          (candidate) => candidate.id === setting.id || candidate.name === setting.name,
        );
        if (!track) continue;
        applySceneTrack(track, setting);
      }
    } catch (error) {
      console.error(error);
      localError.value = copy.value.errors.sceneFailed;
    }
  }

  const automationRange = computed(() => AUTOMATION_RANGES[automationParam.value]);

  const selectedAutomation = computed(() => {
    if (!selectedTrack.value) return [] as AutomationNode[];
    return selectedTrack.value.automation
      .filter((point) => point.param === automationParam.value)
      .sort((a, b) => a.timeSec - b.timeSec);
  });

  const automationPath = computed(() => {
    const points = selectedAutomation.value;
    if (!points.length) return '';
    return points
      .map(
        (point) =>
          `${timeToPercent(point.timeSec).toFixed(2)},${automationValueToY(point.value).toFixed(2)}`,
      )
      .join(' ');
  });

  function automationValueToY(value: number): number {
    const { min, max } = automationRange.value;
    return invertedRangeToPercent(value, min, max);
  }

  function automationLaneMetrics(event: MouseEvent) {
    const host = autoLaneRef.value;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const ratioX = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const ratioY = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    const { min, max } = automationRange.value;
    return {
      timeSec: ratioX * timelineDuration.value,
      value: clamp(min + (1 - ratioY) * (max - min), min, max),
    };
  }

  function addAutomationPoint(event: MouseEvent) {
    if (!selectedTrack.value) return;
    const metrics = automationLaneMetrics(event);
    if (!metrics) return;
    selectedTrack.value.automation.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      param: automationParam.value,
      timeSec: metrics.timeSec,
      value: metrics.value,
      curve: automationCurve.value,
    });
    bounceResult.value = null;
    revokeOutputUrl();
  }

  function startAutomationDrag(event: PointerEvent, point: AutomationNode) {
    event.stopPropagation();
    if (!selectedTrack.value) return;
    automationDrag.value = { trackId: selectedTrack.value.id, pointId: point.id };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function dragAutomationPoint(event: PointerEvent) {
    if (!automationDrag.value || !selectedTrack.value) return;
    const point = selectedTrack.value.automation.find(
      (candidate) => candidate.id === automationDrag.value?.pointId,
    );
    if (!point) return;
    const metrics = automationLaneMetrics(event);
    if (!metrics) return;
    point.timeSec = metrics.timeSec;
    point.value = metrics.value;
    bounceResult.value = null;
    revokeOutputUrl();
  }

  function endAutomationDrag() {
    automationDrag.value = null;
  }

  function removeAutomationPoint(event: Event, point: AutomationNode) {
    event.stopPropagation();
    if (!selectedTrack.value) return;
    selectedTrack.value.automation = selectedTrack.value.automation.filter(
      (candidate) => candidate.id !== point.id,
    );
    bounceResult.value = null;
    revokeOutputUrl();
  }

  function clearAutomation() {
    if (!selectedTrack.value) return;
    selectedTrack.value.automation = selectedTrack.value.automation.filter(
      (point) => point.param !== automationParam.value,
    );
    bounceResult.value = null;
    revokeOutputUrl();
  }

  function formatAutomationValue(point: AutomationNode): string {
    if (point.param === 'fader') return `${point.value.toFixed(1)} dB`;
    if (point.param === 'pan') return point.value.toFixed(2);
    return `${Math.round(point.value * 100)}%`;
  }

  function revokeOutputUrl() {
    if (outputUrl.value) URL.revokeObjectURL(outputUrl.value);
    outputUrl.value = null;
  }

  function getAudioContext(): AudioContext {
    if (!audioContext) audioContext = new AudioContext();
    return audioContext;
  }

  const realtime = useRealtimeMixer(sonareJsUrl, sonareWasmUrl);
  let realtimeActive = false;

  function currentSceneJson(): string {
    return buildCurrentSceneJson(tracks.value, reverb.value, vcaGains.value);
  }

  function currentGateValues(): boolean[] {
    return currentGates(tracks.value);
  }

  // Mirror the realtime worklet's reported position onto the timeline playhead.
  watch(
    () => realtime.positionSec.value,
    (sec) => {
      if (realtimeActive && realtime.playing.value)
        playheadSeconds.value = clamp(sec, 0, timelineDuration.value);
    },
  );
  watch(
    () => realtime.playing.value,
    (value) => {
      isPlaying.value = value;
    },
  );

  // Live updates while playing: rebuild scene / gates / master gain in the worklet.
  watch(
    () => (realtimeActive && realtime.playing.value ? currentSceneJson() : null),
    (json) => {
      if (json) realtime.updateScene(json);
    },
  );
  watch(
    () => (realtimeActive && realtime.playing.value ? currentGateValues().join(',') : null),
    () => {
      if (realtimeActive && realtime.playing.value) realtime.updateGates(currentGateValues());
    },
  );
  watch(
    () => masterFaderDb.value,
    (db) => {
      if (realtimeActive && realtime.playing.value) realtime.updateMasterGain(dbToLinear(db));
    },
  );

  async function togglePreview() {
    if (isPlaying.value) {
      stopPreview();
      return;
    }
    await startPreview();
  }

  async function startRealtime(): Promise<boolean> {
    if (!tracks.value.length) return false;
    const sampleRate = tracks.value[0]?.audio.sampleRate || 48000;
    const totalFrames = Math.round(loadedDuration.value * sampleRate);
    const startFrame = Math.round(playheadSeconds.value * sampleRate);
    const strips = tracks.value.map((track) => ({
      left: track.audio.left,
      right: track.audio.right,
      offsetFrames: Math.round(track.offsetSeconds * sampleRate),
    }));
    try {
      realtimeActive = true;
      await realtime.start(
        {
          sceneJson: currentSceneJson(),
          sampleRate,
          masterGain: dbToLinear(masterFaderDb.value),
          startFrame,
          totalFrames,
          strips,
          gates: currentGateValues(),
        },
        () => {
          realtimeActive = false;
        },
      );
      return true;
    } catch (error) {
      console.warn('Realtime mixer unavailable, falling back to node preview:', error);
      realtimeActive = false;
      return false;
    }
  }

  async function startPreview() {
    if (!tracks.value.length) return;
    stopPreview();
    // Prefer the WASM realtime mixer (reflects EQ/reverb/sends/VCA); fall back to plain nodes.
    if (await startRealtime()) return;
    const context = getAudioContext();
    if (context.state === 'suspended') await context.resume();
    const soloActive = tracks.value.some((track) => track.soloed);
    const startAt = context.currentTime + 0.04;
    previewStartPosition = playheadSeconds.value;
    previewStartedAt = startAt;

    for (const track of tracks.value) {
      if (soloActive ? !track.soloed : track.muted) continue;
      const clipStart = track.offsetSeconds;
      const clipEnd = track.offsetSeconds + track.audio.duration;
      if (clipEnd <= previewStartPosition) continue;

      const buffer = context.createBuffer(2, track.audio.left.length, track.audio.sampleRate);
      buffer.copyToChannel(track.audio.left, 0);
      buffer.copyToChannel(track.audio.right, 1);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      source.buffer = buffer;
      gain.gain.value = dbToLinear(track.inputTrimDb + track.faderDb);
      pan.pan.value = track.pan;
      source.connect(gain).connect(pan).connect(context.destination);

      const sourceOffset = Math.max(0, previewStartPosition - clipStart);
      const when = startAt + Math.max(0, clipStart - previewStartPosition);
      source.start(when, sourceOffset);
      source.onended = () => {
        previewSources = previewSources.filter((candidate) => candidate !== source);
        if (isPlaying.value && previewSources.length === 0) stopPreview();
      };
      previewSources.push(source);
    }

    isPlaying.value = previewSources.length > 0;
    if (isPlaying.value) tickPlayhead();
  }

  function stopPreview(resetSources = true) {
    if (realtimeActive) {
      realtime.stop();
      realtimeActive = false;
    }
    for (const source of previewSources) {
      try {
        if (resetSources) source.stop();
      } catch {
        // Source may already have ended.
      }
    }
    previewSources = [];
    isPlaying.value = false;
    if (playheadRaf) cancelAnimationFrame(playheadRaf);
    playheadRaf = 0;
  }

  function tickPlayhead() {
    if (!isPlaying.value || !audioContext) return;
    playheadSeconds.value = clamp(
      previewStartPosition + audioContext.currentTime - previewStartedAt,
      0,
      timelineDuration.value,
    );
    if (playheadSeconds.value >= loadedDuration.value) {
      stopPreview();
      return;
    }
    playheadRaf = requestAnimationFrame(tickPlayhead);
  }

  function seekTimeline(event: MouseEvent) {
    if (!timelineRef.value) return;
    const rect = timelineRef.value.getBoundingClientRect();
    const timelineLeft = rect.left + 140;
    const timelineWidth = Math.max(1, rect.width - 140);
    const position = clamp((event.clientX - timelineLeft) / timelineWidth, 0, 1);
    playheadSeconds.value = position * timelineDuration.value;
    if (realtimeActive && realtime.playing.value) {
      realtime.seek(
        Math.round(playheadSeconds.value * (tracks.value[0]?.audio.sampleRate || 48000)),
      );
    } else if (isPlaying.value) {
      void startPreview();
    }
  }

  function startClipDrag(event: PointerEvent, track: MixTrack) {
    if (!timelineRef.value) return;
    selectedTrackId.value = track.id;
    activeDrag = { trackId: track.id, startX: event.clientX, startOffset: track.offsetSeconds };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function dragClip(event: PointerEvent) {
    if (!activeDrag || !timelineRef.value) return;
    const track = tracks.value.find((candidate) => candidate.id === activeDrag?.trackId);
    if (!track) return;
    const rect = timelineRef.value.getBoundingClientRect();
    const deltaSeconds =
      ((event.clientX - activeDrag.startX) / Math.max(1, rect.width - 140)) *
      timelineDuration.value;
    track.offsetSeconds = clamp(
      roundToGrid(activeDrag.startOffset + deltaSeconds),
      0,
      Math.max(0, MAX_DURATION_SECONDS - track.audio.duration),
    );
    bounceResult.value = null;
    revokeOutputUrl();
  }

  function endClipDrag() {
    activeDrag = null;
  }

  function clipStyle(track: MixTrack) {
    return {
      left: `${timeToPercent(track.offsetSeconds)}%`,
      width: `${Math.max(0.8, (track.audio.duration / timelineDuration.value) * 100)}%`,
    };
  }

  function playheadStyle() {
    return {
      '--playhead-position': `${timeToPercent(playheadSeconds.value)}%`,
    };
  }

  function timeToPercent(time: number): number {
    return clamp((time / timelineDuration.value) * 100, 0, 100);
  }

  function roundToGrid(value: number): number {
    const grid = timelineDuration.value <= 60 ? 0.1 : 0.25;
    return Math.round(value / grid) * grid;
  }

  function formatStage(stage: string): string {
    return copy.value.stages[stage] || stage;
  }

  function trackLevels(track: MixTrack) {
    const levels = calculatePeakRms(track.audio.left, track.audio.right);
    return {
      peak: formatDb(levels.peakDb),
      rms: formatDb(levels.rmsDb),
    };
  }

  return {
    MAX_TRACKS,
    MAX_DURATION_SECONDS,
    REVERB_SEND_FLOOR,
    VCA_GROUP_IDS,
    AUTOMATION_CURVES,
    AUTOMATION_PARAM_IDS,
    copy,
    libVersion,
    tracks,
    selectedTrackId,
    masterFaderDb,
    reverb,
    vcaGains,
    automationParam,
    automationCurve,
    isLoading,
    isBouncing,
    progress,
    progressStage,
    localError,
    warning,
    bounceResult,
    outputUrl,
    fileInput,
    sceneInput,
    timelineRef,
    autoLaneRef,
    zoomSeconds,
    playheadSeconds,
    isPlaying,
    docsPath,
    oppositeLocalePath,
    statusKind,
    statusLabel,
    selectedTrack,
    slots,
    loadedDuration,
    timelineDuration,
    timelineTicks,
    statusFields,
    selectedMeter,
    masterMonoCompatible,
    selectedAutomation,
    automationPath,
    term,
    stripMeterFor,
    meterHeight,
    goniometerPoints,
    chooseFiles,
    handleFileInput,
    handleDrop,
    loadDemo,
    removeTrack,
    resetTrack,
    bounceMix,
    downloadMix,
    exportScene,
    chooseScene,
    importScene,
    automationValueToY,
    addAutomationPoint,
    startAutomationDrag,
    dragAutomationPoint,
    endAutomationDrag,
    removeAutomationPoint,
    clearAutomation,
    formatAutomationValue,
    togglePreview,
    stopPreview,
    seekTimeline,
    startClipDrag,
    dragClip,
    endClipDrag,
    clipStyle,
    playheadStyle,
    timeToPercent,
    trackLevels,
    waveformPath,
    formatDb,
    formatDuration,
    formatSampleRate,
  };
}
