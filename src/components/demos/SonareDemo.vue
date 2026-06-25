<script setup lang="ts">
/**
 * Dispatcher for inline documentation demos.
 *
 * Markdown uses only `<SonareDemo id="..." />`. This component resolves the id to a
 * registry definition, lazily activates when scrolled into view (so WASM is not
 * loaded on every doc page), and renders the matching archetype component.
 *
 * Archetype components own their visuals; this dispatcher owns resolution + gating.
 */
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { getDemo } from '@/demos/registry';
import type { DemoArchetype } from '@/demos/types';

const props = defineProps<{ id: string }>();

const def = computed(() => getDemo(props.id));

/** Becomes true once the widget scrolls near the viewport; gates WASM/work. */
const active = ref(false);
const rootEl = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    active.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        active.value = true;
        observer?.disconnect();
        observer = null;
      }
    },
    { rootMargin: '200px' },
  );
  if (rootEl.value) observer.observe(rootEl.value);
});

onBeforeUnmount(() => observer?.disconnect());

// Archetype → component. Async so each archetype is code-split and only the ones
// used on a page are fetched. Unimplemented archetypes fall back to a placeholder.
const archetypeComponents: Partial<Record<DemoArchetype, ReturnType<typeof defineAsyncComponent>>> =
  {
    transform: defineAsyncComponent(() => import('./archetypes/TransformDemo.vue')),
    detector: defineAsyncComponent(() => import('./archetypes/DetectorDemo.vue')),
    'ab-process': defineAsyncComponent(() => import('./archetypes/AbProcessDemo.vue')),
    'param-sweep': defineAsyncComponent(() => import('./archetypes/ParamSweepDemo.vue')),
    meters: defineAsyncComponent(() => import('./archetypes/MetersDemo.vue')),
    signal: defineAsyncComponent(() => import('./archetypes/SignalDemo.vue')),
    synth: defineAsyncComponent(() => import('./archetypes/SynthDemo.vue')),
    room: defineAsyncComponent(() => import('./archetypes/RoomDemo.vue')),
    contour: defineAsyncComponent(() => import('./archetypes/ContourDemo.vue')),
    'lane-mixer': defineAsyncComponent(() => import('./archetypes/LaneMixerDemo.vue')),
    'spectral-edit': defineAsyncComponent(() => import('./archetypes/SpectralEditDemo.vue')),
  };

const archetypeComponent = computed(() =>
  def.value ? archetypeComponents[def.value.archetype] : undefined,
);
</script>

<template>
  <div ref="rootEl" class="sonare-demo">
    <div v-if="!def" class="sonare-demo__error">
      Unknown demo id: <code>{{ id }}</code>
    </div>
    <component
      :is="archetypeComponent"
      v-else-if="archetypeComponent"
      :def="def"
      :active="active"
    />
    <div v-else class="sonare-demo__error">
      Archetype not yet implemented: <code>{{ def.archetype }}</code> ({{ id }})
    </div>
  </div>
</template>

<style scoped>
/* Structural only — visual design is layered on by the design system. */
.sonare-demo {
  margin: 1.5rem 0;
}
.sonare-demo__error {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--vp-c-warning-1, #d97706);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--vp-c-warning-1, #d97706);
}
</style>
