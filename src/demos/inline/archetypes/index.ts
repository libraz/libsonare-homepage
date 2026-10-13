import { defineDemoAsync } from '@/components/defineDemoAsync';
import type { DemoArchetype } from '@/demos/inline/types';

export const demoArchetypeComponents = {
  transcribe: defineDemoAsync(() => import('./TranscribeDemo.vue')),
  transform: defineDemoAsync(() => import('./TransformDemo.vue')),
  detector: defineDemoAsync(() => import('./DetectorDemo.vue')),
  'ab-process': defineDemoAsync(() => import('./AbProcessDemo.vue')),
  'param-sweep': defineDemoAsync(() => import('./ParamSweepDemo.vue')),
  meters: defineDemoAsync(() => import('./MetersDemo.vue')),
  signal: defineDemoAsync(() => import('./SignalDemo.vue')),
  synth: defineDemoAsync(() => import('./SynthDemo.vue')),
  room: defineDemoAsync(() => import('./RoomDemo.vue')),
  contour: defineDemoAsync(() => import('./ContourDemo.vue')),
  'lane-mixer': defineDemoAsync(() => import('./LaneMixerDemo.vue')),
  'spectral-edit': defineDemoAsync(() => import('./SpectralEditDemo.vue')),
  'piano-roll': defineDemoAsync(() => import('./PianoRollDemo.vue')),
  score: defineDemoAsync(() => import('./ScoreDemo.vue')),
  compressor: defineDemoAsync(() => import('./CompressorDemo.vue')),
  'true-peak': defineDemoAsync(() => import('./TruePeakDemo.vue')),
  'send-routing': defineDemoAsync(() => import('./SendRoutingDemo.vue')),
  'mono-fold': defineDemoAsync(() => import('./MonoFoldDemo.vue')),
  comping: defineDemoAsync(() => import('./CompingDemo.vue')),
  hpss: defineDemoAsync(() => import('./HpssDemo.vue')),
  'tempo-grid': defineDemoAsync(() => import('./TempoGridDemo.vue')),
  'instrument-audition': defineDemoAsync(() => import('./InstrumentAuditionDemo.vue')),
  'pitch-correct': defineDemoAsync(() => import('./PitchCorrectDemo.vue')),
  'chord-track': defineDemoAsync(() => import('./ChordTrackDemo.vue')),
  'channel-downmix': defineDemoAsync(() => import('./ChannelDownmixDemo.vue')),
  'pan-law': defineDemoAsync(() => import('./PanLawDemo.vue')),
  'fm-sidebands': defineDemoAsync(() => import('./FmSidebandsDemo.vue')),
  limiter: defineDemoAsync(() => import('./LimiterDemo.vue')),
  ducking: defineDemoAsync(() => import('./DuckingDemo.vue')),
  'clarity-split': defineDemoAsync(() => import('./ClaritySplitDemo.vue')),
  tempogram: defineDemoAsync(() => import('./TempogramDemo.vue')),
} satisfies Record<DemoArchetype, ReturnType<typeof defineDemoAsync>>;

export function implementedDemoArchetypes(): DemoArchetype[] {
  return Object.keys(demoArchetypeComponents) as DemoArchetype[];
}
