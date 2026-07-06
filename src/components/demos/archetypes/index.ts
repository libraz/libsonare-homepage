import { defineAsyncComponent } from 'vue';
import type { DemoArchetype } from '@/demos/types';

export const demoArchetypeComponents = {
  transform: defineAsyncComponent(() => import('./TransformDemo.vue')),
  detector: defineAsyncComponent(() => import('./DetectorDemo.vue')),
  'ab-process': defineAsyncComponent(() => import('./AbProcessDemo.vue')),
  'param-sweep': defineAsyncComponent(() => import('./ParamSweepDemo.vue')),
  meters: defineAsyncComponent(() => import('./MetersDemo.vue')),
  signal: defineAsyncComponent(() => import('./SignalDemo.vue')),
  synth: defineAsyncComponent(() => import('./SynthDemo.vue')),
  room: defineAsyncComponent(() => import('./RoomDemo.vue')),
  contour: defineAsyncComponent(() => import('./ContourDemo.vue')),
  'lane-mixer': defineAsyncComponent(() => import('./LaneMixerDemo.vue')),
  'spectral-edit': defineAsyncComponent(() => import('./SpectralEditDemo.vue')),
  'piano-roll': defineAsyncComponent(() => import('./PianoRollDemo.vue')),
  score: defineAsyncComponent(() => import('./ScoreDemo.vue')),
  compressor: defineAsyncComponent(() => import('./CompressorDemo.vue')),
  'true-peak': defineAsyncComponent(() => import('./TruePeakDemo.vue')),
  'send-routing': defineAsyncComponent(() => import('./SendRoutingDemo.vue')),
  'mono-fold': defineAsyncComponent(() => import('./MonoFoldDemo.vue')),
  comping: defineAsyncComponent(() => import('./CompingDemo.vue')),
  hpss: defineAsyncComponent(() => import('./HpssDemo.vue')),
  'tempo-grid': defineAsyncComponent(() => import('./TempoGridDemo.vue')),
  'instrument-audition': defineAsyncComponent(() => import('./InstrumentAuditionDemo.vue')),
  'pitch-correct': defineAsyncComponent(() => import('./PitchCorrectDemo.vue')),
} satisfies Record<DemoArchetype, ReturnType<typeof defineAsyncComponent>>;

export function implementedDemoArchetypes(): DemoArchetype[] {
  return Object.keys(demoArchetypeComponents) as DemoArchetype[];
}
